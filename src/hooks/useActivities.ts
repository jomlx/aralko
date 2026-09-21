import { useState, useEffect, useCallback } from 'react';
import type { Activity } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'aralko-activities-local';

export function useActivities() {
  const { user } = useAuth();
  const userId = user?.id;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const saveToLocal = useCallback((data: Activity[]) => {
    if (!userId) return;
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${userId}`, JSON.stringify(data));
  }, [userId]);

  const fetchActivities = useCallback(async () => {
    if (!userId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let data = null;
    let error = null;
    try {
      const { data: memberGroups } = await supabase
        .from('study_group_members')
        .select('group_id')
        .eq('user_id', userId);
        
      const groupIds = (memberGroups || []).map(g => g.group_id);
      
      let sharedActivityIds: number[] = [];
      if (groupIds.length > 0) {
        const { data: shared } = await supabase
          .from('group_shared_activities')
          .select('activity_id')
          .in('group_id', groupIds);
        sharedActivityIds = (shared || []).map(s => s.activity_id);
      }
      
      const filterStr = sharedActivityIds.length > 0 
        ? `user_id.eq.${userId},id.in.(${sharedActivityIds.join(',')})`
        : `user_id.eq.${userId}`;

      const res = await supabase
        .from('activities')
        .select('*')
        .or(filterStr)
        .order('id', { ascending: true });
      data = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }
      
    if (error || !data) {
      console.warn('Supabase not configured or unreachable. Falling back to local storage.');
      const local = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${userId}`);
      if (local) {
        setActivities(JSON.parse(local));
      }
    } else if (data) {
      // Supabase JSONB columns can occasionally come back as raw JSON strings
      // (especially after a session token refresh). Parse them defensively.
      const safeParse = (val: any): any => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch { return undefined; }
        }
        return val; // already object/array — return as-is
      };

      const mapped: Activity[] = data.map(row => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        progress: row.progress,
        notes: row.notes,
        reviewerContent: row.reviewerContent,
        technique: row.technique,
        techniqueData: safeParse(row.techniqueData),
        quizData: safeParse(row.quizData),
        reviewedCards: safeParse(row.reviewedCards),
      }));
      setActivities(mapped);
      saveToLocal(mapped);
    }
    setLoading(false);

  }, [userId, saveToLocal]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Re-fetch when the Supabase session is restored after a token refresh / idle expiry.
  // Without this, coming back after 30+ mins shows stale/corrupted data.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        fetchActivities();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchActivities]);

  const addActivity = useCallback(async (activity: Activity) => {
    if (!userId) return undefined;

    const { data, error } = await supabase.from('activities').insert({
      user_id: userId,
      name: activity.name,
      subject: activity.subject,
      progress: activity.progress,
      notes: activity.notes,
      reviewerContent: activity.reviewerContent,
      technique: activity.technique,
      techniqueData: activity.techniqueData,
      quizData: activity.quizData
    }).select('id').single();

    if (error || !data) {
      console.warn('Failed to save activity to Supabase:', error?.message);
      return undefined;
    }

    const realActivity = { ...activity, id: data.id };

    setActivities(prev => {
      const next = [...prev, realActivity];
      saveToLocal(next);
      return next;
    });

    return data.id; 
  }, [saveToLocal, userId]);

  const updateActivity = useCallback((id: number, updates: Partial<Activity>) => {
    if (!userId) return;

    // 1. Optimistic UI update instantly
    setActivities(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      saveToLocal(next);
      return next;
    });

    // 2. Fire-and-forget Supabase update
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.reviewerContent !== undefined) dbUpdates.reviewerContent = updates.reviewerContent;
    if (updates.technique !== undefined) dbUpdates.technique = updates.technique;
    if (updates.techniqueData !== undefined) dbUpdates.techniqueData = updates.techniqueData;
    if (updates.quizData !== undefined) dbUpdates.quizData = updates.quizData;

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('activities').update(dbUpdates).eq('id', id).eq('user_id', userId).then(({ error }) => {
        if (error) console.warn('Failed to update activity in Supabase:', error.message);
      });
    }
  }, [saveToLocal, userId]);

  const removeActivity = useCallback((id: number) => {
    if (!userId) return;

    // 1. Optimistic UI update instantly
    setActivities(prev => {
      const next = prev.filter(a => a.id !== id);
      saveToLocal(next);
      return next;
    });

    // 2. Fire-and-forget Supabase delete
    supabase.from('activities').delete().eq('id', id).eq('user_id', userId).then(({ error }) => {
      if (error) console.warn('Failed to delete activity from Supabase:', error.message);
    });
  }, [saveToLocal, userId]);

  return {
    activities,
    loading,
    addActivity,
    updateActivity,
    removeActivity
  };
}
