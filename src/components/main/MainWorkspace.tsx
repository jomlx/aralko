import { useState, useCallback, useEffect } from 'react';
import type { Activity } from '../../types';
import { Settings, BookOpen, Trash2, Plus, Loader2, PenTool, X, Share2 } from 'lucide-react';
import { FlashcardsViewer } from './FlashcardsViewer';
import { AIChatPanel } from '../sidebar/AIChatPanel';
import { useGemini } from '../../hooks/useGemini';
import { getFlashcardPrompt } from '../../prompts/flashcardsPrompt';
import { parseAIJson } from '../../lib/parseAIJson';
import { useStudyGroups } from '../../hooks/useStudyGroups';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useToast } from '../ui/Toast';

function ShareActivityButton({ activityId }: { activityId: number }) {
  const { groups, shareActivity } = useStudyGroups();
  const [sharing, setSharing] = useState(false);
  const { showToast } = useToast();

  const handleShare = async (groupId: string) => {
    setSharing(true);
    try {
      await shareActivity(groupId, activityId);
      // alert('Activity shared successfully!'); // Suppressed technical alert to follow UI guidelines, but a toast could be added here
      showToast('Activity shared successfully!', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to share activity');
      showToast(err.message || 'Failed to share activity', 'error');
    } finally {
      setSharing(false);
    }
  };

  if (groups.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-token bg-surface px-2.5 py-1.5 text-xs font-medium text-secondary hover:bg-white/[0.05] hover:text-primary transition-colors"
          disabled={sharing}
        >
          <Share2 size={14} />
          {sharing ? 'Sharing...' : 'Share'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {groups.map((g) => (
          <DropdownMenuItem
            key={g.id}
            onClick={() => handleShare(g.id)}
          >
            {g.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MainWorkspaceProps {
  activities: Activity[];
  selectedActivity: number;
  onSelectActivity: (id: number) => void;
  onAddActivity: () => void;
  onRemoveActivity: (id: number) => void;
  onUpdateActivity: (id: number, updates: Partial<Activity>) => void;
  isTestMode: boolean;
  onEnterTestMode: () => void;
  onExitTestMode: () => void;
}

export function MainWorkspace({
  activities,
  selectedActivity,
  onSelectActivity,
  onAddActivity,
  onRemoveActivity,
  onUpdateActivity,
  isTestMode,
  onEnterTestMode,
  onExitTestMode,
}: MainWorkspaceProps) {
  const { showToast } = useToast();
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [flashcardProgress, setFlashcardProgress] = useState(0);
  // overlay visibility for CSS transition (slight delay so CSS can animate in)
  // Controls actual mounting in the DOM
  const [renderOverlay, setRenderOverlay] = useState(false);
  // Controls CSS opacity/scale transition classes
  const [overlayVisible, setOverlayVisible] = useState(false);

  const activeActivity = activities.find((a) => a.id === selectedActivity) || activities[0];

  const gemini = useGemini() || { generateReviewer: async () => '' };

  const [isGeneratingNewSet, setIsGeneratingNewSet] = useState(false);

  // Reset test mode when switching activity
  useEffect(() => {
    if (isTestMode) onExitTestMode();
  }, [activeActivity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate overlay in after mount
  // Handle overlay mount/unmount with animation delay
  useEffect(() => {
    if (isTestMode) {
      requestAnimationFrame(() => setOverlayVisible(true));
      setRenderOverlay(true);
      // Wait for next frame so the element is in the DOM before adding transition classes
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOverlayVisible(true));
      });
    } else {
      setOverlayVisible(false);
      // Wait for transition duration (500ms) before unmounting
      const timer = setTimeout(() => {
        setRenderOverlay(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isTestMode]);

  const handleGenerateNewSet = async () => {
    if (!activeActivity?.notes) return;
    setIsGeneratingNewSet(true);
    try {
      const prompt = getFlashcardPrompt(activeActivity.notes, true);
      // @ts-ignore
      const response = await gemini.sendChat([{ id: '1', role: 'user', content: prompt, timestamp: 0 }], 'You are an expert study guide creator. If asked for JSON, return ONLY JSON without markdown formatting.');
      
      let newCards = parseAIJson<any>(response, 'notes-flashcards', 'array');
      if (!Array.isArray(newCards)) {
        if (newCards.flashcards && Array.isArray(newCards.flashcards)) newCards = newCards.flashcards;
        else if (newCards.cards && Array.isArray(newCards.cards)) newCards = newCards.cards;
        else newCards = [];
      }
      
      // Merge reviewed/flagged cards into the new set (prepend them)
      const reviewed = activeActivity.reviewedCards || [];
      if (reviewed.length > 0 && Array.isArray(newCards)) {
        // Filter out any reviewed cards that are already in the new set (by front text)
        const newFronts = new Set(newCards.map((c: any) => c.front));
        const uniqueReviewed = reviewed.filter((r) => !newFronts.has(r.front));
        newCards = [...uniqueReviewed, ...newCards];
      }
      
      onUpdateActivity(activeActivity.id, { techniqueData: newCards });
      setFlashcardProgress(0);
      showToast("New flashcards generated successfully!", "success");
    } catch (e: any) {
      console.error('Generate New Set error:', e);
      if (e.message === 'Gemini API key not configured') {
        alert("Please add VITE_GEMINI_API_KEY to your .env file to use this feature.");
        showToast("Please add VITE_GEMINI_API_KEY to your .env file to use this feature.", "error");
      } else {
        alert(`Failed to generate new flashcards: ${e.message}`);
        showToast(`Failed to generate new flashcards: ${e.message}`, "error");
      }
    } finally {
      setIsGeneratingNewSet(false);
    }
  };

  const handleFlagForReview = useCallback((card: { front: string; back: string; options?: string[] }) => {
    const existing = activeActivity.reviewedCards || [];
    const isExisting = existing.some((r) => r.front === card.front);
    
    if (isExisting) {
      // Remove it (undo flag)
      onUpdateActivity(activeActivity.id, { 
        reviewedCards: existing.filter((r) => r.front !== card.front) 
      });
    } else {
      // Add it
      onUpdateActivity(activeActivity.id, { 
        reviewedCards: [...existing, card] 
      });
    }
  }, [activeActivity, onUpdateActivity]);

  const handleFlashcardProgress = useCallback((visitedCount: number, totalCards: number) => {
    if (totalCards > 0) {
      const pct = Math.round((visitedCount / totalCards) * 100);
      setFlashcardProgress(pct);
    }
  }, []);

  const handleDoubleClick = (activity: Activity) => {
    setEditingTabId(activity.id);
    setEditValue(activity.name);
  };

  const handleRenameSubmit = (id: number) => {
    if (editValue.trim()) {
      onUpdateActivity(id, { name: editValue.trim() });
    }
    setEditingTabId(null);
  };


  if (!activeActivity) return null;

  const isFlashcardTechnique = activeActivity.technique?.toLowerCase().includes('flashcard') && activeActivity.techniqueData;
  const displayProgress = isFlashcardTechnique ? flashcardProgress : activeActivity.progress;

  return (
    <>
    <div className="px-8 pt-4 pb-8">

      <div className="mb-3 flex-shrink-0 flex items-center gap-2 overflow-x-auto border-b border-token pb-3">
        {activities.map((activity) => {
          const isActive = activity.id === selectedActivity;
          return (
            <div
              key={activity.id}
              className="group relative flex items-center"
            >
              <button
                onDoubleClick={() => handleDoubleClick(activity)}
                onClick={() => onSelectActivity(activity.id)}
                className={`rounded-xl px-4 py-2 transition-colors ${
                  isActive
                    ? 'bg-accent-muted font-semibold text-accent'
                    : 'text-muted hover:bg-white/[0.04] hover:text-secondary'
                }`}
              >
                {editingTabId === activity.id ? (
                  <input
                    type="text"
                    value={editValue}
                    autoFocus
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(activity.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(activity.id)}
                    className="w-24 bg-transparent outline-none"
                  />
                ) : (
                  <span className="whitespace-nowrap">{activity.name}</span>
                )}
              </button>
              {activities.length > 1 && (
                <button
                  onClick={() => onRemoveActivity(activity.id)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-surface p-1 text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={onAddActivity}
          className="ml-2 whitespace-nowrap rounded-xl border border-dashed border-token px-4 py-2 text-sm text-secondary transition-colors hover:border-violet-400 hover:text-accent"
        >
          <Plus size={16} className="mr-1 inline" /> Add activity
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col rounded-2xl border border-token bg-surface p-6 min-h-[520px]">
          <div className="mb-4 flex-shrink-0 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-primary">{activeActivity.name}</h3>
                {activeActivity.technique ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-muted px-2.5 py-1 text-2xs font-semibold tracking-wide text-accent uppercase">
                    <PenTool size={12} className="text-accent" />
                    {activeActivity.technique}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-muted px-2.5 py-1 text-2xs font-semibold tracking-wide text-accent uppercase">
                    <BookOpen size={12} className="text-accent" />
                    Study Notes
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-secondary">{activeActivity.subject}</p>
            </div>
            <div className="flex items-center gap-2">
              <ShareActivityButton activityId={activeActivity.id} />
              <button className="rounded-lg p-1.5 text-secondary hover:bg-white/[0.04] hover:text-primary">
                <Settings size={18} />
              </button>
            </div>
          </div>

          {isFlashcardTechnique ? (
            <div className="flex-1 w-full rounded-xl border border-token bg-app overflow-hidden relative flex flex-col">
              {isGeneratingNewSet && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-app/80 backdrop-blur-sm">
                  <Loader2 size={40} className="animate-spin text-accent mb-4" />
                  <p className="text-sm font-medium text-primary">Generating new deck...</p>
                </div>
              )}
              <FlashcardsViewer 
                cards={activeActivity.techniqueData ?? []} 
                onProgressChange={handleFlashcardProgress}
                onFlagForReview={handleFlagForReview}
                reviewedCards={activeActivity.reviewedCards || []}
                isTestMode={isTestMode}
                onFinishTest={onExitTestMode}
                onProceedToTest={onEnterTestMode}
                onUpdateDeck={(newCards) => onUpdateActivity(activeActivity.id, { techniqueData: newCards })}
                onClearReviewed={() => onUpdateActivity(activeActivity.id, { reviewedCards: [] })}
              />
            </div>
          ) : (
            <textarea
              value={activeActivity.notes}
              onChange={(e) => onUpdateActivity(activeActivity.id, { notes: e.target.value })}
              placeholder="Start writing your notes here..."
              className="min-h-[280px] w-full flex-1 resize-none rounded-xl border border-token bg-app p-4 text-secondary placeholder:text-muted focus:border-accent focus:outline-none"
            />
          )}

          <div className="mt-4 flex-shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted">Autosave enabled</span>
            <div className="flex gap-3">
              {isFlashcardTechnique ? (
                <button 
                  onClick={handleGenerateNewSet}
                  disabled={isGeneratingNewSet || isTestMode}
                  className="rounded-xl bg-white/[0.05] px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-white/[0.1] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate New Cards
                </button>
              ) : (
                <button className="rounded-xl bg-white/[0.05] px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-white/[0.1]">
                  Save notes
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative h-full">
          <div className="absolute inset-0 flex flex-col gap-4">
            <div className="rounded-2xl border border-token bg-surface p-4 flex-shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-primary font-medium text-xs">Progress</span>
                <span className="text-[13px] font-bold text-accent">{displayProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-app">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
              {isFlashcardTechnique ? (
                <p className="mt-2 text-xs text-muted">
                  Progress updates as you navigate through flashcards.
                </p>
              ) : (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activeActivity.progress}
                  onChange={(e) => onUpdateActivity(activeActivity.id, { progress: parseInt(e.target.value, 10) })}
                  className="mt-2 w-full accent-violet-500"
                />
              )}
            </div>

            <AIChatPanel
              activeActivity={activeActivity}
              onUpdateActivity={onUpdateActivity}
            />
          </div>
        </div>
      </div>
    </div>

    {/* ── Focus Test Mode Overlay ── */}
    {renderOverlay && (
      <div
        className={`fixed inset-0 z-50 bg-app flex flex-col transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          overlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b border-token">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{activeActivity.name}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-muted px-2.5 py-1 text-2xs font-semibold tracking-wide text-accent uppercase">
              Test Mode
            </span>
          </div>
          <button
            onClick={onExitTestMode}
            className="flex items-center justify-center rounded-xl border border-token bg-white/[0.04] h-9 w-9 text-secondary transition-colors hover:bg-white/[0.08] hover:text-primary"
            title="Exit Test"
          >
            <X size={16} />
          </button>
        </div>

        {/* Enlarged quiz content */}
        <div 
          className={`flex-1 overflow-y-auto flex items-start justify-center py-6 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            overlayVisible ? 'scale-100 translate-y-0' : 'scale-[0.93] translate-y-4'
          }`}
        >
          <div className="w-full max-w-4xl">
            <FlashcardsViewer
              cards={activeActivity.techniqueData ?? []}
              onProgressChange={handleFlashcardProgress}
              onFlagForReview={handleFlagForReview}
              reviewedCards={activeActivity.reviewedCards || []}
              isTestMode={true}
              onFinishTest={onExitTestMode}
              onProceedToTest={onEnterTestMode}
              onUpdateDeck={(newCards) => onUpdateActivity(activeActivity.id, { techniqueData: newCards })}
              onClearReviewed={() => onUpdateActivity(activeActivity.id, { reviewedCards: [] })}
            />
          </div>
        </div>
      </div>
    )}
  </>
  );
}

