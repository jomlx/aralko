import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

import type { PomodoroPreset } from './usePomodoro';

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 20 * level * (level - 1);
}

export function xpToLevel(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function levelProgress(xp: number): number {
  const lvl = xpToLevel(xp);
  const curr = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  return next > curr ? (xp - curr) / (next - curr) : 1;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

const XP_EVENTS_KEY = 'aralko-xp-events';

function hasAwardedXP(userId: string, event: string): boolean {
  try {
    const raw = localStorage.getItem(`${XP_EVENTS_KEY}-${userId}`);
    return raw ? (JSON.parse(raw) as string[]).includes(event) : false;
  } catch { return false; }
}

function markXPAwarded(userId: string, event: string): void {
  try {
    const raw = localStorage.getItem(`${XP_EVENTS_KEY}-${userId}`);
    const events: string[] = raw ? JSON.parse(raw) : [];
    if (!events.includes(event)) {
      events.push(event);
      localStorage.setItem(`${XP_EVENTS_KEY}-${userId}`, JSON.stringify(events));
    }
  } catch {}
}

export function useUserSettings() {
  const { user } = useAuth();
  const userId = user?.id;

  const [preset, setPreset] = useState<PomodoroPreset>('classic');
  const [autoStart, setAutoStart] = useState(false);
  const [geminiKey, setGeminiKey] = useState<string | null>(null);

  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpThisWeek, setXpThisWeek] = useState(0);

  const [streakFreezes, setStreakFreezes] = useState(0);
  const [savedStreak, setSavedStreak] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const xpRef = useRef(0);
  const xpThisWeekRef = useRef(0);

  useEffect(() => {
    if (!userId) {
      setPreset('classic');
      setAutoStart(false);
      setGeminiKey(null);
      setXp(0);
      setLevel(1);
      setXpThisWeek(0);
      setStreakFreezes(0);
      setSavedStreak(0);
      setSettingsLoaded(false);
      xpRef.current = 0;
      xpThisWeekRef.current = 0;
      return;
    }

    supabase
      .from('user_settings')
      .select('pomodoro_preset, pomodoro_autostart, gemini_api_key, xp, level, xp_this_week, week_start, display_name, avatar_url, streak_freezes, saved_streak')
      .eq('user_id', userId)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (data) {
          if (data.pomodoro_preset)    setPreset(data.pomodoro_preset);
          if (data.pomodoro_autostart !== null) setAutoStart(data.pomodoro_autostart);
          if (data.gemini_api_key)    setGeminiKey(data.gemini_api_key);

          const loadedXp = data.xp ?? 0;
          const currentWeekStart = getCurrentWeekStart();
          let weekXp = data.xp_this_week ?? 0;

          if (data.week_start !== currentWeekStart) {
            weekXp = 0;
            supabase.from('user_settings').upsert(
              { user_id: userId, xp_this_week: 0, week_start: currentWeekStart },
              { onConflict: 'user_id' }
            ).then(() => {});
          }

          setXp(loadedXp);
          setLevel(xpToLevel(loadedXp));
          setXpThisWeek(weekXp);
          xpRef.current = loadedXp;
          xpThisWeekRef.current = weekXp;
          
          if (data.streak_freezes !== undefined) setStreakFreezes(data.streak_freezes);
          if (data.saved_streak !== undefined) setSavedStreak(data.saved_streak);
        } else if (error && error.code !== 'PGRST116') {
          console.warn('Failed to load user settings:', error.message);
        }

        const newName  = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
        const newAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

        const syncPayload: Record<string, unknown> = { user_id: userId };
        if (newName)   syncPayload.display_name = newName;
        if (newAvatar) syncPayload.avatar_url   = newAvatar;

        if (Object.keys(syncPayload).length > 1) {
          supabase.from('user_settings').upsert(syncPayload, { onConflict: 'user_id' }).then(() => {});
        }
        
        setSettingsLoaded(true);
      });
  }, [userId, user]);

  useEffect(() => { xpRef.current = xp; }, [xp]);
  useEffect(() => { xpThisWeekRef.current = xpThisWeek; }, [xpThisWeek]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('user_settings')
      .upsert({ user_id: userId, pomodoro_preset: preset }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.warn('Failed to sync preset:', error.message); });
  }, [preset, userId]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('user_settings')
      .upsert({ user_id: userId, pomodoro_autostart: autoStart }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.warn('Failed to sync autoStart:', error.message); });
  }, [autoStart, userId]);

  const addXP = useCallback((amount: number, eventKey?: string) => {
    if (!userId) return;

    if (eventKey) {
      if (hasAwardedXP(userId, eventKey)) return;
      markXPAwarded(userId, eventKey);
    }

    const newXp        = xpRef.current + amount;
    const newWeekXp    = xpThisWeekRef.current + amount;
    const newLevel     = xpToLevel(newXp);
    const weekStart    = getCurrentWeekStart();

    xpRef.current        = newXp;
    xpThisWeekRef.current = newWeekXp;

    setXp(newXp);
    setLevel(newLevel);
    setXpThisWeek(newWeekXp);

    supabase.from('user_settings').upsert(
      { user_id: userId, xp: newXp, level: newLevel, xp_this_week: newWeekXp, week_start: weekStart },
      { onConflict: 'user_id' }
    ).then(({ error }) => { if (error) console.warn('Failed to sync XP:', error.message); });
  }, [userId]);

  const updateStreakData = useCallback((newFreezes: number, newStreak: number) => {
    if (!userId) return;
    setStreakFreezes(newFreezes);
    setSavedStreak(newStreak);
    supabase.from('user_settings').upsert(
      { user_id: userId, streak_freezes: newFreezes, saved_streak: newStreak },
      { onConflict: 'user_id' }
    ).then(({ error }) => { if (error) console.warn('Failed to sync streak data:', error.message); });
  }, [userId]);

  return { 
    preset, setPreset, autoStart, setAutoStart, geminiKey, 
    xp, level, xpThisWeek, addXP,
    streakFreezes, savedStreak, updateStreakData, settingsLoaded
  };
}
