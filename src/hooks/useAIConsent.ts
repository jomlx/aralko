import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface AIConsentState {
  aiConsent: boolean;
  aiConsentDate: string | null;
  consentLoading: boolean;
  setConsentOn: () => Promise<void>;
  setConsentOff: () => Promise<void>;
}

export function useAIConsent(): AIConsentState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [aiConsent, setAiConsent] = useState(false);
  const [aiConsentDate, setAiConsentDate] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);

  // Load from DB — only when userId changes, never after a toggle
  useEffect(() => {
    if (!userId) {
      setAiConsent(false);
      setAiConsentDate(null);
      return;
    }
    supabase
      .from('user_settings')
      .select('ai_consent_acknowledged_at')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        if (error && error.code === 'PGRST116') {
          // No row yet — new user; useUserSettings will create it with consent ON via DB default
          setAiConsent(true);
          setAiConsentDate(new Date().toISOString());
        } else if (error) {
          console.error('[consent fetch error]', error);
          setAiConsent(false);
          setAiConsentDate(null);
        } else if (data?.ai_consent_acknowledged_at) {
          setAiConsent(true);
          setAiConsentDate(data.ai_consent_acknowledged_at);
        } else {
          setAiConsent(false);
          setAiConsentDate(null);
        }
      });
  }, [userId]);

  const setConsentOn = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    // Optimistic
    setAiConsent(true);
    setAiConsentDate(now);
    setConsentLoading(true);
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, ai_consent_acknowledged_at: now },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('[consent save error]', error);
      setAiConsent(false);
      setAiConsentDate(null);
    }
    setConsentLoading(false);
  }, [user]);

  const setConsentOff = useCallback(async () => {
    if (!user) return;
    // Optimistic
    setAiConsent(false);
    setAiConsentDate(null);
    setConsentLoading(true);
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, ai_consent_acknowledged_at: null },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('[consent revoke error]', error);
      // Roll back
      // We don't know the old date here, so re-fetch
      supabase
        .from('user_settings')
        .select('ai_consent_acknowledged_at')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.ai_consent_acknowledged_at) {
            setAiConsent(true);
            setAiConsentDate(data.ai_consent_acknowledged_at);
          }
        });
    }
    setConsentLoading(false);
  }, [user]);

  return { aiConsent, aiConsentDate, consentLoading, setConsentOn, setConsentOff };
}
