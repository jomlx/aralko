import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroPhase } from '../types';

export type PomodoroPreset = 'classic' | 'short' | 'extended';

export const POMODORO_PRESETS = {
  classic:  { work: 25 * 60, break: 5 * 60,  label: 'Classic (25/5)' },
  short:    { work: 15 * 60, break: 3 * 60,  label: 'Short (15/3)'   },
  extended: { work: 50 * 60, break: 10 * 60, label: 'Extended (50/10)' }
};

interface UsePomodoroProps {
  onSessionComplete?: () => void;
  /** Controlled by useUserSettings — preset/autoStart come from Supabase-backed state */
  preset:    PomodoroPreset;
  autoStart: boolean;
}

export function usePomodoro({ onSessionComplete, preset, autoStart }: UsePomodoroProps) {
  const times     = POMODORO_PRESETS[preset] ?? POMODORO_PRESETS.classic;
  const WORK_TIME  = times.work;
  const BREAK_TIME = times.break;

  const [secondsLeft,       setSecondsLeft]       = useState(WORK_TIME);
  const [phase,             setPhase]             = useState<PomodoroPhase>('idle');
  const [isRunning,         setIsRunning]         = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  const onSessionCompleteRef = useRef(onSessionComplete);
  useEffect(() => { onSessionCompleteRef.current = onSessionComplete; }, [onSessionComplete]);

  // When preset changes while idle, reset the clock to match new duration
  useEffect(() => {
    if (phase === 'idle') setSecondsLeft(WORK_TIME);
  }, [WORK_TIME, phase]);

  // Main timer tick + phase transitions
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    } else if (isRunning && secondsLeft === 0) {
      // Play notification sound silently without interrupting existing audio streams
      try {
        const audio = new Audio('/sounds/timer-end.wav');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {
        // fail silently if blocked by browser
      }

      if (phase === 'work') {
        setSessionsCompleted(c => c + 1);
        onSessionCompleteRef.current?.();
        setPhase('break');
        setSecondsLeft(BREAK_TIME);
        if (!autoStart) setIsRunning(false);
      } else if (phase === 'break') {
        setSecondsLeft(WORK_TIME);
        if (autoStart) {
          setPhase('work');
          // isRunning stays true
        } else {
          setPhase('idle');
          setIsRunning(false);
        }
      }
    }

    return () => { if (interval) clearInterval(interval); };
  }, [isRunning, secondsLeft, phase, BREAK_TIME, WORK_TIME, autoStart]);

  const start = useCallback(() => {
    if (phase === 'idle') setPhase('work');
    setIsRunning(true);
  }, [phase]);

  const pause = useCallback(() => setIsRunning(false), []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setPhase('idle');
    setSecondsLeft(WORK_TIME);
  }, [WORK_TIME]);

  const togglePhase = useCallback(() => {
    if (phase === 'work' || phase === 'idle') {
      setPhase('break');
      setSecondsLeft(BREAK_TIME);
    } else {
      setPhase('work');
      setSecondsLeft(WORK_TIME);
    }
    setIsRunning(false);
  }, [phase, BREAK_TIME, WORK_TIME]);

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
  };
}
