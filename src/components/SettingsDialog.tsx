import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Check, X, Loader2, SquarePen, Camera, Mail, Lock, Eye, EyeOff, LogOut, Trash2, User, Settings2, MessageSquare, ShieldCheck, Download, Info, Flame, Snowflake } from 'lucide-react';
import { getPersonalGeminiKey, setPersonalGeminiKey, validateGeminiKey } from '../lib/aiCall';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useUserSettings } from '../hooks/useUserSettings';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
  aiConsent: boolean;
  aiConsentDate: string | null;
  consentLoading: boolean;
  onConsentOn: () => Promise<void>;
  onConsentOff: () => Promise<void>;
  streak: number;
  streakFreezes: number;
}

export function SettingsDialog({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  isAuthenticated,
  onLogin,
  onLogout,
  aiConsent,
  aiConsentDate,
  consentLoading,
  onConsentOn,
  onConsentOff,
  streak,
  streakFreezes,
}: SettingsDialogProps) {
  const { user } = useAuth();

  // ── Streak card helpers ──────────────────────────────────────────────────
  const STREAK_THRESHOLDS = [3, 10, 30, 100, 200];
  const streakStage = STREAK_THRESHOLDS.reduce((s, t) => streak >= t ? s + 1 : s, 0);
  const STREAK_GRADIENTS: (string | null)[] = [
    null,
    'linear-gradient(135deg, #FFE680, #FFB84D)',
    'linear-gradient(135deg, #FFCF40, #FF9A33)',
    'linear-gradient(135deg, #FFA24D, #FF6B45)',
    'linear-gradient(135deg, #FF7A7A, #F5588C)',
    'linear-gradient(135deg, #FF9BE8, #B38CFF)',
  ];
  const streakBg = STREAK_GRADIENTS[Math.min(streakStage, 5)];
  const freezeLabel = streakFreezes === 0 ? 'No freezes' : streakFreezes === 1 ? '1 freeze' : `${streakFreezes} freezes`;
  // DB is the source of truth — useUserSettings reads user_settings.display_name first
  const { displayName: dbDisplayName, avatarUrl: dbAvatarUrl } = useUserSettings();
  
  // ── Account Name State ────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // ── Avatar State ──────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Email Change State ────────────────────────────────────────────────
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  // ── Password Change State ─────────────────────────────────────────────
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // ── Feedback State ────────────────────────────────────────────────────
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  // ── Privacy Tab State ─────────────────────────────────────────────────
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [consentOffDialogOpen, setConsentOffDialogOpen] = useState(false);

  // Seed local state from DB-authoritative values (not user_metadata)
  useEffect(() => {
    if (dbDisplayName) {
      setDisplayName(dbDisplayName);
      setOriginalName(dbDisplayName);
    } else if (user && !dbDisplayName) {
      // Fallback for before hook loads
      const name = user.email?.split('@')[0] ?? '';
      setDisplayName(name);
      setOriginalName(name);
    }
  }, [dbDisplayName, user]);

  useEffect(() => {
    if (dbAvatarUrl) setAvatarUrl(dbAvatarUrl);
  }, [dbAvatarUrl]);

  // Load AI consent state from DB — only run when user.id changes,
  // and never overwrite state once consent is already acknowledged locally.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    supabase.from('user_settings').select('ai_consent_acknowledged_at').eq('user_id', userId).single()
      .then(({ data, error }) => {
        if (error) console.error('[consent fetch error]', error);
        if (data?.ai_consent_acknowledged_at) {
        }
        // If data is null/missing acknowledged_at, leave existing state untouched
      });
  }, [userId]);

  // ── Privacy handlers ──────────────────────────────────────
  const handleToggleConsent = (checked: boolean) => {
    if (checked) {
      onConsentOn();
    } else {
      setConsentOffDialogOpen(true);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExportingData(true);
    try {
      const uid = user.id;
      const [settingsRes, activitiesRes, sessionsRes, chatRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', uid).single(),
        supabase.from('activities').select('*').eq('user_id', uid),
        supabase.from('sessions').select('*').eq('user_id', uid),
        supabase.from('chat_messages').select('*').eq('user_id', uid),
      ]);
      const exportObj = {
        exported_at: new Date().toISOString(),
        profile: { email: user.email, id: user.id },
        settings: settingsRes.data,
        activities: activitiesRes.data ?? [],
        sessions: sessionsRes.data ?? [],
        chat_messages: chatRes.data ?? [],
      };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aralko-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    setDeleteError('');
    try {
      const uid = user.id;
      // Delete all user data rows we own (client-side, no service role needed)
      await Promise.all([
        supabase.from('chat_messages').delete().eq('user_id', uid),
        supabase.from('sessions').delete().eq('user_id', uid),
        supabase.from('activities').delete().eq('user_id', uid),
        supabase.from('user_settings').delete().eq('user_id', uid),
      ]);
      // Sign the user out — the auth.users record itself cannot be deleted
      // from the client side without a service-role Edge Function.
      // Full auth deletion requires a backend call (see notes in Settings).
      await supabase.auth.signOut();
      onLogout();
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred. Please try again.');
      setDeletingAccount(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    setIsSubmittingFeedback(true);
    setFeedbackError('');
    setFeedbackSuccess(false);
    try {
      const res = await fetch('https://formspree.io/f/xbglnjll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          username: dbDisplayName,
          message: feedbackText
        })
      });
      if (!res.ok) throw new Error('Failed to send feedback.');
      setFeedbackSuccess(true);
      setFeedbackText('');
      setTimeout(() => setFeedbackSuccess(false), 5000);
    } catch (err: any) {
      setFeedbackError(err.message || 'An error occurred.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!user || !trimmed || trimmed === originalName) return;
    setSavingName(true);
    setNameSuccess(false);
    setNameError('');
    try {
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

      // Write to user_settings DB (source of truth) — skipping auth.updateUser
      // which can fail due to Supabase email rate limits and is no longer needed
      // since we read display_name from user_settings, not user_metadata.
      const { error: upsertError } = await supabase.from('user_settings').upsert(
        { user_id: user.id, display_name: trimmed },
        { onConflict: 'user_id' }
      );
      if (upsertError) {
        console.error('[handleSaveName] upsert error:', upsertError);
        throw upsertError;
      }

      setOriginalName(trimmed);
      setNameSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: any) {
      console.error('[handleSaveName] full error:', JSON.stringify(err), err);
      const errMsg = err?.message || err?.error_description || err?.code || JSON.stringify(err) || 'Unknown error';
      setNameError(errMsg);
    } finally {
      setSavingName(false);
    }
  };

  // ── Avatar Upload ─────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please upload an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Image must be under 2 MB.'); return; }
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path);
      // Cache-bust so browser loads the new image immediately
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;
      // Save to user_settings (DB source of truth) — avoids auth.updateUser rate limits
      const { error: dbErr } = await supabase.from('user_settings').upsert(
        { user_id: user.id, avatar_url: urlWithBust },
        { onConflict: 'user_id' }
      );
      if (dbErr) throw dbErr;
      setAvatarUrl(urlWithBust);
    } catch (err: any) {
      setAvatarError(err.message?.includes('Bucket not found') || err.message?.includes('does not exist')
        ? 'Storage bucket "user-avatars" not set up yet. Create it in your Supabase dashboard.'
        : 'Upload failed: ' + (err.message ?? 'Unknown error'));
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // ── Email Change ──────────────────────────────────────────────────────
  const handleChangeEmail = async () => {
    if (!user || !newEmail.trim()) return;
    setSavingEmail(true);
    setEmailError('');
    setEmailSuccess(false);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      setEmailSuccess(true);
    } catch (err: any) {
      setEmailError(err.message ?? 'Failed to update email.');
    } finally {
      setSavingEmail(false);
    }
  };

  // ── Password Change ───────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setSavingPassword(true);
    setPasswordSuccess(false);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPasswordSuccess(false); setShowPasswordDialog(false); }, 2000);
    } catch (err: any) {
      setPasswordError(err.message ?? 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  // ── Gemini key state ──────────────────────────────────────────────────
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (keyStatus === 'success') {
      setShowKeyDialog(false);
      setKeyError('');
    }
  }, [keyStatus]);

  const [keyError, setKeyError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSavedKey(getPersonalGeminiKey());
  }, []);

  useEffect(() => {
    if (keyStatus !== 'idle') setKeyStatus('idle');
  }, [keyInput]);

  useEffect(() => {
    if (!showGuide) return;
    const handleClick = (e: MouseEvent) => {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) {
        setShowGuide(false);
      }
    };
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
    supabase.from('user_settings')
      .upsert({ user_id: user?.id ?? 'default-user', gemini_api_key: null }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.warn('Failed to clear key from Supabase:', error.message); });
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl h-[85vh] min-h-[500px] p-0 flex flex-col md:flex-row bg-app border-token text-primary overflow-hidden shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="account" orientation="vertical" className="flex flex-col md:flex-row w-full h-full">
          {/* Sidebar Nav */}
          <div className="w-full md:w-[240px] shrink-0 border-b md:border-b-0 md:border-r border-token bg-surface py-6 flex flex-col">
            <div style={streakBg
                ? { background: streakBg, padding: '14px 18px' }
                : { background: 'var(--color-surface)', border: '1px solid var(--color-token)', padding: '14px 18px' }
              } className="mx-4 mb-5 rounded-[14px] flex items-center gap-3 overflow-hidden">
              {/* Avatar */}
              <Avatar className="h-[46px] w-[46px] shrink-0 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <AvatarImage src={avatarUrl || ''} />
                <AvatarFallback style={{ background: 'rgba(255,255,255,0.5)', color: '#111' }} className="font-bold text-base">
                  {(displayName || user?.email || '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Middle */}
              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <span className="text-[15px] font-medium leading-tight truncate" style={{ color: '#111' }}>
                  {displayName || user?.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-[13px] flex items-center gap-1" style={{ color: 'rgba(17,17,17,0.8)' }}>
                  <Snowflake size={12} />
                  {freezeLabel}
                </span>
              </div>
              {/* Streak */}
              <div className="flex flex-col items-end shrink-0 gap-0.5">
                <div className="flex items-center gap-1 leading-none">
                  <Flame size={26} style={{ color: '#111' }} />
                  <span className="text-[32px] font-medium leading-none tabular-nums" style={{ color: '#111' }}>{streak}</span>
                </div>
                <span className="text-[12px] leading-none" style={{ color: 'rgba(17,17,17,0.8)' }}>day streak</span>
              </div>
            </div>
            
            <TabsList className="flex flex-col h-auto bg-transparent p-0 items-stretch space-y-0.5 w-full">
              <TabsTrigger value="account" className="w-full justify-start gap-3 data-active:!bg-[var(--accent)] data-active:!text-white data-active:!font-semibold data-active:!shadow-none text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <User className="size-[18px]" />
                Account
              </TabsTrigger>
              <TabsTrigger value="privacy" className="w-full justify-start gap-3 data-active:!bg-[var(--accent)] data-active:!text-white data-active:!font-semibold data-active:!shadow-none text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <ShieldCheck className="size-[18px]" />
                Data & Privacy
              </TabsTrigger>
              <TabsTrigger value="general" className="w-full justify-start gap-3 data-active:!bg-[var(--accent)] data-active:!text-white data-active:!font-semibold data-active:!shadow-none text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <Settings2 className="size-[18px]" />
                General
              </TabsTrigger>
              <TabsTrigger value="feedback" className="w-full justify-start gap-3 data-active:!bg-[var(--accent)] data-active:!text-white data-active:!font-semibold data-active:!shadow-none text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <MessageSquare className="size-[18px]" />
                Feedback
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <TabsContent value="account" className="mt-0 outline-none h-full flex flex-col">
              <div className="shrink-0 relative z-10 bg-app px-6 md:px-8 pt-6 pb-4 border-b border-token">
                <h2 className="text-lg font-semibold text-primary">Account</h2>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-6 px-6 md:px-8 pr-2.5 pt-6 pb-8">
                  {/* Profile Picture */}
                  <div className="flex flex-col gap-3 rounded-xl border border-token bg-surface p-4">
                    <label className="text-xs font-medium text-secondary">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <Avatar className="h-14 w-14">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                          <AvatarFallback className="bg-accent/20 text-accent font-bold text-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-token bg-surface text-secondary hover:text-primary transition-colors"
                          title="Upload picture"
                        >
                          {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                        </button>
                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="text-xs font-medium text-accent hover:text-accent/80 transition-colors text-left"
                        >
                          {uploadingAvatar ? 'Uploading...' : 'Upload new picture'}
                        </button>
                        <p className="text-2xs text-muted">JPEG, PNG, WebP - Max 2 MB</p>
                      </div>
                    </div>
                    {avatarError && <p className="text-xs text-danger flex items-center gap-1"><X size={12} />{avatarError}</p>}
                  </div>

                {/* Display Name */}
                  <div className="flex flex-col gap-3 rounded-xl border border-token bg-surface p-4">
                    <label className="text-xs font-medium text-secondary">Display Name</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayName}
                        readOnly={!isEditingName}
                        onChange={e => { setDisplayName(e.target.value); setNameError(''); }}
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm text-primary placeholder-slate-500 outline-none transition-colors
                          ${isEditingName
                            ? 'border-accent/60 bg-app focus:border-accent cursor-text'
                            : 'border-token bg-raised cursor-default select-none'
                          }`}
                        placeholder="Your display name"
                      />
                      {!isEditingName ? (
                        <button
                          onClick={() => { setIsEditingName(true); setNameError(''); setNameSuccess(false); }}
                          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-token hover:border-accent/50 text-muted hover:text-accent transition-colors shrink-0"
                          title="Edit Display Name"
                        >
                          <SquarePen size={18} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setDisplayName(originalName); setIsEditingName(false); setNameError(''); }}
                            className="rounded-xl border border-token px-3 py-2 text-sm text-muted hover:text-primary transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveName}
                            disabled={savingName || displayName.trim() === '' || displayName.trim() === originalName}
                            className="rounded-xl bg-accent hover:bg-accent/90 px-4 py-2 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {savingName ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      )}
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

                  {/* Change Email */}
                  <div className="flex flex-col gap-2 mt-3">
                    <button
                      onClick={() => { setShowEmailDialog(true); setNewEmail(''); setEmailError(''); setEmailSuccess(false); }}
                      className="flex items-center justify-between rounded-xl border border-token bg-surface p-3 hover:bg-white/[0.04] transition-colors w-full text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20">
                          <Mail size={14} className="text-accent" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-primary">Change Email</span>
                          <span className="text-2xs text-muted">{user?.email ?? ''}</span>
                        </div>
                      </div>
                      <SquarePen size={15} className="text-muted shrink-0" />
                    </button>

                    {/* Change Password */}
                    <button
                      onClick={() => { setShowPasswordDialog(true); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(false); }}
                      className="flex items-center justify-between rounded-xl border border-token bg-surface p-3 hover:bg-white/[0.04] transition-colors w-full text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20">
                          <Lock size={14} className="text-accent" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-primary">Change Password</span>
                          <span className="text-2xs text-muted">Update your account password</span>
                        </div>
                      </div>
                      <SquarePen size={15} className="text-muted shrink-0" />
                    </button>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={async () => { await supabase.auth.signOut(); onLogout(); }}
                      className="flex items-center gap-2 rounded-xl border border-token px-4 py-2 text-sm font-medium text-secondary hover:bg-white/[0.04] hover:text-danger transition-colors"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="general" className="mt-0 outline-none h-full flex flex-col">
              <div className="shrink-0 relative z-10 bg-app px-6 md:px-8 pt-6 pb-4 border-b border-token">
                <h2 className="text-lg font-semibold text-primary">General</h2>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-6 px-6 md:px-8 pr-2.5 pt-6 pb-8">
              <div className="flex items-center justify-between rounded-xl border border-token bg-surface p-3 mb-3">
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

              <div className="pt-2">
                <h3 className="text-lg font-semibold text-primary mb-3">Connections</h3>
                {!isAuthenticated ? (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-token p-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-semibold text-primary">Connect Spotify</span>
                      <span className="text-xs text-secondary">Connect Spotify to play your music directly in Aralko.</span>
                    </div>
                    <button
                      onClick={onLogin}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-token p-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">Spotify Connected</span>
                      </div>
                      <span className="text-xs text-success">Premium active</span>
                    </div>
                    <button
                      onClick={onLogout}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors shrink-0"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-token p-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">Connect your own AI key</span>
                      <div className="relative" ref={guideRef}>
                        <button
                          onClick={() => setShowGuide(v => !v)}
                          className="flex items-center justify-center rounded-full text-muted hover:text-accent transition-colors"
                          title="How to get a free key"
                        >
                          <Info size={15} />
                        </button>
                        {showGuide && (
                          <div className="absolute top-8 z-10 w-72 rounded-xl border border-token bg-surface p-4 shadow-xl shadow-black/20">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-2xs font-semibold text-primary">How to get your free key</p>
                              <button onClick={() => setShowGuide(false)} className="text-secondary hover:text-secondary transition-colors">
                                <X size={13} />
                              </button>
                            </div>
                            {[
                              <><span className="font-semibold text-accent">"Get Key"</span> button →</>,
                              <>Click the blue <span className="font-semibold text-primary">"Create API key"</span> button on Google's page</>,
                              <>Copy the key that appears (starts with <span className="font-mono text-accent">"AIza..."</span>)</>,
                              <>Paste it and click <span className="font-semibold text-primary">Save</span></>,
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
                    <span className="text-xs text-secondary">Add your free Gemini API key for faster, more reliable responses.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowKeyDialog(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors shrink-0"
                  >
                    Get Key
                  </button>
                </div>

                {savedKey && (
                  <div className="flex items-center justify-between rounded-xl border border-token px-4 py-3 mt-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20">
                        <Check size={16} className="text-success" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-primary">Key is active</span>
                        <span className="text-xs text-secondary font-mono">
                          {savedKey.slice(0, 4)}••••••••••{savedKey.slice(-4)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveKey}
                      className="rounded-lg p-2 text-muted hover:bg-white/[0.05] hover:text-danger transition-colors"
                      title="Remove key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
                </div>
              </ScrollArea>
            </TabsContent>


            <TabsContent value="privacy" className="mt-0 outline-none h-full flex flex-col">
              <div className="shrink-0 relative z-10 bg-app px-6 md:px-8 pt-6 pb-4 border-b border-token">
                <h2 className="text-lg font-semibold text-primary">Data & Privacy</h2>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-6 px-6 md:px-8 pr-2.5 pt-6 pb-8">

              {/* Section 1: What we collect */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary">What we store</h3>
                  <span className="inline-flex items-center justify-center rounded-full bg-surface border border-token px-2 py-0.5 text-xs font-medium text-secondary leading-none">6</span>
                </div>
                <Accordion className="rounded-xl border border-token overflow-hidden divide-y divide-token">
                  {([
                    { value: 'account',  title: 'Account information',  desc: 'Your email, display name, and profile picture.' },
                    { value: 'progress', title: 'Study progress',       desc: 'Pomodoro sessions, streaks, XP, level, flashcard progress, and quiz scores.' },
                    { value: 'content',  title: 'Study content',        desc: 'Your notes, reviewers, cheat sheets, flashcards, and test questions.' },
                    { value: 'chat',     title: 'AI chat',              desc: 'Your conversations with the AI study assistant, saved so you can continue them later.' },
                    { value: 'spotify',  title: 'Spotify connection',   desc: 'Your Spotify access and refresh tokens, securely stored to keep you connected across devices.' },
                    { value: 'prefs',    title: 'Preferences',          desc: 'Your Pomodoro settings, AI preferences, and personal Gemini API key.' },
                  ] as { value: string; title: string; desc: string }[]).map((item) => (
                    <AccordionItem key={item.value} value={item.value} className="border-none">
                      <AccordionTrigger className="px-5 pt-4 pb-1 text-[14px] font-semibold text-primary no-underline hover:no-underline hover:text-primary rounded-none">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-3 text-[13px] text-secondary leading-snug">
                        {item.desc}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              <div className="h-px bg-white/5 my-6" />
              {/* Section 2: AI consent toggle */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-token p-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-primary">AI & Data Processing</span>
                  <span className="text-xs text-secondary">Notes, files, and chat you send are processed by Google Gemini to generate study materials.</span>
                  {aiConsent && aiConsentDate && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1.5"><Check size={12} /> Acknowledged {new Date(aiConsentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  )}
                  {!aiConsent && <p className="text-xs text-muted mt-1">AI features are off. Turn this on to use them.</p>}
                </div>
                <Switch
                  checked={aiConsent}
                  disabled={consentLoading}
                  onCheckedChange={handleToggleConsent}
                />
              </div>

              <div className="h-px bg-white/5 my-6" />
              {/* Section 3: Export data */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-token p-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-primary">Export your data</span>
                  <span className="text-xs text-secondary">Download a JSON snapshot of your profile, settings, activities, sessions, and chat messages.</span>
                </div>
                <button
                  onClick={handleExportData}
                  disabled={exportingData || !user}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors shrink-0 disabled:opacity-50"
                >
                  {exportingData ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {exportingData ? 'Preparing...' : 'Export'}
                </button>
              </div>

              <div className="h-px bg-white/5 my-6" />
              {/* Section 4: Delete account */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 p-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-red-400">Delete Account</span>
                  <span className="text-xs text-secondary">Permanently deletes all your data. <span className="text-primary font-medium">This cannot be undone.</span></span>
                  {deleteError && <p className="text-xs text-red-400 mt-1">{deleteError}</p>}
                </div>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="feedback" className="mt-0 outline-none h-full flex flex-col">
              <div className="shrink-0 relative z-10 bg-app px-6 md:px-8 pt-6 pb-4 border-b border-token">
                <h2 className="text-lg font-semibold text-primary">Send Feedback</h2>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 px-6 md:px-8 pr-2.5 pt-4 pb-8">
              <p className="text-sm text-secondary">
                Have a suggestion, feature request, or found a bug? We'd love to hear from you.
              </p>
              <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              disabled={isSubmittingFeedback}
              placeholder="What's on your mind?"
              className="w-full h-32 rounded-xl border border-token bg-app p-3 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors resize-none disabled:opacity-50"
              />
              {feedbackError && <p className="text-xs text-red-400 font-medium">{feedbackError}</p>}
              {feedbackSuccess && (
              <div className="rounded-xl bg-success-muted border border-success/20 p-3 flex items-center gap-2">
              <Check size={16} className="text-success shrink-0" />
              <p className="text-sm font-medium text-success">Feedback sent! Thank you.</p>
              </div>
              )}
              {!feedbackSuccess && (
              <button
              disabled={isSubmittingFeedback || !feedbackText.trim()}
              onClick={handleFeedbackSubmit}
              className="self-start rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent px-4 py-2 text-sm font-semibold text-primary transition-colors flex items-center gap-2"
              >
              {isSubmittingFeedback && <Loader2 size={16} className="animate-spin" />}
              {isSubmittingFeedback ? "Sending..." : "Submit Feedback"}
              </button>
              )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        {/* ── Change Email overlay dialog ── */}
        {showEmailDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-token bg-surface p-6 shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-semibold text-primary">Change Email</span>
                <button onClick={() => setShowEmailDialog(false)} className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-primary transition-colors">
                  <X size={16} />
                </button>
              </div>
              {emailSuccess ? (
                <div className="rounded-xl bg-success-muted border border-success/20 p-4 flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-success">Confirmation email sent</p>
                    <p className="text-xs text-muted mt-0.5">Check <span className="font-medium text-primary">{newEmail}</span> to confirm the change.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted mb-4">Enter your new email address. Supabase will send a confirmation link before the change takes effect.</p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                      placeholder="new@email.com"
                      className="rounded-xl border border-token bg-app px-3 py-2 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                    />
                    {emailError && <p className="text-xs text-danger flex items-center gap-1"><X size={12} />{emailError}</p>}
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => setShowEmailDialog(false)} className="flex-1 rounded-xl border border-token px-3 py-2 text-sm text-muted hover:text-primary transition-colors">Cancel</button>
                      <button
                        onClick={handleChangeEmail}
                        disabled={savingEmail || !newEmail.trim()}
                        className="flex-1 rounded-xl bg-accent hover:bg-accent/90 px-3 py-2 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingEmail ? <Loader2 size={14} className="animate-spin" /> : null}
                        {savingEmail ? 'Sending...' : 'Send confirmation'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Change Password overlay dialog ── */}
        {showPasswordDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-token bg-surface p-6 shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-semibold text-primary">Change Password</span>
                <button onClick={() => setShowPasswordDialog(false)} className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-primary transition-colors">
                  <X size={16} />
                </button>
              </div>
              {passwordSuccess ? (
                <div className="rounded-xl bg-success-muted border border-success/20 p-4 flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  <p className="text-sm font-medium text-success">Password updated successfully!</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-secondary">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPwd ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }}
                          placeholder="At least 6 characters"
                          className="w-full rounded-xl border border-token bg-app px-3 py-2 pr-9 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                        />
                        <button type="button" onClick={() => setShowNewPwd(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors">
                          {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-secondary">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPwd ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                          placeholder="Repeat password"
                          className="w-full rounded-xl border border-token bg-app px-3 py-2 pr-9 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
                        />
                        <button type="button" onClick={() => setShowConfirmPwd(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors">
                          {showConfirmPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    {passwordError && <p className="text-xs text-danger flex items-center gap-1"><X size={12} />{passwordError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setShowPasswordDialog(false)} className="flex-1 rounded-xl border border-token px-3 py-2 text-sm text-muted hover:text-primary transition-colors">Cancel</button>
                      <button
                        onClick={handleChangePassword}
                        disabled={savingPassword || !newPassword || !confirmPassword}
                        className="flex-1 rounded-xl bg-accent hover:bg-accent/90 px-3 py-2 text-sm font-semibold text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
                        {savingPassword ? 'Saving...' : 'Update password'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent className="bg-app border-token">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-primary">Delete Account?</AlertDialogTitle>
          <AlertDialogDescription className="text-secondary">
            This permanently deletes your account and all associated data — activities, sessions, chat history, settings. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError && <p className="text-xs text-red-400 -mt-2">{deleteError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-surface border-token text-secondary hover:bg-white/[0.05] hover:text-primary">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
            disabled={deletingAccount}
            className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2"
          >
            {deletingAccount && <Loader2 size={14} className="animate-spin" />}
            {deletingAccount ? 'Deleting...' : 'Yes, delete everything'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={showKeyDialog} onOpenChange={(open) => {
      setShowKeyDialog(open);
      if (!open) {
        setKeyInput('');
        setKeyError('');
      }
    }}>
      <DialogContent className="w-[95vw] sm:max-w-md bg-app border-token p-6">
        <DialogHeader>
          <DialogTitle className="text-primary text-lg font-semibold">Get your free Gemini API key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <ol className="list-decimal list-inside space-y-2 text-sm text-secondary">
            <li>Open Google AI Studio</li>
            <li>Click <strong>"Create API key"</strong></li>
            <li>Copy the key that appears (starts with "AIza...")</li>
            <li>Paste it below</li>
          </ol>
          <button
            type="button"
            onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank', 'noopener,noreferrer')}
            className="w-full rounded-xl bg-surface border border-token px-4 py-2 text-sm font-semibold text-primary hover:bg-white/[0.04] transition-colors"
          >
            Open Google AI Studio
          </button>
          <div className="flex flex-col gap-2 mt-4">
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(); }}
                className="flex-1 rounded-xl border border-token bg-app px-3 py-2 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors"
              />
              <button
                onClick={handleSaveKey}
                disabled={validating || !keyInput.trim()}
                className="flex w-[80px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-primary hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {validating ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
              </button>
            </div>
            {keyStatus === 'success' && (
              <div className="flex items-center gap-2 text-xs text-success">
                <Check size={13} />
                Key added - you're all set!
              </div>
            )}
            {keyStatus === 'error' && (
              <div className="flex items-start gap-2 text-xs text-red-400">
                <X size={13} className="mt-0.5 shrink-0" />
                <span>{keyError || "That doesn't look right - please check you copied the full key."}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* AI Consent OFF confirmation dialog */}
    <AlertDialog open={consentOffDialogOpen} onOpenChange={setConsentOffDialogOpen}>
      <AlertDialogContent className="bg-app border-token">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-primary">Turn off AI features?</AlertDialogTitle>
          <AlertDialogDescription className="text-secondary">
            AI features that send your content to Google Gemini will stop working until you turn this back on.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-surface border-token text-secondary hover:bg-white/[0.05] hover:text-primary">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { onConsentOff(); setConsentOffDialogOpen(false); }}
            className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300"
          >
            Turn off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
