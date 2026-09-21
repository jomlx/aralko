import { useState } from 'react';
import { Brain, Target, BookOpen, Clock3, LayoutDashboard, Check, ChevronRight, PenTool } from 'lucide-react';
// @ts-ignore
import { techniques } from '../../data/techniques';

interface TechniquesGridProps {
  onApplyTechnique?: (techniqueName: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  Brain,
  Target,
  BookOpen,
  Clock3,
  LayoutDashboard,
  Check,
  PenTool,
};

export function TechniquesGrid({ onApplyTechnique }: TechniquesGridProps) {
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);

  // Fallback data if techniques import fails or is empty
  const techniquesList = techniques?.length ? techniques : [
    {
      id: 'pomodoro',
      iconName: 'Clock3',
      name: 'Pomodoro Technique',
      shortDescription: 'Work in focused intervals.',
      description: 'The Pomodoro Technique is a time management method that uses a timer to break down work into intervals, traditionally 25 minutes in length, separated by short breaks.',
      steps: ['Pick a task', 'Set a 25-minute timer', 'Work on your task until the time is up', 'Take a 5 minute break', 'Every 4 pomodoros, take a longer 15-30 minute break']
    }
  ];

  const toggleExpand = (id: string) => {
    setExpandedTechnique(expandedTechnique === id ? null : id);
  };

  return (
    <div className="px-8 pt-4 pb-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-primary">Learning Techniques</h2>
        <p className="mt-1 text-sm text-muted">Practical methods to improve your study efficiency.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {techniquesList.map((technique: any) => {
          const isExpanded = expandedTechnique === (technique.id || technique.name);
          const IconComponent = iconMap[technique.iconName] || Brain;
          
          return (
            <div
              key={technique.id || technique.name}
              className="flex flex-col rounded-2xl border border-token bg-surface p-5 transition-colors hover:border-accent/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                    <IconComponent size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">{technique.name}</h3>
                    <p className="text-sm text-muted">{technique.shortDescription}</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleExpand(technique.id || technique.name)}
                  className="rounded-lg p-1 text-secondary transition-colors hover:bg-white/[0.05] hover:text-primary"
                >
                  <ChevronRight 
                    size={20} 
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                  />
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4 rounded-xl bg-app p-4 text-sm">
                  <p className="mb-4 whitespace-pre-wrap leading-6 text-secondary">
                    {technique.description}
                  </p>
                  
                  {technique.steps && technique.steps.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <h4 className="font-medium text-secondary">How to apply:</h4>
                      <ol className="list-decimal space-y-1 pl-4 text-secondary marker:text-accent/70">
                        {technique.steps.map((step: string, idx: number) => (
                          <li key={idx} className="pl-1 leading-relaxed">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <button 
                    onClick={() => onApplyTechnique?.(technique.name)}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent transition-colors hover:text-accent"
                  >
                    Apply technique <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
