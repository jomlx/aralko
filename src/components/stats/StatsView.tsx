
import type { StudySession } from '../../types';

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

export function StatsView({ sessions, streak }: StatsViewProps) {
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const sessionsCompleted = sessions.length;

  // Mocking weekly data based on last 7 days for the chart
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mockWeeklyHours = [1.5, 2, 0.5, 3.5, 2.5, 1, 3]; // Mock data
  
  // Breakdown by activity
  const activityMap = sessions.reduce((acc, session) => {
    acc[session.activityName] = (acc[session.activityName] || 0) + session.minutes;
    return acc;
  }, {} as Record<string, number>);

  const activitiesList = Object.entries(activityMap)
    .map(([name, minutes]) => ({ name, hours: minutes / 60 }))
    .sort((a, b) => b.hours - a.hours);

  const maxHours = Math.max(3.5, ...mockWeeklyHours);

  return (
    <div className="px-8 pt-4 pb-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-primary">Study Statistics</h2>
        <p className="mt-1 text-sm text-muted">Understand your habits and track your learning journey.</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total study hours" value={`${totalHours}h`} change="+12% from last week" />
        <StatCard label="Current streak" value={`${streak} days`} change="Keep it up!" />
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
