import type { StudySession } from '../../types';
import React, { useState } from 'react';
import { Snowflake, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { STREAK_THRESHOLDS, STREAK_NAMES, MAX_FREEZES, XP_SESSION, XP_ADD_FILE, XP_QUIZ_BASE, XP_TEST_BASE, PERFECT_TEST_MIN_QUESTIONS } from '../../lib/streakConstants';
import { xpForLevel } from '../../hooks/useUserSettings';
import { useUserSettingsContext } from '../../hooks/UserSettingsContext';
import { StreakFlame } from '../ui/StreakFlame';


interface StatsViewProps {
  sessions: StudySession[];
  streak: number;
}

function StatCard({ label, value, change }: { label: string; value: string | number; change?: string }) {
  return (
    <div className="rounded-2xl border border-token bg-surface p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-3 text-2xl font-bold text-primary">{value}</div>
      {change && <p className="mt-2 text-xs font-medium text-success">{change}</p>}
    </div>
  );
}

function LevelCard({ xp, level }: { xp: number; level: number }) {
  const nextLvlXp = xpForLevel(level + 1);
  const prevLvlXp = xpForLevel(level);
  const progress = Math.max(0, Math.min(100, ((xp - prevLvlXp) / (nextLvlXp - prevLvlXp)) * 100));
  const remaining = nextLvlXp - xp;

  return (
    <div className="rounded-2xl border border-token bg-surface p-5">
      <div>
        <p className="text-xs font-medium text-muted">Level {level}</p>
        <div className="mt-3 text-2xl font-bold text-primary">{xp.toLocaleString()} XP</div>
      </div>
      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-app">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[11px] font-medium text-muted">{remaining.toLocaleString()} XP to level {level + 1}</p>
      </div>
    </div>
  );
}

export function StatsView({ sessions, streak }: StatsViewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { streakFreezes, xp, level } = useUserSettingsContext();
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const sessionsCompleted = sessions.length;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mockWeeklyHours = [1.5, 2, 0.5, 3.5, 2.5, 1, 3];
  
  const activityMap = sessions.reduce((acc, session) => {
    acc[session.activityName] = (acc[session.activityName] || 0) + session.minutes;
    return acc;
  }, {} as Record<string, number>);

  const activitiesList = Object.entries(activityMap)
    .map(([name, minutes]) => ({ name, hours: minutes / 60 }))
    .sort((a, b) => b.hours - a.hours);

  const maxHours = Math.max(3.5, ...mockWeeklyHours);

  const stage = STREAK_THRESHOLDS.reduce((s, t) => streak >= t ? s + 1 : s, 0);
  const nextThreshold = STREAK_THRESHOLDS[stage];

  return (
    <div className="px-[var(--gutter)] pt-4 pb-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-primary">Study Statistics</h2>
          <button onClick={() => setIsDialogOpen(true)} className="text-muted hover:text-primary transition-colors focus:outline-none" aria-label="How it works">
            <Info size={18} />
          </button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="bg-app border-token max-w-md">
              <DialogHeader>
                <DialogTitle className="text-primary">How it works</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 text-sm text-secondary mt-2">
                <div>
                  <h4 className="font-medium text-primary mb-1.5">XP & Levels</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Earn +{XP_SESSION} XP for completing a study session or flashcard deck.</li>
                    <li>Earn +{XP_ADD_FILE} XP for adding a study file (once per unique content).</li>
                    <li>Earn up to +{XP_QUIZ_BASE + 100 * 0.15} XP for completing a quiz based on your score.</li>
                    <li>Earn up to +{XP_TEST_BASE + 100 * 0.25} XP for completing a test.</li>
                    <li>Level up by reaching XP thresholds (Level N requires 10 * (N-1) * (2N+1) total XP). Example: Level 2 = 50 XP, Level 3 = 140 XP.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-primary mb-1.5">Streak</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Log at least one study session in a day to grow your streak.</li>
                    <li>Unlock new flame badges and stages at {STREAK_THRESHOLDS.join(', ')} days.</li>
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
        </div>
        <p className="mt-1 text-sm text-muted">Understand your habits and track your learning journey.</p>
      </div>

      {/* Streak Section */}
      <div className="mb-10 flex flex-col items-center">
        <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-[22px]">
          <div className="w-[100px] h-[125px] shrink-0">
            <StreakFlame 
              stage={stage} 
              locked={streak < 3} 
              animated
              aria-label={`${streak} day streak, ${STREAK_NAMES[stage - 1] || 'Spark'} stage`}
              className="w-full h-full" 
            />
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left mt-4 sm:mt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[56px] font-medium text-primary leading-none tabular-nums">{streak}</span>
              <span className="text-[16px] text-secondary">day streak</span>
            </div>
            <div className="mt-2 text-[14px] text-secondary">
              {stage >= STREAK_THRESHOLDS.length 
                ? 'Max stage' 
                : streak < 3 
                  ? 'Start a streak today' 
                  : <>Stage {stage}, {STREAK_NAMES[stage - 1]} &middot; {nextThreshold - streak} days to next stage</>}
            </div>
            
            <div className="mt-4 flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: MAX_FREEZES }).map((_, i) => (
                  <div key={i} className={`flex items-center justify-center w-[26px] h-[26px] rounded-full ${i < streakFreezes ? 'bg-[#3E8BF0]/[0.18] border border-[#3E8BF0]' : 'border border-dashed border-token'}`}>
                    {i < streakFreezes && <Snowflake size={14} className="text-[#3E8BF0]" />}
                  </div>
                ))}
              </div>
              <span className="text-[13px] text-secondary">{streakFreezes} of {MAX_FREEZES} freezes</span>
            </div>
          </div>
        </div>

        <div className="mt-10 w-full max-w-2xl">
          <h3 className="text-[15px] font-medium text-primary text-center mb-6">Your streak badges</h3>
          <div className="flex items-center justify-between w-full">
            {STREAK_THRESHOLDS.map((threshold, i) => {
              const reached = streak >= threshold;
              return (
                <React.Fragment key={threshold}>
                  <div className="flex flex-col items-center shrink min-w-[36px]">
                    <div className="w-[36px] h-[45px] sm:w-[44px] sm:h-[55px] shrink-0">
                      <StreakFlame 
                        stage={i + 1} 
                        locked={!reached} 
                        aria-hidden="true"
                        className="w-full h-full"
                      />
                    </div>
                    <span className={`mt-2 text-[13px] ${reached ? 'font-medium text-primary' : 'text-muted'}`}>
                      {threshold}d
                    </span>
                  </div>
                  {i < STREAK_THRESHOLDS.length - 1 && (
                    <div 
                      className="h-[3px] rounded-full flex-1 mx-2 shrink transition-colors min-w-[8px]" 
                      style={{ backgroundColor: streak >= STREAK_THRESHOLDS[i + 1] ? 'rgba(255, 154, 51, 0.45)' : 'var(--border)' }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <LevelCard xp={xp} level={level} />
        <StatCard label="Total study hours" value={`${totalHours}h`} change="+12% from last week" />
        <StatCard label="Sessions completed" value={sessionsCompleted} />
      </div>

      <div className="mb-6 rounded-2xl border border-token bg-surface p-6">
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-primary">Weekly activity</h3>
          <p className="text-sm text-muted">Hours spent studying over the last 7 days</p>
        </div>

        <div className="flex h-64 items-end justify-between gap-3">
          {mockWeeklyHours.map((hours, i) => (
            <div key={i} className="group relative flex flex-1 flex-col items-center gap-2">
              <span className="text-xs text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                {hours}h
              </span>
              <div 
                className="w-full max-w-[48px] rounded-t-xl bg-gradient-to-t from-violet-700 to-indigo-400 transition-all hover:opacity-80"
                style={{ height: `${(hours / maxHours) * 100}%` }}
              />
              <span className="mt-2 text-xs font-medium text-muted">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {activitiesList.length > 0 && (
        <div className="rounded-2xl border border-token bg-surface p-6">
          <h3 className="mb-6 text-lg font-semibold text-primary">Activity breakdown</h3>
          <div className="flex flex-col gap-4">
            {activitiesList.map((item, i) => {
              const maxItemHours = activitiesList[0].hours;
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-32 truncate text-sm font-medium text-secondary">
                    {item.name}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-app">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(item.hours / maxItemHours) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-sm text-secondary">
                    {item.hours.toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
