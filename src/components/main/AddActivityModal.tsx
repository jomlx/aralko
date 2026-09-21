import { useState, useRef, useEffect } from 'react';
import { UploadCloud, Loader2, X } from 'lucide-react';
import type { Activity } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded: (activity: Activity) => void;
}

import { callAI } from '../../lib/aiCall';
import type { AIBody } from '../../lib/aiCall';
import { parseAIJson } from '../../lib/parseAIJson';
import { getFlashcardPrompt } from '../../prompts/flashcardsPrompt';


export function AddActivityModal({ isOpen, onClose, onActivityAdded }: AddActivityModalProps) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'error'>('upload');
  const [loadingMsg, setLoadingMsg] = useState('Reading your file...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track the current abort controller for the active upload
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // Time-based fallback messages
  useEffect(() => {
    if (step !== 'analyzing') return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 30000) {
        setLoadingMsg('Still working — this is taking a little longer than usual...');
      } else if (elapsed > 15000) {
        // Only override if we're not already showing the 30s message
        setLoadingMsg((prev) => 
          prev.includes('taking a little longer') ? prev : 'Almost there — putting the finishing touches on your study materials...'
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const resetState = () => {
    setStep('upload');
    setLoadingMsg('Reading your file...');
    setErrorMsg(null);
    abortControllerRef.current = null;
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    resetState();
    onClose();
  };

  const analyzeAndCreate = async (rawText: string) => {
    setStep('analyzing');
    setErrorMsg(null);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;
    startTimeRef.current = Date.now();

    try {
      setLoadingMsg('Understanding your notes...');

      const extractBody: AIBody = {
        contents: [{
          role: 'user',
          parts: [{ text: `Extract the following from the study material and return ONLY a valid JSON object without markdown wrappers:\n{"name": "A short 2-3 word title", "subject": "The broad subject area"}\n\nMaterial:\n${rawText.substring(0, 50000)}` }]
        }],
        systemInstruction: { parts: [{ text: 'You are a data extraction bot. Output only raw JSON.' }] }
      };

      const flashcardBody: AIBody = {
        contents: [{
          role: 'user',
          parts: [{ text: getFlashcardPrompt(rawText.substring(0, 50000)) }]
        }],
        systemInstruction: {
          parts: [{ text: 'You are an expert study guide creator. Output ONLY valid JSON array without markdown.' }]
        },
        generationConfig: { maxOutputTokens: 65536 }  // was 8192 — increased to allow full card sets for large docs
      };

      // Diagnostic logging
      console.log(`[AddActivity] Input text length: ${rawText.length} chars (sending first ${Math.min(rawText.length, 50000)} chars to AI)`);

      // Wrap in a delay before changing the text so it doesn't flash too fast
      setTimeout(() => {
        if (!signal.aborted && Date.now() - startTimeRef.current < 15000) {
          setLoadingMsg('Creating your flashcards...');
        }
      }, 2000);

      const [extractRaw, flashcardRaw] = await Promise.all([
        callAI(extractBody, { fastFail: true, signal }),
        callAI(flashcardBody, { maxRetries: 2, signal })  // removed fastFail — flashcards need full retry budget
      ]);

      console.log(`[AddActivity] Raw flashcard response length: ${flashcardRaw.length} chars`);

      if (signal.aborted) return;

      // Parse extraction result
      let parsed: { name?: string; subject?: string } = {};
      try {
        const clean = extractRaw.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = parseAIJson<{ name?: string; subject?: string }>(clean, 'extraction', 'object');
      } catch (e: any) {
        console.warn('[Upload] Extraction parse failed — using defaults:', e.message);
      }

      // Parse flashcards
      let flashcards: any[] = [];
      try {
        flashcards = parseAIJson<any[]>(flashcardRaw, 'flashcards', 'array');
        if (!Array.isArray(flashcards)) flashcards = [];
      } catch (e: any) {
        if (signal.aborted) return;
        throw new Error('Failed to create flashcards. Please try again.');
      }

      // Disallow cancellation during the actual write step
      abortControllerRef.current = null;

      const newActivity: Activity = {
        id: Date.now(),
        name: parsed.name || 'New Activity',
        subject: parsed.subject || 'General Study',
        progress: 0,
        notes: rawText,
        reviewerContent: '',
        technique: flashcards.length > 0 ? 'Flashcards' : undefined,
        techniqueData: flashcards.length > 0 ? flashcards : undefined,
        quizData: undefined,
      };

      onActivityAdded(newActivity);
      handleClose();
    } catch (err: any) {
      if (err.message === 'Aborted') return; // User cancelled
      console.error('Error processing file:', err);
      setErrorMsg('Error processing file. Please try again.');
      setStep('error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('analyzing');
    setLoadingMsg('Reading your file...');
    setErrorMsg(null);
    startTimeRef.current = Date.now();

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
        }
        analyzeAndCreate(fullText.trim());
      } else {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const text = ev.target?.result as string;
          analyzeAndCreate(text);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error('Error reading file:', err);
      setErrorMsg('Failed to read file.');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-token bg-surface p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">Add New Activity</h2>
          <button 
            onClick={handleClose} 
            className="rounded-lg p-2 text-secondary hover:bg-white/[0.05] hover:text-primary disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in duration-300">
            <div className="mb-4 rounded-full bg-red-500/10 p-4 text-red-500">
              <X size={32} />
            </div>
            <h3 className="mb-2 text-lg font-medium text-primary">Error</h3>
            <p className="mb-6 text-sm text-secondary">{errorMsg}</p>
            <button onClick={resetState} className="rounded-xl bg-white/[0.05] px-6 py-2 text-sm font-medium text-primary hover:bg-white/[0.1]">
              Try Again
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-token bg-app p-10 text-center transition-colors hover:border-accent/50 hover:bg-accent/5 animate-in fade-in duration-300"
          >
            <UploadCloud size={40} className="mb-4 text-accent" />
            <h3 className="mb-2 text-sm font-medium text-primary">Upload your study material</h3>
            <p className="text-xs text-muted">Supported formats: .txt, .md, .pdf</p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.md,.pdf"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-300">
            <Loader2 size={40} className="mb-4 animate-spin text-accent" />
            <h3 key={loadingMsg} className="text-sm font-medium text-primary animate-in fade-in slide-in-from-bottom-1 duration-300">
              {loadingMsg}
            </h3>
            <p className="mt-2 text-xs text-muted">Please wait, this may take a moment</p>
          </div>
        )}
      </div>
    </div>
  );
}

