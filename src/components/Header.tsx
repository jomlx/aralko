import { Settings, LayoutDashboard, BarChart3, BookOpen, FileText, Users, type LucideIcon } from 'lucide-react';
import type { MainTab } from '../types';

interface HeaderProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onOpenSettings: () => void;
  disabled?: boolean;
}

interface NavButtonProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function NavButton({ label, icon: Icon, isActive, onClick, disabled }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition-colors ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${
        isActive
          ? 'bg-white/[0.09] text-primary shadow-sm'
          : 'text-muted hover:bg-white/[0.04] hover:text-secondary'
      }`}
    >
      <Icon size={18} />
      <span className="hidden text-sm font-medium sm:inline">{label}</span>
    </button>
  );
}

export function Header({ activeTab, onTabChange, onOpenSettings, disabled }: HeaderProps) {
  return (
    <header className="flex h-[60px] w-full items-center justify-between border-b border-token bg-app px-4">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 overflow-hidden rounded-2xl shadow-lg">
          <img src="/logo.png" alt="Aralko Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary">Aralko</h1>
          <p className="text-xs text-muted">Made by Joml for easier studying.</p>
        </div>
      </div>

      {/* Nav + Settings */}
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1 rounded-2xl border border-token bg-surface p-1">
          <NavButton label="Home" icon={LayoutDashboard} isActive={activeTab === 'main'} onClick={() => onTabChange('main')} disabled={disabled} />
          <NavButton label="Learn" icon={BookOpen} isActive={activeTab === 'learn'} onClick={() => onTabChange('learn')} disabled={disabled} />
          <NavButton label="Reviewer" icon={FileText} isActive={activeTab === 'reviewer'} onClick={() => onTabChange('reviewer')} disabled={disabled} />
          <NavButton label="Stats" icon={BarChart3} isActive={activeTab === 'stats'} onClick={() => onTabChange('stats')} disabled={disabled} />
          <NavButton label="Community" icon={Users} isActive={activeTab === 'community'} onClick={() => onTabChange('community')} disabled={disabled} />
        </nav>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Settings"
          disabled={disabled}
          className={`h-[42px] w-[42px] rounded-full border border-token bg-white/[0.05] flex items-center justify-center transition-all text-secondary ${
            disabled ? 'opacity-40 pointer-events-none' : 'hover:bg-white/[0.1] hover:scale-105 hover:text-primary'
          }`}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
