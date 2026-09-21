import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Flag, CheckCircle2, XCircle, RefreshCw, Check, BookOpen, PenTool, Meh, Smile, Zap, Shield } from 'lucide-react';
import type { Flashcard } from '../../types';

interface FlashcardsViewerProps {
  cards: Flashcard[];
  onProgressChange?: (currentIndex: number, totalCards: number) => void;
  onFlagForReview?: (card: Flashcard) => void;
  reviewedCards?: Flashcard[];
  isTestMode?: boolean;
  onFinishTest?: () => void;
  onProceedToTest?: () => void;
  onUpdateDeck?: (newCards: Flashcard[]) => void;
  onClearReviewed?: () => void;
  onDeckComplete?: () => void;
}

type StudyMode = 'fast' | 'serious';

export function FlashcardsViewer({
  cards,
  onProgressChange,
  onFlagForReview,
  reviewedCards = [],
  isTestMode = false,
  onFinishTest,
  onProceedToTest,
  onUpdateDeck,
  onClearReviewed,
  onDeckComplete,
}: FlashcardsViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [playDeck, setPlayDeck] = useState<Flashcard[]>(cards);
  const [studyMode, setStudyMode] = useState<StudyMode>('fast');

  // Reset everything when cards change or mode changes
  useEffect(() => {
    setPlayDeck(cards);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setIsFlipped(false);
    setTestResults({});
  }, [cards, isTestMode]);

  // Report progress
  useEffect(() => {
    if (playDeck && playDeck.length > 0) {
      if (currentIndex >= playDeck.length) {
        onProgressChange?.(playDeck.length, playDeck.length);
        const reviewingCount = Object.values(testResults).filter(v => v === false).length;
        if (reviewingCount === 0) {
          onDeckComplete?.();
        }
      } else {
        onProgressChange?.(currentIndex + 1, playDeck.length);
      }
    }
  }, [currentIndex, playDeck.length, onProgressChange, onDeckComplete, testResults]);

  const isReviewed = (card: Flashcard) =>
    reviewedCards.some((r) => r.front === card.front);

  const getRemainingCards = () => {
    if (!isTestMode) return playDeck;
    return playDeck.filter((card) => {
      const isCorrect = testResults[card.front];
      if (isCorrect === undefined) return true;
      if (isCorrect === false) return true;
      if (isReviewed(card)) return true;
      return false;
    });
  };

  const handleSelectOption = (option: string) => {
    if (answered) return;
    setSelectedOption(option);
    setAnswered(true);
    setIsFlipped(true);
    const isCorrect = option === playDeck[currentIndex].back;
    setTestResults((prev) => ({ ...prev, [playDeck[currentIndex].front]: isCorrect }));
  };

  // Crossfade transition — no 3D rotation, no blur
  const goTo = (nextIndex: number) => {
    setIsFlipped(false);
    setTimeout(() => {
      setSelectedOption(null);
      setAnswered(false);
      setCurrentIndex(nextIndex);
    }, 150);
  };

  const handleNext = () => goTo(Math.min(currentIndex + 1, playDeck.length));
  const handlePrev = () => { if (currentIndex > 0) goTo(currentIndex - 1); };

  const handleRestart = () => {
    setPlayDeck(cards);
    setIsFlipped(false);
    setSelectedOption(null);
    setAnswered(false);
    setCurrentIndex(0);
    setTestResults({});
  };

  const handleFinishTest = () => {
    const remaining = getRemainingCards();
    if (onUpdateDeck) {
      onUpdateDeck(remaining);
      onClearReviewed?.();
    }
    onFinishTest?.();
  };

  const shuffledOptions = React.useMemo(() => {
    const card = playDeck[currentIndex];
    if (!card || !card.options || card.options.length !== 4) return [card?.back || ''];
    const opts = [...card.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [playDeck, currentIndex]);

  if (!playDeck || playDeck.length === 0) {
    return <div className="p-8 text-center text-secondary">No flashcards generated.</div>;
  }

  // --- Deck Completed / Auto-loop logic ---
  if (currentIndex >= playDeck.length) {
    const finalKnown = Object.values(testResults).filter(v => v === true).length;
    const finalReviewing = Object.values(testResults).filter(v => v === false).length;
    const total = finalKnown + finalReviewing;
    const pct = total > 0 ? Math.round((finalKnown / total) * 100) : 0;

    if (finalReviewing > 0) {
      const reviewingCards = playDeck.filter((card) => testResults[card.front] === false);
      setTimeout(() => {
        setPlayDeck(reviewingCards);
        setCurrentIndex(0);
        setSelectedOption(null);
        setAnswered(false);
        setIsFlipped(false);
      }, 0);
      return (
        <div className="flex flex-col items-center justify-center p-8 h-full min-h-[300px]">
          <h3 className="mb-2 text-xl font-bold text-primary">Round Complete!</h3>
          <p className="mb-4 text-secondary text-center text-sm">
            {finalReviewing} card{finalReviewing > 1 ? 's' : ''} still need{finalReviewing === 1 ? 's' : ''} review. Let's go again!
          </p>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-success font-semibold">{finalKnown} Known</span>
            <span className="text-amber-400 font-semibold">{finalReviewing} Reviewing</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 h-full min-h-[300px]">
        <h3 className="mb-2 text-2xl font-bold text-primary">All Cards Known! 🎉</h3>
        <p className="mb-2 text-secondary text-center">
          You've mastered all {cards.length} cards in this set.
        </p>
        <div className="mb-6 flex items-center gap-6 text-sm">
          <span className="text-success font-semibold">{finalKnown} Known</span>
          <span className="text-accent font-semibold">{pct}% accuracy</span>
        </div>
        <div className="flex gap-4 mt-4">
          {!isTestMode && (
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] px-6 py-3 text-sm font-medium text-primary transition-colors"
            >
              <RotateCcw size={18} />
              Restart Deck
            </button>
          )}
          {isTestMode ? (
            onFinishTest && (
              <button
                onClick={handleFinishTest}
                className="flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-6 py-3 text-sm font-medium text-primary transition-colors"
              >
                <Check size={18} />
                Finish
              </button>
            )
          ) : (
            onProceedToTest && (
              <button
                onClick={() => { handleRestart(); onProceedToTest(); }}
                className="flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-6 py-3 text-sm font-medium text-primary transition-colors"
              >
                <ChevronRight size={18} />
                Proceed to Quiz
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  // --- Active Card ---
  const card = playDeck[currentIndex];
  const hasMultipleChoice = isTestMode && shuffledOptions.length === 4;
  const currentCorrect = Object.values(testResults).filter(v => v === true).length;
  const currentIncorrect = Object.values(testResults).filter(v => v === false).length;

  return (
    <div className="flex flex-col w-full min-h-[420px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
        {/* Tracker Header */}
        <div className="w-full mb-1 flex flex-col gap-3">
          {/* Progress Bar Row */}
          <div className="flex items-center w-full mt-3 mb-1">
            <div className="relative flex-1 h-2 bg-white/[0.05] rounded-full">
              <div
                className="absolute top-0 left-0 h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${playDeck.length > 0 ? Math.round(((currentIndex + 1) / playDeck.length) * 100) : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-accent/20 text-accent text-2xs font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md border border-accent/30 shadow-sm whitespace-nowrap">
                  {playDeck.length > 0 ? Math.round(((currentIndex + 1) / playDeck.length) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="flex gap-4 w-full">
            <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <BookOpen size={14} className="text-blue-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary leading-tight">{playDeck.length - (currentCorrect + currentIncorrect)}</span>
                <span className="text-2xs font-medium text-blue-500">Learning</span>
              </div>
            </div>

            <div className="flex-1 bg-slate-500/10 border border-slate-500/20 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-slate-500/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(100,116,139,0.2)]">
                <PenTool size={14} className="text-muted" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary leading-tight">{currentIncorrect}</span>
                <span className="text-2xs font-medium text-muted">Reviewing</span>
              </div>
            </div>

            <div className="flex-1 bg-success-muted border border-success/20 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Check size={14} className="text-success" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary leading-tight">{currentCorrect}</span>
                <span className="text-2xs font-medium text-success">Known</span>
              </div>
            </div>
          </div>
        </div>

        {/* Flashcard — proper 3D flip with preserve-3d to avoid blur */}
        <div 
          className={`relative w-full h-64 ${(!hasMultipleChoice || answered) ? 'cursor-pointer' : ''}`}
          style={{ perspective: '1000px' }}
          onClick={() => {
            if (hasMultipleChoice && !answered) return;
            setIsFlipped(f => !f);
          }}
        >
          <div 
            className="w-full h-full relative"
            style={{ 
              transition: 'transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)', 
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)'
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-accent/20 bg-surface p-6 text-center shadow-sm"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <h3 className="text-lg font-medium text-primary leading-relaxed">{card.front}</h3>
              {(!isTestMode || (!answered && !hasMultipleChoice)) && (
                <p className="absolute bottom-4 text-2xs font-medium text-accent/80 flex items-center gap-1 uppercase tracking-widest">
                  <RefreshCw size={12} /> Click to flip
                </p>
              )}
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-accent/20 bg-surface p-6 text-center shadow-sm"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
            >
              <p className="text-base font-medium text-secondary whitespace-pre-wrap leading-relaxed">{card.back}</p>
            </div>
          </div>
        </div>

        {/* Test Mode: Multiple-Choice Options */}
        {hasMultipleChoice && (
          <div className="w-full max-w-4xl grid grid-cols-2 gap-2 mb-4">
            {shuffledOptions.map((option, idx) => {
              const isCorrect = option === card.back;
              const isSelected = selectedOption === option;
              let optionStyle = 'border border-token bg-white/[0.03] text-secondary hover:bg-white/[0.07] hover:border-token';
              if (answered) {
                if (isCorrect) {
                  optionStyle = 'border border-success/40 bg-success-muted text-success';
                } else if (isSelected && !isCorrect) {
                  optionStyle = 'border border-red-500/40 bg-red-500/15 text-red-300';
                } else {
                  optionStyle = 'border border-token bg-white/[0.01] text-muted';
                }
              }
              return (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); handleSelectOption(option); }}
                  disabled={answered}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${optionStyle} disabled:cursor-default`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-token text-xs">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {answered && isCorrect && <CheckCircle2 size={16} className="text-success shrink-0" />}
                  {answered && isSelected && !isCorrect && <XCircle size={16} className="text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls */}
        {isTestMode ? (
          answered && (
            <div className="flex w-full max-w-4xl items-center justify-between mt-2">
              <button
                onClick={() => onFlagForReview?.(card)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  isReviewed(card)
                    ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-white/[0.05] text-secondary hover:bg-white/[0.1]'
                }`}
              >
                <Flag size={14} />
                {isReviewed(card) ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 btn btn-primary"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center w-full mt-4 gap-2">
            {/* Single row: [Left Action] [Mode Toggle] [Right Action] clustered together */}
            <div className="flex items-center justify-center gap-5">
              
              {/* Left Component */}
              {studyMode === 'fast' ? (
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  title="Previous Card"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-primary transition-colors disabled:opacity-30 disabled:hover:bg-white/[0.05] shrink-0"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const front = card.front;
                    setTestResults((prev) => ({ ...prev, [front]: false }));
                    handleNext();
                  }}
                  title="Needs review"
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shrink-0 ${
                    testResults[card.front] === false
                      ? 'bg-slate-500 text-primary shadow-[0_0_15px_rgba(100,116,139,0.5)] scale-110'
                      : 'bg-slate-500/20 text-muted hover:bg-slate-500/30'
                  }`}
                >
                  <Meh size={20} />
                </button>
              )}

              {/* Centre: Segmented Mode Toggle */}
              <div className="flex items-center rounded-xl border border-token bg-raised p-1 w-[180px]">
                <button
                  onClick={() => setStudyMode('fast')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    studyMode === 'fast'
                      ? 'bg-accent !text-white shadow-sm'
                      : 'text-muted hover:text-secondary'
                  }`}
                >
                  <Zap size={12} />
                  Fast
                </button>
                <button
                  onClick={() => setStudyMode('serious')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    studyMode === 'serious'
                      ? 'bg-accent !text-white shadow-sm'
                      : 'text-muted hover:text-secondary'
                  }`}
                >
                  <Shield size={12} />
                  Serious
                </button>
              </div>

              {/* Right Component */}
              {studyMode === 'fast' ? (
                <button
                  onClick={handleNext}
                  title="Next Card"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-primary transition-colors shrink-0"
                >
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const front = card.front;
                    setTestResults((prev) => ({ ...prev, [front]: true }));
                    handleNext();
                  }}
                  title="Got it!"
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all shrink-0 ${
                    testResults[card.front] === true
                      ? 'bg-success text-primary shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110'
                      : 'bg-success/20 text-success hover:bg-success/30'
                  }`}
                >
                  <Smile size={20} />
                </button>
              )}
            </div>

            {/* Hint when serious and unmarked */}
            {studyMode === 'serious' && testResults[card.front] === undefined && (
              <span className="text-2xs text-muted">Mark the card to continue</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
