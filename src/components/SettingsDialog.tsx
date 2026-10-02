import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Key, Check, X, Loader2, HelpCircle, SquarePen, Camera, Mail, Lock, Eye, EyeOff, LogOut, ExternalLink, Trash2, Music2, User, Settings2, MessageSquare, Bot } from 'lucide-react';
import { getPersonalGeminiKey, setPersonalGeminiKey, validateGeminiKey } from '../lib/aiCall';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

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
  const { user } = useAuth();
  
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

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? '';
      setDisplayName(name);
      setOriginalName(name);
      setAvatarUrl(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null);
    }
  }, [user]);

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

      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmed, name: trimmed }
      });
      if (error) throw error;

      await supabase.from('user_settings').upsert({ user_id: user.id, display_name: trimmed }, { onConflict: 'user_id' });
      
      await supabase.auth.refreshSession();

      setOriginalName(trimmed);
      setNameSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: any) {
      setNameError('An error occurred while saving.');
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
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      await supabase.auth.refreshSession();
      setAvatarUrl(publicUrl);
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
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl h-[85vh] min-h-[500px] p-0 flex flex-col md:flex-row bg-app border-token text-primary overflow-hidden shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="account" orientation="vertical" className="flex flex-col md:flex-row w-full h-full">
          {/* Sidebar Nav */}
          <div className="w-full md:w-[240px] shrink-0 border-b md:border-b-0 md:border-r border-token bg-surface py-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6 px-6">
              <Avatar className="h-10 w-10 shrink-0 border border-token">
                <AvatarImage src={avatarUrl || ''} />
                <AvatarFallback className="bg-accent text-white font-bold text-sm">
                  {(displayName || user?.email || '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-primary truncate">{displayName || user?.email?.split('@')[0] || 'User'}</span>
                <span className="text-xs text-muted truncate">{user?.email}</span>
              </div>
            </div>
            
            <TabsList className="flex flex-col h-auto bg-transparent p-0 items-stretch space-y-0.5 w-full">
              <TabsTrigger value="account" className="w-full justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-sm text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <User size={15} />
                Account
              </TabsTrigger>
              <TabsTrigger value="general" className="w-full justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-sm text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <Settings2 size={15} />
                General
              </TabsTrigger>
              <TabsTrigger value="ai" className="w-full justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-sm text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <Bot size={15} />
                AI
              </TabsTrigger>
              <TabsTrigger value="feedback" className="w-full justify-start gap-3 data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-sm text-secondary hover:text-primary hover:bg-white/[0.04] rounded-none px-6 py-3 transition-colors">
                <MessageSquare size={15} />
                Feedback
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 relative" style={{ scrollbarGutter: 'stable' }}>
            <TabsContent value="account" className="mt-0 outline-none h-full space-y-6">
              <h2 className="text-lg font-semibold text-primary mb-4">Account</h2>
              <>
                  {/* Profile Picture */}
                  <div className="flex flex-col gap-3 rounded-xl border border-token bg-surface p-4 mt-3">
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
              </>
            </TabsContent>

            <TabsContent value="general" className="mt-0 outline-none h-full space-y-6">
              <h2 className="text-lg font-semibold text-primary mb-4">General</h2>
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
                <h3 className="text-sm font-semibold text-primary mb-3">Integrations</h3>
                {!isAuthenticated ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-token bg-surface p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1db954]/20 shrink-0">
                        <Music2 size={14} className="text-[#1db954]" />
                      </div>
                      <span className="text-xs text-secondary truncate">Link your Spotify Premium account</span>
                    </div>
                    <button
                      onClick={onLogin}
                      className="bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-xs py-1.5 px-4 rounded-xl border-0 transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-token bg-surface p-3">
                    <div className="flex items-center gap-3 min-w-0">
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
                      className="flex items-center gap-1.5 shrink-0 text-xs px-3 py-1.5 rounded-lg text-danger hover:bg-danger/10 border border-danger/20 transition-colors"
                    >
                      <LogOut size={12} />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-0 outline-none h-full space-y-6">
              <h2 className="text-lg font-semibold text-primary mb-4">AI</h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20">
                    <Key size={14} className="text-accent" />
                  </div>
                  <span className="text-sm font-semibold text-primary">Your own Gemini API key</span>
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-2xs font-semibold text-accent border border-accent/30">
                    recommended
                  </span>
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
                  By default, Aralko uses a shared API key that is strictly rate-limited (one request every 2 seconds across all users). To avoid "Too many requests" errors and get faster responses, provide your own free Gemini API key.
                </p>

                <div className="flex items-center gap-2 my-2">
                  <a 
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                  >
                    Get my free key <ExternalLink size={12} />
                  </a>
                </div>

                {savedKey ? (
                  <div className="flex items-center justify-between rounded-xl border border-token bg-surface px-4 py-3">
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
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="feedback" className="mt-0 outline-none h-full space-y-4">
              <h2 className="text-lg font-semibold text-primary mb-2">Send Feedback</h2>
              <p className="text-sm text-secondary">
                Have a suggestion, feature request, or found a bug? We'd love to hear from you.
              </p>
              <textarea
                placeholder="What's on your mind?"
                className="w-full h-32 rounded-xl border border-token bg-app p-3 text-sm text-primary placeholder-slate-500 outline-none focus:border-accent/60 transition-colors resize-none"
              ></textarea>
              <button
                className="self-start rounded-xl bg-accent hover:bg-accent/90 px-4 py-2 text-sm font-semibold text-primary transition-colors"
                onClick={() => alert("Feedback submission is not yet wired to a backend! (Will be sent to Supabase in the future)")}
              >
                Submit Feedback
              </button>
              <p className="text-xs text-muted mt-2">
                Note: Feedback submission is currently a UI placeholder and needs follow-up wiring to a Supabase table.
              </p>
            </TabsContent>
          </div>
        </Tabs>

        {/* ── Change Email overlay dialog ── */}
        {showEmailDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
  );
}
