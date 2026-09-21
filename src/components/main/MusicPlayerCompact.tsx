import { useState, useEffect, useRef, useCallback } from 'react';
import { Music2, Play, Pause, SkipBack, SkipForward, Search, ListMusic, Radio } from 'lucide-react';
import { useSpotify } from '../../hooks/useSpotify';
import { SpotifyPremiumPlayer } from './SpotifyPremiumPlayer';

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: object) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

const DEFAULT_YT_PLAYLIST = [
  { id: 'zN5Yk6ZNmBo', title: '3 HOUR STUDY WITH ME | Pomodoro 50/10 | Lo-fi Rain Forest Spring & Birdsong', artist: 'chill chill journal' },
  { id: 'x7mlvtkSCvo', title: 'Pomodoro Timer 3x50 (3hr) | ADHD | Let\'s get focused! | Lofi + rain ambience', artist: 'chill chill journal' },
  { id: 'SAZcwnO7nBw', title: 'Small steps every day! Pomodoro timer 25/5 | 3-Hours Study with Me!', artist: 'chill chill journal' }
];

type MusicTab = 'player' | 'playlists' | 'search';

// ─── Playlist Browser ───
function SpotifyPlaylists({ accessToken, onPlayUri }: { accessToken: string; onPlayUri: (uri: string) => void }) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlaylists(data.items || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchPlaylists();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1db954]" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
      {playlists.map((pl) => (
        <button
          key={pl.id}
          onClick={() => onPlayUri(pl.uri)}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-left group"
        >
          {pl.images?.[0]?.url ? (
            <img src={pl.images[0].url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-app flex items-center justify-center shrink-0">
              <ListMusic size={16} className="text-muted" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-primary truncate">{pl.name}</div>
            <div className="text-2xs text-muted truncate">{pl.tracks?.total || 0} tracks</div>
          </div>
          <Play size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      ))}
      {playlists.length === 0 && (
        <div className="text-center text-muted text-xs py-6">No playlists found</div>
      )}
    </div>
  );
}

// ─── Song Search ───
function SpotifySearch({ accessToken, onPlayUri }: { accessToken: string; onPlayUri: (uri: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.tracks?.items || []);
      } else {
        console.error('Spotify search failed:', await res.text());
        setResults([]);
      }
    } catch (err) {
      console.error('Spotify search error:', err);
      setResults([]);
    }
    setLoading(false);
  }, [accessToken]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="relative mb-2 shrink-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search songs..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-app border border-token rounded-xl pl-8 pr-3 py-2 text-2xs text-primary placeholder:text-muted focus:outline-none focus:border-[#1db954]"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1db954]" />
          </div>
        )}
        {!loading && results.map((track) => (
          <button
            key={track.id}
            onClick={() => onPlayUri(track.uri)}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-left group"
          >
            {track.album?.images?.[2]?.url ? (
              <img src={track.album.images[2].url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-app flex items-center justify-center shrink-0">
                <Music2 size={16} className="text-muted" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-primary truncate">{track.name}</div>
              <div className="text-2xs text-muted truncate">{track.artists?.map((a: any) => a.name).join(', ')}</div>
            </div>
            <Play size={14} className="text-[#1db954] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
        {!loading && !query && (
          <div className="text-center text-muted text-xs py-6">Type to search for songs</div>
        )}
        {!loading && query && results.length === 0 && (
          <div className="text-center text-muted text-xs py-6">No results found</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───
export function MusicPlayerCompact() {
  const { accessToken, isAuthenticated } = useSpotify();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<MusicTab>('player');
  const [playlistIndex, setPlaylistIndex] = useState(0);

  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTrack = DEFAULT_YT_PLAYLIST[playlistIndex];

  // Play a track/playlist via Spotify Web API
  const playSpotifyUri = useCallback(async (uri: string) => {
    if (!accessToken) return;
    try {
      const body = uri.startsWith('spotify:track:')
        ? { uris: [uri] }
        : { context_uri: uri };
      await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      setActiveTab('player');
    } catch (err) {
      console.error('Failed to play:', err);
    }
  }, [accessToken]);

  // Poll progress while playing
  const startProgressPolling = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const duration = p.getDuration();
      const current = p.getCurrentTime();
      if (duration > 0) setProgress(current / duration);
    }, 500);
  }, []);

  const stopProgressPolling = useCallback(() => {
    if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
  }, []);

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT?.Player) { setApiReady(true); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
    return () => stopProgressPolling();
  }, [stopProgressPolling]);

  const initPlayer = useCallback(() => {
    // Only initialize YouTube player if Spotify is NOT connected
    if (!apiReady || !containerRef.current || (isAuthenticated && accessToken)) return;
    if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    stopProgressPolling();
    setProgress(0);
    setIsPlaying(false);

    const el = document.createElement('div');
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(el);

    playerRef.current = new window.YT.Player(el, {
      videoId: currentTrack.id,
      playerVars: { autoplay: 0, controls: 0, loop: 0, origin: window.location.origin },
      events: {
        onStateChange: (e: { data: number }) => {
          const playing = e.data === window.YT.PlayerState.PLAYING;
          setIsPlaying(playing);
          if (playing) startProgressPolling();
          else stopProgressPolling();

          // Auto play next when ended
          if (e.data === window.YT.PlayerState.ENDED) {
            setPlaylistIndex(prev => (prev + 1) % DEFAULT_YT_PLAYLIST.length);
          }
        },
      },
    });
  }, [apiReady, currentTrack.id, isAuthenticated, accessToken, startProgressPolling, stopProgressPolling]);

  useEffect(() => { initPlayer(); }, [initPlayer]);

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const handleNext = () => {
    setPlaylistIndex(prev => (prev + 1) % DEFAULT_YT_PLAYLIST.length);
  };
  const handlePrev = () => {
    setPlaylistIndex(prev => (prev - 1 + DEFAULT_YT_PLAYLIST.length) % DEFAULT_YT_PLAYLIST.length);
  };

  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - progress * circ;

  // ─── Spotify Connected Mode ───
  if (isAuthenticated && accessToken) {
    return (
      <div className="w-full h-full rounded-2xl border border-token bg-surface p-3 flex flex-col relative shadow-lg shadow-black/20">
        {/* Tab bar */}
        <div className="flex gap-1 mb-2 shrink-0 bg-app rounded-xl p-1">
          {([
            { key: 'player' as MusicTab, icon: Radio, label: 'Playing' },
            { key: 'playlists' as MusicTab, icon: ListMusic, label: 'Playlists' },
            { key: 'search' as MusicTab, icon: Search, label: 'Search' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex flex-row items-center justify-center gap-1.5 px-1 py-1.5 rounded-lg transition-colors ${
                activeTab === key
                  ? 'bg-[#1db954]/10 text-[#1db954]'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              <Icon size={12} className="shrink-0" />
              <span className="text-2xs font-medium leading-none truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={activeTab === 'player' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
          <SpotifyPremiumPlayer accessToken={accessToken} />
        </div>
        <div className={activeTab === 'playlists' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
          <SpotifyPlaylists accessToken={accessToken} onPlayUri={playSpotifyUri} />
        </div>
        <div className={activeTab === 'search' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
          <SpotifySearch accessToken={accessToken} onPlayUri={playSpotifyUri} />
        </div>
      </div>
    );
  }

  // ─── YouTube / Default Mode ───
  return (
    <div className="w-full h-full rounded-2xl border border-token bg-surface p-3 flex flex-col relative overflow-hidden shadow-lg shadow-black/20">
      <div className="h-full flex flex-col">
        {/* Album art */}
        <div className="flex-1 min-h-0 rounded-xl bg-app relative flex items-center justify-center overflow-hidden mb-2 group">
          <img 
            src={`https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`}
            alt={currentTrack.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />
          <div ref={containerRef} className="absolute opacity-0 pointer-events-none w-1 h-1 overflow-hidden" />
        </div>

        {/* Title + Controls */}
        <div className="flex items-center justify-between w-full shrink-0">
          <div className="flex flex-col min-w-0 pr-2">
            <div className="text-primary font-bold text-[13px] leading-tight truncate">{currentTrack.title}</div>
            <div className="text-secondary text-2xs mt-0.5 truncate">{currentTrack.artist}</div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handlePrev} className="w-7 h-7 rounded-full bg-raised hover:bg-[#343844] flex items-center justify-center text-primary transition-colors">
              <SkipBack size={13} fill="currentColor" />
            </button>

            <div className="relative w-[42px] h-[42px] shrink-0">
              <svg className="absolute top-0 left-0 w-full h-full -rotate-90">
                <circle cx="21" cy="21" r={r} className="stroke-[#2a2d36]" strokeWidth="3" fill="none" />
                <circle
                  cx="21" cy="21" r={r}
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: circ,
                    strokeDashoffset: isPlaying ? offset : circ,
                    transition: 'stroke-dashoffset 0.5s linear',
                  }}
                />
              </svg>
              <button
                onClick={handlePlayPause}
                style={{ zIndex: 1 }}
                className="absolute inset-[3px] rounded-full bg-app hover:bg-surface flex items-center justify-center text-primary transition-colors"
              >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
              </button>
            </div>

            <button onClick={handleNext} className="w-7 h-7 rounded-full bg-raised hover:bg-[#343844] flex items-center justify-center text-primary transition-colors">
              <SkipForward size={13} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
