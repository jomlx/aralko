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



export function useStreakLogic({ sessions, sessionsLoaded, settingsLoaded = true, streakFreezes, savedStreak, updateStreakData }: StreakLogicProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const evaluatedRef = useRef(false);

  const dates = [...new Set(sessions.map(s => toLocalDateStr(s.date)))].sort().reverse();
  const rawLastStudy = dates.length > 0 ? dates[0] : null;
  const freezeCovered = localStorage.getItem('aralko-freeze-covered');
  
  // Use whichever is later: the last actual session, or the last freeze-covered date
  const lastStudyDate = !rawLastStudy ? freezeCovered : (!freezeCovered ? rawLastStudy : (rawLastStudy > freezeCovered ? rawLastStudy : freezeCovered));

  function daysBetween(dateStr: string): number {
    const last = new Date(dateStr);
    last.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now.getTime() - last.getTime()) / 86_400_000);
  }

  const gap = lastStudyDate ? daysBetween(lastStudyDate) : Infinity;
  // gap 0 or 1 → alive (studied today or yesterday)
  // gap 2 → missed exactly yesterday → freeze eligible
  // gap ≥ 3 → missed 2+ days → always reset
  const isAlive = gap <= 1;
  const freezeEligible = gap === 2 && streakFreezes > 0;
  const displayedStreak = isAlive ? savedStreak : (freezeEligible ? savedStreak : 0);

  useEffect(() => {
    if (!sessionsLoaded || !settingsLoaded) return;
    if (evaluatedRef.current) return;

    if (savedStreak === 0 || isAlive) {
      // nothing to do
    } else if (freezeEligible) {
      // gap = 2, freeze available: consume one freeze and persist yesterday as covered
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      localStorage.setItem('aralko-freeze-covered', toLocalDateStr(yesterday.toISOString()));
      
      updateStreakData(streakFreezes - 1, savedStreak);
      setToastMessage('Your streak was protected! ❄️ 1 freeze used.');
      setTimeout(() => setToastMessage(null), 5000);
    } else {
      // gap ≥ 3, or gap = 2 with no freezes
      updateStreakData(streakFreezes, 0);
      setToastMessage('Your streak was lost. Keep trying! 🔥');
      setTimeout(() => setToastMessage(null), 5000);
    }

    evaluatedRef.current = true;
  }, [sessionsLoaded, settingsLoaded, isAlive, freezeEligible, streakFreezes, savedStreak, updateStreakData]);

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
