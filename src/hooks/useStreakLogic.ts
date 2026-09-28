import { useEffect, useState, useRef, useCallback } from 'react';
import type { StudySession } from '../types';

interface StreakLogicProps {
  sessions: StudySession[];
  sessionsLoaded: boolean;
  settingsLoaded?: boolean;
  streakFreezes: number;
  savedStreak: number;
  updateStreakData: (freezes: number, streak: number) => void;
}

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

export function useStreakLogic({ sessions, sessionsLoaded, settingsLoaded = true, streakFreezes, savedStreak, updateStreakData }: StreakLogicProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const evaluatedRef = useRef(false);

  const dates = [...new Set(sessions.map(s => toLocalDateStr(s.date)))].sort().reverse();
  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();
  const lastStudyDate = dates.length > 0 ? dates[0] : null;

  const hasStudiedToday = dates.includes(todayStr);
  const hasStudiedYesterday = dates.includes(yesterdayStr);

  const isAlive = hasStudiedToday || hasStudiedYesterday;
  const displayedStreak = isAlive ? savedStreak : (streakFreezes > 0 ? savedStreak : 0);

  useEffect(() => {
    if (!sessionsLoaded || !settingsLoaded) return;
    if (evaluatedRef.current) return;

    let branch = 'unknown';

    if (savedStreak === 0) {
      branch = 'no-op (savedStreak is 0)';
    } else if (hasStudiedToday || hasStudiedYesterday) {
      branch = 'skipped (streak is alive)';
    } else if (streakFreezes > 0) {
      branch = 'freeze used';
      updateStreakData(streakFreezes - 1, savedStreak);
      setToastMessage('Your streak was protected! ❄️ 1 freeze used.');
      setTimeout(() => setToastMessage(null), 5000);
    } else {
      branch = 'reset to 0';
      updateStreakData(0, 0);
      setToastMessage('Your streak was lost. Keep trying! 🔥');
      setTimeout(() => setToastMessage(null), 5000);
    }

    console.log('--- STREAK DIAGNOSTIC ---', {
      savedStreak,
      lastStudyDate,
      streakFreezes,
      sessionsLoaded,
      settingsLoaded,
      todayStr,
      yesterdayStr,
      branch
    });

    evaluatedRef.current = true;
  }, [sessionsLoaded, settingsLoaded, sessions, streakFreezes, savedStreak, updateStreakData]);

  const incrementStreak = useCallback(() => {
    if (dates.includes(getTodayStr())) return;

    const newStreak = displayedStreak + 1;
    let newFreezes = streakFreezes;

    if (newStreak % 7 === 0 && streakFreezes < 2) {
      newFreezes += 1;
      setToastMessage('You earned a Streak Freeze! ❄️ (Max 2)');
      setTimeout(() => setToastMessage(null), 5000);
    }

    updateStreakData(newFreezes, newStreak);
  }, [dates, displayedStreak, streakFreezes, updateStreakData]);

  return { toastMessage, incrementStreak, displayedStreak };
}
