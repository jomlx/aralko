import { useState, useRef, useEffect } from 'react';
import { UploadCloud, Loader2, X } from 'lucide-react';
import type { Activity } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { generateWithBackend } from '../../lib/apiClient';
import { getPersonalGeminiKey } from '../../lib/aiCall';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded: (activity: Activity) => void;
}

function nameFromFile(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'New Activity';
}

export function AddActivityModal({ isOpen, onClose, onActivityAdded }: AddActivityModalProps) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'error'>('upload');
  const [loadingMsg, setLoadingMsg] = useState('Reading your file...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (step !== 'analyzing') return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 40000) {
        setLoadingMsg('Still working - this can take up to a minute...');
      } else if (elapsed > 15000) {
        setLoadingMsg((prev) =>
          prev.includes('Still working') ? prev : 'Generating flashcards in the background...'
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

  const analyzeAndCreate = async (rawText: string, fileName: string) => {
    setStep('analyzing');
    setErrorMsg(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    startTimeRef.current = Date.now();

    try {
      setLoadingMsg('Uploading to secure cloud storage...');

      const personalKey = getPersonalGeminiKey();
      const { cachedData } = await generateWithBackend(rawText, ['flashcards'], personalKey);
      const flashcards = Array.isArray(cachedData?.flashcards_result) ? cachedData.flashcards_result : [];

      const newActivity: Activity = {
        id: Date.now(),
        name: nameFromFile(fileName),
        subject: 'General Study',
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
      console.error('[AddActivity] Error:', err);
      setErrorMsg(err.message || 'Error processing file. Please try again.');
      setStep('error');
    }
  };

  const extractDocxText = async (file: File): Promise<string> => {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) throw new Error('Invalid DOCX: word/document.xml not found.');
    const docXml = await docXmlFile.async('string');

    let text = '';
    const pRegex = /<w:p[ >]([\s\S]*?)<\/w:p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(docXml)) !== null) {
      const tRegex = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      let para = '';
      while ((tMatch = tRegex.exec(pMatch[1])) !== null) para += tMatch[1];
      if (para.trim()) text += para + '\n';
    }
    return text.trim();
  };

  const extractPptxText = async (file: File): Promise<string> => {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)?.[0] ?? '0') - parseInt(b.match(/\d+/)?.[0] ?? '0'));

    if (!slideFiles.length) throw new Error('Invalid PPTX: no slides found.');

    let fullText = '';
    for (const path of slideFiles) {
      const xml = await zip.file(path)!.async('string');
      const pRegex = /<a:p[ >]([\s\S]*?)<\/a:p>/g;
      let pMatch: RegExpExecArray | null;
      while ((pMatch = pRegex.exec(xml)) !== null) {
        const tRegex = /<a:t(?:[^>]*)>([\s\S]*?)<\/a:t>/g;
        let tMatch: RegExpExecArray | null;
        let para = '';
        while ((tMatch = tRegex.exec(pMatch[1])) !== null) para += tMatch[1];
        if (para.trim()) fullText += para + '\n';
      }
      fullText += '\n';
    }
    return fullText.trim();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('analyzing');
    setLoadingMsg('Reading your file...');
    setErrorMsg(null);
    startTimeRef.current = Date.now();

    try {
      const name = file.name.toLowerCase();

      if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        setLoadingMsg('Extracting text from PDF...');
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(' ') + '\n\n';
        }
        analyzeAndCreate(fullText.trim(), file.name);

      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      ) {
        setLoadingMsg('Extracting text from Word document...');
        const text = await extractDocxText(file);
        if (!text) throw new Error('No text found in this DOCX file.');
        analyzeAndCreate(text, file.name);

      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        name.endsWith('.pptx')
      ) {
        setLoadingMsg('Extracting text from PowerPoint...');
        const text = await extractPptxText(file);
        if (!text) throw new Error('No text found in this PPTX file.');
        analyzeAndCreate(text, file.name);

      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (!text?.trim()) {
            setErrorMsg('The file appears to be empty.');
            setStep('error');
            return;
          }
          analyzeAndCreate(text, file.name);
        };
        reader.onerror = () => { setErrorMsg('Failed to read file.'); setStep('error'); };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error('[AddActivity] File read error:', err);
      setErrorMsg(err.message || 'Failed to read file.');
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

        {step === 'upload' && (
          <div>
            <label
              className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-token bg-white/[0.02] p-10 text-center transition-colors hover:border-accent hover:bg-accent/5"
              htmlFor="activity-file-upload"
            >
              <UploadCloud size={40} className="text-accent opacity-80" />
              <div>
                <p className="font-semibold text-primary">Drop your study material here</p>
                <p className="mt-1 text-sm text-muted">PDF, DOCX, PPTX, or plain text</p>
              </div>
              <span className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white">
                Choose File
              </span>
            </label>
            <input
              id="activity-file-upload"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <Loader2 size={44} className="animate-spin text-accent" />
            <div>
              <p className="font-semibold text-primary">{loadingMsg}</p>
              <p className="mt-1 text-sm text-muted">This usually takes 15-45 seconds</p>
            </div>
            <button
              onClick={handleClose}
              className="mt-2 text-xs text-muted hover:text-secondary underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button
              onClick={resetState}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

