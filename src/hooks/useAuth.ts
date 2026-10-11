import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

function getLocalSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('-auth-token')) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          return parsed.currentSession || parsed || null;
        }
      }
    }
  } catch (e) {}
  return null;
}

/** Remove all per-user aralko caches from localStorage on sign-out. */
function clearUserCaches() {
  const prefixes = [
    'aralko:cache:',
    'aralko-sessions-local-',
    'aralko-activities-local-',
    'aralko-xp-events-',
    'aralko-freeze-covered-',
    'aralko:pomodoro-preset:',
  ];
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && prefixes.some(p => key.startsWith(p))) {
      toRemove.push(key);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const cachedSession = getLocalSession();
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [loading, setLoading] = useState(!cachedSession);

  useEffect(() => {
    const hadCachedSession = !!getLocalSession();

    // Verify the cached session against the server
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && hadCachedSession) {
        // Cached token was invalid / expired — clear caches
        clearUserCaches();
      }
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to all future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        clearUserCaches();
      }
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}
