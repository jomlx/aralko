import { useState } from 'react';
import { Plus, Trash2, BookOpen, PenTool, ChevronRight } from 'lucide-react';
import type { Activity } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface ActivityListProps {
  activities: Activity[];
  selectedActivity: number;
  onSelectActivity: (id: number) => void;
  onAddActivity: () => void;
  onRemoveActivity: (id: number) => void;
  onNavigateToLearn: () => void;
}

export function ActivityList({
  activities,
  selectedActivity,
  onSelectActivity,
  onAddActivity,
  onRemoveActivity,
  onNavigateToLearn,
}: ActivityListProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { user } = useAuth();
  
  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.user_metadata?.name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Student';
    
  const currentHour = new Date().getHours();
  let greeting = 'Good evening';
  if (currentHour < 12) greeting = 'Good morning';
  else if (currentHour < 18) greeting = 'Good afternoon';

  const handleClick = (id: number) => {
    onSelectActivity(id);
    onNavigateToLearn();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Page heading */}
      <div className="px-8 pt-4 pb-4">
        <h4 className="text-xs font-semibold tracking-[0.2em] text-accent">WELCOME BACK</h4>
        <h1 className="mt-2 text-3xl font-bold text-primary">{greeting}, {displayName}.</h1>
        <p className="mt-1 text-sm text-muted">Pick up where you left off and make progress today.</p>
      </div>

      {/* Activity list */}
      <div className="px-8 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">My Activities</h2>
          <button
            onClick={onAddActivity}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-token px-3 py-1.5 text-sm text-secondary transition-colors hover:border-violet-400 hover:text-accent"
          >
            <Plus size={14} />
            Add activity
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <BookOpen size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No activities yet.</p>
            <button
              onClick={onAddActivity}
              className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
            >
              + Add your first activity
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activities.map((activity) => {
              const isActive = activity.id === selectedActivity;
              const isHovered = hoveredId === activity.id;
              const isFlashcard = activity.technique?.toLowerCase().includes('flashcard');

              return (
                <div
                  key={activity.id}
                  className={`group relative flex items-center gap-4 rounded-2xl border px-5 py-4 cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'border-accent/40 bg-accent-muted'
                      : 'border-token bg-surface hover:border-accent/20 hover:bg-raised'
                  }`}
                  onClick={() => handleClick(activity.id)}
                  onMouseEnter={() => setHoveredId(activity.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Active indicator bar */}
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-150 ${
                      isActive ? 'bg-accent' : 'bg-transparent'
                    }`}
                  />

                  {/* Technique icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    isActive ? 'bg-accent/20 text-accent' : 'bg-raised text-secondary'
                  }`}>
                    {isFlashcard ? <PenTool size={15} /> : <BookOpen size={15} />}
                  </div>

                  {/* Name + subject */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-accent' : 'text-primary'}`}>
                      {activity.name}
                    </p>
                    {activity.subject && (
                      <p className="text-xs text-muted mt-0.5 truncate">{activity.subject}</p>
                    )}
                  </div>

                  {/* Chevron or delete */}
                  {(isHovered || isActive) && activities.length > 1 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveActivity(activity.id); }}
                      className="shrink-0 rounded-lg p-1 text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-red-500/10 ml-2"
                      title="Remove activity"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <ChevronRight size={16} className={`shrink-0 ml-2 transition-colors ${isActive ? 'text-accent' : 'text-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

