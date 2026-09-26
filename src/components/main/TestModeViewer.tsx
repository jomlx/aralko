import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  LogOut,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trophy,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { TestQuestion } from '../../types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TestModeViewerProps {
  activityName: string;
  questions: TestQuestion[];
  totalFlashcards: number;
  isGenerating: boolean;
  generateError: string | null;
  onGenerateQuestions: (timeLimitSeconds: number) => void;
  onExit: () => void;
  onTestStateChange?: (isActive: boolean) => void;
}

type Phase = 'setup' | 'test' | 'results';

const TIME_PRESETS = [
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────
// ExitConfirmDialog
// ─────────────────────────────────────────────
function ExitConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-token bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-warning" />
          </div>
          <div>
            <p className="font-semibold text-primary">Exit Test?</p>
            <p className="text-xs text-secondary mt-0.5">Your progress will be lost.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-token py-2.5 text-sm font-medium text-secondary hover:bg-white/[0.05] transition-colors"
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/30 py-2.5 text-sm font-semibold text-danger transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Setup Screen
// ─────────────────────────────────────────────
function SetupScreen({
  activityName,
  questions,
  totalFlashcards,
  isGenerating,
  generateError,
  onGenerateQuestions,
  onStart,
  onExit,
}: {
  activityName: string;
  questions: TestQuestion[];
  totalFlashcards: number;
  isGenerating: boolean;
  generateError: string | null;
  onGenerateQuestions: (seconds: number) => void;
  onStart: (timeLimitSeconds: number) => void;
  onExit: () => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState(TIME_PRESETS[1]); // default 10 min

  const expectedCap =
    selectedPreset.seconds === 300 ? 8 : selectedPreset.seconds === 600 ? 13 : 20;
  const expectedQuestions = Math.min(totalFlashcards, expectedCap);
  
  const hasQuestions = questions.length > 0;
  // It's a mismatch if they change to a shorter time limit than what they generated for,
  // resulting in too many questions for the new limit. (If AI generated fewer than expected, that's fine).
  const isMismatch = hasQuestions && questions.length > expectedQuestions;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-muted px-3 py-1 text-xs font-semibold text-accent uppercase tracking-wider mb-4">
            Test Mode
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">{activityName}</h1>
          <p className="text-sm text-secondary">
            {hasQuestions && !isMismatch
              ? `${questions.length} questions ready — single-answer & multi-select mixed`
              : 'Generate questions from your flashcards to begin'}
          </p>
        </div>

        {/* Generate / Regenerate */}
        <div className="rounded-2xl border border-token bg-surface p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">Questions</p>
            {hasQuestions && !isMismatch && (
              <span className="text-xs text-secondary bg-white/[0.05] border border-token rounded-full px-2.5 py-1">
                {questions.length} questions
              </span>
            )}
          </div>

          {generateError && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
              <XCircle size={15} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300 flex-1">{generateError}</p>
            </div>
          )}
          
          {isMismatch && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2.5">
              <AlertTriangle size={15} className="text-warning shrink-0" />
              <p className="text-xs text-warning-foreground flex-1">Time limit changed. Please regenerate questions to match the {selectedPreset.label} format ({expectedQuestions} questions).</p>
            </div>
          )}

          <button
            onClick={() => onGenerateQuestions(selectedPreset.seconds)}
            disabled={isGenerating || totalFlashcards === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-token bg-white/[0.04] hover:bg-white/[0.07] py-2.5 text-sm font-medium text-secondary transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating with AI…
              </>
            ) : hasQuestions && !isMismatch ? (
              <>
                <RefreshCw size={15} />
                Regenerate Questions
              </>
            ) : isMismatch ? (
              <>
                <RefreshCw size={15} />
                Generate for {selectedPreset.label}
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Generate Questions from Flashcards
              </>
            )}
          </button>
          {totalFlashcards === 0 && !isGenerating && (
            <p className="mt-2 text-center text-xs text-muted">
              Flashcards must exist before generating test questions.
            </p>
          )}
        </div>

        {/* Time Limit */}
        <div className="rounded-2xl border border-token bg-surface p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-primary">Time Limit</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                onClick={() => setSelectedPreset(preset)}
                className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  selectedPreset.seconds === preset.seconds
                    ? 'border-accent/50 bg-accent-muted text-accent'
                    : 'border-token bg-white/[0.03] text-secondary hover:bg-white/[0.06]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-2 rounded-xl border border-token px-5 py-3 text-sm font-medium text-secondary hover:bg-white/[0.05] transition-colors"
          >
            <LogOut size={15} />
            Cancel
          </button>
          <button
            onClick={() => onStart(selectedPreset.seconds)}
            disabled={!hasQuestions || isGenerating || isMismatch}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Test
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Test Screen
// ─────────────────────────────────────────────
function TestScreen({
  activityName,
  questions,
  timeLimit,
  onSubmit,
  onExit,
}: {
  activityName: string;
  questions: TestQuestion[];
  timeLimit: number;
  onSubmit: (answers: Record<number, string[]>, timeUsed: number) => void;
  onExit: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [secondsLeft, setSecondsLeft] = useState(timeLimit);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const timeUsedRef = useRef(0);

  // Shuffle options for each question
  useEffect(() => {
    setShuffledOptions(shuffleArray(questions[currentIndex]?.options ?? []));
  }, [currentIndex, questions]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      onSubmit(answers, timeLimit);
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        timeUsedRef.current = timeLimit - s + 1;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft, answers, timeLimit, onSubmit]);

  const question = questions[currentIndex];
  if (!question) return <div className="flex-1 flex flex-col items-center justify-center p-8"><p className="text-secondary mb-4">No questions available.</p><button onClick={onExit} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">Exit</button></div>;
    const isMulti = question.answer_type === 'multiple';
  const currentAnswer = answers[currentIndex] ?? [];

  const toggleOption = (option: string) => {
    if (isMulti) {
      setAnswers((prev) => {
        const cur = prev[currentIndex] ?? [];
        return {
          ...prev,
          [currentIndex]: cur.includes(option)
            ? cur.filter((o) => o !== option)
            : [...cur, option],
        };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [currentIndex]: [option] }));
    }
  };

  const handleExitRequest = () => {
    const answered = Object.keys(answers).length;
    if (answered > 0) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  };

  const timerPct = (secondsLeft / timeLimit) * 100;
  const timerColor =
    timerPct > 50 ? 'text-success' : timerPct > 20 ? 'text-warning' : 'text-danger';
  const timerBarColor =
    timerPct > 50
      ? 'bg-success'
      : timerPct > 20
      ? 'bg-amber-400'
      : 'bg-danger';
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {showExitConfirm && (
        <ExitConfirmDialog
          onConfirm={onExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      {/* Test top bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-8 py-3 border-b border-token bg-surface/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-semibold text-primary truncate">{activityName}</span>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent-muted px-2 py-0.5 text-2xs font-semibold text-accent uppercase tracking-wider">
            Test Mode
          </span>
        </div>

        {/* Counter */}
        <span className="shrink-0 text-sm text-secondary font-medium">
          {currentIndex + 1} / {questions.length}
        </span>

        {/* Timer */}
        <div className={`shrink-0 flex items-center gap-1.5 font-mono text-base font-bold ${timerColor}`}>
          <Clock size={16} />
          {formatTime(secondsLeft)}
        </div>

        {/* Exit */}
        <button
          onClick={handleExitRequest}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-token px-3 py-1.5 text-xs font-medium text-secondary hover:bg-white/[0.05] hover:text-primary transition-colors"
        >
          <LogOut size={14} />
          Exit
        </button>
      </div>

      {/* Timer progress bar */}
      <div className="flex-shrink-0 h-1 bg-white/[0.05]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${timerBarColor}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-5">

          {/* Question progress dots */}
          <div className="flex flex-wrap gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                title={`Question ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === currentIndex
                    ? 'bg-accent'
                    : answers[i]?.length
                    ? 'bg-success/70'
                    : 'bg-white/[0.12]'
                }`}
              />
            ))}
          </div>

          {/* Question card */}
          <div className="rounded-2xl border border-accent/20 bg-surface p-6 shadow-sm">
            {isMulti && (
              <p className="text-2xs font-semibold uppercase tracking-widest text-accent mb-2">
                Select all that apply
              </p>
            )}
            <span className="text-2xs font-semibold uppercase tracking-widest text-muted mb-2 block">
              Question {currentIndex + 1}
              {isMulti ? '' : ' · Single answer'}
            </span>
            <p className="text-base font-medium text-primary leading-relaxed">{question.question}</p>
          </div>

          {/* Options */}
          <div className={`grid ${isMulti ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
            {shuffledOptions.map((option, idx) => {
              const isSelected = currentAnswer.includes(option);
              return (
                <button
                  key={idx}
                  onClick={() => toggleOption(option)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-all border ${
                    isSelected
                      ? 'border-accent/50 bg-accent-muted text-accent'
                      : 'border-token bg-white/[0.03] text-secondary hover:bg-white/[0.07] hover:border-accent/20 cursor-pointer'
                  }`}
                >
                  {/* Indicator */}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs font-bold transition-colors ${
                      isMulti
                        ? `rounded-md ${isSelected ? 'border-accent/50 bg-accent text-white' : 'border-token'}`
                        : `rounded-full ${isSelected ? 'border-accent/50 bg-accent text-white' : 'border-token text-muted'}`
                    }`}
                  >
                    {isMulti
                      ? isSelected
                        ? '✓'
                        : ''
                      : isSelected
                      ? '●'
                      : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-xl border border-token px-4 py-2 text-sm font-medium text-secondary hover:bg-white/[0.05] disabled:opacity-30 transition-colors"
            >
              ← Previous
            </button>

            <span className="text-xs text-muted">
              {answeredCount} of {questions.length} answered
            </span>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="flex items-center gap-2 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/20 px-4 py-2 text-sm font-semibold text-accent transition-colors"
              >
                Next <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => onSubmit(answers, timeLimit - secondsLeft)}
                className="flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-5 py-2 text-sm font-semibold text-white transition-colors"
              >
                Submit Test <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Results Screen
// ─────────────────────────────────────────────
function ResultsScreen({
  questions,
  answers,
  timeUsed,
  timeLimit,
  onRetake,
  onExit,
}: {
  questions: TestQuestion[];
  answers: Record<number, string[]>;
  timeUsed: number;
  timeLimit: number;
  onRetake: () => void;
  onExit: () => void;
}) {
  // Score each question
  const scored = questions.map((q, i) => {
    const given = answers[i] ?? [];
    const correct = q.correct_options;

    const isCorrect =
      given.length === correct.length &&
      correct.every((c) => given.includes(c));

    // For multi, track which were missed or wrong
    const missed = correct.filter((c) => !given.includes(c));
    const wrong = given.filter((g) => !correct.includes(g));

    return { q, given, correct, isCorrect, missed, wrong, skipped: given.length === 0 };
  });

  const correctCount = scored.filter((s) => s.isCorrect).length;
  const pct = Math.round((correctCount / questions.length) * 100);
  const grade =
    pct >= 90
      ? '🏆 Excellent!'
      : pct >= 75
      ? '🎉 Great job!'
      : pct >= 60
      ? '👍 Good effort!'
      : '📚 Keep studying!';

  const timeUsedDisplay = formatTime(Math.min(timeUsed, timeLimit));

  return (
    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Score card */}
        <div className="rounded-2xl border border-token bg-surface p-8 flex flex-col items-center gap-4 text-center">
          <p className="text-3xl">{grade}</p>
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl font-bold text-primary">{pct}%</span>
            <span className="text-sm text-secondary">
              {correctCount} / {questions.length} correct
            </span>
          </div>
          <div className="w-full h-3 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                pct >= 75
                  ? 'bg-gradient-to-r from-success to-emerald-500'
                  : pct >= 60
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-red-500 to-rose-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-6 text-sm text-secondary mt-2">
            <span>⏱ Time used: <strong className="text-primary">{timeUsedDisplay}</strong></span>
            <span>📝 Skipped: <strong className="text-primary">{scored.filter((s) => s.skipped).length}</strong></span>
          </div>
        </div>

        {/* Per-question review */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
            Question Review
          </p>
          {scored.map(({ q, correct, isCorrect, missed, wrong, skipped }, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3.5 text-sm ${
                isCorrect
                  ? 'bg-success-muted border-success/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5">
                  {isCorrect ? (
                    <CheckCircle2 size={16} className="text-success" />
                  ) : (
                    <XCircle size={16} className="text-red-400" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-secondary leading-snug line-clamp-3">{q.question}</p>

                  {/* Type badge */}
                  <span className="inline-block mt-1 text-2xs font-semibold text-muted uppercase tracking-wide">
                    {q.answer_type === 'multiple' ? 'Multi-select' : 'Single answer'}
                  </span>

                  {/* If wrong — show breakdown */}
                  {!isCorrect && !skipped && (
                    <div className="mt-2 flex flex-col gap-1">
                      {missed.length > 0 && (
                        <p className="text-2xs text-success">
                          Missed: {missed.join(', ')}
                        </p>
                      )}
                      {wrong.length > 0 && (
                        <p className="text-2xs text-red-400">
                          Wrongly selected: {wrong.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {skipped && (
                    <p className="mt-1 text-2xs text-muted">Not answered</p>
                  )}

                  {/* Correct answers always shown on miss */}
                  {!isCorrect && (
                    <p className="mt-1 text-2xs text-success">
                      Correct: {correct.join(', ')}
                    </p>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <p className="mt-1.5 text-2xs text-muted italic">{q.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={onRetake}
            className="flex items-center gap-2 rounded-xl border border-token bg-white/[0.04] hover:bg-white/[0.08] px-5 py-2.5 text-sm font-medium text-primary transition-colors"
          >
            <RotateCcw size={15} /> Retake Test
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <Trophy size={15} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export — orchestrates phases
// ─────────────────────────────────────────────
export function TestModeViewer({
  activityName,
  questions,
  totalFlashcards,
  isGenerating,
  generateError,
  onGenerateQuestions,
  onExit,
  onTestStateChange,
}: TestModeViewerProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(600);
  const [testAnswers, setTestAnswers] = useState<Record<number, string[]>>({});
  const [timeUsed, setTimeUsed] = useState(0);
  // Shuffle questions once when test starts so order is randomised
  const [activeQuestions, setActiveQuestions] = useState<TestQuestion[]>([]);

  const handleStart = useCallback(
    (seconds: number) => {
      setTimeLimitSeconds(seconds);
      setActiveQuestions(shuffleArray(questions));
      setPhase('test');
      onTestStateChange?.(true);
    },
    [questions, onTestStateChange]
  );

  const handleSubmit = useCallback((answers: Record<number, string[]>, used: number) => {
    setTestAnswers(answers);
    setTimeUsed(used);
    setPhase('results');
    setPhase('setup'); setTestAnswers({}); setTimeUsed(0); onTestStateChange?.(false);
  }, [onTestStateChange]);

  const handleRetake = useCallback(() => {
    setActiveQuestions(shuffleArray(questions));
    setPhase('test');
    onTestStateChange?.(true);
  }, [questions, onTestStateChange]);

  const handleExit = useCallback(() => {
    setPhase('setup'); setTestAnswers({}); setTimeUsed(0); onTestStateChange?.(false);
    onExit();
  }, [onExit, onTestStateChange]);

  if (phase === 'setup') {
    return (
      <SetupScreen
        activityName={activityName}
        questions={questions}
        totalFlashcards={totalFlashcards}
        isGenerating={isGenerating}
        generateError={generateError}
        onGenerateQuestions={onGenerateQuestions}
        onStart={handleStart}
        onExit={handleExit}
      />
    );
  }

  if (phase === 'test') {
    return (
      <TestScreen
        activityName={activityName}
        questions={activeQuestions}
        timeLimit={timeLimitSeconds}
        onSubmit={handleSubmit}
        onExit={handleExit}
      />
    );
  }

  return (
    <ResultsScreen
      questions={activeQuestions}
      answers={testAnswers}
      timeUsed={timeUsed}
      timeLimit={timeLimitSeconds}
      onRetake={handleRetake}
      onExit={handleExit}
    />
  );
}

