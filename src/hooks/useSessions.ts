import { useState, useEffect, useCallback } from 'react';
import type { StudySession } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'aralko-sessions-local';

export function useSessions(addXP?: (amount: number) => void) {
  const { user } = useAuth();
  const userId = user?.id;

  const [sessions, setSessions] = useState<StudySession[]>([]);

  const saveToLocal = useCallback((data: StudySession[]) => {
    if (!userId) return;
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${userId}`, JSON.stringify(data));
  }, [userId]);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return;
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
      const local = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${userId}`);
      if (local) {
        setSessions(JSON.parse(local));
      }
    } else if (data) {
      const mapped: StudySession[] = data.map(row => ({
        date: row.date,
        minutes: row.minutes,
        activityId: row.activityId,
        activityName: row.activityName
      }));
      setSessions(mapped);
      saveToLocal(mapped);
    }
  }, [userId, saveToLocal]);

  useEffect(() => {
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

  // Calculate streak from sessions
  let streak = 0;
  if (sessions.length > 0) {
    const dates = [...new Set(sessions.map(s => {
      const d = new Date(s.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }))].sort().reverse();

    if (dates.length > 0) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      if (dates[0] === todayStr || dates[0] === yesterdayStr) {
        streak = 1;
        let currentDate = new Date(dates[0]);

        for (let i = 1; i < dates.length; i++) {
          const prevDate = new Date(currentDate);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

          if (dates[i] === prevDateStr) {
            streak++;
            currentDate = prevDate;
          } else {
            break;
          }
        }
      }
    }
  }

  return {
    sessions,
    addSession,
    streak
  };
}
