import { useState } from 'react';
import { LeaderboardView } from './LeaderboardView';
import { StudyGroupsView } from './StudyGroupsView';
import { Users, Trophy } from 'lucide-react';

type CommunitySubTab = 'leaderboard' | 'groups';

interface CommunityTabProps {
  onOpenActivity?: (id: number) => void;
}

export function CommunityTab({ onOpenActivity }: CommunityTabProps) {
  const [subTab, setSubTab] = useState<CommunitySubTab>('leaderboard');

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-app">
      {/* Sub-navigation */}
      <div className="px-8 pt-6 pb-2 border-b border-token">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setSubTab('leaderboard')}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              subTab === 'leaderboard' 
                ? 'border-accent text-accent font-semibold' 
                : 'border-transparent text-secondary hover:text-secondary'
            }`}
          >
            <Trophy size={18} />
            Leaderboard
          </button>
          <button
            onClick={() => setSubTab('groups')}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              subTab === 'groups' 
                ? 'border-accent text-accent font-semibold' 
                : 'border-transparent text-secondary hover:text-secondary'
            }`}
          >
            <Users size={18} />
            Study Groups
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-8 py-6 max-w-5xl mx-auto">
          {subTab === 'leaderboard' && <LeaderboardView />}
          {subTab === 'groups' && <StudyGroupsView onOpenActivity={onOpenActivity} />}
        </div>
      </div>
    </div>
  );
}

