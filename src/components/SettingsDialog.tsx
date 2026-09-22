import { useState, useEffect, useRef } from 'react';
import { Settings, Sun, Moon, Music2, Key, ExternalLink, Check, X, Trash2, Loader2, HelpCircle, LogOut } from 'lucide-react';
import { getPersonalGeminiKey, setPersonalGeminiKey, validateGeminiKey } from '../lib/aiCall';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function SettingsDialog({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  isAuthenticated,
  onLogin,
  onLogout,
}: SettingsDialogProps) {
  // ── Gemini key state (moved verbatim from ProfilePopover) ──────────────
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [keyError, setKeyError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  
  // ── Account Name State ────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? '';
      setDisplayName(name);
      setOriginalName(name);
    }
  }, [user]);

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!user || !trimmed || trimmed === originalName) return;
    setSavingName(true);
    setNameSuccess(false);
    setNameError('');
    try {
      // Soft unique check
      const { data: existing } = await supabase
        .from('user_settings')
        .select('user_id')
        .ilike('display_name', trimmed)
        .neq('user_id', user.id)
        .limit(1);
        
      if (existing && existing.length > 0) {
        setNameError('Username is already taken by another user.');
        setSavingName(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmed, name: trimmed }
      });
      if (error) throw error;

      // Sync to user_settings so other checks catch it immediately
      await supabase.from('user_settings').upsert({ user_id: user.id, display_name: trimmed }, { onConflict: 'user_id' });

      setOriginalName(trimmed);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      setNameError('An error occurred while saving.');
    } finally {
      setSavingName(false);
    }
  };

  // Load saved key on mount
  useEffect(() => {
    setSavedKey(getPersonalGeminiKey());
  }, []);

  // Clear status when input changes
  useEffect(() => {
    if (keyStatus !== 'idle') setKeyStatus('idle');
  }, [keyInput]);

  // Close the step guide if user clicks outside of it
  useEffect(() => {
    if (!showGuide) return;
    function handleClick(e: MouseEvent) {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) {
        setShowGuide(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showGuide]);

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setValidating(true);
    setKeyStatus('idle');
    try {
      await validateGeminiKey(trimmed);
      setPersonalGeminiKey(trimmed);
      setSavedKey(trimmed);
      setKeyInput('');
      setKeyStatus('success');
      // Persist to Supabase (fire-and-forget, localStorage is the live source)
      supabase.from('user_settings')
        .upsert({ user_id: user?.id ?? 'default-user', gemini_api_key: trimmed }, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.warn('Failed to sync Gemini key to Supabase:', error.message); });
    } catch (err: any) {
      setKeyError(err.message || 'Key validation failed.');
      setKeyStatus('error');
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveKey = () => {
    setPersonalGeminiKey(null);
    setSavedKey(null);
    setKeyInput('');
    setKeyStatus('idle');
    // Clear from Supabase too
    supabase.from('user_settings')
      .upsert({ user_id: user?.id ?? 'default-user', gemini_api_key: null }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.warn('Failed to clear Gemini key in Supabase:', error.message); });
  };
  // ──────────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="w-full max-w-md rounded-2xl border border-token bg-surface p-6 shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: 'stable' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20">
              <Settings size={16} className="text-accent" />
            </div>
            <span className="text-base font-semibold text-primary">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Section 0: Account ─────────────────────────── */}
        <div className="mb-5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted mb-3">Account</p>
          <div className="flex flex-col gap-3 rounded-xl border border-token bg-raised p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-secondary">Display Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="flex-1 rounded-xl border border-token bg-app px-3 py-2 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                  placeholder="Your display name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || displayName.trim() === '' || displayName.trim() === originalName}
                  className="rounded-xl bg-accent hover:bg-accent/90 px-4 py-2 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingName ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                </button>
              </div>
              {nameSuccess && (
                <p className="text-xs text-success mt-1 animate-in fade-in flex items-center gap-1">
                  <Check size={12} /> Name updated successfully
                </p>
              )}
              {nameError && (
                <p className="text-xs text-danger mt-1 animate-in fade-in flex items-center gap-1">
                  <X size={12} /> {nameError}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-token mb-5" />

        {/* ── Section 1: General ─────────────────────────── */}
        <div className="mb-5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted mb-3">General</p>
          <div className="flex items-center justify-between rounded-xl border border-token bg-raised p-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20">
                {theme === 'dark'
                  ? <Moon size={14} className="text-accent" />
                  : <Sun size={14} className="text-amber-400" />
                }
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-primary">Theme</span>
                <span className="text-2xs text-muted">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
              </div>
            </div>
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="relative h-6 w-11 rounded-full border border-token bg-app transition-colors hover:border-accent/40 focus:outline-none"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform flex items-center justify-center
                  ${theme === 'light' ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-raised'}`}
              >
                {theme === 'dark'
                  ? <Moon size={10} className="text-secondary" />
                  : <Sun size={10} className="text-white" />
                }
              </span>
            </button>
          </div>

          {!isAuthenticated ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-token bg-raised p-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1db954]/20 shrink-0">
                  <Music2 size={14} className="text-[#1db954]" />
                </div>
                <span className="text-xs text-secondary truncate">Link your Spotify Premium account</span>
              </div>
              <button
                onClick={onLogin}
                className="btn btn-spotify text-xs py-1.5 px-3 h-auto rounded-xl border-0"
              >
                Connect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-token bg-raised p-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1db954]/20 shrink-0">
                  <Music2 size={14} className="text-[#1db954]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-primary truncate">Spotify Connected</span>
                  <span className="text-2xs text-success">Premium active</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 shrink-0 text-xs px-2.5 py-1.5 rounded-lg text-danger hover:bg-danger/10 border border-danger/20 transition-colors"
              >
                <LogOut size={12} />
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* ── Section 2: AI / Gemini key ───────────────────── */}
        <div className="border-t border-token mb-5" />
        <div className="flex flex-col gap-3">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted">AI</p>
          {/* Heading row */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20">
              <Key size={14} className="text-accent" />
            </div>
            <span className="text-sm font-semibold text-primary">Your own Gemini API key</span>
            {/* Fixed badge */}
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-2xs font-semibold text-accent border border-accent/30">
              recommended
            </span>
            {/* "?" — click to open step guide */}
            <div className="relative ml-auto" ref={guideRef}>
              <button
                onClick={() => setShowGuide(v => !v)}
                className="flex items-center justify-center rounded-full text-muted hover:text-accent transition-colors"
                title="How to get a free key"
              >
                <HelpCircle size={15} />
              </button>

              {showGuide && (
                <div className="absolute right-0 top-6 z-10 w-72 rounded-xl border border-token bg-surface p-4 shadow-xl shadow-black/20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-2xs font-semibold text-primary">How to get your free key</p>
                    <button onClick={() => setShowGuide(false)} className="text-secondary hover:text-secondary transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  {[
                    <><span className="font-semibold text-accent">"Get my free key"</span> below</>,
                    <>Click the blue <span className="font-semibold text-primary">"Create API key"</span> button on Google's page</>,
                    <>Copy the key that appears (starts with <span className="font-mono text-accent">"AIza..."</span>)</>,
                    <>Paste it below and click <span className="font-semibold text-primary">Save</span></>,
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/30 text-2xs font-bold text-accent mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-2xs text-secondary leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-secondary leading-relaxed">
            Aralko works out of the box using a shared AI key. Add your own free key for faster, unlimited use without sharing limits with other users.
          </p>

          {savedKey ? (
            /* ── Key is saved ── */
            <div className="rounded-xl bg-success-muted border border-success/20 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check size={15} className="text-success shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-success">Personal key active</span>
                  <span className="text-2xs text-muted font-mono">{savedKey.substring(0, 8)}...{savedKey.slice(-4)}</span>
                </div>
              </div>
              <button
                onClick={handleRemoveKey}
                className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          ) : (
            /* ── No key saved ── */
            <>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-accent/40 bg-accent-muted hover:bg-accent/20 px-4 py-2 text-xs font-semibold text-accent transition-colors"
              >
                <ExternalLink size={13} />
                Get my free key
              </a>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                  placeholder='Paste your key here (AIza...)'
                  className="flex-1 rounded-xl border border-token bg-app px-3 py-2 text-xs text-primary placeholder-slate-600 outline-none focus:border-accent/60 transition-colors"
                />
                <button
                  onClick={handleSaveKey}
                  disabled={!keyInput.trim() || validating}
                  className="flex items-center gap-1.5 rounded-xl bg-accent hover:bg-violet-700 px-4 py-2 text-xs font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {validating ? <Loader2 size={12} className="animate-spin" /> : null}
                  {validating ? 'Checking...' : 'Save'}
                </button>
              </div>

              {/* Validation feedback */}
              {keyStatus === 'success' && (
                <div className="flex items-center gap-2 text-xs text-success">
                  <Check size={13} />
                  Key added — you're all set!
                </div>
              )}
              {keyStatus === 'error' && (
                <div className="flex items-start gap-2 text-xs text-red-400">
                  <X size={13} className="mt-0.5 shrink-0" />
                  <span>{keyError || "That doesn't look right — please check you copied the full key."}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

