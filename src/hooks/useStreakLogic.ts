import { useEffect, useState, useRef, useCallback } from 'react';
import type { StudySession } from '../types';

interface StreakLogicProps {
  sessions: StudySession[];
  streakFreezes: number;
  savedStreak: number;
  updateStreakData: (freezes: number, streak: number) => void;
}

export function useStreakLogic({ sessions, streakFreezes, savedStreak, updateStreakData }: StreakLogicProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const evaluatedRef = useRef(false);

  // Helper to format Date to YYYY-MM-DD local
  const formatDate = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Evaluate freeze usage on load
  useEffect(() => {
    // Only evaluate once, when we have sessions loaded
    if (evaluatedRef.current) return;
    if (sessions.length === 0 && savedStreak === 0) return; // Nothing to evaluate yet
    
    // We consider it loaded enough to evaluate if we have the settings mapped.
    // Even if sessions is empty, maybe they cleared cache but DB has savedStreak.
    
    // Find unique dates sorted desc
    const dates = [...new Set(sessions.map(s => formatDate(new Date(s.date))))].sort().reverse();
    
    const today = new Date();
    const todayStr = formatDate(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    const hasStudiedToday = dates.includes(todayStr);
    const hasStudiedYesterday = dates.includes(yesterdayStr);

    // Only process if we haven't studied today and we didn't study yesterday.
    // (If we studied today, we already processed the freeze when that session was logged).
    // (If we studied yesterday, the streak is alive naturally).
    if (!hasStudiedToday && !hasStudiedYesterday && savedStreak > 0) {
      if (streakFreezes > 0) {
        // Consumer 1 freeze to keep the streak alive!
        updateStreakData(streakFreezes - 1, savedStreak);
        setToastMessage('Your streak was protected! ❄️ 1 freeze used.');
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        // No freezes left, streak is lost.
        updateStreakData(0, 0);
        setToastMessage('Your streak was lost. Keep trying!');
        setTimeout(() => setToastMessage(null), 5000);
      }
    }

    evaluatedRef.current = true;
  }, [sessions, streakFreezes, savedStreak, updateStreakData]);

  // Call this when completing a new session
  const incrementStreak = useCallback(() => {
    const todayStr = formatDate(new Date());
    const dates = [...new Set(sessions.map(s => formatDate(new Date(s.date))))];
    
    // If they already studied today, no streak changes are needed.
    if (dates.includes(todayStr)) return;

    // Otherwise, they're completing their FIRST session of today!
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

