import { useEffect, useState, useRef, useCallback } from 'react';
import type { StudySession } from '../types';

interface StreakLogicProps {
  sessions: StudySession[];
  sessionsLoaded: boolean;   // NEW: must be true before we evaluate
  streakFreezes: number;
  savedStreak: number;
  updateStreakData: (freezes: number, streak: number) => void;
}

/** Parse any date string to a local YYYY-MM-DD string (timezone-safe) */
function toLocalDateStr(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr() {
  return toLocalDateStr(new Date().toISOString());
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateStr(d.toISOString());
}

export function useStreakLogic({ sessions, sessionsLoaded, streakFreezes, savedStreak, updateStreakData }: StreakLogicProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const evaluatedRef = useRef(false);

  // Evaluate freeze/reset logic — ONLY once sessions are fully loaded from DB
  useEffect(() => {
    // Don't run until sessions have been fetched from Supabase/localStorage
    if (!sessionsLoaded) return;

    // Only evaluate once per app session
    if (evaluatedRef.current) return;

    // Nothing stored — nothing to evaluate
    if (savedStreak === 0) {
      evaluatedRef.current = true;
      return;
    }

    // Find unique local date strings, sorted newest first
    const dates = [...new Set(sessions.map(s => toLocalDateStr(s.date)))].sort().reverse();

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    const hasStudiedToday = dates.includes(todayStr);
    const hasStudiedYesterday = dates.includes(yesterdayStr);

    // Streak is alive if they studied today or yesterday
    if (hasStudiedToday || hasStudiedYesterday) {
      evaluatedRef.current = true;
      return; // Streak is safe, nothing to do
    }

    // Neither today nor yesterday — streak should be lost (or frozen)
    if (streakFreezes > 0) {
      // Use 1 freeze to keep the streak alive
      updateStreakData(streakFreezes - 1, savedStreak);
      setToastMessage('Your streak was protected! ❄️ 1 freeze used.');
      setTimeout(() => setToastMessage(null), 5000);
    } else {
      // No freezes left — streak is lost
      updateStreakData(0, 0);
      setToastMessage('Your streak was lost. Keep trying! 💪');
      setTimeout(() => setToastMessage(null), 5000);
    }

    evaluatedRef.current = true;
  }, [sessionsLoaded, sessions, streakFreezes, savedStreak, updateStreakData]);

  // Call this immediately when a Pomodoro session completes
  const incrementStreak = useCallback(() => {
    const todayStr = getTodayStr();
    const dates = [...new Set(sessions.map(s => toLocalDateStr(s.date)))];

    // Already studied today — streak doesn't change (already incremented earlier today)
    if (dates.includes(todayStr)) return;

    // First session of the day!
    const newStreak = savedStreak + 1;
    let newFreezes = streakFreezes;

    // Earn 1 freeze every 7 days (max 2)
    if (newStreak % 7 === 0 && streakFreezes < 2) {
      newFreezes += 1;
      setToastMessage('You earned a Streak Freeze! ❄️ (Max 2)');
      setTimeout(() => setToastMessage(null), 5000);
    }

    updateStreakData(newFreezes, newStreak);
  }, [sessions, savedStreak, streakFreezes, updateStreakData]);

  return { toastMessage, incrementStreak };
}
