import { CalendarDays, Play, Pause, TimerReset, Settings2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { PomodoroPhase } from '../../types';
import type { PomodoroPreset } from '../../hooks/usePomodoro';
import { POMODORO_PRESETS } from '../../hooks/usePomodoro';
import { Switch } from '../ui/switch';

type StudyTrackerProps = {
  secondsLeft: number;
  phase: PomodoroPhase;
  isRunning: boolean;
  sessionsCompleted: number;
  streak: number;
  streakFreezes: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  preset: PomodoroPreset;
  setPreset: (preset: PomodoroPreset) => void;
  autoStart: boolean;
  setAutoStart: (val: boolean) => void;
  WORK_TIME: number;
};

export function StudyTracker({
  secondsLeft,
  phase,
  isRunning,
  sessionsCompleted,
  streak,
  streakFreezes,
  onStart,
  onPause,
  onReset,
  preset,
  setPreset,
  autoStart,
  setAutoStart,
  WORK_TIME,
}: StudyTrackerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSettings]);

  const today = new Date();
  const dateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(today);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const totalPhaseSeconds = phase === 'work' ? WORK_TIME : POMODORO_PRESETS[preset].break;
  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / totalPhaseSeconds));

  const isWork = phase === 'work';
  const presetKeys = Object.keys(POMODORO_PRESETS) as PomodoroPreset[];

  return (
    <div className="rounded-2xl border border-token bg-surface p-3">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-primary font-medium text-xs">Study Tracker</h2>
        <div className="flex items-center gap-1.5">
          <div className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-2xs font-medium flex items-center gap-1">
            🔥 {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          {streakFreezes > 0 && (
            <div className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-2xs font-medium flex items-center gap-1" title="Streak Freezes active">
              ❄️ {streakFreezes}
            </div>
          )}

          {/* Settings gear — dot indicates auto-start is on without changing card height */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(s => !s)}
              className={`relative p-1 rounded-lg transition-colors ${showSettings ? 'bg-white/10 text-primary' : 'text-muted hover:text-secondary hover:bg-white/[0.05]'}`}
              title="Timer settings"
            >
              <Settings2 size={13} />
              {/* Tiny dot badge when auto-start is active */}
              {autoStart && (
                <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-accent ring-1 ring-[#151922]" />
              )}
            </button>

            {/* Settings popover — uses bg-surface which is mapped to #DCE3EE in light mode */}
            {showSettings && (
              <div className="absolute top-full right-0 mt-1.5 w-56 rounded-xl border border-token bg-surface shadow-xl shadow-black/50 z-50 p-3 flex flex-col gap-3">
                {/* Duration presets */}
                <div>
                  <p className="text-2xs font-semibold text-secondary uppercase tracking-wider mb-1.5">Duration</p>
                  <div className="flex flex-col gap-1">
                    {presetKeys.map(key => (
                      <button
                        key={key}
                        onClick={() => setPreset(key)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          preset === key
                            ? 'bg-accent text-primary'
                            : 'text-secondary hover:bg-white/[0.05] hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span className="font-medium capitalize">{key}</span>
                        <span className={`text-2xs ${preset === key ? 'opacity-80' : 'opacity-60'}`}>
                          {POMODORO_PRESETS[key].work / 60}m / {POMODORO_PRESETS[key].break / 60}m
                        </span>
                      </button>
                    ))}
                  </div>
                  {isRunning && (
                    <p className="text-2xs text-muted mt-1.5 text-center">Change applies next session</p>
                  )}
                </div>

                <div className="h-px bg-white/[0.07]" />

                {/* Auto-start toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-primary">Auto-start</p>
                    <p className="text-2xs text-secondary leading-tight mt-0.5">Continue sessions hands-free</p>
                  </div>
                  <Switch
                    checked={autoStart}
                    onCheckedChange={setAutoStart}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-secondary">
          <CalendarDays size={14} />
          <span>{dateFormatted}</span>
        </div>
        <div className="text-2xs text-muted">
          {sessionsCompleted} sessions
        </div>
      </div>

      {/* Timer Ring */}
      <div className="flex flex-col items-center mb-4 mt-4">
        <div className="relative w-[130px] h-[130px] flex flex-col items-center justify-center">
          <svg viewBox="0 0 130 130" className="absolute inset-0 w-full h-full">
            <g transform="rotate(-90 65 65)">
              <circle cx="65" cy="65" r={58} className="stroke-white/10" strokeWidth="5" fill="none" />
              <circle
                cx="65"
                cy="65"
                r={58}
                className={`transition-all duration-1000 ease-linear ${isWork ? 'stroke-violet-500' : 'stroke-emerald-500'}`}
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 58}
                strokeDashoffset={2 * Math.PI * 58 * (1 - progress)}
              />
            </g>
          </svg>
          <div className="text-2xl font-bold text-primary z-10 tracking-tight">{timeFormatted}</div>
          <div className={`text-2xs font-bold tracking-widest mt-0.5 z-10 uppercase ${isWork ? 'text-accent' : 'text-success'}`}>
            {phase === 'idle' ? 'Ready' : isWork ? 'Focus' : 'Break'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full">
        {isRunning ? (
          <button onClick={onPause} className="btn btn-primary flex-1">
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button onClick={onStart} className="btn btn-primary flex-1">
            <Play size={14} /> Start
          </button>
        )}
        <button onClick={onReset} className="btn btn-secondary px-2" title="Reset Timer">
          <TimerReset size={14} />
        </button>
      </div>
    </div>
  );
}
