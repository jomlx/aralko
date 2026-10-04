import { useEffect, useState, useRef, useCallback } from 'react';
import { MAX_FREEZES } from '../lib/streakConstants';
import type { StudySession } from '../types';

interface StreakLogicProps {
  userId?: string;
  sessions: StudySession[];
  sessionsLoaded: boolean;
  settingsLoaded?: boolean;
  streakFreezes: number;
  savedStreak: number;
  updateStreakData: (freezes: number, streak: number) => void;
}

export type StreakAction = 'none' | 'freeze' | 'reset';

export function parseLocalDate(dateStr: string): Date {
  // If it's just YYYY-MM-DD, parse as local to avoid UTC offset shifting
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  return new Date(dateStr);
}

function toLocalDateStr(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = parseLocalDate(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr() {
  return toLocalDateStr(new Date().toISOString());
}

export function evaluateStreak({
  lastStudyDate,
  today,
  freezes,
  savedStreak
}: {
  lastStudyDate: string | null;
  today: string;
  freezes: number;
  savedStreak: number;
}): { displayedStreak: number; action: StreakAction } {
  if (savedStreak === 0 && !lastStudyDate) {
    return { displayedStreak: 0, action: 'none' };
  }

  const todayDate = parseLocalDate(today);
  todayDate.setHours(0, 0, 0, 0);

  let gap = Infinity;
  if (lastStudyDate) {
    const last = parseLocalDate(lastStudyDate);
    last.setHours(0, 0, 0, 0);
    gap = Math.round((todayDate.getTime() - last.getTime()) / 86_400_000);
  }

  const isAlive = gap <= 1;
  const freezeEligible = gap === 2 && freezes > 0;
  const displayedStreak = isAlive ? savedStreak : (freezeEligible ? savedStreak : 0);

  let action: StreakAction = 'none';
  if (savedStreak > 0 && !isAlive) {
    if (freezeEligible) {
      action = 'freeze';
    } else {
      action = 'reset';
    }
  }

  return { displayedStreak, action };
}

export function useStreakLogic({ userId, sessions, sessionsLoaded, settingsLoaded = true, streakFreezes, savedStreak, updateStreakData }: StreakLogicProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const evaluatedRef = useRef(false);

  const dates = [...new Set(sessions.map(s => toLocalDateStr(s.date)))].sort().reverse();
  const rawLastStudy = dates.length > 0 ? dates[0] : null;
  const freezeCoverKey = userId ? `aralko-freeze-covered-${userId}` : null;
  const freezeCovered = freezeCoverKey ? localStorage.getItem(freezeCoverKey) : null;
  
  // Use whichever is later: the last actual session, or the last freeze-covered date
  const lastStudyDate = !rawLastStudy ? freezeCovered : (!freezeCovered ? rawLastStudy : (rawLastStudy > freezeCovered ? rawLastStudy : freezeCovered));
  const todayStr = getTodayStr();

  const { displayedStreak, action } = evaluateStreak({
    lastStudyDate,
    today: todayStr,
    freezes: streakFreezes,
    savedStreak
  });

  useEffect(() => {
    if (!userId || !sessionsLoaded || !settingsLoaded) return;
    if (evaluatedRef.current) return;

    if (action === 'freeze' && freezeCoverKey) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      localStorage.setItem(freezeCoverKey, toLocalDateStr(yesterday.toISOString()));
      
      updateStreakData(streakFreezes - 1, savedStreak);
      setToastMessage('streak:protected');
      setTimeout(() => setToastMessage(null), 5000);
    } else if (action === 'reset') {
      updateStreakData(streakFreezes, 0);
      setToastMessage('streak:lost');
      setTimeout(() => setToastMessage(null), 5000);
    }

    evaluatedRef.current = true;
  }, [userId, sessionsLoaded, settingsLoaded, action, streakFreezes, savedStreak, updateStreakData, freezeCoverKey]);

  const incrementStreak = useCallback(() => {
    if (dates.includes(todayStr)) return;

    const newStreak = displayedStreak + 1;
    let newFreezes = streakFreezes;

    if (newStreak % 7 === 0 && streakFreezes < MAX_FREEZES) {
      newFreezes += 1;
      setToastMessage('streak:earned');
      setTimeout(() => setToastMessage(null), 5000);
    }

    updateStreakData(newFreezes, newStreak);
  }, [dates, displayedStreak, streakFreezes, updateStreakData, todayStr]);

  return { toastMessage, incrementStreak, displayedStreak };
}
