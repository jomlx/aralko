import { useState, useRef, useEffect } from 'react';
import { Sparkles, MessageSquare, Send, Settings2, ChevronDown, Trash2, Loader2 } from 'lucide-react';
import type { ChatMessage, Activity } from '../../types';
import { useGemini } from '../../hooks/useGemini';
import { useChat } from '../../hooks/useChat';

interface AIChatPanelProps {
  activeActivity?: Activity;
  onUpdateActivity?: (id: number, updates: Partial<Activity>) => void;
}

export function AIChatPanel({ activeActivity }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState(() =>
    localStorage.getItem('aralko-system-prompt') || 'You are a helpful study assistant.'
  );

  const chatEndRef = useRef<HTMLDivElement>(null);

  const { messages, loading: historyLoading, addMessage, clearMessages, getContextMessages } =
    useChat(activeActivity?.id);

  const gemini = useGemini() || {
    sendChat: async (msgs: ChatMessage[], _prompt: string) =>
      `Simulated response to: ${msgs[msgs.length - 1]?.content || 'Hello'}`,
    generateReviewer: async () => ''
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Reset confirm-clear state when switching activity
  useEffect(() => {
    setConfirmClear(false);
  }, [activeActivity?.id]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    await addMessage(userMsg);
    setInput('');
    setIsLoading(true);

    try {
      // Only send last N messages to AI to control token usage
      const contextMsgs = getContextMessages([...messages, userMsg]);
      const response = await gemini.sendChat(contextMsgs, systemPrompt);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      await addMessage(aiMsg);
    } catch (err: any) {
      console.error('Chat error:', err);
      let errorMsg: string;
      if (err.message === 'Gemini API key not configured') {
        errorMsg = '⚠️ Please add your Gemini API key in Settings to use the AI assistant.';
      } else if (err.message?.includes('Invalid API Key')) {
        errorMsg = '🔑 Your API key appears to be invalid. Please check your settings.';
      } else {
        errorMsg = `❌ ${err.message || 'Unknown error connecting to the AI.'}`;
      }

      await addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearRequest = () => {
    if (confirmClear) {
      clearMessages();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('aralko-system-prompt', systemPrompt);
    setActiveView('chat');
  };

  return (
    <div className="rounded-2xl border border-token bg-surface flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 mb-1">
        <div className="flex items-center gap-2">
          <div className="text-success">
            <Sparkles size={16} />
          </div>
          <h2 className="text-primary font-medium text-xs">Aralmo Assistant</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear chat button — only visible when there are messages */}
          {activeView === 'chat' && messages.length > 0 && (
            <button
              onClick={handleClearRequest}
              title={confirmClear ? 'Click again to confirm clear' : 'Clear chat history'}
              className={`flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded-lg ${
                confirmClear
                  ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                  : 'text-muted hover:text-red-400 hover:bg-white/[0.05]'
              }`}
            >
              <Trash2 size={12} />
              {confirmClear && <span>Confirm?</span>}
            </button>
          )}

          {/* Persona / settings toggle */}
          <button
            onClick={() => setActiveView(prev => prev === 'chat' ? 'settings' : 'chat')}
            className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors"
          >
            <Settings2 size={13} />
            Persona
            <ChevronDown size={11} className={`transition-transform ${activeView === 'settings' ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {activeView === 'settings' ? (
        <div className="flex-1 flex flex-col p-4 mx-3 mb-3 bg-app rounded-xl border border-token">
          <h3 className="text-primary text-sm font-medium mb-3">AI Settings</h3>
          <label className="text-xs text-secondary mb-1 block">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full bg-surface border border-token rounded-lg py-2 px-3 text-sm text-primary h-24 mb-3 focus:outline-none focus:border-accent/50 resize-none"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setSystemPrompt('You are a strict study tutor. Point out mistakes clearly.')} className="text-xs px-2 py-1 bg-surface border border-token rounded-full text-secondary hover:text-primary">Strict tutor</button>
            <button onClick={() => setSystemPrompt('You are a friendly explainer. Use simple analogies.')} className="text-xs px-2 py-1 bg-surface border border-token rounded-full text-secondary hover:text-primary">Friendly explainer</button>
            <button onClick={() => setSystemPrompt('You are a quiz master. Always ask follow-up questions.')} className="text-xs px-2 py-1 bg-surface border border-token rounded-full text-secondary hover:text-primary">Quiz master</button>
          </div>
          <button
            onClick={saveSettings}
            className="mt-auto w-full bg-white/[0.05] hover:bg-white/[0.1] text-primary py-2 rounded-lg text-sm transition-colors"
          >
            Save Settings
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">
          {/* Messages */}
          <div className="flex-1 min-h-[100px] overflow-y-auto overflow-x-hidden space-y-4 py-2 pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
            {historyLoading ? (
              <div className="flex items-center justify-center mt-10 gap-2 text-muted text-xs">
                <Loader2 size={14} className="animate-spin" />
                Loading chat history…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-muted text-sm text-center mt-10">
                Ask a question about your study material.
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`text-sm max-w-[90%] break-words whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-accent/20 text-primary rounded-lg px-3 py-2'
                      : 'text-secondary'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-start">
                <div className="p-3 rounded-xl bg-app border border-token flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 pt-3 mt-2 border-t border-token flex gap-2">
            <div className="flex-1 relative">
              <MessageSquare size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask something..."
                className="w-full bg-app border border-token rounded-lg py-2 pl-9 pr-3 text-sm text-primary placeholder-slate-500 focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 flex items-center justify-center flex-shrink-0 bg-accent hover:bg-accent disabled:opacity-50 text-primary rounded-lg transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
