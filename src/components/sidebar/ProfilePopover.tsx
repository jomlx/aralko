import { useState, useCallback, useRef } from 'react';
import { LogOut, Flame, Star, Zap, BookOpen, Clock, Share, X, CalendarDays, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { xpToLevel } from '../../hooks/useUserSettings';
import { useToast } from '../ui/Toast';

interface ProfilePopoverProps {
  onLogout: () => void;
  streak: number;
  xp: number;
  totalMinutes: number;
  sessionsCount: number;
}

export function ProfilePopover({ onLogout, streak, xp, totalMinutes, sessionsCount }: ProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadJpeg = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const isLight = document.documentElement.classList.contains('light');
      const bgColor = isLight ? '#ffffff' : '#151922'; // Matches bg-surface
      
      const canvas = await html2canvas(cardRef.current, { 
        backgroundColor: bgColor, 
        scale: 2, 
        useCORS: true 
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      const link = document.createElement('a');
      link.download = `aralko-stats.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to generate image', e);
    }
  }, []);

  const { user } = useAuth();
  const displayEmail = user?.email ?? 'Not signed in';
  const displayName =
    user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? 'User';
  const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const level = xpToLevel(xp);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Format join date from Supabase user.created_at
  const joinDate = user?.created_at
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(user.created_at))
    : null;

  const handleSignOut = async () => {
    handleClose();
    onLogout();
    await supabase.auth.signOut();
  };

  const handleClose = () => setIsOpen(false);

  // Share via invite link — copies the app URL with a ref param so new visitors land on the sign-up page
  const handleShare = useCallback(async () => {
    const inviteLink = `${window.location.origin}/?ref=${encodeURIComponent(displayName)}`;
    const shareText = `Join me on Aralko — the AI-powered study companion! I'm Level ${level} with a ${streak}-day streak 🔥\n${inviteLink}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Study with me on Aralko',
          text: shareText,
          url: inviteLink,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        showToast('Invite link copied to clipboard!', 'success');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // Final fallback — manually copy just the URL
        try {
          await navigator.clipboard.writeText(inviteLink);
          showToast('Link copied!', 'success');
        } catch {
          showToast('Could not copy link. Try again.', 'error');
        }
      }
    }
  }, [displayName, level, streak, showToast]);

  return (
    <>
      {/* Profile Card Trigger */}
      <div
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 rounded-2xl border border-token bg-surface p-3 hover:bg-white/[0.09] cursor-pointer transition-colors shrink-0"
      >
        <Avatar className="h-9 w-9">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="bg-accent text-primary font-bold text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-primary truncate">{displayName}</span>
          <span className="text-xs text-secondary truncate">{displayEmail}</span>
        </div>
      </div>

      {/* Profile Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-token bg-surface p-6 shadow-2xl shadow-black/60">
            {/* Header row */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-accent text-primary font-bold text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-primary">{displayName}</span>
                  <span className="text-xs text-secondary">{displayEmail}</span>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Streak & Stats Card ─────────────────────────── */}
            <div ref={cardRef} className="rounded-2xl bg-gradient-to-br from-accent/25 via-violet-600/10 to-indigo-500/10 border border-accent/20 p-5 mb-3">
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 overflow-hidden rounded-xl shadow-sm">
                    <img src="/logo.png" alt="Aralko" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary tracking-wide leading-none">Aralko</span>
                    <span className="text-[10px] text-muted leading-tight mt-0.5">@{displayName.replace(/\s+/g, '').toLowerCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-muted">Study Stats</span>
                  <div className="relative flex items-center gap-1">
                    <button
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      title="Share or Save"
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-accent/20 hover:bg-accent/30 text-accent transition-colors"
                    >
                      <Share size={15} />
                    </button>
                    {showShareMenu && (
                      <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-token bg-surface p-1.5 shadow-xl shadow-black/40 z-10 animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                          onClick={() => {
                            setShowShareMenu(false);
                            handleShare();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-white/[0.06] transition-colors"
                        >
                          <Share size={13} />
                          Share Link
                        </button>
                        <button
                          onClick={() => {
                            setShowShareMenu(false);
                            handleDownloadJpeg();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-white/[0.06] transition-colors"
                        >
                          <Download size={13} />
                          Save Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Streak highlight */}
              <div className="flex items-center gap-2 mb-4">
                <Flame size={28} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-3xl font-extrabold text-primary leading-none">{streak}</p>
                  <p className="text-xs text-muted mt-0.5">day streak</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap size={12} className="text-accent" />
                  </div>
                  <p className="text-lg font-bold text-primary leading-none">{level}</p>
                  <p className="text-2xs text-muted mt-0.5">Level</p>
                </div>

                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star size={12} className="text-amber-400" />
                  </div>
                  <p className="text-lg font-bold text-primary leading-none">{xp.toLocaleString()}</p>
                  <p className="text-2xs text-muted mt-0.5">Total XP</p>
                </div>

                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BookOpen size={12} className="text-success" />
                  </div>
                  <p className="text-lg font-bold text-primary leading-none">{sessionsCount}</p>
                  <p className="text-2xs text-muted mt-0.5">Sessions</p>
                </div>

                <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-secondary" />
                    <span className="text-xs text-secondary">Total study time</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{totalHours} hrs</span>
                </div>

                {joinDate && (
                  <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={13} className="text-secondary" />
                      <span className="text-xs text-secondary">Member since</span>
                    </div>
                    <span className="text-xs font-semibold text-primary">{joinDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Sign out ─────────────────────────────────── */}
            <div className="h-px bg-white/[0.07] mb-3 mt-4" />
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 text-sm font-medium text-danger hover:bg-raised border border-danger/25 hover:border-danger/40 rounded-xl py-2 transition-colors w-full"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
