import { Music2, Play, Pause, SkipBack, SkipForward, Monitor } from 'lucide-react';
import { useSpotifyPlayer } from '../../hooks/useSpotifyPlayer';

interface SpotifyPremiumPlayerProps {
  accessToken: string;
}

export function SpotifyPremiumPlayer({ accessToken }: SpotifyPremiumPlayerProps) {
  const {
    isReady,
    isActive,
    isPlayingOnWeb,
    currentTrack,
    isPaused,
    togglePlay,
    nextTrack,
    previousTrack,
    transferToWeb
  } = useSpotifyPlayer(accessToken);

  if (!isReady) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1db954] mb-3" />
        <p className="text-xs text-secondary text-center">Connecting to Spotify...</p>
      </div>
    );
  }

  if (!isActive || !currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4">
        <div className="bg-[#1db954]/10 rounded-full p-2.5 mb-2.5 text-[#1db954]">
          <Music2 size={18} />
        </div>
        <p className="text-sm font-medium text-primary mb-1">Ready to play</p>
        <p className="text-2xs text-secondary mb-4 text-center leading-tight">
          Play from Spotify or connect below
        </p>
        <button
          onClick={transferToWeb}
          className="btn btn-spotify text-2xs px-3.5 py-1.5 h-auto rounded-full border-0"
        >
          <Monitor size={12} />
          This device
        </button>
      </div>
    );
  }

  const artists = currentTrack.artists?.map((a: any) => a.name).join(', ') || '';
  const albumUrl = currentTrack.album?.images?.[0]?.url;

  return (
    <div className="h-full flex flex-col">
      {/* Album art */}
      <div className="flex-1 min-h-0 rounded-xl relative flex items-center justify-center overflow-hidden mb-2 group">
        {albumUrl ? (
          <img src={albumUrl} alt="Album Art" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
        ) : (
          <div className="w-full h-full bg-slate-800 rounded-xl flex items-center justify-center">
            <Music2 size={32} className="text-muted" />
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {!isPlayingOnWeb && (
            <button
              onClick={transferToWeb}
              className="p-1.5 bg-[#1db954]/90 hover:bg-[#1db954] rounded-full text-black"
              title="Play on this device"
            >
              <Monitor size={12} />
            </button>
          )}
        </div>

        {/* Small indicator showing where music is playing */}
        {!isPlayingOnWeb && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-pulse" />
            <span className="text-2xs text-primary/70">Playing on another device</span>
          </div>
        )}
      </div>

      {/* Title + Controls */}
      <div className="flex items-center justify-between w-full shrink-0">
        <div className="flex flex-col min-w-0 pr-2">
          <div className="text-primary font-bold text-[13px] leading-tight truncate">{currentTrack.name}</div>
          <div className="text-[#1db954] text-2xs mt-0.5 truncate">{artists}</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={previousTrack} className="w-7 h-7 rounded-full bg-raised hover:bg-[#343844] flex items-center justify-center text-primary transition-colors">
            <SkipBack size={13} fill="currentColor" />
          </button>

          <div className="relative w-[42px] h-[42px] shrink-0">
            <button
              onClick={togglePlay}
              className="absolute inset-[3px] rounded-full bg-[#1db954] hover:bg-[#1ed760] shadow-[0_0_15px_rgba(29,185,84,0.4)] flex items-center justify-center text-black transition-colors"
            >
              {isPaused ? <Play size={14} fill="currentColor" className="ml-0.5" /> : <Pause size={14} fill="currentColor" />}
            </button>
          </div>

          <button onClick={nextTrack} className="w-7 h-7 rounded-full bg-raised hover:bg-[#343844] flex items-center justify-center text-primary transition-colors">
            <SkipForward size={13} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
