import { useState, useCallback, useRef } from 'react';
import { LogOut, Flame, Star, Zap, BookOpen, Clock, Share, X, CalendarDays } from 'lucide-react';
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

    // Clone the node BEFORE closing the modal so the ref stays valid
    const clone = cardRef.current.cloneNode(true) as HTMLElement;
    const isLight = document.documentElement.classList.contains('light');

    // Give the clone a solid opaque background so gradients render correctly
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.width = `${cardRef.current.offsetWidth}px`;
    clone.style.zIndex = '-1';
    clone.style.borderRadius = '1rem';
    document.body.appendChild(clone);

    try {
      const bgColor = isLight ? '#f1f5f9' : '#151922';
      const canvas = await html2canvas(clone, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 5000,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = 'aralko-stats.jpg';
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to generate image', e);
      showToast('Could not save image. Try again.', 'error');
    } finally {
      document.body.removeChild(clone);
    }
  }, [showToast]);

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

  const joinDate = user?.created_at
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(user.created_at))
    : null;

  const handleSignOut = async () => {
    handleClose();
    onLogout();
    await supabase.auth.signOut();
  };

  const handleClose = () => setIsOpen(false);

  const inviteLink = `${window.location.origin}/?ref=${encodeURIComponent(displayName)}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('Link copied to clipboard!', 'success');
    } catch {
      showToast('Could not copy link.', 'error');
    }
  }, [inviteLink, showToast]);

  const handleShareFacebook = useCallback(() => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`, '_blank');
  }, [inviteLink]);

  const handleShareInstagram = useCallback(() => {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    showToast('Link copied! Paste it on Instagram.', 'success');
  }, [inviteLink, showToast]);

  const handleShareEmail = useCallback(() => {
    const subject = encodeURIComponent('Study with me on Aralko!');
    const body = encodeURIComponent(`Hey! I've been using Aralko to study smarter. Join me!\n\n${inviteLink}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [inviteLink]);

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
                  <span className="text-[10px] text-muted">Study Stats</span>
                  <button
                    onClick={() => setShowShareMenu(true)}
                    title="Share"
                    className="h-6 w-6 flex items-center justify-center rounded-lg bg-accent/20 hover:bg-accent/30 text-accent transition-colors"
                  >
                    <Share size={13} />
                  </button>
                </div>
              </div>

              {/* Streak highlight */}
              <div className="flex items-center gap-2 mb-4">
                <Flame size={26} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-3xl font-extrabold text-primary leading-none">{streak}</p>
                  <p className="text-[11px] text-muted mt-0.5">day streak</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap size={11} className="text-accent" />
                  </div>
                  <p className="text-base font-bold text-primary leading-none">{level}</p>
                  <p className="text-[10px] text-muted mt-0.5">Level</p>
                </div>

                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star size={11} className="text-amber-400" />
                  </div>
                  <p className="text-base font-bold text-primary leading-none">{xp.toLocaleString()}</p>
                  <p className="text-[10px] text-muted mt-0.5">Total XP</p>
                </div>

                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BookOpen size={11} className="text-success" />
                  </div>
                  <p className="text-base font-bold text-primary leading-none">{sessionsCount}</p>
                  <p className="text-[10px] text-muted mt-0.5">Sessions</p>
                </div>

                <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={11} className="text-secondary" />
                    <span className="text-[11px] text-secondary">Total study time</span>
                  </div>
                  <span className="text-[11px] font-bold text-primary">{totalHours} hrs</span>
                </div>

                {joinDate && (
                  <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={11} className="text-secondary" />
                      <span className="text-[11px] text-secondary">Member since</span>
                    </div>
                    <span className="text-[11px] font-semibold text-primary">{joinDate}</span>
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

      {/* ── Share with Friends Modal ──────────────────────── */}
      {showShareMenu && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowShareMenu(false); }}
        >
          <div className="w-full max-w-xs rounded-2xl border border-token bg-surface p-6 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-primary">Share with Friends</h2>
              <button
                onClick={() => setShowShareMenu(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted mb-5 text-center">Studying is more fun when you connect with friends!</p>

            {/* Invite link row */}
            <p className="text-xs font-medium text-secondary mb-2">Share your link</p>
            <div className="flex items-center gap-2 rounded-xl border border-token bg-raised px-3 py-2.5 mb-6">
              <span className="flex-1 text-xs text-primary truncate">{inviteLink}</span>
              <button
                onClick={handleCopyLink}
                title="Copy link"
                className="shrink-0 text-muted hover:text-accent transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              </button>
            </div>

            {/* Share to icons */}
            <p className="text-xs font-medium text-secondary mb-4">Share to</p>
            <div className="grid grid-cols-4 gap-2">
              {/* Save Image */}
              <button
                onClick={() => { setShowShareMenu(false); handleDownloadJpeg(); }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="h-12 w-12 rounded-full bg-raised border border-token flex items-center justify-center group-hover:border-accent/50 group-hover:bg-accent/10 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary group-hover:text-accent transition-colors">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                  </svg>
                </div>
                <span className="text-[10px] text-muted group-hover:text-primary transition-colors text-center leading-tight">Save Image</span>
              </button>

              {/* Facebook */}
              <button
                onClick={() => { setShowShareMenu(false); handleShareFacebook(); }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1877F2' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <span className="text-[10px] text-muted group-hover:text-primary transition-colors text-center leading-tight">Facebook</span>
              </button>

              {/* Instagram */}
              <button
                onClick={() => { setShowShareMenu(false); handleShareInstagram(); }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                </div>
                <span className="text-[10px] text-muted group-hover:text-primary transition-colors text-center leading-tight">Instagram</span>
              </button>

              {/* Email */}
              <button
                onClick={() => { setShowShareMenu(false); handleShareEmail(); }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="h-12 w-12 rounded-full bg-raised border border-token flex items-center justify-center group-hover:border-accent/50 group-hover:bg-accent/10 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary group-hover:text-accent transition-colors">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <span className="text-[10px] text-muted group-hover:text-primary transition-colors text-center leading-tight">Email</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
