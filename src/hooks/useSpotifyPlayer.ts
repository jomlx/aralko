import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

export function useSpotifyPlayer(accessToken: string | null) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [isPlayingOnWeb, setIsPlayingOnWeb] = useState(false);
  
  const playerRef = useRef<any>(null);

  // Helper for Spotify Web API calls
  const apiCall = useCallback(async (endpoint: string, method: string = 'PUT', body?: object) => {
    if (!accessToken) return;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);
    try {
      await fetch(`https://api.spotify.com/v1/me/player${endpoint}`, options);
    } catch (err) {
      console.error('Spotify API error:', err);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const initPlayer = () => {
      if (!window.Spotify) return;
      
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Aralko Web Player',
        getOAuthToken: (cb: (token: string) => void) => { cb(accessToken); },
        volume: 0.5
      });

      playerRef.current = spotifyPlayer;

      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
      });

      spotifyPlayer.addListener('not_ready', () => {
        setIsReady(false);
      });

      spotifyPlayer.addListener('player_state_changed', (state: any) => {
        if (!state) {
          setIsActive(false);
          setIsPlayingOnWeb(false);
          return;
        }

        setCurrentTrack(state.track_window.current_track);
        setIsPaused(state.paused);
        setIsActive(true);
        setIsPlayingOnWeb(true);
      });

      spotifyPlayer.connect();
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause().then(() => {
            playerRef.current.disconnect();
          }).catch(() => {
            playerRef.current.disconnect();
          });
        } catch (e) {
          playerRef.current.disconnect();
        }
      }
    };
  }, [accessToken]);

  // Transfer playback to this web player
  const transferToWeb = useCallback(async () => {
    if (!deviceId) return;
    await apiCall('', 'PUT', { device_ids: [deviceId], play: true });
  }, [deviceId, apiCall]);

  // Use Web API for controls — works regardless of which device is active
  const togglePlay = useCallback(async () => {
    if (isPlayingOnWeb && playerRef.current) {
      // If playing on web, use SDK (more responsive)
      playerRef.current.togglePlay();
    } else {
      // Otherwise use Web API to control whatever device is active
      if (isPaused) {
        await apiCall('/play', 'PUT');
      } else {
        await apiCall('/pause', 'PUT');
      }
    }
  }, [isPlayingOnWeb, isPaused, apiCall]);

  const nextTrack = useCallback(async () => {
    if (isPlayingOnWeb && playerRef.current) {
      playerRef.current.nextTrack();
    } else {
      await apiCall('/next', 'POST');
    }
  }, [isPlayingOnWeb, apiCall]);

  const previousTrack = useCallback(async () => {
    if (isPlayingOnWeb && playerRef.current) {
      playerRef.current.previousTrack();
    } else {
      await apiCall('/previous', 'POST');
    }
  }, [isPlayingOnWeb, apiCall]);

  const setVolume = useCallback((volume: number) => {
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  }, []);

  // Fetch current playback state from any device (for when not playing on web)
  useEffect(() => {
    if (!accessToken || isPlayingOnWeb) return;

    const fetchState = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (res.ok && res.status !== 204) {
          const data = await res.json();
          if (data?.item) {
            setCurrentTrack({
              name: data.item.name,
              artists: data.item.artists,
              album: data.item.album,
            });
            setIsPaused(!data.is_playing);
            setIsActive(true);
          }
        }
      } catch { /* ignore */ }
    };

    fetchState();
    const interval = setInterval(fetchState, 3000); // poll every 3s
    return () => clearInterval(interval);
  }, [accessToken, isPlayingOnWeb]);

  return {
    isReady,
    isActive,
    isPlayingOnWeb,
    currentTrack,
    isPaused,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    transferToWeb,
    deviceId
  };
}
