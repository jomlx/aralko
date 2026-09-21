import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface StudyGroup {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
}

export interface SharedActivity {
  id: string;
  group_id: string;
  activity_id: number;
  shared_by: string;
  shared_at: string;
  // joined from activities table if needed
  activity_name?: string;
  activity_subject?: string;
}

export interface MemberProgress {
  user_id: string;
  activity_id: number;
  quiz_score: number | null;
  cards_reviewed: number;
  completed: boolean;
  updated_at: string;
}

export function useStudyGroups() {
  const { user } = useAuth();
  const userId = user?.id;

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch all groups this user is a member of
    const { data, error } = await supabase
      .from('study_group_members')
      .select(`
        group_id,
        study_groups (
          id, name, invite_code, created_by, created_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch groups:', error);
    } else if (data) {
      console.log('[fetchGroups] Supabase returned data:', data);
      // Map out the nested study_groups
      const parsedGroups = data
        .map(row => {
          const sg = Array.isArray(row.study_groups) ? row.study_groups[0] : row.study_groups;
          return sg as unknown as StudyGroup;
        })
        .filter(g => g && g.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('[fetchGroups] Parsed groups:', parsedGroups);
      setGroups(parsedGroups);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (name: string, displayName: string | null, avatarUrl: string | null) => {
    if (!userId) throw new Error('Not authenticated');
    
    const { data, error } = await supabase.rpc('create_study_group', {
      p_name: name,
      p_display_name: displayName,
      p_avatar_url: avatarUrl
    });

    if (error) throw error;
    await fetchGroups(); // Refresh list
    return data; // { group_id, invite_code }
  };

  const joinGroup = async (inviteCode: string, displayName: string | null, avatarUrl: string | null) => {
    if (!userId) throw new Error('Not authenticated');
    
    const { data, error } = await supabase.rpc('join_study_group', {
      p_invite_code: inviteCode,
      p_display_name: displayName,
      p_avatar_url: avatarUrl
    });

    if (error) throw error;
    await fetchGroups(); // Refresh list
    return data; // { group_id, group_name }
  };

  const leaveGroup = async (groupId: string) => {
    if (!userId) throw new Error('Not authenticated');
    
    const { error } = await supabase.rpc('leave_study_group', {
      p_group_id: groupId
    });

    if (error) throw error;
    await fetchGroups(); // Refresh list
  };

  const shareActivity = async (groupId: string, activityId: number) => {
    if (!userId) throw new Error('Not authenticated');
    
    // Check if already shared
    const { data: existing } = await supabase
      .from('group_shared_activities')
      .select('id')
      .eq('group_id', groupId)
      .eq('activity_id', activityId)
      .maybeSingle();
      
    if (existing) {
      throw new Error('This activity is already shared with this group.');
    }

    const { error } = await supabase
      .from('group_shared_activities')
      .insert({
        group_id: groupId,
        activity_id: activityId,
        shared_by: userId
      });

    if (error) throw error;
  };

  const unshareActivity = async (sharedRowId: string) => {
    if (!userId) throw new Error('Not authenticated');
    const { error, count } = await supabase
      .from('group_shared_activities')
      .delete({ count: 'exact' })
      .eq('id', sharedRowId)
      .eq('shared_by', userId); // only allow removing activities you shared yourself
      
    if (error) throw error;
    if (count === 0) {
       throw new Error('Failed to unshare activity. You may not have permission or it was already removed.');
    }
  };

  return {
    groups,
    loading,
    fetchGroups,
    createGroup,
    joinGroup,
    leaveGroup,
    shareActivity,
    unshareActivity,
  };
}
