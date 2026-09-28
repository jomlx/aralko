import { useState, useEffect } from 'react';
import { ChevronRight, CheckCircle2, XCircle, RotateCcw, Trophy, Check } from 'lucide-react';
import type { QuizQuestion } from '../../types';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';

interface QuizViewerProps {
  questions: QuizQuestion[];
  onRegenerateQuiz?: () => void;
  isRegenerating?: boolean;
  onQuizComplete?: (score: number, total: number) => void;
}

function QuizSummary({
  pct, passed, grade, totalCorrect, activeQuestions, results, onRestart, onRegenerate, isRegenerating,
}: {
  pct: number;
  passed: boolean;
  grade: string;
  totalCorrect: number;
  activeQuestions: QuizQuestion[];
  results: Record<number, boolean>;
  onRestart: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
  useEffect(() => {
    try {
      const audio = new Audio(passed ? '/sounds/passed.wav' : '/sounds/failed.wav');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (_) {}
  }, [passed]);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 py-6">
      {/* Score card */}
      <div className="w-full bg-surface border border-token rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
        <p className="text-3xl">{grade}</p>
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl font-bold text-primary">{pct}%</span>
          <span className="text-sm text-secondary">{totalCorrect} / {activeQuestions.length} correct</span>
        </div>
        <div className="w-full h-3 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pct >= 75 ? 'bg-gradient-to-r from-success to-emerald-500'
              : pct >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-red-500 to-rose-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-question Accordion review */}
      <div className="w-full flex flex-col gap-1">
        <Accordion className="w-full rounded-xl border border-token overflow-hidden bg-surface">
          <AccordionItem value="review" className="border-none">
            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-white/[0.02]">
              <span className="font-semibold text-secondary uppercase tracking-wider text-xs">Question Review</span>
            </AccordionTrigger>
            <AccordionContent className="p-0 border-t border-token flex flex-col">
              {activeQuestions.map((q, i) => {
                const isCorrect = results[i] === true;
                const isWrong = results[i] === false;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-5 py-4 text-sm border-b border-token last:border-b-0 ${
                      isCorrect ? 'bg-success-muted'
                      : isWrong  ? 'bg-red-500/10'
                      : 'bg-white/[0.01]'
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">
                      {isCorrect ? <CheckCircle2 size={16} className="text-success" />
                      : isWrong  ? <XCircle size={16} className="text-red-400" />
                      : <span className="w-4 h-4 rounded-full border border-slate-600 inline-block" />}
                    </span>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="text-secondary leading-snug">{q.question}</span>
                      {isWrong && (
                        <p className="mt-1 text-2xs text-success"><Check size={12} className="inline mr-1" />Correct answer: {q.answer}</p>
                      )}
                      {isCorrect && (
                        <p className="mt-1 text-2xs text-success"><Check size={12} className="inline mr-1" />{q.answer}</p>
                      )}
                      {results[i] === undefined && (
                        <p className="mt-1 text-2xs text-muted">Not answered — correct: {q.answer}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="flex items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-5 py-2.5 text-sm font-medium text-primary transition-colors"
        >
          <RotateCcw size={15} /> Retake Quiz
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {isRegenerating ? 'Generating…' : 'New Quiz'}
          </button>
        )}
      </div>
    </div>
  );
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuizViewer({ questions, onRegenerateQuiz, isRegenerating, onQuizComplete }: QuizViewerProps) {
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const question = activeQuestions[currentIndex];

  // Shuffle options whenever the question changes
  useEffect(() => {
    if (question?.options) {
      setShuffledOptions(shuffleArray(question.options));
    }
    setSelected(null);
    setAnswered(false);
  }, [currentIndex, question]);

  // Reset when questions change (new quiz generated)
  useEffect(() => {
    const pool = shuffleArray(questions || []);
    setActiveQuestions(pool.slice(0, 15));
    setCurrentIndex(0);
    setSelected(null);
    setAnswered(false);
    setResults({});
    setShowSummary(false);
  }, [questions]);

  if (!activeQuestions || activeQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted gap-3">
        <Trophy size={32} className="opacity-30" />
        <p className="text-sm">No quiz questions yet.</p>
      </div>
    );
  }

  const totalCorrect = Object.values(results).filter(Boolean).length;
  const progressPct = activeQuestions.length > 0 ? ((currentIndex + 1) / activeQuestions.length) * 100 : 0;

  const handleSelect = (option: string) => {
    if (answered) return;
    setSelected(option);
    setAnswered(true);
    const isCorrect = option === question.answer;
    setResults((prev) => ({ ...prev, [currentIndex]: isCorrect }));
  };

  const handleNext = () => {
    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setShowSummary(true);
      onQuizComplete?.(totalCorrect, activeQuestions.length);
    }
  };

  const handleRestart = () => {
    const pool = shuffleArray(questions || []);
    setActiveQuestions(pool.slice(0, 15));
    setCurrentIndex(0);
    setResults({});
    setShowSummary(false);
  };

  // ── Summary Screen ──
  if (showSummary) {
    const pct = Math.round((totalCorrect / activeQuestions.length) * 100);
    const passed = pct >= 60;
    const grade = pct >= 90 ? '🏆 Excellent!' : pct >= 75 ? '🎉 Great job!' : pct >= 60 ? '👍 Good effort!' : '📚 Keep studying!';
    return (
      <QuizSummary
        pct={pct}
        passed={passed}
        grade={grade}
        totalCorrect={totalCorrect}
        activeQuestions={activeQuestions}
        results={results}
        onRestart={handleRestart}
        onRegenerate={onRegenerateQuiz}
        isRegenerating={isRegenerating}
      />
    );
  }


  // ── Question Screen ──
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="flex flex-col w-full min-h-[420px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">

        {/* Progress Row */}
        <div className="flex items-center w-full mt-3 mb-1">
          <div className="relative flex-1 h-2 bg-white/[0.05] rounded-full">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(progressPct)}%` }}
            >
              {/* Floating percentage indicator at the tip */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-accent/20 text-accent text-2xs font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md border border-accent/30 shadow-sm whitespace-nowrap">
                {Math.round(progressPct)}%
              </div>
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="w-full bg-surface border border-accent/20 rounded-2xl p-6 shadow-sm">
          <span className="text-2xs font-semibold uppercase tracking-widest text-accent mb-3 block">
            Question {currentIndex + 1}
          </span>
          <p className="text-base font-medium text-primary leading-relaxed">{question.question}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {shuffledOptions.map((option, idx) => {
            const isCorrect = option === question.answer;
            const isSelected = option === selected;
            let style = 'border border-token bg-white/[0.03] text-secondary hover:bg-white/[0.07] hover:border-accent/30 cursor-pointer';
            if (answered) {
              if (isCorrect) style = 'border border-success/40 bg-success-muted text-success cursor-default';
              else if (isSelected) style = 'border border-red-500/40 bg-red-500/10 text-red-300 cursor-default';
              else style = 'border border-token bg-white/[0.01] text-muted cursor-default';
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(option)}
                disabled={answered}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all ${style}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold border ${
                  answered && isCorrect ? 'border-success/50 text-success'
                  : answered && isSelected ? 'border-red-500/50 text-red-400'
                  : 'border-token text-muted'
                }`}>
                  {optionLetters[idx]}
                </span>
                <span className="flex-1">{option}</span>
                {answered && isCorrect && <CheckCircle2 size={16} className="text-success shrink-0" />}
                {answered && isSelected && !isCorrect && <XCircle size={16} className="text-red-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {answered && question.explanation && (
          <div className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-indigo-400 mb-1 uppercase tracking-wider">Explanation</p>
            <p className="text-sm text-secondary">{question.explanation}</p>
          </div>
        )}

        {/* Next button — only after answering */}
        {answered && (
          <div className="flex w-full items-center justify-center mt-2">
            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-6 py-2 text-sm font-semibold text-primary transition-colors"
            >
              {currentIndex === activeQuestions.length - 1 ? 'See Results' : 'Next'} <ChevronRight size={15} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}


