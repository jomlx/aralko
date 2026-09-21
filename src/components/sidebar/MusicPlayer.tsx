import { useState } from 'react';
import { Music2, Play, Pause, Volume2, ChevronDown, ChevronUp } from 'lucide-react';

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showPlayer, setShowPlayer] = useState(false);

  const togglePlay = () => setIsPlaying(!isPlaying);

  return (
    <div className="rounded-2xl border border-token bg-surface p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent-muted text-accent">
          <Music2 size={20} />
        </div>
        <div>
          <h2 className="text-primary font-medium">Focus Music</h2>
          <p className="text-secondary text-sm">Lo-fi study session</p>
        </div>
      </div>

      <div className="bg-app rounded-xl p-3 border border-token mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Music2 size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-primary text-sm font-medium">Lo-fi Study Beats</div>
            <div className="text-secondary text-xs">Aralko Focus Playlist</div>
          </div>
        </div>
        <button 
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-accent hover:bg-accent flex items-center justify-center text-primary transition-colors"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Volume2 size={16} className="text-secondary" />
        <div className="relative flex-1 h-1.5 flex items-center">
          <div className="absolute w-full h-1 rounded-full bg-white/[0.08]" />
          <div 
            className="absolute h-1 rounded-full bg-accent pointer-events-none" 
            style={{ width: `${volume}%` }} 
          />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer"
            aria-label="Volume"
          />
        </div>
        <div className="text-xs text-secondary w-6 text-right">{volume}</div>
      </div>

      <button
        onClick={() => setShowPlayer(!showPlayer)}
        className="text-xs text-secondary hover:text-primary flex items-center justify-center gap-1 w-full transition-colors"
      >
        {showPlayer ? 'Hide player' : 'Show player'}
        {showPlayer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showPlayer && (
        <div className="mt-3 rounded-xl overflow-hidden border border-token h-[160px] bg-black">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=${isPlaying ? 1 : 0}&loop=1&playlist=jfKfPfyJRdk`}
            title="Lo-fi Study Beats"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
    </div>
  );
}
