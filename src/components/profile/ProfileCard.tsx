import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Flame, Zap, Star, BookOpen, Trophy, Clock, CalendarDays, Share } from 'lucide-react';

interface ProfileCardProps {
  displayName: string;
  avatarUrl?: string | null;
  initials: string;
  streak: React.ReactNode;
  level: React.ReactNode;
  xp: React.ReactNode;
  sessionsCount: React.ReactNode;
  longestStreak: React.ReactNode;
  totalTime: React.ReactNode;
  joinDate: React.ReactNode;
  showShareButton?: boolean;
  onShareClick?: () => void;
}

export function ProfileCard({
  displayName,
  avatarUrl,
  initials,
  streak,
  level,
  xp,
  sessionsCount,
  longestStreak,
  totalTime,
  joinDate,
  showShareButton,
  onShareClick
}: ProfileCardProps) {
  return (
    <div id="aralko-stats-card" className="w-full rounded-2xl bg-surface bg-gradient-to-br from-accent/25 via-violet-600/10 to-indigo-500/10 border border-accent/20 p-5 mb-4 shadow-2xl shadow-black/60 relative">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 overflow-hidden rounded-xl shadow-sm">
            <img src="/logo.png" alt="Aralko" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[13px] font-bold text-primary tracking-wide leading-none">Aralko</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">Study Stats</span>
          {showShareButton && onShareClick && (
            <button
              onClick={onShareClick}
              title="Share"
              data-html2canvas-ignore="true"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-accent/20 hover:bg-accent/30 text-accent transition-colors shrink-0"
            >
              <Share size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Profile Row */}
      <div className="flex flex-col items-center gap-2 mb-6 mt-2">
        <Avatar className="h-16 w-16 border-2 border-accent/20">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} crossOrigin="anonymous" />}
          <AvatarFallback className="bg-slate-800 text-secondary font-medium text-xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-primary">{displayName || 'Anonymous Learner'}</span>
        </div>
      </div>

      {/* Streak highlight */}
      <div className="flex justify-center items-center gap-2 mb-5">
        <Flame size={28} className="text-amber-400 shrink-0" />
        <div className="flex items-baseline gap-1.5">
          <p className="text-3xl font-extrabold text-primary leading-none">{streak}</p>
          <p className="text-xs text-muted font-medium">day streak</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[0.07] p-2.5 flex flex-col items-center justify-between min-h-[72px]">
          <p className="text-base font-bold text-primary leading-none">{level}</p>
          <p className="text-[10px] text-muted leading-tight mt-1 mb-1.5">Level</p>
          <Zap size={14} className="text-accent mt-auto" />
        </div>

        <div className="rounded-xl bg-white/[0.07] p-2.5 flex flex-col items-center justify-between min-h-[72px]">
          <p className="text-base font-bold text-primary leading-none">{xp}</p>
          <p className="text-[10px] text-muted leading-tight mt-1 mb-1.5">Total XP</p>
          <Star size={14} className="text-amber-400 mt-auto" />
        </div>

        <div className="rounded-xl bg-white/[0.07] p-2.5 flex flex-col items-center justify-between min-h-[72px]">
          <p className="text-base font-bold text-primary leading-none">{sessionsCount}</p>
          <p className="text-[10px] text-muted leading-tight mt-1 mb-1.5">Sessions</p>
          <BookOpen size={14} className="text-success mt-auto" />
        </div>

        <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Trophy size={11} className="text-secondary" />
            <span className="text-[11px] text-secondary">Longest streak</span>
          </div>
          <span className="text-[11px] font-bold text-primary">{longestStreak}</span>
        </div>

        <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={11} className="text-secondary" />
            <span className="text-[11px] text-secondary">Total study time</span>
          </div>
          <span className="text-[11px] font-bold text-primary">{totalTime}</span>
        </div>

        {joinDate && (
          <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={11} className="text-secondary" />
              <span className="text-[11px] text-secondary">Active since</span>
            </div>
            <span className="text-[11px] font-semibold text-primary">{joinDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

