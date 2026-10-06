import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroPhase } from '../types';

export type PomodoroPreset = 'classic' | 'short' | 'extended';

export const POMODORO_PRESETS = {
  classic:  { work: 25 * 60, break: 5 * 60,  label: 'Classic (25/5)' },
  short:    { work: 15 * 60, break: 3 * 60,  label: 'Short (15/3)'   },
  extended: { work: 50 * 60, break: 10 * 60, label: 'Extended (50/10)' }
};

interface UsePomodoroProps {
  onSessionComplete?: (focusMinutes: number) => void;
  preset:    PomodoroPreset;
  autoStart: boolean;
  userId?:   string;
}

interface StoredState {
  phase: PomodoroPhase;
  preset: PomodoroPreset;
  isRunning: boolean;
  endTime: number | null;
  remainingSeconds: number;
}

export function usePomodoro({ onSessionComplete, preset, autoStart, userId }: UsePomodoroProps) {
  const times = POMODORO_PRESETS[preset] ?? POMODORO_PRESETS.classic;
  const WORK_TIME = times.work;
  const BREAK_TIME = times.break;

  const [secondsLeft, setSecondsLeft] = useState(WORK_TIME);
  const [phase, setPhase] = useState<PomodoroPhase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  
  // Track the preset the current session was started with
  const [runningPreset, setRunningPreset] = useState<PomodoroPreset>(preset);

  const onSessionCompleteRef = useRef(onSessionComplete);
  useEffect(() => { onSessionCompleteRef.current = onSessionComplete; }, [onSessionComplete]);

  const storageKey = userId ? `aralko:pomodoro:${userId}` : null;

  // Restore on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const state: StoredState = JSON.parse(raw);
        const presetTimes = POMODORO_PRESETS[state.preset] ?? POMODORO_PRESETS.classic;
        const workTime = presetTimes.work;
        const breakTime = presetTimes.break;

        if (state.isRunning && state.endTime) {
          const remaining = Math.round((state.endTime - Date.now()) / 1000);
          if (remaining > 0) {
            setPhase(state.phase);
            setIsRunning(true);
            setEndTime(state.endTime);
            setSecondsLeft(remaining);
            setRunningPreset(state.preset);
          } else {
            // Passed while closed
            if (state.phase === 'work') {
              setSessionsCompleted(c => c + 1);
              onSessionCompleteRef.current?.(Math.round(workTime / 60));
              setPhase('break');
              setSecondsLeft(breakTime);
              setIsRunning(false);
              setEndTime(null);
            } else {
              setPhase('idle');
              setSecondsLeft(workTime); // back to current preset
              setIsRunning(false);
              setEndTime(null);
            }
            localStorage.removeItem(storageKey);
          }
        } else {
          // Paused
          setPhase(state.phase);
          setIsRunning(false);
          setSecondsLeft(state.remainingSeconds);
          setEndTime(null);
          setRunningPreset(state.preset);
        }
      }
    } catch {}
    // Only run once on mount or when storageKey changes (login/logout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save state on change
  useEffect(() => {
    if (!storageKey || phase === 'idle') {
      if (storageKey && phase === 'idle') {
        try { localStorage.removeItem(storageKey); } catch {}
      }
      return;
    }
    const state: StoredState = {
      phase,
      preset: runningPreset,
      isRunning,
      endTime,
      remainingSeconds: secondsLeft
    };
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }, [phase, runningPreset, isRunning, endTime, secondsLeft, storageKey]);

  // When preset changes while idle, reset the clock to match new duration
  useEffect(() => {
    if (phase === 'idle') {
      setSecondsLeft(WORK_TIME);
      setRunningPreset(preset);
    }
  }, [WORK_TIME, preset, phase]);

  // Main timer tick + phase transitions
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && endTime) {
      interval = setInterval(() => {
        const remaining = Math.round((endTime - Date.now()) / 1000);
        if (remaining > 0) {
          setSecondsLeft(remaining);
        } else {
          setSecondsLeft(0);
          // Play notification sound
          try {
            const audio = new Audio('/sounds/timer-end.wav');
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch (e) {}

          const presetTimes = POMODORO_PRESETS[runningPreset] ?? POMODORO_PRESETS.classic;

          if (phase === 'work') {
            setSessionsCompleted(c => c + 1);
            onSessionCompleteRef.current?.(Math.round(presetTimes.work / 60));
            setPhase('break');
            setSecondsLeft(presetTimes.break);
            if (autoStart) {
              setEndTime(Date.now() + presetTimes.break * 1000);
            } else {
              setIsRunning(false);
              setEndTime(null);
            }
          } else if (phase === 'break') {
            setSecondsLeft(WORK_TIME);
            setRunningPreset(preset); // Update to current preset
            if (autoStart) {
              setPhase('work');
              setEndTime(Date.now() + WORK_TIME * 1000);
            } else {
              setPhase('idle');
              setIsRunning(false);
              setEndTime(null);
            }
          }
        }
      }, 1000);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [isRunning, phase, endTime, runningPreset, WORK_TIME, preset, autoStart]);

  const start = useCallback(() => {
    if (phase === 'idle') {
      setPhase('work');
      setRunningPreset(preset);
    }
    setIsRunning(true);
    setEndTime(Date.now() + secondsLeft * 1000);
  }, [phase, secondsLeft, preset]);

  const pause = useCallback(() => {
    setIsRunning(false);
    setEndTime(null);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setPhase('idle');
    setSecondsLeft(WORK_TIME);
    setEndTime(null);
    setRunningPreset(preset);
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }, [WORK_TIME, preset, storageKey]);

  const togglePhase = useCallback(() => {
    let nextTime = WORK_TIME;
    if (phase === 'work' || phase === 'idle') {
      setPhase('break');
      nextTime = BREAK_TIME;
    } else {
      setPhase('work');
    }
    setSecondsLeft(nextTime);
    setIsRunning(false);
    setEndTime(null);
    setRunningPreset(preset);
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }, [phase, BREAK_TIME, WORK_TIME, preset, storageKey]);

  const currentPhaseLength = phase === 'work' ? (POMODORO_PRESETS[runningPreset]?.work ?? WORK_TIME) : (POMODORO_PRESETS[runningPreset]?.break ?? BREAK_TIME);

  return {
    secondsLeft,
    phase,
    isRunning,
    sessionsCompleted,
    start,
    pause,
    reset,
    togglePhase,
    WORK_TIME,
    BREAK_TIME,
    currentPhaseLength,
  };
}

