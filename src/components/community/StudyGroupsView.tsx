import { useState, useEffect } from 'react';
import { useStudyGroups } from '../../hooks/useStudyGroups';
import type { StudyGroup } from '../../hooks/useStudyGroups';
import { Users, Plus, LogIn, Loader2, Copy, LogOut, BookOpen, PenTool, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';

interface StudyGroupsViewProps {
  onOpenActivity?: (id: number) => void;
}

export function StudyGroupsView({ onOpenActivity }: StudyGroupsViewProps) {
  const { user } = useAuth();
  const { groups, loading, createGroup, joinGroup, leaveGroup, unshareActivity } = useStudyGroups();
  
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load user meta to pass to RPC functions for nice displaying
  const displayName = user?.user_metadata?.name || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await createGroup(newGroupName.trim(), displayName, avatarUrl);
      setIsCreating(false);
      setNewGroupName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await joinGroup(inviteCode.trim(), displayName, avatarUrl);
      setIsJoining(false);
      setInviteCode('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join group');
    } finally {
      setActionLoading(false);
    }
  };
  const { showToast } = useToast();

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Invite code copied: ' + code);
    showToast('Invite code copied!', 'success');
  };

  if (activeGroupId) {
    const activeGroup = groups.find(g => g.id === activeGroupId);
    if (!activeGroup) {
      setActiveGroupId(null);
      return null;
    }
    return (
      <GroupDetailView 
        group={activeGroup} 
        onBack={() => setActiveGroupId(null)} 
        onLeave={() => {
          leaveGroup(activeGroup.id);
          setActiveGroupId(null);
          showToast('Left study group.', 'info');
        }}
        onOpenActivity={onOpenActivity}
        onUnshareActivity={unshareActivity}
        currentUserId={user?.id}
      />
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex items-end justify-between bg-surface p-6 rounded-2xl border border-token">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-success/20 text-success flex items-center justify-center">
              <Users size={18} />
            </div>
            <h2 className="text-2xl font-bold text-primary">Study Groups</h2>
          </div>
          <p className="text-sm text-secondary">Collaborate with friends, share activities, and track progress together.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setIsJoining(true); setIsCreating(false); setErrorMsg(''); }}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-token text-secondary hover:bg-white/[0.05] flex items-center gap-2"
          >
            <LogIn size={14} />
            Join Group
          </button>
          <button
            onClick={() => { setIsCreating(true); setIsJoining(false); setErrorMsg(''); }}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-success hover:bg-success text-primary shadow-sm flex items-center gap-2"
          >
            <Plus size={14} />
            Create Group
          </button>
        </div>
      </div>

      {/* Forms */}
      {(isCreating || isJoining) && (
        <div className="bg-surface rounded-2xl border border-token p-6 animate-in slide-in-from-top-4 fade-in">
          <h3 className="text-lg font-semibold mb-4">
            {isCreating ? 'Create a New Study Group' : 'Join a Study Group'}
          </h3>
          
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              placeholder={isCreating ? "e.g. History Finals Prep" : "Enter 6-character Invite Code"} 
              value={isCreating ? newGroupName : inviteCode}
              onChange={e => isCreating ? setNewGroupName(e.target.value) : setInviteCode(e.target.value)}
              className="flex-1 bg-app border border-token rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-success"
              maxLength={isCreating ? 50 : 6}
            />
            <button 
              onClick={isCreating ? handleCreate : handleJoin}
              disabled={actionLoading || (isCreating ? !newGroupName : !inviteCode)}
              className="bg-success text-primary px-6 py-3 rounded-xl font-medium text-sm hover:bg-success disabled:opacity-50 min-w-[120px] flex justify-center"
            >
              {actionLoading ? <Loader2 size={18} className="animate-spin" /> : (isCreating ? 'Create' : 'Join')}
            </button>
            <button 
              onClick={() => { setIsCreating(false); setIsJoining(false); setErrorMsg(''); }}
              className="px-4 py-3 text-secondary hover:text-secondary text-sm font-medium"
            >
              Cancel
            </button>
          </div>
          {errorMsg && <p className="text-red-400 text-sm mt-3">{errorMsg}</p>}
        </div>
      )}

      {/* Group List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-success" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-surface rounded-2xl border border-token">
          <Users size={48} className="text-slate-700 mb-4" />
          <p className="text-secondary font-medium text-lg">You aren't in any groups yet</p>
          <p className="text-sm text-muted mt-2 max-w-sm">
            Create your own study group to invite friends, or join an existing one using an invite code.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <div 
              key={group.id} 
              onClick={() => setActiveGroupId(group.id)}
              className="bg-surface rounded-2xl border border-token p-5 cursor-pointer hover:border-success/50 transition-colors group relative"
            >
              <h3 className="font-semibold text-lg text-slate-200 mb-1">{group.name}</h3>
              <p className="text-xs text-muted mb-4">
                Created {new Date(group.created_at).toLocaleDateString()}
              </p>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-token">
                <div 
                  className="bg-app px-3 py-1.5 rounded-lg text-xs font-mono text-success border border-success/20 flex items-center gap-2 cursor-copy hover:bg-success-muted transition-colors"
                  onClick={(e) => { e.stopPropagation(); copyInvite(group.invite_code); }}
                  title="Copy Invite Code"
                >
                  <Copy size={12} />
                  {group.invite_code}
                </div>
                
                <span className="text-xs text-muted font-medium group-hover:text-success transition-colors">
                  View details &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Group Detail View Sub-component
// ────────────────────────────────────────────────────────

function GroupDetailView({ 
  group, 
  onBack, 
  onLeave, 
  onOpenActivity,
  onUnshareActivity,
  currentUserId
}: { 
  group: StudyGroup;
  onBack: () => void;
  onLeave: () => void;
  onOpenActivity?: (id: number) => void;
  onUnshareActivity: (sharedRowId: string) => Promise<void>;
  currentUserId: string | undefined;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [sharedActivities, setSharedActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;
    
    Promise.all([
      supabase
        .from('study_group_members')
        .select('user_id, display_name, avatar_url, joined_at')
        .eq('group_id', group.id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('group_shared_activities')
        .select(`
          id,
          activity_id,
          shared_by,
          shared_at,
          activities ( name, subject, technique )
        `)
        .eq('group_id', group.id)
        .order('shared_at', { ascending: false })
    ]).then(([membersRes, activitiesRes]) => {
      if (!mounted) return;
      if (membersRes.data) setMembers(membersRes.data);
      if (activitiesRes.data) setSharedActivities(activitiesRes.data);
      setLoading(false);
    });
    
    return () => { mounted = false; };
  }, [group.id]);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
      <button onClick={onBack} className="text-sm font-medium text-secondary hover:text-slate-200 self-start">
        &larr; Back to Groups
      </button>

      <div className="flex items-start justify-between bg-surface p-6 rounded-2xl border border-token">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-2">{group.name}</h2>
          <div className="flex items-center gap-4">
            <div className="bg-app px-3 py-1.5 rounded-lg text-xs font-mono text-success border border-success/20 flex items-center gap-2">
              Code: {group.invite_code}
            </div>
            <span className="text-xs text-muted">
              Share this code with friends to let them join.
            </span>
          </div>
        </div>
        <button 
          onClick={onLeave}
          className="px-3 py-2 text-xs font-medium rounded-lg transition-colors border border-red-500/20 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
        >
          <LogOut size={14} />
          Leave Group
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-slate-200">Shared Activities</h3>
          
          {loading ? (
             <div className="bg-surface rounded-2xl border border-token p-4 min-h-[160px] text-sm text-muted text-center py-8 flex flex-col items-center justify-center gap-2">
               <Loader2 size={16} className="animate-spin" />
               Loading activities...
             </div>
          ) : sharedActivities.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-token p-4 min-h-[160px] flex flex-col items-center justify-center py-8 text-center">
              <p className="text-secondary text-sm">No activities have been shared with this group yet.</p>
              <p className="text-xs text-muted mt-2">Go to a specific activity in your Workspace and click "Share to Group" to add one.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
                {sharedActivities.map(sa => {
                  // PostgREST might return the joined relation as an array or object
                  const act = Array.isArray(sa.activities) ? sa.activities[0] : sa.activities;
                  const member = members.find(m => m.user_id === sa.shared_by);
                  const sharerName = member?.display_name || 'A member';
                  
                  const isFlashcard = act?.technique?.toLowerCase().includes('flashcard');
                  
                  return (
                    <div
                      key={sa.id}
                      onClick={() => onOpenActivity && onOpenActivity(sa.activity_id)}
                      className="group relative flex items-center gap-4 rounded-2xl border px-5 py-4 cursor-pointer transition-all duration-150 border-token bg-surface hover:border-token hover:bg-white/[0.04]"
                    >
                      {/* Technique icon */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-secondary">
                        {isFlashcard ? <PenTool size={15} /> : <BookOpen size={15} />}
                      </div>

                      {/* Name + subject */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate text-slate-200">
                            {act?.name || 'Unknown Activity'}
                          </p>
                          <span className="text-2xs text-muted bg-white/[0.05] px-2 py-0.5 rounded-md">
                            {act?.technique || 'Study Notes'}
                          </span>
                        </div>
                        {act?.subject && (
                          <p className="text-xs text-muted mt-0.5 truncate">{act.subject}</p>
                        )}
                        <div className="mt-1 text-2xs text-muted flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-success/50"></span>
                          Shared by {sharerName}
                        </div>
                      </div>
                      
                      {currentUserId === sa.shared_by && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await onUnshareActivity(sa.id);
                              setSharedActivities(prev => prev.filter(x => x.id !== sa.id));
                              showToast('Shared activity removed.', 'success');
                            } catch (err: any) {
                              showToast(err.message || 'Failed to remove shared activity', 'error');
                            }
                          }}
                          className="shrink-0 p-2 ml-2 transition-colors text-muted hover:text-red-400 rounded-lg hover:bg-white/[0.05]"
                          title="Remove shared activity"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <ChevronRight size={16} className="shrink-0 ml-2 transition-colors text-muted group-hover:text-accent" />
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-slate-200">Members</h3>
          <div className="bg-surface rounded-2xl border border-token p-4 flex flex-col gap-2">
             {loading ? (
               <div className="text-sm text-muted text-center py-4 flex flex-col items-center gap-2">
                 <Loader2 size={16} className="animate-spin" />
                 Loading members...
               </div>
             ) : members.length === 0 ? (
               <div className="text-sm text-muted text-center py-4">No members found.</div>
             ) : (
               <div className="flex flex-col gap-3">
                 {members.map(m => (
                   <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.02] transition-colors">
                     <div className="h-8 w-8 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold overflow-hidden border border-success/20">
                       {m.avatar_url ? (
                         <img src={m.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                       ) : (
                         (m.display_name || m.user_id).slice(0, 2).toUpperCase()
                       )}
                     </div>
                     <div className="flex flex-col">
                       <span className="text-sm font-semibold text-slate-200 truncate max-w-[150px]">
                         {m.display_name || 'Anonymous User'}
                       </span>
                       <span className="text-2xs text-muted">
                         Joined {new Date(m.joined_at).toLocaleDateString()}
                       </span>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
