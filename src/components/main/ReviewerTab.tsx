import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Sparkles, BookOpen, Edit3, Download, ChevronDown, Trash2, RotateCcw, MessageSquare, MessageSquareOff } from 'lucide-react';
import type { Activity } from '../../types';
import { exportReviewerAsPDF, exportReviewerAsDocx } from '../../utils/exportReviewer';
import { generateWithBackend } from '../../lib/apiClient';
import { getPersonalGeminiKey } from '../../lib/aiCall';
import { AIChatPanel } from '../sidebar/AIChatPanel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReviewerTabProps {
  activities: Activity[];
  selectedActivity: number;
  onUpdateActivity: (id: number, updates: Partial<Activity>) => void;
  addXP?: (amount: number, eventKey?: string) => void;
}

export function ReviewerTab({ activities, selectedActivity, onUpdateActivity, addXP }: ReviewerTabProps) {
  const activeActivity = activities.find(a => a.id === selectedActivity) || activities[0];

  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewerCooldown, setReviewerCooldown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // â”€â”€ On-demand reviewer generation â”€â”€
  // Automatically generate if the tab is opened for an activity that has notes
  // but hasn't had a reviewer generated yet (reviewerContent is empty).
  useEffect(() => {
    if (!activeActivity) return;
    if (activeActivity.reviewerContent) return;  // already have one
    if (!activeActivity.notes || activeActivity.notes.trim().length < 50) return;  // nothing to generate from
    if (isGenerating) return;  // already in progress

    // Auto-trigger generation
    generateFromText(activeActivity.notes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeActivity?.id]);

  const generateFromText = async (text: string, fileName?: string) => {
    if (isGenerating || reviewerCooldown) return;
    setReviewerCooldown(true);
    setInlineError(null);
    setTimeout(() => setReviewerCooldown(false), 3000);
    setIsGenerating(true);
    if (fileName) setUploadedFileName(fileName);
    try {
      // If there's a file, we should update the notes first so the backend can read it!
      // But actually ReviewerTab isn't an "Add Activity" tab, it's just updating the current activity.
      if (fileName && activeActivity) {
        onUpdateActivity(activeActivity.id, { notes: activeActivity.notes + '\n\n' + text });
        // Wait a small bit for DB sync
        await new Promise(r => setTimeout(r, 500));
      }

      if (activeActivity) {
        const personalKey = getPersonalGeminiKey();
        const { cachedData } = await generateWithBackend(activeActivity.notes, ['reviewer'], personalKey);
        const content = typeof cachedData?.reviewer_result === 'string' ? cachedData.reviewer_result : '';
        onUpdateActivity(activeActivity.id, { reviewerContent: content });
        addXP?.(5, `reviewer-${activeActivity.id}`);
      }
    } catch (e: any) {
      console.error('Generate Reviewer error via Queue:', e);
      setInlineError('Something went wrong while generating the reviewer. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => reject(new Error('Failed to read file'));
      // Plain text only for now; PDF extraction would need a library
      reader.readAsText(file);
    });
  };

  const handleFile = async (file: File) => {
    const allowedTypes = ['text/plain', 'text/markdown', 'application/json', 'text/csv'];
    const allowedExts = ['.txt', '.md', '.json', '.csv'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      setInlineError('Unsupported file type. Please upload a .txt, .md, .json, or .csv file.');
      return;
    }
    const text = await readFileAsText(file);
    if (!text.trim()) { setInlineError('The file appears to be empty.'); return; }
    await generateFromText(text, file.name);
  };

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  }, [activeActivity]);

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    e.target.value = '';
  };

  const startEditing = () => {
    setEditValue(activeActivity?.reviewerContent || '');
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (activeActivity) onUpdateActivity(activeActivity.id, { reviewerContent: editValue });
    setIsEditing(false);
  };

  const clearReviewer = () => {
    if (activeActivity) {
      onUpdateActivity(activeActivity.id, { reviewerContent: '' });
      setUploadedFileName(null);
    }
  };

  const [isChatOpen, setIsChatOpen] = useState(true);

  if (!activeActivity) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted">
        <p>No activity selected.</p>
      </div>
    );
  }

  const hasContent = !!activeActivity.reviewerContent;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Outer padding wrapper â€” does NOT scroll */}
      <div className="flex-1 min-h-0 flex gap-5 px-8 py-4 overflow-hidden">

        {/* Center: Reviewer Content */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          
          {/* --- STATIC HEADER & COMMANDS (Does not scroll) --- */}
          <div className="flex-shrink-0 flex flex-col pb-4 mb-4 border-b border-white/[0.05]">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-primary">Reviewer</h2>
                <p className="mt-1 text-sm text-muted">
                  {activeActivity.name}{activeActivity.subject ? `: ${activeActivity.subject}` : ''} â€” Upload a file or use activity notes to auto-generate a cheat sheet.
                </p>
              </div>

              {/* Right controls: AI Chat Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsChatOpen(prev => !prev)}
                  className="flex items-center justify-center rounded-xl border border-token bg-white/[0.04] h-8 w-8 text-secondary transition-colors hover:bg-white/[0.08] hover:text-primary"
                  title={isChatOpen ? "Hide Assistant" : "Show Assistant"}
                >
                  {isChatOpen ? <MessageSquareOff size={14} /> : <MessageSquare size={14} />}
                </button>
              </div>
            </div>

            {/* Toolbar (Commands) */}
            {hasContent && !isGenerating && (
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-amber-400" />
                  <span className="text-sm font-medium text-primary">Cheat Sheet</span>
                  {uploadedFileName && (
                    <span className="text-xs text-muted">â€” {uploadedFileName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <button
                      onClick={startEditing}
                      className="rounded-lg p-1.5 text-secondary hover:bg-white/[0.05] hover:text-primary transition-colors"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}

                  {/* Re-upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg p-1.5 text-secondary hover:bg-white/[0.05] hover:text-primary transition-colors"
                    title="Re-upload file"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv" className="hidden" onChange={onFileInput} />

                  {/* Export */}
                  <div ref={exportRef} className="relative">
                    <button
                      onClick={() => setExportOpen(p => !p)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-secondary hover:bg-white/[0.05] hover:text-primary transition-colors border border-token"
                    >
                      <Download size={12} /> Export <ChevronDown size={10} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {exportOpen && (
                      <div className="absolute right-0 top-full mt-1 z-20 min-w-[130px] rounded-xl border border-token bg-surface p-1 shadow-xl">
                        <button
                          onClick={() => { exportReviewerAsPDF(activeActivity.reviewerContent, activeActivity.name); setExportOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-secondary hover:bg-white/[0.07] hover:text-primary transition-colors"
                        >
                          <FileText size={11} /> As PDF
                        </button>
                        <button
                          onClick={() => { exportReviewerAsDocx(activeActivity.reviewerContent, activeActivity.name); setExportOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-secondary hover:bg-white/[0.07] hover:text-primary transition-colors"
                        >
                          <FileText size={11} /> As Word
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Clear */}
                  <button
                    onClick={clearReviewer}
                    className="rounded-lg p-1.5 text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Clear"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* --- END STATIC HEADER --- */}

          {/* --- SCROLLING CONTENT --- */}
          <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Inline error banner */}
            {inlineError && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <span className="text-sm text-red-300">{inlineError}</span>
                <button onClick={() => setInlineError(null)} className="ml-auto text-red-400 hover:text-red-200 text-lg leading-none">Ã—</button>
              </div>
            )}

            {/* Upload zone */}
            {(!hasContent && !isGenerating) && (
              <div
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-20 cursor-pointer transition-all ${
                  isDragging
                    ? 'border-accent bg-accent/5'
                    : 'border-token hover:border-token hover:bg-white/[0.02]'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv" className="hidden" onChange={onFileInput} />
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted text-accent">
                  <Upload size={30} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-primary">Drop a file or click to upload</p>
                  <p className="mt-1 text-xs text-muted">Supported: .txt, .md, .json, .csv</p>
                </div>
                {activeActivity.notes && (
                  <>
                    <div className="flex items-center gap-3 w-48 mt-4">
                      <div className="flex-1 h-px bg-white/[0.07]" />
                      <span className="text-xs text-muted">or</span>
                      <div className="flex-1 h-px bg-white/[0.07]" />
                    </div>
                    <button
                      onClick={async (e) => { e.stopPropagation(); await generateFromText(activeActivity.notes, 'Activity Notes'); }}
                      disabled={isGenerating || reviewerCooldown}
                      className="btn btn-primary mt-4"
                    >
                      <Sparkles size={15} />
                      Generate from Activity Notes
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Generating spinner */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 size={40} className="animate-spin text-accent" />
                <p className="text-sm font-medium text-primary">Generating your cheat sheet (this may take a bit via Queue)...</p>
                {uploadedFileName && (
                  <p className="text-xs text-muted">{uploadedFileName}</p>
                )}
              </div>
            )}

            {/* Reviewer content */}
            {hasContent && !isGenerating && (
              <div className="flex flex-col gap-4">

                {/* Content */}
                {isEditing ? (
                  <div className="flex flex-col gap-3 flex-1 min-h-0 pb-4">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full flex-1 resize-y min-h-[300px] rounded-xl border border-accent/30 bg-app p-4 text-sm text-secondary focus:outline-none focus:border-accent"
                    />
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={saveEdit} className="btn btn-primary">Save</button>
                      <button onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-secondary leading-relaxed pb-4 min-w-0 w-full overflow-x-hidden">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="w-full text-left border-collapse border border-token rounded-lg overflow-hidden" {...props} /></div>,
                        th: ({node, ...props}) => <th className="border border-token bg-white/[0.03] px-4 py-2 font-medium text-primary" {...props} />,
                        td: ({node, ...props}) => <td className="border border-token px-4 py-2" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-primary mt-6 mb-4" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-primary mt-5 mb-3" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-medium text-primary mt-4 mb-2" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside my-4 space-y-1 ml-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside my-4 space-y-1 ml-2" {...props} />,
                        p: ({node, ...props}) => <p className="mb-4" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-primary" {...props} />,
                        code: ({node, inline, ...props}: any) => inline 
                          ? <code className="bg-app border border-token text-accent px-1.5 py-0.5 rounded text-xs" {...props} />
                          : <pre className="bg-app border border-token p-4 rounded-xl overflow-x-auto my-4 text-xs"><code {...props} /></pre>,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-accent pl-4 my-4 italic text-secondary bg-white/[0.02] py-2 pr-4 rounded-r-xl" {...props} />
                      }}
                    >
                      {activeActivity.reviewerContent}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
          
        {/* Right: Aralmo Assistant Slider */}
        <div
          className={`flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            isChatOpen ? 'w-[280px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 overflow-hidden ml-[-20px]'
          }`}
        >
          <div className="w-[280px] h-full flex flex-col">
            <AIChatPanel activeActivity={activeActivity} />
          </div>
        </div>

      </div>
    </div>
  );
}




