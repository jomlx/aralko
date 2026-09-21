import { useState, useEffect, useCallback } from 'react';
import { 
  SPOTIFY_ACCESS_TOKEN_KEY, 
  SPOTIFY_EXPIRES_AT_KEY,
  refreshSpotifyToken,
  initiateSpotifyLogin
} from '../lib/spotifyAuth';
import { useToast } from '../components/ui/Toast';

export function useSpotify() {
  const { showToast } = useToast();
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
  const [accessToken, setAccessToken] = useState<string | null>(() => window.localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!accessToken);

  // Check token expiration periodically
  useEffect(() => {
    if (!accessToken || !clientId) return;

    const checkToken = async () => {
      const expiresAt = parseInt(window.localStorage.getItem(SPOTIFY_EXPIRES_AT_KEY) || '0', 10);
      // If expiring in less than 5 mins, refresh
      if (Date.now() > expiresAt - 5 * 60 * 1000) {
        const newToken = await refreshSpotifyToken(clientId);
        if (newToken) {
          setAccessToken(newToken);
          setIsAuthenticated(true);
        } else {
          setAccessToken(null);
          setIsAuthenticated(false);
        }
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 60000); // check every minute
    return () => clearInterval(interval);
  }, [accessToken, clientId]);

  // Sync state across components when token changes (login/logout)
  useEffect(() => {
    const syncToken = () => {
      const token = window.localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY);
      setAccessToken(token);
      setIsAuthenticated(!!token);
    };
    window.addEventListener('spotify-auth-update', syncToken);
    window.addEventListener('storage', (e) => {
      if (e.key === SPOTIFY_ACCESS_TOKEN_KEY) syncToken();
    });
    return () => {
      window.removeEventListener('spotify-auth-update', syncToken);
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  const login = useCallback(async () => {
    if (!clientId) {
      showToast("Spotify Client ID is missing. The developer must add VITE_SPOTIFY_CLIENT_ID to the .env file.", "error");
      return;
    }
    try {
      await initiateSpotifyLogin(clientId);
    } catch (err) {
      console.error('Spotify login error:', err);
      showToast("Failed to connect to Spotify. Check the console for details.", "error");
    }
  }, [clientId, showToast]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
    window.localStorage.removeItem('aralko-spotify-refresh-token');
    setAccessToken(null);
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('spotify-auth-update'));
  }, []);

  return {
    clientId,
    accessToken,
    isAuthenticated,
    login,
    logout
  };
}

