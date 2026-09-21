import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Trophy, Target, CalendarDays, Loader2 } from 'lucide-react';
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
  const [range, setRange] = useState<TimeRange>('all_time');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchLeaderboard = async () => {
      const orderBy = range === 'all_time' ? 'xp' : 'xp_this_week';
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, display_name, avatar_url, xp, xp_this_week, level')
        .order(orderBy, { ascending: false })
        .limit(50);

      if (isMounted) {
        if (error) {
          console.error('Leaderboard fetch error:', error);
        } else if (data) {
          // Filter out users with 0 XP for the selected range to keep it clean
          const filtered = data.filter(u => range === 'all_time' ? u.xp > 0 : u.xp_this_week > 0);
          setUsers(filtered);
        }
        setLoading(false);
      }
    };

    fetchLeaderboard();
    return () => { isMounted = false; };
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
            <Target size={14} />
            All Time
          </button>
          <button
            onClick={() => setRange('this_week')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              range === 'this_week' ? 'bg-accent text-primary shadow-sm' : 'text-secondary hover:text-slate-200'
            }`}
          >
            <CalendarDays size={14} />
            This Week
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="bg-surface rounded-2xl border border-token overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-accent mb-4" />
            <p className="text-sm text-secondary">Loading rankings...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Trophy size={48} className="text-slate-700 mb-4" />
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
                    className={`grid grid-cols-[60px_1fr_100px_120px] gap-4 px-6 py-4 items-center transition-colors ${
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
                        {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.display_name || ''} />}
                        <AvatarFallback className="bg-slate-800 text-secondary font-medium">
                          {getInitials(u.display_name, u.user_id)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className={`font-semibold ${isMe ? 'text-accent' : 'text-slate-200'}`}>
                          {u.display_name || 'Anonymous Learner'} {isMe && '(You)'}
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

    </div>
  );
}
