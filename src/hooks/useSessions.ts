import { useState, useEffect, useCallback, useRef } from 'react';
import { XP_SESSION } from '../lib/streakConstants';
import type { StudySession } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'aralko-sessions-local';

/** Parse a session date string to a local YYYY-MM-DD string (timezone-safe) */
function toLocalDateStr(dateStr: string): string {
  // If the date is already YYYY-MM-DD (no time part), use it directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Otherwise it's an ISO timestamp — extract the local date parts
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useSessions(addXP?: (amount: number) => void) {
  const { user } = useAuth();
  const userId = user?.id;

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [hasSessionsData, setHasSessionsData] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  const saveToLocal = useCallback((data: StudySession[]) => {
    if (!userId) return;
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${userId}`, JSON.stringify(data));
  }, [userId]);

  // Use refs so the recursive fetch + event listeners always see latest values
  const cancelledRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const slowRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    cancelledRef.current = false;
    setSessionsLoaded(false);
    setSyncFailed(false);

    if (!userId) {
      setSessions([]);
      setSessionsLoaded(true);
      return;
    }

    // Seed from localStorage immediately so UI isn't empty while network loads
    const local = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${userId}`);
    if (local) {
      try {
        setSessions(JSON.parse(local));
        setHasSessionsData(true);
      } catch {}
    }

    let retryCount = 0;

    const onOnline = () => { if (!cancelledRef.current) scheduleSlowRetry(); };
    const onVisible = () => { if (!cancelledRef.current && document.visibilityState === 'visible') scheduleSlowRetry(); };

    const scheduleSlowRetry = () => {
      if (slowRetryTimerRef.current) clearTimeout(slowRetryTimerRef.current);
      slowRetryTimerRef.current = setTimeout(fetchSessions, 0);
    };

    const startSlowRetries = () => {
      setSyncFailed(true);
      slowRetryTimerRef.current = setTimeout(fetchSessions, 30000);
      window.addEventListener('online', onOnline);
      document.addEventListener('visibilitychange', onVisible);
    };

    const stopSlowRetries = () => {
      setSyncFailed(false);
      if (slowRetryTimerRef.current) clearTimeout(slowRetryTimerRef.current);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };

    const fetchSessions = async () => {
      if (cancelledRef.current) return;

      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', userId)
          .order('id', { ascending: true });

        if (cancelledRef.current) return;

        if (!error && data) {
          const mapped: StudySession[] = data.map(row => ({
            date: row.date,
            minutes: row.minutes,
            activityId: row.activityId,
            activityName: row.activityName
          }));
          setSessions(mapped);
          saveToLocal(mapped);
          setHasSessionsData(true);
          setSessionsLoaded(true);
          stopSlowRetries();
          return;
        }
        console.warn(`Failed to fetch sessions (attempt ${retryCount + 1}/6):`, error?.message);
      } catch (e) {
        if (cancelledRef.current) return;
        console.warn(`Failed to fetch sessions (attempt ${retryCount + 1}/6):`, e);
      }

      // Fast retries (5s apart, up to 6 attempts)
      if (retryCount < 5) {
        retryCount++;
        retryTimerRef.current = setTimeout(fetchSessions, 5000);
        return;
      }

      // All fast retries exhausted — do NOT set sessionsLoaded.
      // Keep retrying slowly in the background.
      startSlowRetries();
    };

    fetchSessions();

    return () => {
      cancelledRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (slowRetryTimerRef.current) clearTimeout(slowRetryTimerRef.current);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, saveToLocal]);

  const addSession = useCallback((session: StudySession) => {
    if (!userId) return;

    // 1. Optimistic update instantly
    setSessions(prev => {
      const next = [...prev, session];
      saveToLocal(next);
      return next;
    });

    // 2. Fire-and-forget Supabase write (does not block UI)
    supabase.from('sessions').insert({
      user_id: userId,
      date: session.date,
      minutes: session.minutes,
      activityId: session.activityId,
      activityName: session.activityName
    }).then(({ error }) => {
      if (error) {
        console.warn('Failed to save session to Supabase:', error.message);
      }
    });

    // 3. Award XP for completing a session (no dedup key — every session counts)
    addXP?.(XP_SESSION);
  }, [saveToLocal, userId, addXP]);

  // Calculate streak from sessions (timezone-safe)
  let streak = 0;
  if (sessions.length > 0) {
    const dates = [...new Set(sessions.map(s => toLocalDateStr(s.date)))].sort().reverse();

    if (dates.length > 0) {
      const today = new Date();
      const todayStr = toLocalDateStr(today.toISOString());

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalDateStr(yesterday.toISOString());

      if (dates[0] === todayStr || dates[0] === yesterdayStr) {
        streak = 1;
        let currentDateStr = dates[0];

        for (let i = 1; i < dates.length; i++) {
          // Compute expected previous day
          const cur = new Date(currentDateStr + 'T12:00:00'); // noon to avoid DST edge
          cur.setDate(cur.getDate() - 1);
          const prevStr = toLocalDateStr(cur.toISOString());

          if (dates[i] === prevStr) {
            streak++;
            currentDateStr = prevStr;
          } else {
            break;
          }
        }
      }
    }
  }

  return {
    sessions,
    sessionsLoaded,
    hasSessionsData,
    syncFailed,
    addSession,
    streak
  };
}

