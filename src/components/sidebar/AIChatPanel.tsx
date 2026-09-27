import { useState, useEffect } from 'react';
import { UserCog, Trash2, Loader2, Plus, ArrowUp } from 'lucide-react';
import type { ChatMessage, Activity } from '../../types';
import { useGemini } from '../../hooks/useGemini';
import { useChat } from '../../hooks/useChat';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from '../ui/message-scroller';

interface AIChatPanelProps {
  activeActivity?: Activity;
  onUpdateActivity?: (id: number, updates: Partial<Activity>) => void;
}

export function AIChatPanel({ activeActivity }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState(() =>
    localStorage.getItem('aralko-system-prompt') || 'You are a helpful study assistant.'
  );

  const { messages, loading: historyLoading, addMessage, clearMessages, getContextMessages } =
    useChat(activeActivity?.id);

  const gemini = useGemini() || {
    sendChat: async (msgs: ChatMessage[], _prompt: string) =>
      `Simulated response to: ${msgs[msgs.length - 1]?.content || 'Hello'}`,
    generateReviewer: async () => ''
  };

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
        errorMsg = '💡 Please add your Gemini API key in Settings to use the AI assistant.';
      } else if (err.message?.includes('Invalid API Key')) {
        errorMsg = '❌ Your API key appears to be invalid. Please check your settings.';
      } else {
        errorMsg = '⚠️ ' + (err.message || 'Unknown error connecting to the AI.');
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
      {/* Header — single row: title+subtitle on left, Trash + Persona icons on right */}
      <div className="flex-shrink-0 flex items-start justify-between px-4 pt-3 pb-3">
        {/* Left: title + subtitle */}
        <div>
          <h3 className="text-primary font-semibold text-sm leading-tight">Aralko Assistant</h3>
          <p className="text-muted text-xs mt-0.5">
            {activeActivity?.name ?? 'New Chat'}
          </p>
        </div>

        {/* Right: Trash icon + Persona icon */}
        <div className="flex items-center gap-1 mt-0.5">
          {/* Clear chat — always rendered but only active when messages exist */}
          <button
            onClick={handleClearRequest}
            disabled={messages.length === 0}
            title={confirmClear ? 'Click again to confirm' : 'Clear chat history'}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
              messages.length === 0
                ? 'text-muted/30 cursor-not-allowed'
                : confirmClear
                  ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                  : 'text-secondary hover:text-red-400 hover:bg-white/[0.05]'
            }`}
          >
            <Trash2 size={14} />
          </button>

          {/* Persona icon with dropdown — settings only */}
          <div className="relative">
            <button
              onClick={() => setPersonaMenuOpen(prev => !prev)}
              title="Assistant settings"
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                personaMenuOpen
                  ? 'text-primary bg-white/[0.08]'
                  : 'text-secondary hover:text-primary hover:bg-white/[0.05]'
              }`}
            >
              <UserCog size={14} />
            </button>

            {personaMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-token bg-surface shadow-lg z-50 py-1 overflow-hidden">
                <button
                  onClick={() => { setActiveView(prev => prev === 'chat' ? 'settings' : 'chat'); setPersonaMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-secondary hover:text-primary hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
                >
                  <UserCog size={13} />
                  {activeView === 'settings' ? 'Back to chat' : 'AI Persona settings'}
                </button>
              </div>
            )}
          </div>
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
          <MessageScrollerProvider>
            <MessageScroller className="flex-1 min-h-0 relative">
              <MessageScrollerViewport className="[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.12] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:mr-0">
                <MessageScrollerContent className="space-y-6 py-4">
                  {historyLoading ? (
                    <div className="flex items-center justify-center mt-10 gap-2 text-muted text-xs">
                      <Loader2 size={14} className="animate-spin" />
                      Loading chat history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-muted text-sm text-center mt-10">
                      Ask a question about your study material.
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <MessageScrollerItem
                        key={msg.id}
                        messageId={msg.id}
                        scrollAnchor={msg.role === "user"}
                      >
                        <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`text-[13px] leading-relaxed max-w-[85%] break-words whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-accent/20 text-primary rounded-2xl rounded-br-sm px-4 py-3 border border-accent/10 shadow-sm'
                              : 'bg-app border border-token text-secondary rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      </MessageScrollerItem>
                    ))
                  )}

                  {isLoading && (
                    <MessageScrollerItem messageId="loading-indicator">
                      <div className="flex items-start">
                        <div className="bg-app border border-token rounded-2xl rounded-bl-sm px-4 py-4 shadow-sm flex gap-1.5 items-center">
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton className="!absolute !left-1/2 !-translate-x-1/2 !bottom-2 !rounded-full !w-8 !h-8 !border-token !bg-app/90 !text-primary shadow-md hover:!bg-surface backdrop-blur-sm" />
            </MessageScroller>
          </MessageScrollerProvider>          {/* Input */}
          <div className="flex-shrink-0 mt-2 flex items-center gap-2 bg-app border border-token rounded-[24px] p-1.5 shadow-sm">
            <button 
              className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full border border-token text-secondary hover:bg-surface hover:text-primary transition-colors"
              title="Attach (coming soon)"
            >
              <Plus size={16} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask something..."
              className="min-w-0 flex-1 bg-transparent border-none py-1.5 px-2 text-sm text-primary placeholder-slate-500 focus:outline-none focus:ring-0"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 flex items-center justify-center flex-shrink-0 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white rounded-full transition-colors"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
