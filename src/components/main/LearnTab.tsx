import { useState, useCallback, useEffect } from 'react';
import type { Activity } from '../../types';
import { Loader2, X, ChevronDown, Share2 } from 'lucide-react';
import { FlashcardsViewer } from './FlashcardsViewer';
import { QuizViewer } from './QuizViewer';
import { TestModeViewer } from './TestModeViewer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useStudyGroups } from '../../hooks/useStudyGroups';
import { useAIQueue } from '../../hooks/useAIQueue';

function ShareActivityButton({ activityId }: { activityId: number }) {
  const { groups, shareActivity } = useStudyGroups();
  const [sharing, setSharing] = useState(false);

  const handleShare = async (groupId: string) => {
    setSharing(true);
    try {
      await shareActivity(groupId, activityId);
    } catch (err: any) {
      console.warn('Share error:', err.message);
    } finally {
      setSharing(false);
    }
  };

  if (groups.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 bg-surface border border-token text-secondary text-sm font-medium px-4 py-2 rounded-xl outline-none cursor-pointer hover:bg-white/[0.04] hover:text-primary transition-colors shadow-sm" disabled={sharing}>
        <Share2 size={16} className="opacity-70" />
        {sharing ? 'Sharing...' : 'Share to Group'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-3 py-2 text-2xs font-semibold text-secondary uppercase tracking-wide">
          Select Group
        </div>
        {groups.map((g) => (
          <DropdownMenuItem
            key={g.id}
            onClick={() => handleShare(g.id)}
            className="cursor-pointer"
          >
            {g.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface LearnTabProps {
  activities: Activity[];
  selectedActivity: number;
  onUpdateActivity: (id: number, updates: Partial<Activity>) => void;
  isTestMode: boolean;
  onEnterTestMode: () => void;
  onExitTestMode: () => void;
  addXP?: (amount: number, eventKey?: string) => void;
}

export function LearnTab({
  activities,
  selectedActivity,
  onUpdateActivity,
  isTestMode,
  onEnterTestMode,
  onExitTestMode,
  addXP,
}: LearnTabProps) {
  const [renderOverlay, setRenderOverlay] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizCooldown, setQuizCooldown] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const activeActivity = activities.find((a) => a.id === selectedActivity) || activities[0];

  // Reset test mode when switching activity
  useEffect(() => {
    if (isTestMode) onExitTestMode();
  }, [activeActivity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overlay mount/unmount with animation
  useEffect(() => {
    if (isTestMode) {
      setRenderOverlay(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOverlayVisible(true));
      });
    } else {
      setOverlayVisible(false);
      const timer = setTimeout(() => setRenderOverlay(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isTestMode]);

  const { enqueueJob } = useAIQueue();

  const handleGenerateQuizFromFlashcards = async () => {
    if (quizCooldown || isGeneratingQuiz) return;

    setQuizError(null);
    setQuizCooldown(true);
    setTimeout(() => setQuizCooldown(false), 3000);

    setIsGeneratingQuiz(true);
    try {
      // We now trigger the backend queue. The Edge function reads activities.notes directly.
      const validQuestions = await enqueueJob(activeActivity.id, 'quiz');
      
      if (Array.isArray(validQuestions) && validQuestions.length > 0) {
        // Safe-guard: explicitly merge if needed, though edge function already updates the DB!
        // But since we have local state in 'activities' hook, we should update local state too.
        onUpdateActivity(activeActivity.id, { quizData: validQuestions });
      } else {
        setQuizError('Could not generate quiz questions. Please try again.');
      }
    } catch (e: any) {
      console.error('Quiz generation error via Queue:', e);
      setQuizError('Something went wrong while generating the quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleFlagForReview = useCallback((card: { front: string; back: string; options?: string[] }) => {
    const existing = activeActivity.reviewedCards || [];
    const isExisting = existing.some((r) => r.front === card.front);
    if (isExisting) {
      onUpdateActivity(activeActivity.id, { reviewedCards: existing.filter((r) => r.front !== card.front) });
    } else {
      onUpdateActivity(activeActivity.id, { reviewedCards: [...existing, card] });
    }
  }, [activeActivity, onUpdateActivity]);

  const handleGenerateTestQuestions = async (timeLimitSeconds: number) => {
    if (isGeneratingTest) return;
    setTestError(null);
    setIsGeneratingTest(true);
    try {
      // Trigger backend AI queue
      const questions = await enqueueJob(activeActivity.id, 'test');
      
      const validQuestions = Array.isArray(questions)
        ? questions.filter(
            (q) =>
              q.question &&
              (q.answer_type === 'single' || q.answer_type === 'multiple') &&
              Array.isArray(q.options) &&
              Array.isArray(q.correct_options) &&
              q.correct_options.length >= 1
          )
        : [];

      if (validQuestions.length > 0) {
        // Enforce the time cap locally by slicing the valid questions
        const cap = timeLimitSeconds === 300 ? 8 : timeLimitSeconds === 600 ? 13 : 20;
        const clampedQuestions = validQuestions.length > cap ? validQuestions.slice(0, cap) : validQuestions;

        onUpdateActivity(activeActivity.id, { testData: clampedQuestions });
      } else {
        setTestError('AI returned no valid questions. Please try again.');
      }
    } catch (e: any) {
      console.error('Test generation error via Queue:', e);
      setTestError('Something went wrong generating the test. Please try again.');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  if (!activeActivity) return null;

  const isFlashcardTechnique = !!activeActivity.technique?.toLowerCase().includes('flashcard');
  const isQuizTechnique = activeActivity.technique?.toLowerCase() === 'quiz';
  const isTestModeTechnique = activeActivity.technique?.toLowerCase() === 'test mode';

  // ── On-demand quiz generation ──
  // When the user switches to Quiz tab for the first time, auto-generate if there's no quiz yet.
  useEffect(() => {
    if (!isQuizTechnique) return;
    if (activeActivity.quizData && activeActivity.quizData.length > 0) return; // already have one
    if (!activeActivity.techniqueData || activeActivity.techniqueData.length === 0) return; // no flashcards yet
    if (isGeneratingQuiz) return; // already in progress
    handleGenerateQuizFromFlashcards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuizTechnique, activeActivity?.id]);

  return (
    <>
      {/* Main scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="px-8 pt-4 pb-8">

          {/* Flex layout for sliding sidebar */}
          <div className="flex gap-5 relative overflow-hidden">
            {/* Left: Flashcard or notes */}
            <div className="flex-1 flex flex-col min-h-[520px] transition-all duration-300 min-w-0">
              {/* Header */}
              <div className="mb-4 w-full flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-primary">Learn</h2>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-medium">{activeActivity.name}</span>
                    {activeActivity.subject ? `: ${activeActivity.subject}` : ''}
                  </p>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-3">
                  <ShareActivityButton activityId={activeActivity.id} />
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-2 bg-surface border border-token text-secondary text-sm font-medium px-4 py-2 rounded-xl outline-none cursor-pointer hover:bg-white/[0.04] hover:text-primary transition-colors shadow-sm">
                      {activeActivity.technique || 'Study Notes'}
                      <ChevronDown size={16} className="opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {['Study Notes', 'Flashcards', 'Quiz', 'Test Mode', 'Feynman Technique', 'Active Recall', 'Spaced Repetition', 'Interleaving'].map((tech) => (
                        <DropdownMenuItem 
                          key={tech} 
                          onClick={() => onUpdateActivity(activeActivity.id, { technique: tech === 'Study Notes' ? undefined : tech })}
                        >
                          {tech === 'Test Mode' ? '🧪 ' : ''}{tech}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Content area — always render all three, show/hide via CSS to preserve state */}

              {/* FLASHCARDS */}
              <div className={isFlashcardTechnique ? "flex-1 relative flex flex-col min-h-0" : "hidden"}>
                {activeActivity.techniqueData && activeActivity.techniqueData.length > 0 ? (
                  <FlashcardsViewer
                    cards={activeActivity.techniqueData}
                    onFlagForReview={handleFlagForReview}
                    reviewedCards={activeActivity.reviewedCards || []}
                    isTestMode={isTestMode}
                    onFinishTest={onExitTestMode}
                    onProceedToTest={() => onUpdateActivity(activeActivity.id, { technique: 'Quiz' })}
                    onUpdateDeck={(newCards) => onUpdateActivity(activeActivity.id, { techniqueData: newCards })}
                    onClearReviewed={() => onUpdateActivity(activeActivity.id, { reviewedCards: [] })}
                    onDeckComplete={() => addXP?.(5, `flashcard-${activeActivity.id}`)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <p className="text-sm text-muted">No flashcards generated yet for this activity.</p>
                    <p className="text-xs text-muted">Upload a file to auto-generate flashcards, or switch to "Study Notes" to add notes manually.</p>
                  </div>
                )}
              </div>

              {/* QUIZ */}
              <div className={isQuizTechnique ? "flex-1 relative flex flex-col min-h-0" : "hidden"}>
                {isGeneratingQuiz && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-app/80 backdrop-blur-sm rounded-2xl">
                    <Loader2 size={40} className="animate-spin text-accent mb-4" />
                    <p className="text-sm font-medium text-primary">Generating quiz with AI...</p>
                  </div>
                )}
                {quizError && !isGeneratingQuiz && (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <span className="text-sm text-red-300">{quizError}</span>
                    <button onClick={() => setQuizError(null)} className="ml-auto text-red-400 hover:text-red-200 text-lg leading-none">×</button>
                  </div>
                )}
                {activeActivity.quizData && activeActivity.quizData.length > 0 ? (
                  <QuizViewer
                    questions={activeActivity.quizData}
                    onRegenerateQuiz={handleGenerateQuizFromFlashcards}
                    isRegenerating={isGeneratingQuiz}
                    onQuizComplete={(score) => addXP?.(10 + Math.round(score / 2), `quiz-${activeActivity.id}`)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <p className="text-sm text-muted">No quiz generated yet. Generate flashcards first, then create a quiz.</p>
                    <button
                      onClick={handleGenerateQuizFromFlashcards}
                      disabled={isGeneratingQuiz || quizCooldown || !activeActivity.techniqueData || activeActivity.techniqueData.length === 0}
                      className="btn btn-primary"
                    >
                      {isGeneratingQuiz ? 'Generating...' : quizCooldown ? 'Please wait\u2026' : 'Create Quiz from Flashcards'}
                    </button>
                  </div>
                )}
              </div>

              {/* TEST MODE */}
              <div className={isTestModeTechnique ? "flex-1 flex flex-col min-h-0" : "hidden"}>
                <TestModeViewer
                  activityName={activeActivity.name}
                  questions={activeActivity.testData ?? []}
                  totalFlashcards={activeActivity.techniqueData?.length || 0}
                  isGenerating={isGeneratingTest}
                  generateError={testError}
                  onGenerateQuestions={handleGenerateTestQuestions}
                  onExit={() => onUpdateActivity(activeActivity.id, { technique: 'Flashcards' })}
                  onTestStateChange={(isActive) => {
                    if (isActive) onEnterTestMode();
                    else onExitTestMode();
                  }}
                />
              </div>

              {/* STUDY NOTES / other techniques */}
              <div className={(!isFlashcardTechnique && !isQuizTechnique && !isTestModeTechnique) ? "flex-1 flex flex-col min-h-0" : "hidden"}>
                <textarea
                  value={activeActivity.notes}
                  onChange={(e) => onUpdateActivity(activeActivity.id, { notes: e.target.value })}
                  placeholder="Start writing your notes here..."
                  className="flex-1 min-h-[280px] w-full resize-none rounded-xl border border-token bg-app p-4 text-secondary placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Focus Test Mode Overlay ── */}
      {renderOverlay && isFlashcardTechnique && (
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
