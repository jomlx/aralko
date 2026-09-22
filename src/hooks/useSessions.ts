import { useState, useEffect, useCallback } from 'react';
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

  const saveToLocal = useCallback((data: StudySession[]) => {
    if (!userId) return;
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${userId}`, JSON.stringify(data));
  }, [userId]);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setSessionsLoaded(true); // No user = nothing to load
      return;
    }

    // Seed from localStorage immediately so UI isn't empty while network loads
    const local = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${userId}`);
    if (local) {
      try { setSessions(JSON.parse(local)); } catch {}
    }

    let data = null;
    let error = null;
    try {
      const res = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });
      data = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }

    if (error || !data) {
      console.warn('Failed to fetch sessions from Supabase. Falling back to local storage.');
      // Keep whatever we already seeded from localStorage
    } else {
      const mapped: StudySession[] = data.map(row => ({
        date: row.date,
        minutes: row.minutes,
        activityId: row.activityId,
        activityName: row.activityName
      }));
      setSessions(mapped);
      saveToLocal(mapped);
    }

    // Mark loaded only AFTER the network attempt completes (success or fallback)
    setSessionsLoaded(true);
  }, [userId, saveToLocal]);

  useEffect(() => {
    setSessionsLoaded(false); // reset on user change
    fetchSessions();
  }, [fetchSessions]);

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
    addXP?.(5);
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
    addSession,
    streak
  };
}
