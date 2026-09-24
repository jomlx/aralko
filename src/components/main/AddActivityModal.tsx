import { useState, useRef, useEffect } from 'react';
import { UploadCloud, Loader2, X } from 'lucide-react';
import type { Activity } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded: (activity: Activity) => Promise<number | undefined> | void;
}

import { useAIQueue } from '../../hooks/useAIQueue';

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

  const { enqueueJob } = useAIQueue();

  const analyzeAndCreate = async (rawText: string) => {
    setStep('analyzing');
    setErrorMsg(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    try {
      setLoadingMsg('Setting up your study material...');
      
      const genericName = `Upload: ${new Date().toLocaleDateString()}`;
      
      const initialActivity: Activity = {
        id: Date.now(),
        name: genericName,
        subject: 'General Study',
        progress: 0,
        notes: rawText,
        reviewerContent: '',
        technique: 'Flashcards',
        techniqueData: []
      };

      if (signal.aborted) return;
      
      // onActivityAdded returns the real DB ID
      const realId = await onActivityAdded(initialActivity);

      if (realId) {
        setLoadingMsg('Extracting flashcards via AI Queue (this may take a bit)...');
        // Wait for the job to complete
        await enqueueJob(realId, 'flashcards');
        if (signal.aborted) return;
      }

      abortControllerRef.current = null;
      handleClose();
    } catch (err: any) {
      if (err.message === 'Aborted') return; // User cancelled
      console.error('Error processing file via queue:', err);
      setErrorMsg(err.message || 'Error processing file. Please try again.');
      setStep('error');
    }
  };

  // ── DOCX: unzip and extract all <w:t> text nodes from word/document.xml ──
  const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // word/document.xml holds the main body text
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) throw new Error('Invalid DOCX file: word/document.xml not found.');
    const docXml = await docXmlFile.async('string');

    // Each <w:p> is a paragraph; collect all <w:t> runs within it
    let text = '';
    const pRegex = /<w:p[ >]([\s\S]*?)<\/w:p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(docXml)) !== null) {
      const pContent = pMatch[1];
      const tRegex = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      let paraText = '';
      while ((tMatch = tRegex.exec(pContent)) !== null) {
        paraText += tMatch[1];
      }
      if (paraText.trim()) text += paraText + '\n';
    }

    return text.trim();
  };

  // ── PPTX: unzip and extract all <a:t> text nodes from each slide XML ──
  const extractPptxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Slides live at ppt/slides/slide1.xml, slide2.xml, …
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) throw new Error('Invalid PPTX: no slides found.');

    let fullText = '';
    for (const slidePath of slideFiles) {
      const slideXml = await zip.file(slidePath)!.async('string');

      // Each <a:p> is a text paragraph on the slide
      const pRegex = /<a:p[ >]([\s\S]*?)<\/a:p>/g;
      let pMatch: RegExpExecArray | null;
      while ((pMatch = pRegex.exec(slideXml)) !== null) {
        const pContent = pMatch[1];
        const tRegex = /<a:t(?:[^>]*)>([\s\S]*?)<\/a:t>/g;
        let tMatch: RegExpExecArray | null;
        let paraText = '';
        while ((tMatch = tRegex.exec(pContent)) !== null) {
          paraText += tMatch[1];
        }
        if (paraText.trim()) fullText += paraText + '\n';
      }
      fullText += '\n'; // blank line between slides
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
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
        }
        analyzeAndCreate(fullText.trim());

      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      ) {
        setLoadingMsg('Extracting text from Word document...');
        const text = await extractDocxText(file);
        if (!text) throw new Error('No text could be extracted from this DOCX file.');
        analyzeAndCreate(text);

      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        name.endsWith('.pptx')
      ) {
        setLoadingMsg('Extracting text from PowerPoint slides...');
        const text = await extractPptxText(file);
        if (!text) throw new Error('No text could be extracted from this PPTX file.');
        analyzeAndCreate(text);

      } else {
        // Plain text / markdown fallback
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const text = ev.target?.result as string;
          analyzeAndCreate(text);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error('Error reading file:', err);
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
            <p className="text-xs text-muted">Supported: .pdf, .docx, .pptx, .txt, .md</p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.md,.pdf,.docx,.pptx"
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

