import type { StudySession } from '../../types';
import React, { useState, useMemo } from 'react';
import { Snowflake, Info, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  STREAK_THRESHOLDS, STREAK_NAMES, MAX_FREEZES,
  XP_SESSION, XP_ADD_FILE, XP_QUIZ_BASE, XP_TEST_BASE, PERFECT_TEST_MIN_QUESTIONS,
} from '../../lib/streakConstants';
import { xpForLevel } from '../../hooks/useUserSettings';
import { useUserSettingsContext } from '../../hooks/UserSettingsContext';
import { StreakFlame } from '../ui/StreakFlame';

interface StatsViewProps {
  sessions: StudySession[];
  streak: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekStartStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevWeekStartStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -13 : 1 - day - 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function LevelCard({ xp, level }: { xp: number; level: number }) {
  const nextLvlXp = xpForLevel(level + 1);
  const prevLvlXp = xpForLevel(level);
  const progress = Math.max(0, Math.min(100, ((xp - prevLvlXp) / (nextLvlXp - prevLvlXp)) * 100));
  const remaining = nextLvlXp - xp;
  return (
    <div className="rounded-2xl border border-token bg-surface p-5 flex flex-col justify-between">
      <p className="text-xs font-medium text-muted">Level {level}</p>
      <div className="mt-3 text-3xl font-bold text-primary">{xp.toLocaleString()} XP</div>
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-app">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-muted">{remaining.toLocaleString()} XP to level {level + 1}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-token bg-surface p-5 flex flex-col justify-between">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-3 text-3xl font-bold text-primary">{value}</div>
      {sub && <div className="mt-2 text-xs font-medium">{sub}</div>}
    </div>
  );
}

export function StatsView({ sessions, streak }: StatsViewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { streakFreezes, xp, level } = useUserSettingsContext();

  const today = todayStr();
  const wsStart = weekStartStr();

  const thisWeekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(wsStart, i)),
    [wsStart]
  );

  const thisWeekMinutes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      const d = s.date.slice(0, 10);
      if (d >= wsStart && d <= today) map[d] = (map[d] || 0) + s.minutes;
    }
    return thisWeekDates.map(d => (map[d] || 0) / 60);
  }, [sessions, wsStart, today, thisWeekDates]);

  const prevWeekTotalHours = useMemo(() => {
    const pwStart = prevWeekStartStr();
    const pwEnd = addDays(wsStart, -1);
    return sessions
      .filter(s => { const d = s.date.slice(0, 10); return d >= pwStart && d <= pwEnd; })
      .reduce((a, s) => a + s.minutes, 0) / 60;
  }, [sessions, wsStart]);

  const totalHours = (sessions.reduce((sum, s) => sum + s.minutes, 0) / 60).toFixed(1);
  const sessionsCompleted = sessions.length;
  const thisWeekTotalHours = thisWeekMinutes.reduce((a, h) => a + h, 0);

  const thisWeekSessions = useMemo(() =>
    sessions.filter(s => { const d = s.date.slice(0, 10); return d >= wsStart && d <= today; }).length,
    [sessions, wsStart, today]
  );

  const pctChange = prevWeekTotalHours > 0
    ? ((thisWeekTotalHours - prevWeekTotalHours) / prevWeekTotalHours * 100).toFixed(0)
    : null;

  const studiedDates = useMemo(
    () => new Set(sessions.map(s => s.date.slice(0, 10))),
    [sessions]
  );
  const todayDayIndex = (() => { const d = new Date(); return d.getDay() === 0 ? 6 : d.getDay() - 1; })();

  const maxBarHours = Math.max(0.5, ...thisWeekMinutes);

  const activityMap = sessions.reduce((acc, s) => {
    acc[s.activityName] = (acc[s.activityName] || 0) + s.minutes;
    return acc;
  }, {} as Record<string, number>);
  const activitiesList = Object.entries(activityMap)
    .map(([name, minutes]) => ({ name, hours: minutes / 60 }))
    .sort((a, b) => b.hours - a.hours);

  // Dev mock state
  const isDev = import.meta.env.MODE !== 'production';
  const [mockStreak, setMockStreak] = useState<number | null>(null);
  const displayStreak = mockStreak !== null ? mockStreak : streak;
  const displayStage = STREAK_THRESHOLDS.reduce((s, t) => displayStreak >= t ? s + 1 : s, 0);
  const displayNext = STREAK_THRESHOLDS[displayStage];
  const displayPrev = displayStage > 0 ? STREAK_THRESHOLDS[displayStage - 1] : 0;
  const displayProgress = displayNext
    ? Math.min(100, ((displayStreak - displayPrev) / (displayNext - displayPrev)) * 100)
    : 100;
  const displayDaysToNext = displayNext ? displayNext - displayStreak : 0;

  return (
    <div className="px-[var(--gutter)] pt-4 pb-10">

      {/* 1. Header row: title + info icon + week day circles */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-primary">Study Statistics</h2>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="text-muted hover:text-primary transition-colors focus:outline-none"
              aria-label="How it works"
            >
              <Info size={16} />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-muted">Understand your habits and track your learning journey.</p>
        </div>

        {/* Week-day circles */}
        <div className="flex items-center gap-1.5 shrink-0">
          {thisWeekDates.map((dateStr, i) => {
            const studied = studiedDates.has(dateStr);
            const isToday = i === todayDayIndex;
            const isPast = i < todayDayIndex;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors
                  ${studied
                    ? 'bg-accent text-primary'
                    : isToday
                      ? 'border-2 border-dashed border-accent/60 text-accent'
                      : isPast
                        ? 'border border-token text-muted'
                        : 'border border-dashed border-token text-muted/50'
                  }`}
                >
                  {studied ? <CheckCircle2 size={14} strokeWidth={2.5} /> : DAY_LABELS[i].slice(0, 1)}
                </div>
                <span className="text-[9px] text-muted">{DAY_LABELS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-app border-token max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">How it works</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm text-secondary mt-2">
            <div>
              <h4 className="font-medium text-primary mb-1.5">XP &amp; Levels</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Earn +{XP_SESSION} XP for completing a study session or flashcard deck.</li>
                <li>Earn +{XP_ADD_FILE} XP for adding a study file (once per unique content).</li>
                <li>Earn up to +{XP_QUIZ_BASE + 100 * 0.15} XP for completing a quiz based on your score.</li>
                <li>Earn up to +{XP_TEST_BASE + 100 * 0.25} XP for completing a test.</li>
                <li>Level up by reaching XP thresholds (Level N requires 10*(N-1)*(2N+1) total XP). Example: Level 2 = 50 XP, Level 3 = 140 XP.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-primary mb-1.5">Streak</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Log at least one study session in a day to grow your streak.</li>
                <li>Unlock new flame badges at {STREAK_THRESHOLDS.join(', ')} days.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-primary mb-1.5">Freezes</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Earn 1 freeze every 7 streak days, or by scoring 100% on a test ({PERFECT_TEST_MIN_QUESTIONS}+ questions).</li>
                <li>You can hold a maximum of {MAX_FREEZES} freezes at once.</li>
                <li>If you miss a day, one freeze is automatically consumed to protect your streak.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Streak hero – no card, horizontal row */}
      <div className="mb-8 flex flex-col sm:flex-row items-center gap-6 justify-center">
        {/* Flame */}
        <div className="w-[100px] h-[125px] shrink-0">
          <StreakFlame
            stage={displayStage}
            locked={displayStreak < 3}
            animated
            className="w-full h-full"
            aria-label={`${displayStreak} day streak`}
          />
        </div>

        {/* Text column */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3">
          {/* Number + label */}
          <div className="flex items-baseline gap-2">
            <span className="text-[60px] font-bold text-primary leading-none tabular-nums">{displayStreak}</span>
            <span className="text-lg text-secondary">day streak</span>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-[400px]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-app">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {displayStage >= STREAK_THRESHOLDS.length
                ? 'Max stage reached!'
                : displayStreak < 3
                  ? `${3 - displayStreak} days to first badge`
                  : `${displayDaysToNext} days to next stage`}
            </p>
          </div>

          {/* Freeze icons */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {Array.from({ length: MAX_FREEZES }).map((_, i) => (
                <div key={i} className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors
                  ${i < streakFreezes ? 'bg-[#3E8BF0]/[0.18] border border-[#3E8BF0]' : 'border border-dashed border-token'}`}>
                  {i < streakFreezes && <Snowflake size={14} className="text-[#3E8BF0]" />}
                </div>
              ))}
            </div>
            <span className="text-[13px] text-secondary">{streakFreezes} of {MAX_FREEZES} freezes</span>
          </div>
        </div>
      </div>

      {/* 3. Three stat cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <LevelCard xp={xp} level={level} />
        <StatCard
          label="Total study hours"
          value={`${totalHours}h`}
          sub={pctChange !== null
            ? <span className={Number(pctChange) >= 0 ? 'text-success' : 'text-red-400'}>
                {Number(pctChange) >= 0 ? '+' : ''}{pctChange}% from last week
              </span>
            : undefined}
        />
        <StatCard
          label="Sessions completed"
          value={sessionsCompleted}
          sub={thisWeekSessions > 0
            ? <span className="text-secondary">{thisWeekSessions} this week</span>
            : undefined}
        />
      </div>

      {/* 4. Weekly activity bar chart */}
      <div className="mb-6 rounded-2xl border border-token bg-surface p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-primary">Weekly activity</h3>
          <span className="text-sm text-muted">Hours studied this week</span>
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: '148px' }}>
          {thisWeekMinutes.map((hours, i) => {
            const barPct = maxBarHours > 0 ? (hours / maxBarHours) : 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-0">
                <span className="text-[11px] text-secondary mb-1 h-4">
                  {hours > 0 ? `${hours.toFixed(1)}h` : '0h'}
                </span>
                <div className="flex-1 w-full flex items-end justify-center">
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg transition-all
                      ${hours > 0 ? 'bg-gradient-to-t from-violet-700 to-indigo-400' : 'bg-white/[0.06]'}`}
                    style={{ height: `${Math.max(4, barPct * 100)}px` }}
                  />
                </div>
                <div className="h-px w-full bg-token mt-1" />
                <span className="text-[11px] font-medium text-muted mt-1">{DAY_LABELS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak badges (kept) */}
      <div className="mb-6 rounded-2xl border border-token bg-surface p-6">
        <h3 className="text-[14px] font-semibold text-primary mb-5">Streak badges</h3>
        <div className="flex items-center justify-between w-full">
          {STREAK_THRESHOLDS.map((threshold, i) => {
            const reached = displayStreak >= threshold;
            return (
              <React.Fragment key={threshold}>
                <div className="flex flex-col items-center shrink min-w-[40px]">
                  <div className="w-[38px] h-[48px] sm:w-[44px] sm:h-[55px] shrink-0">
                    <StreakFlame stage={i + 1} locked={!reached} aria-hidden="true" className="w-full h-full" />
                  </div>
                  <span className={`mt-2 text-[12px] ${reached ? 'font-medium text-primary' : 'text-muted'}`}>
                    {threshold}d
                  </span>
                  <span className={`text-[10px] ${reached ? 'text-secondary' : 'text-muted/60'}`}>
                    {STREAK_NAMES[i]}
                  </span>
                </div>
                {i < STREAK_THRESHOLDS.length - 1 && (
                  <div
                    className="h-[3px] rounded-full flex-1 mx-2 shrink min-w-[8px]"
                    style={{ backgroundColor: displayStreak >= STREAK_THRESHOLDS[i + 1] ? 'rgba(255,154,51,0.45)' : 'var(--border)' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Activity breakdown (kept) */}
      {activitiesList.length > 0 && (
        <div className="mb-6 rounded-2xl border border-token bg-surface p-6">
          <h3 className="mb-5 text-[14px] font-semibold text-primary">Activity breakdown</h3>
          <div className="flex flex-col gap-4">
            {activitiesList.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-32 truncate text-sm font-medium text-secondary">{item.name}</span>
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-app">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(item.hours / activitiesList[0].hours) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right text-sm text-secondary">{item.hours.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Dev-only preview toggles */}
      {isDev && (
        <div className="mt-2 pt-4 border-t border-dashed border-token flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-muted font-medium">Preview only:</span>
          <button onClick={() => setMockStreak(null)} className="px-3 py-1 text-[11px] rounded-lg border border-token text-secondary hover:text-primary transition-colors">
            Real data
          </button>
          <button onClick={() => setMockStreak(0)} className="px-3 py-1 text-[11px] rounded-lg border border-token text-secondary hover:text-primary transition-colors">
            New user
          </button>
          <button onClick={() => setMockStreak(134)} className="px-3 py-1 text-[11px] rounded-lg border border-token text-secondary hover:text-primary transition-colors">
            134 day streak
          </button>
        </div>
      )}
    </div>
  );
}
