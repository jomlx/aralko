import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useUserSettingsContext as useUserSettings } from '../../hooks/UserSettingsContext';
import { Trophy, Target, CalendarDays, Loader2, Flame, Zap, Star, BookOpen, Clock, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

type TimeRange = 'all_time' | 'this_week';

interface LeaderboardUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  xp_this_week: number;
  level: number;
}

export function LeaderboardView() {
  const { user } = useAuth();
  const { displayName: dbDisplayName, avatarUrl: dbAvatarUrl, xp: ctxXp, xpThisWeek: ctxXpThisWeek, level: ctxLevel } = useUserSettings();
  const [range, setRange] = useState<TimeRange>('all_time');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const lastGoodListRef = useRef<LeaderboardUser[]>([]);
  const xpRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [selectedUserExtra, setSelectedUserExtra] = useState<{ sessionsCount: number, totalMinutes: number, streak: number, joinDate: string | null } | null>(null);

  const handleUserClick = async (u: LeaderboardUser) => {
    setSelectedUser(u);
    setSelectedUserExtra(null);
    
    try {
      const { data: sessions } = await supabase.from('sessions').select('minutes').eq('user_id', u.user_id);
      const { data: us } = await supabase.from('user_settings').select('saved_streak, updated_at').eq('user_id', u.user_id).single();
      
      let totalMinutes = 0;
      let sessionsCount = 0;
      if (sessions) {
        sessionsCount = sessions.length;
        totalMinutes = sessions.reduce((acc, s) => acc + s.minutes, 0);
      }

      let joinDate = null;
      if (us?.updated_at) {
        joinDate = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(us.updated_at));
      }

      setSelectedUserExtra({
        sessionsCount,
        totalMinutes,
        streak: us?.saved_streak || 0,
        joinDate
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaderboard = useCallback(async (isInitial = false) => {
    // Wait for auth session before querying
    if (!user) return;

    if (isInitial) setLoading(true);

    const orderBy = range === 'all_time' ? 'xp' : 'xp_this_week';
    const xpFilter = range === 'all_time' ? 'xp' : 'xp_this_week';

    console.log('[Leaderboard] fetching from leaderboard_public, range:', range, 'user:', user.id);

    const { data, error } = await supabase
      .from('leaderboard_public')
      .select('user_id, display_name, avatar_url, xp, xp_this_week, level')
      .gt(xpFilter, 0)
      .order(orderBy, { ascending: false })
      .limit(50);

    if (!isMountedRef.current) return;

    if (error) {
      console.error('[Leaderboard] fetch error:', error);
      // Keep the last good list — never fall back to showing only the current user
      if (isInitial) setLoading(false);
      return;
    }

    let list: LeaderboardUser[] = data ?? [];

    // Merge current user into list if their XP for this tab is > 0 and they're not already present
    const myXp = range === 'all_time' ? ctxXp : ctxXpThisWeek;
    if (user && myXp > 0) {
      const alreadyIn = list.some(u => u.user_id === user.id);
      if (!alreadyIn) {
        list = [
          ...list,
          {
            user_id: user.id,
            display_name: dbDisplayName,
            avatar_url: dbAvatarUrl,
            xp: ctxXp,
            xp_this_week: ctxXpThisWeek,
            level: ctxLevel,
          },
        ].sort((a, b) => (range === 'all_time' ? b.xp - a.xp : b.xp_this_week - a.xp_this_week));
      }
    }

    lastGoodListRef.current = list;
    setUsers(list);
    if (isInitial) setLoading(false);
  }, [range, user, ctxXp, ctxXpThisWeek, ctxLevel, dbDisplayName, dbAvatarUrl]);

  // Initial fetch + refetch when range or auth changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchLeaderboard(true);
    return () => { isMountedRef.current = false; };
  }, [range, user?.id]);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(() => { fetchLeaderboard(false); }, 30000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  // Refetch on window focus
  useEffect(() => {
    const onFocus = () => fetchLeaderboard(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchLeaderboard]);

  // Refetch ~1s after XP, name, or avatar changes (wait for DB write to propagate)
  useEffect(() => {
    if (xpRefetchTimerRef.current) clearTimeout(xpRefetchTimerRef.current);
    xpRefetchTimerRef.current = setTimeout(() => { fetchLeaderboard(false); }, 1000);
    return () => {
      if (xpRefetchTimerRef.current) clearTimeout(xpRefetchTimerRef.current);
    };
  }, [ctxXp, ctxXpThisWeek, dbDisplayName, dbAvatarUrl]);

  const getInitials = (name: string | null, userId: string) => {
    if (name) return name.slice(0, 2).toUpperCase();
    return userId.slice(0, 2).toUpperCase();
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    if (rank === 2) return 'text-secondary bg-slate-300/10 border-slate-300/20';
    if (rank === 3) return 'text-amber-700 bg-amber-700/10 border-amber-700/20';
    return 'text-muted bg-white/[0.03] border-token';
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Header & Controls */}
      <div className="flex items-end justify-between bg-surface p-6 rounded-2xl border border-token">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
              <Trophy size={18} />
            </div>
            <h2 className="text-2xl font-bold text-primary">Leaderboard</h2>
          </div>
          <p className="text-sm text-secondary">See how you stack up against the Aralko community.</p>
        </div>

        <div className="flex items-center bg-app p-1 rounded-xl border border-token">
          <button
            onClick={() => setRange('all_time')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              range === 'all_time' ? 'bg-accent text-primary shadow-sm' : 'text-secondary hover:text-slate-200'
            }`}
          >
            <Target size={18} />
            All Time
          </button>
          <button
            onClick={() => setRange('this_week')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              range === 'this_week' ? 'bg-accent text-primary shadow-sm' : 'text-secondary hover:text-slate-200'
            }`}
          >
            <CalendarDays size={18} />
            This Week
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="bg-surface rounded-2xl border border-token overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={18} className="animate-spin text-accent mb-4" />
            <p className="text-sm text-secondary">Loading rankings...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Trophy size={18} className="text-slate-700 mb-4" />
            <p className="text-secondary font-medium">No activity yet</p>
            <p className="text-sm text-muted mt-1">Complete study sessions to earn XP and climb the ranks!</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header Row */}
            <div className="grid grid-cols-[60px_1fr_100px_120px] gap-4 px-6 py-4 border-b border-token bg-white/[0.02] text-xs font-semibold text-secondary uppercase tracking-wider">
              <div className="text-center">Rank</div>
              <div>Student</div>
              <div className="text-center">Level</div>
              <div className="text-right">Total XP</div>
            </div>

            {/* User Rows */}
            <div className="divide-y divide-white/[0.03]">
              {users.map((u, i) => {
                const isMe = u.user_id === user?.id;
                const rank = i + 1;
                const displayXp = range === 'all_time' ? u.xp : u.xp_this_week;
                
                return (
                  <div 
                    key={u.user_id}
                    onClick={() => handleUserClick(u)}
                    className={`grid grid-cols-[60px_1fr_100px_120px] gap-4 px-6 py-4 items-center transition-colors cursor-pointer ${
                      isMe ? 'bg-accent-muted' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex justify-center">
                      <div className={`h-8 w-8 rounded-full border flex items-center justify-center text-sm font-bold ${getRankColor(rank)}`}>
                        {rank}
                      </div>
                    </div>

                    {/* Student Info */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-token">
                        {(isMe ? dbAvatarUrl : u.avatar_url) && <AvatarImage src={(isMe ? dbAvatarUrl : u.avatar_url)!} alt={(isMe ? dbDisplayName : u.display_name) || ''} />}
                        <AvatarFallback className="bg-slate-800 text-secondary font-medium">
                          {getInitials(isMe ? dbDisplayName : u.display_name, u.user_id)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className={`font-semibold ${isMe ? 'text-accent' : 'text-slate-200'}`}>
                          {(isMe ? dbDisplayName : u.display_name) || 'Anonymous Learner'} {isMe && '(You)'}
                        </span>
                      </div>
                    </div>

                    {/* Level Badge */}
                    <div className="flex justify-center">
                      <span className="inline-flex items-center justify-center h-7 px-3 bg-white/[0.05] border border-token rounded-full text-xs font-semibold text-secondary">
                        Lvl {u.level}
                      </span>
                    </div>

                    {/* XP */}
                    <div className="text-right flex flex-col items-end justify-center">
                      <span className="font-bold text-success font-mono text-sm">
                        {displayXp.toLocaleString()} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedUser(null); }}
        >
          <div className="w-full max-w-sm flex flex-col items-center">
            {/* Stats Card */}
            <div className="w-full rounded-2xl bg-surface bg-gradient-to-br from-accent/25 via-violet-600/10 to-indigo-500/10 border border-accent/20 p-5 mb-4 shadow-2xl shadow-black/60">
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 overflow-hidden rounded-xl shadow-sm">
                    <img src="/logo.png" alt="Aralko" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary tracking-wide leading-none">Aralko</span>
                    <span className="text-[10px] text-muted leading-tight mt-0.5">@{(selectedUser.display_name || 'user').replace(/\s+/g, '').toLowerCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">Study Stats</span>
                </div>
              </div>

              {/* Profile Row */}
              <div className="flex flex-col items-center gap-2 mb-6 mt-2">
                <Avatar className="h-16 w-16 border-2 border-accent/20">
                  {selectedUser.avatar_url && <AvatarImage src={selectedUser.avatar_url} alt={selectedUser.display_name || ''} />}
                  <AvatarFallback className="bg-slate-800 text-secondary font-medium text-xl">
                    {getInitials(selectedUser.display_name, selectedUser.user_id)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-primary">{selectedUser.display_name || 'Anonymous Learner'}</span>
                </div>
              </div>

              {/* Streak highlight */}
              <div className="flex justify-center items-center gap-2 mb-5">
                <Flame size={18} className="text-amber-400 shrink-0" />
                <div className="flex items-baseline gap-1.5">
                  <p className="text-3xl font-extrabold text-primary leading-none">
                    {selectedUserExtra ? selectedUserExtra.streak : <Loader2 size={18} className="animate-spin inline text-muted" />}
                  </p>
                  <p className="text-xs text-muted font-medium">day streak</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap size={18} className="text-accent" />
                  </div>
                  <p className="text-base font-bold text-primary leading-none">{selectedUser.level}</p>
                  <p className="text-[10px] text-muted mt-0.5">Level</p>
                </div>

                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star size={18} className="text-amber-400" />
                  </div>
                  <p className="text-base font-bold text-primary leading-none">{(range === 'all_time' ? selectedUser.xp : selectedUser.xp_this_week).toLocaleString()}</p>
                  <p className="text-[10px] text-muted mt-0.5">XP {range === 'this_week' && 'Week'}</p>
                </div>

                <div className="rounded-xl bg-white/[0.07] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BookOpen size={18} className="text-success" />
                  </div>
                  <p className="text-base font-bold text-primary leading-none">
                    {selectedUserExtra ? selectedUserExtra.sessionsCount : '-'}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">Sessions</p>
                </div>

                <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-secondary" />
                    <span className="text-[11px] text-secondary">Total study time</span>
                  </div>
                  <span className="text-[11px] font-bold text-primary">
                    {selectedUserExtra ? (selectedUserExtra.totalMinutes / 60).toFixed(1) : '-'} hrs
                  </span>
                </div>

                {selectedUserExtra?.joinDate && (
                  <div className="col-span-3 rounded-xl bg-white/[0.07] p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={18} className="text-secondary" />
                      <span className="text-[11px] text-secondary">Active since</span>
                    </div>
                    <span className="text-[11px] font-semibold text-primary">{selectedUserExtra.joinDate}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              className="rounded-xl bg-surface hover:bg-white/[0.05] border border-token px-6 py-2.5 text-sm font-semibold text-primary transition-colors flex items-center gap-2"
            >
              <X size={18} />
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
