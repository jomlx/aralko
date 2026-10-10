import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useUserSettingsContext as useUserSettings } from '../../hooks/UserSettingsContext';
import { Trophy, Target, Loader2, CalendarDays } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatHours } from '../stats/StatsView';
import { ProfileCard } from '../profile/ProfileCard';

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
  const { displayName: dbDisplayName, avatarUrl: dbAvatarUrl, xp: myXp, xpThisWeek: myXpThisWeek, level: myLevel } = useUserSettings();
  const [range, setRange] = useState<TimeRange>('all_time');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [selectedUserExtra, setSelectedUserExtra] = useState<{ sessionsCount: number | string, totalMinutes: number | string, streak: number | string, longest_streak?: number | string, joinDate: string | null } | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, any>>({});

  const handleUserClick = async (u: LeaderboardUser) => {
    setSelectedUser(u);
    if (profileCache[u.user_id]) {
      setSelectedUserExtra(profileCache[u.user_id]);
      return;
    }
    setSelectedUserExtra(null);
    
    try {
      const { data: rpcData, error } = await supabase.rpc('get_public_profile', { p_user_id: u.user_id });
      
      if (error || !rpcData || (Array.isArray(rpcData) && rpcData.length === 0)) {
        const fallback = {
          sessionsCount: '-',
          totalMinutes: '-',
          streak: '-',
          longest_streak: '-',
          joinDate: '-'
        };
        setSelectedUserExtra(fallback);
        setProfileCache(prev => ({ ...prev, [u.user_id]: fallback }));
        return;
      }

      const profile = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      let joinDate = '-';
      if (profile.active_since) {
        joinDate = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(profile.active_since));
      }

      const fetchedStreak = profile.saved_streak || 0;
      const fetchedLongest = profile.longest_streak || 0;

      const extra = {
        sessionsCount: profile.sessions_count ?? '-',
        totalMinutes: profile.total_minutes ?? '-',
        streak: fetchedStreak,
        longest_streak: Math.max(fetchedStreak, fetchedLongest),
        joinDate
      };

      setSelectedUserExtra(extra);
      setProfileCache(prev => ({ ...prev, [u.user_id]: extra }));
    } catch (err) {
      console.error(err);
      setSelectedUserExtra({
        sessionsCount: '-',
        totalMinutes: '-',
        streak: '-',
        longest_streak: '-',
        joinDate: '-'
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchLeaderboard = async () => {
      const orderBy = range === 'all_time' ? 'xp' : 'xp_this_week';
      
      const { data, error } = await supabase
        .from('leaderboard_public')
        .select('user_id, display_name, avatar_url, xp, xp_this_week, level')
        .order(orderBy, { ascending: false })
        .limit(50);

      if (isMounted) {
        if (error) {
          console.error('Leaderboard fetch error:', error);
          setFetchError(error.message || 'Failed to load leaderboard');
        } else if (data) {
          setFetchError(null);
          // Filter out users with 0 XP for the selected range to keep it clean
          const filtered = data.filter(u => range === 'all_time' ? u.xp > 0 : u.xp_this_week > 0);
          setUsers(filtered);
        }
        setLoading(false);
      }
    };

    fetchLeaderboard();
    
    const interval = setInterval(fetchLeaderboard, 30000);
    window.addEventListener('focus', fetchLeaderboard);

    return () => { 
      isMounted = false; 
      clearInterval(interval);
      window.removeEventListener('focus', fetchLeaderboard);
    };
  }, [range]);

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
        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={18} className="animate-spin text-accent mb-4" />
            <p className="text-sm text-secondary">Loading rankings...</p>
          </div>
        ) : fetchError && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-red-500 font-medium">Error loading leaderboard</p>
            <p className="text-sm text-muted mt-1">{fetchError}</p>
          </div>
        ) : users.length === 0 && !(user && ((range === 'all_time' && myXp > 0) || (range === 'this_week' && myXpThisWeek > 0))) ? (
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
              {(() => {
                let list = [...users];
                if (user && myXp > 0) {
                  const meIdx = list.findIndex(u => u.user_id === user.id);
                  if (meIdx >= 0) {
                    list[meIdx] = { ...list[meIdx], xp: Math.max(list[meIdx].xp, myXp), xp_this_week: Math.max(list[meIdx].xp_this_week, myXpThisWeek), level: Math.max(list[meIdx].level, myLevel) };
                  } else if ((range === 'all_time' && myXp > 0) || (range === 'this_week' && myXpThisWeek > 0)) {
                    list.push({ user_id: user.id, display_name: dbDisplayName, avatar_url: dbAvatarUrl, xp: myXp, xp_this_week: myXpThisWeek, level: myLevel });
                  }
                  list.sort((a, b) => range === 'all_time' ? b.xp - a.xp : b.xp_this_week - a.xp_this_week);
                }
                return list;
              })().map((u, i) => {
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
            {/* ── Stats Card ─────────────────────────── */}
            <ProfileCard
              displayName={selectedUser.display_name || 'Anonymous Learner'}
              avatarUrl={selectedUser.avatar_url}
              initials={getInitials(selectedUser.display_name, selectedUser.user_id)}
              streak={selectedUserExtra ? selectedUserExtra.streak : <span className="inline-block h-6 w-6 bg-white/10 rounded animate-pulse" />}
              level={selectedUser.level}
              xp={(range === 'all_time' ? selectedUser.xp : selectedUser.xp_this_week).toLocaleString()}
              sessionsCount={selectedUserExtra ? selectedUserExtra.sessionsCount : <span className="inline-block h-4 w-8 bg-white/10 rounded animate-pulse" />}
              longestStreak={selectedUserExtra ? (typeof selectedUserExtra.longest_streak === 'number' ? `${selectedUserExtra.longest_streak} ${selectedUserExtra.longest_streak === 1 ? 'day' : 'days'}` : '—') : <span className="inline-block h-3 w-8 bg-white/10 rounded animate-pulse" />}
              totalTime={selectedUserExtra ? (typeof selectedUserExtra.totalMinutes === 'number' ? formatHours(selectedUserExtra.totalMinutes / 60) : '—') : <span className="inline-block h-3 w-8 bg-white/10 rounded animate-pulse" />}
              joinDate={selectedUserExtra ? (selectedUserExtra.joinDate !== '-' ? selectedUserExtra.joinDate : '—') : <span className="inline-block h-3 w-16 bg-white/10 rounded animate-pulse" />}
              showShareButton={selectedUser.user_id === user?.id}
              onShareClick={() => window.dispatchEvent(new CustomEvent('openShareModal'))}
            />
          </div>
        </div>
      )}

    </div>
  );
}
