import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const MAX_CONTEXT_MESSAGES = 14; 
const LOCAL_STORAGE_KEY = 'aralko-chat';

export function useChat(activityId: number | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const lastActivityIdRef = useRef<number | undefined>(undefined);

  const saveToLocal = useCallback((msgs: ChatMessage[]) => {
    if (!userId || !activityId) return;
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${userId}-${activityId}`, JSON.stringify(msgs));
  }, [userId, activityId]);

  const fetchMessages = useCallback(async () => {
    if (!userId || !activityId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    let dbData = null;
    let dbError = null;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
        
      dbData = data;
      dbError = error;
    } catch (e) {
      dbError = e;
    }

    if (dbError || !dbData) {
      console.warn('Failed to fetch chat from Supabase (table might not exist). Falling back to local storage.');
      const local = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${userId}-${activityId}`);
      if (local) {
        setMessages(JSON.parse(local));
      }
    } else if (dbData) {
      const mapped = dbData.map(row => ({
        id: String(row.id),
        role: row.role as 'user' | 'assistant',
        content: row.content,
        timestamp: new Date(row.created_at).getTime()
      }));
      setMessages(mapped);
      saveToLocal(mapped);
    }
    
    setLoading(false);
  }, [userId, activityId, saveToLocal]);

  useEffect(() => {
    if (lastActivityIdRef.current !== activityId) {
      setMessages([]);
      lastActivityIdRef.current = activityId;
    }
    fetchMessages();
  }, [fetchMessages, activityId]);

  const addMessage = useCallback(async (msg: ChatMessage) => {
    if (!userId || !activityId) return;

    setMessages(prev => {
      const next = [...prev, msg];
      saveToLocal(next);
      return next;
    });

    supabase.from('chat_messages').insert({
      user_id: userId,
      activity_id: activityId,
      role: msg.role,
      content: msg.content,
    }).then(({ error }) => {
      if (error) console.warn('Supabase save failed (fallback to local):', error.message);
    });
  }, [userId, activityId, saveToLocal]);

  const clearMessages = useCallback(async () => {
    if (!userId || !activityId) return;

    setMessages([]);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}-${userId}-${activityId}`);

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .eq('activity_id', activityId);

    if (error) console.warn('Supabase clear failed:', error.message);
  }, [userId, activityId]);

  /**
   * Returns only the last N messages to send as context to the AI.
   * The full history is always kept in `messages` for the UI.
   */
  const getContextMessages = useCallback((allMsgs: ChatMessage[]) => {
    return allMsgs.slice(-MAX_CONTEXT_MESSAGES);
  }, []);

  return {
    messages,
    loading,
    addMessage,
    clearMessages,
    getContextMessages,
  };
}

