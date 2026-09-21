import { useState, useEffect } from 'react';
import { Plus, Trash2, BookOpen, PenTool, ChevronRight, Share2, X, Check } from 'lucide-react';
import type { Activity } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useStudyGroups } from '../../hooks/useStudyGroups';

interface ActivityListProps {
  activities: Activity[];
  selectedActivity: number;
  onSelectActivity: (id: number) => void;
  onAddActivity: () => void;
  onRemoveActivity: (id: number) => void;
  onNavigateToLearn: () => void;
}

function ShareDialog({ 
  isOpen, 
  onClose, 
  selectedIds, 
  groups,
  shareActivity 
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: Set<number>;
  groups: any[];
  shareActivity: (gId: string, aId: number) => Promise<void>;
}) {
  const [sharedGroups, setSharedGroups] = useState<Set<string>>(new Set());

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) setSharedGroups(new Set());
  }, [isOpen]);

  const handleShareToGroup = async (groupId: string) => {
    for (const actId of selectedIds) {
      await shareActivity(groupId, actId);
    }
    setSharedGroups(prev => new Set(prev).add(groupId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-surface border border-token rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-token">
          <h3 className="text-lg font-semibold text-primary">Share to Group</h3>
          <button onClick={onClose} className="p-1 text-muted hover:text-primary rounded-lg hover:bg-white/[0.05]">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {groups.length === 0 ? (
            <div className="py-8 text-center text-muted">
              <p className="mb-2">You haven't joined a study group yet.</p>
              <p className="text-xs">Go to the Community tab to join one.</p>
            </div>
          ) : (
            groups.map(g => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-token bg-raised">
                <div>
                  <p className="text-sm font-medium text-primary">{g.name}</p>
                </div>
                {sharedGroups.has(g.id) ? (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    <Check size={12} />
                    Shared!
                  </div>
                ) : (
                  <button 
                    onClick={() => handleShareToGroup(g.id)}
                    className="px-3 py-1.5 rounded-lg bg-accent text-primary text-xs font-medium hover:bg-accent/90"
                  >
                    Share
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-token bg-app/50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-surface border border-token text-sm text-secondary hover:text-primary transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
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

  // Multi-select Sharing State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const { user } = useAuth();
  const { groups, shareActivity } = useStudyGroups();
  
  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.user_metadata?.name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Student';
    
  const currentHour = new Date().getHours();
  let greeting = 'Good evening';
  if (currentHour < 12) greeting = 'Good morning';
  else if (currentHour < 18) greeting = 'Good afternoon';

  const handleRowClick = (id: number) => {
    if (isSelectionMode) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      onSelectActivity(id);
      onNavigateToLearn();
    }
  };

  const handleShareClick = () => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set());
    } else {
      if (selectedIds.size > 0) {
        setIsShareDialogOpen(true);
      }
    }
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleCloseDialog = () => {
    setIsShareDialogOpen(false);
    cancelSelection();
  };

  return (
    <>
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
            <div className="flex items-center gap-2">
              {isSelectionMode && (
                <>
                  <span className="text-xs text-muted mr-1">{selectedIds.size} selected</span>
                  <button
                    onClick={cancelSelection}
                    className="flex items-center justify-center rounded-xl bg-surface border border-token h-[34px] w-[34px] text-secondary transition-colors hover:text-primary hover:bg-raised"
                    title="Cancel selection"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
              
              <button
                onClick={handleShareClick}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                  isSelectionMode 
                    ? selectedIds.size > 0 
                      ? 'bg-accent text-primary border-accent hover:bg-accent/90' 
                      : 'bg-surface text-muted border-token'
                    : 'bg-surface border-token text-secondary hover:border-violet-400 hover:text-accent'
                }`}
              >
                <Share2 size={14} />
                {isSelectionMode ? `Share (${selectedIds.size})` : 'Share'}
              </button>

              {!isSelectionMode && (
                <button
                  onClick={onAddActivity}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-token px-3 py-1.5 text-sm text-secondary transition-colors hover:border-violet-400 hover:text-accent"
                >
                  <Plus size={14} />
                  Add activity
                </button>
              )}
            </div>
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
                const isSelected = selectedIds.has(activity.id);

                return (
                  <div
                    key={activity.id}
                    className={`group relative flex items-center gap-4 rounded-2xl border px-5 py-4 cursor-pointer transition-all duration-150 ${
                      isSelectionMode
                        ? isSelected
                          ? 'border-accent bg-accent/5'
                          : 'border-token bg-surface hover:border-token/80 hover:bg-raised'
                        : isActive
                          ? 'border-accent/40 bg-accent-muted'
                          : 'border-token bg-surface hover:border-accent/20 hover:bg-raised'
                    }`}
                    onClick={() => handleRowClick(activity.id)}
                    onMouseEnter={() => setHoveredId(activity.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Selection Checkbox */}
                    {isSelectionMode && (
                      <div className={`shrink-0 flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                        isSelected 
                          ? 'bg-accent border-accent text-primary' 
                          : 'border-token bg-surface'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    )}

                    {/* Active indicator bar - hidden in selection mode */}
                    {!isSelectionMode && (
                      <div
                        className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-150 ${
                          isActive ? 'bg-accent' : 'bg-transparent'
                        }`}
                      />
                    )}

                    {/* Technique icon */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      isActive && !isSelectionMode ? 'bg-accent/20 text-accent' : 'bg-raised text-secondary border border-token'
                    }`}>
                      {isFlashcard ? <PenTool size={15} /> : <BookOpen size={15} />}
                    </div>

                    {/* Name + subject */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate transition-colors ${
                        isActive && !isSelectionMode ? 'text-accent' : 'text-primary'
                      }`}>
                        {activity.name}
                      </p>
                      {activity.subject && (
                        <p className="text-xs text-muted mt-0.5 truncate">{activity.subject}</p>
                      )}
                    </div>

                    {/* Chevron or delete - hidden in selection mode */}
                    {!isSelectionMode && (
                      (isHovered || isActive) && activities.length > 1 ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveActivity(activity.id); }}
                          className="shrink-0 rounded-lg p-1 text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-red-500/10 ml-2"
                          title="Remove activity"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <ChevronRight size={16} className={`shrink-0 ml-2 transition-colors ${isActive ? 'text-accent' : 'text-muted'}`} />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <ShareDialog 
        isOpen={isShareDialogOpen} 
        onClose={handleCloseDialog} 
        selectedIds={selectedIds} 
        groups={groups} 
        shareActivity={shareActivity} 
      />
    </>
  );
}

