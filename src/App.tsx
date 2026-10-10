import { useState, useCallback, useEffect, useRef } from 'react';
import { MAX_FREEZES } from './lib/streakConstants';
import { X, LayoutDashboard, BookOpen, FileText, BarChart3, Users, Settings as SettingsIcon, Pause } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/sidebar/Sidebar';
import { StudyTracker } from './components/sidebar/StudyTracker';
import { MusicPlayerCompact } from './components/main/MusicPlayerCompact';
import { ActivityList } from './components/main/ActivityList';
import { LearnTab } from './components/main/LearnTab';
import { ReviewerTab } from './components/main/ReviewerTab';
import { CommunityTab } from './components/community/CommunityTab';
import { TechniquesGrid } from './components/techniques/TechniquesGrid';
import { StatsView } from './components/stats/StatsView';
import { AddActivityModal } from './components/main/AddActivityModal';
import { ProfilePopover } from './components/sidebar/ProfilePopover';
import { ToastProvider } from './components/ui/Toast';
import { SettingsDialog } from './components/SettingsDialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { useActivities } from './hooks/useActivities';
import { useSessions } from './hooks/useSessions';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePomodoro } from './hooks/usePomodoro';
import { useSpotify } from './hooks/useSpotify';
import { useUserSettingsContext as useUserSettings } from './hooks/UserSettingsContext';
import { useStreakLogic } from './hooks/useStreakLogic';
import { useAuth } from './hooks/useAuth';
import { useAIConsent } from './hooks/useAIConsent';
import { StudyGroupsProvider } from './hooks/StudyGroupsContext';
import { UserSettingsProvider } from './hooks/UserSettingsContext';
import { registerConsentChecker } from './lib/apiClient';
import { AuthPage } from './pages/AuthPage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog';
import { Dialog, DialogContent } from './components/ui/dialog';

import type { MainTab, Activity, StudySession } from './types';

// Simple Error Boundary wrapper
import React from 'react';
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-8 text-red-500 bg-app h-screen"><h1>Something went wrong.</h1><pre>{this.state.error?.toString()}</pre></div>;
    return this.props.children;
  }
}

import { handleSpotifyCallback } from './lib/spotifyAuth';



function AppContent() {
  const [activeTab, setActiveTab] = useState<MainTab>('main');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimerSheetOpen, setIsTimerSheetOpen] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('aralko-theme', 'light');

  const { isAuthenticated, login, logout } = useSpotify();

  // Handle Spotify OAuth Callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

    if (code && clientId) {
      handleSpotifyCallback(clientId, code)
        .then(() => {
          window.dispatchEvent(new Event('spotify-auth-update'));
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(console.error);
    }
  }, []);


  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);



  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const userSettings = useUserSettings();
  const { activities, loading, addActivity, updateActivity, removeActivity } = useActivities();
  const { sessions, sessionsLoaded, addSession } = useSessions(userSettings.addXP);
  const [selectedActivityId, setSelectedActivityId] = useLocalStorage<number>('aralko-selected-activity', 1);

  const activitiesRef = useRef(activities);
  const selectedActivityIdRef = useRef(selectedActivityId);
  useEffect(() => { activitiesRef.current = activities; }, [activities]);
  useEffect(() => { selectedActivityIdRef.current = selectedActivityId; }, [selectedActivityId]);

  // Ensure there's a valid selected ID if the current one was deleted or not found
  useEffect(() => {
    if (!loading && activities.length > 0 && !activities.find(a => a.id === selectedActivityId)) {
      setSelectedActivityId(activities[0].id);
    }
  }, [loading, activities, selectedActivityId, setSelectedActivityId]);

  const { user } = useAuth();
  const { aiConsent, aiConsentDate, consentLoading, setConsentOn, setConsentOff } = useAIConsent();
  const [consentGateOpen, setConsentGateOpen] = useState(false);
  // Single resolver for both hook-based and apiClient-based consent requests
  const consentResolverRef = useRef<((allowed: boolean) => void) | null>(null);

  // Register the consent checker once so apiClient.generateWithBackend can use it
  useEffect(() => {
    registerConsentChecker(() => {
      if (aiConsent) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        consentResolverRef.current = resolve;
        setConsentGateOpen(true);
      });
    });
  }, [aiConsent]);
  
  const streakLogic = useStreakLogic({
    userId: user?.id,
    sessions,
    sessionsLoaded,
    settingsLoaded: userSettings.settingsLoaded,
    streakFreezes: userSettings.streakFreezes,
    savedStreak: userSettings.savedStreak,
    updateStreakData: userSettings.updateStreakData
  });

  const handleSessionComplete = useCallback((focusMinutes: number) => {
    const currentActId = selectedActivityIdRef.current;
    const currentActs = activitiesRef.current;
    const currentAct = currentActs.find(a => a.id === currentActId) || currentActs[0];

    const newSession: StudySession = {
      date: new Date().toISOString(),
      minutes: focusMinutes,
      activityId: currentAct?.id || 1,
      activityName: currentAct?.name || 'Unknown Activity'
    };

    addSession(newSession);
    streakLogic.incrementStreak();
  }, [addSession, streakLogic]);

  const awardFreeze = useCallback(() => {
    if (userSettings.streakFreezes < MAX_FREEZES) {
      userSettings.updateStreakData(userSettings.streakFreezes + 1, streakLogic.displayedStreak);
      return true;
    }
    return false;
  }, [userSettings, streakLogic.displayedStreak]);
  const pomodoro = usePomodoro({
    onSessionComplete: handleSessionComplete,
    preset:    userSettings.preset,
    autoStart: userSettings.autoStart,
    userId:    user?.id,
  });



  const handleActivityAdded = (newActivity: Activity) => {
    // addActivity syncs DB in background and returns the real ID
    return addActivity(newActivity).then(newId => {
      if (newId) setSelectedActivityId(newId);
      return newId;
    });
  };

  return (
    <div 
      data-theme={theme}
      className="h-screen overflow-hidden bg-app text-slate-100 flex flex-col"
    >
      {/* Desktop Header */}
      <div className="flex-shrink-0 h-[60px] hidden md:block">
        <Header activeTab={activeTab} onTabChange={setActiveTab} onOpenSettings={() => setIsSettingsOpen(true)} disabled={isTestMode} />
      </div>

      {/* Mobile Header */}
      <div className="flex-shrink-0 h-[60px] md:hidden flex items-center justify-between px-4 border-b border-token bg-app">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded-lg shadow-sm">
            <img src="/logo.png" alt="Aralko Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg font-bold text-primary">Aralko</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-muted hover:text-primary">
            <SettingsIcon size={20} />
          </button>
          <div className="h-8 w-8 rounded-full overflow-hidden border border-token">
            {userSettings.avatarUrl ? (
              <img src={userSettings.avatarUrl} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-bold text-secondary">
                {userSettings.displayName?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Sidebar */}
        {!isTestMode && (
          <>
            <ResizablePanel defaultSize={25} minSize={22} maxSize={32} className="hidden md:flex flex-col h-full">
              <Sidebar>
                <StudyTracker 
                  secondsLeft={pomodoro.secondsLeft}
                  phase={pomodoro.phase}
                  isRunning={pomodoro.isRunning}
                  sessionsCompleted={pomodoro.sessionsCompleted}
                  onStart={pomodoro.start}
                  onPause={pomodoro.pause}
                  onReset={pomodoro.reset}
                  preset={userSettings.preset}
                  setPreset={userSettings.setPreset}
                  autoStart={userSettings.autoStart}
                  setAutoStart={userSettings.setAutoStart}
                  currentPhaseLength={pomodoro.currentPhaseLength}
                />
                <div className="flex-1 min-h-0 flex flex-col">
                  <MusicPlayerCompact />
                </div>
                
                <ProfilePopover
                  streak={streakLogic.displayedStreak}
                  xp={userSettings.xp}
                  totalMinutes={sessions.reduce((a, s) => a + s.minutes, 0)}
                  sessionsCount={sessions.length}
                  freezes={userSettings.streakFreezes}
                  longestStreak={userSettings.longestStreak}
                />
              </Sidebar>
            </ResizablePanel>
            <ResizableHandle className="hidden md:flex" />
          </>
        )}

        <ResizablePanel>
          {/* Settings Dialog (rendered at app root to float above everything) */}
          <SettingsDialog
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            theme={theme}
            onToggleTheme={toggleTheme}
            isAuthenticated={isAuthenticated}
            onLogin={login}
            onLogout={logout}
            aiConsent={aiConsent}
            aiConsentDate={aiConsentDate}
            consentLoading={consentLoading}
            onConsentOn={setConsentOn}
            onConsentOff={setConsentOff}
          />

          {/* AI Consent Gate Dialog */}
          <AlertDialog open={consentGateOpen} onOpenChange={setConsentGateOpen}>
            <AlertDialogContent className="bg-app border-token">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-primary">Allow AI processing?</AlertDialogTitle>
                <AlertDialogDescription className="text-secondary">
                  AI features need your consent to send your content to Google Gemini.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-surface border-token text-secondary hover:bg-white/[0.05] hover:text-primary" onClick={() => { consentResolverRef.current?.(false); consentResolverRef.current = null; }}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-accent hover:bg-accent/90 text-primary"
                  onClick={async () => {
                    await setConsentOn();
                    consentResolverRef.current?.(true);
                    consentResolverRef.current = null;
                    setConsentGateOpen(false);
                  }}
                >
                  Allow
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <main className="flex-1 flex flex-col min-h-0 h-full bg-app pb-[72px] md:pb-0 px-4 md:px-0">

            {/* Content area */}
            <div className="flex-1 min-h-0 flex flex-col">
              {loading ? (
                <div className="flex flex-1 items-center justify-center text-muted">Loading your workspace...</div>
              ) : (
                <>
                  {/* Main tab — Activity list */}
                  <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'main' ? 'flex' : 'hidden'}`}>
                    {activities.length > 0 ? (
                      <ActivityList
                        activities={activities}
                        selectedActivity={selectedActivityId}
                        onSelectActivity={setSelectedActivityId}
                        onAddActivity={() => setIsModalOpen(true)}
                        onRemoveActivity={removeActivity}
                        onNavigateToLearn={() => setActiveTab('learn')}
                      />
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center text-secondary">
                        <p className="mb-4">No activities found. Get started by adding one!</p>
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="rounded-xl bg-accent px-6 py-3 font-medium text-primary hover:bg-accent"
                        >
                          + Add your first activity
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Learn tab — always mounted so AIChatPanel never unmounts */}
                  <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'learn' ? 'flex' : 'hidden'}`}>
                    {activities.length > 0 ? (
                      <LearnTab
                        activities={activities}
                        selectedActivity={selectedActivityId}
                        onUpdateActivity={updateActivity}
                        isTestMode={isTestMode}
                        onEnterTestMode={() => setIsTestMode(true)}
                        onExitTestMode={() => setIsTestMode(false)}
                        addXP={userSettings.addXP}
                        awardFreeze={awardFreeze}
                      />
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center text-secondary">
                        <p className="mb-4">No activities yet. Add one from the Main tab.</p>
                        <button onClick={() => setActiveTab('main')} className="rounded-xl bg-accent px-6 py-3 font-medium text-primary hover:bg-accent">
                          Go to Main
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reviewer tab — always mounted */}
                  <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'reviewer' ? 'flex' : 'hidden'}`}>
                    {activities.length > 0 ? (
                      <ReviewerTab
                        activities={activities}
                        selectedActivity={selectedActivityId}
                        onUpdateActivity={updateActivity}
                        addXP={userSettings.addXP}
                        aiConsent={aiConsent}
                        onConsentRequired={() => {
                          setConsentGateOpen(true);
                        }}
                      />
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center text-secondary">
                        <p className="mb-4">No activities yet. Add one from the Main tab.</p>
                        <button onClick={() => setActiveTab('main')} className="rounded-xl bg-accent px-6 py-3 font-medium text-primary hover:bg-accent">
                          Go to Main
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Techniques tab — always mounted */}
                  <div className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'techniques' ? 'block' : 'hidden'}`}>
                    <TechniquesGrid />
                  </div>

                  {/* Stats tab — always mounted */}
                  <div className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'stats' ? 'block' : 'hidden'}`}>
                    <StatsView sessions={sessions} streak={streakLogic.displayedStreak} />
                  </div>

                  {/* Community tab — always mounted */}
                  <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'community' ? 'flex' : 'hidden'}`}>
                    <CommunityTab 
                      onOpenActivity={(id) => {
                        setSelectedActivityId(id);
                        setActiveTab('learn');
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>

      {streakLogic.toastMessage && (() => {
        const msg = streakLogic.toastMessage!;
        const isLight = document.documentElement.classList.contains('light');
        const VARIANTS: Record<string, { bg: [string, string]; border: string; title: string; desc: string }> = {
          'streak:lost':      { bg: ['#FDEDED', 'color-mix(in srgb, #E5484D 14%, #151922)'], border: '#E5484D', title: 'Streak lost',         desc: 'Keep trying! Start a new one today.' },
          'streak:protected': { bg: ['#EAF2FE', 'color-mix(in srgb, #3E8BF0 14%, #151922)'], border: '#3E8BF0', title: 'Streak protected',    desc: '1 freeze used.' },
          'streak:earned':    { bg: ['#E8F7EE', 'color-mix(in srgb, #30A46C 14%, #151922)'], border: '#30A46C', title: 'Streak freeze earned', desc: `You can hold up to ${MAX_FREEZES}.` },
        };
        const v = VARIANTS[msg];
        if (!v) return null;
        return (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div
              className="flex items-start gap-3 rounded-xl border min-w-[260px] max-w-xs"
              style={{ background: isLight ? v.bg[0] : v.bg[1], borderColor: v.border, padding: '14px 16px' }}
            >
              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <p className="text-[14px] font-semibold text-primary leading-snug">{v.title}</p>
                <p className="text-[13px] text-secondary leading-snug">{v.desc}</p>
              </div>
              <button
                onClick={() => { /* auto-dismiss handles removal */ }}
                className="text-muted hover:text-primary hover:bg-black/5 rounded p-0.5 transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })()}

      <AddActivityModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onActivityAdded={handleActivityAdded}
        addXP={userSettings.addXP}
      />
      {/* Mobile Bottom Navigation & Pomodoro */}
      <div className="md:hidden">
        {pomodoro.isRunning && (
          <div 
            onClick={() => setIsTimerSheetOpen(true)}
            className="fixed bottom-[80px] left-4 right-4 bg-surface border border-token rounded-2xl p-3 flex items-center justify-between shadow-2xl z-40"
          >
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-full border-2 border-accent/20 flex items-center justify-center">
                <span className="text-xs font-bold text-accent">
                  {pomodoro.phase === 'work' ? 'W' : 'B'}
                </span>
              </div>
              <span className="font-mono font-bold text-primary text-lg tracking-tight">
                {Math.floor(pomodoro.secondsLeft / 60).toString().padStart(2, '0')}:{(pomodoro.secondsLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); pomodoro.pause(); }}
              className="h-10 w-10 bg-accent/10 rounded-full flex items-center justify-center text-accent hover:bg-accent/20 transition-colors"
            >
              <Pause size={18} />
            </button>
          </div>
        )}
        <Dialog open={isTimerSheetOpen} onOpenChange={setIsTimerSheetOpen}>
          <DialogContent className="p-0 border-0 bg-transparent shadow-none" showCloseButton={false}>
            <div className="bg-surface rounded-2xl overflow-hidden shadow-2xl border border-token p-4 w-full">
              <StudyTracker 
                secondsLeft={pomodoro.secondsLeft}
                phase={pomodoro.phase}
                isRunning={pomodoro.isRunning}
                sessionsCompleted={pomodoro.sessionsCompleted}
                onStart={pomodoro.start}
                onPause={pomodoro.pause}
                onReset={pomodoro.reset}
                preset={userSettings.preset}
                setPreset={userSettings.setPreset}
                autoStart={userSettings.autoStart}
                setAutoStart={userSettings.setAutoStart}
                currentPhaseLength={pomodoro.currentPhaseLength}
              />
            </div>
          </DialogContent>
        </Dialog>
        <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-app border-t border-token flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-50">
          <button onClick={() => setActiveTab('main')} className="flex flex-col items-center gap-1 w-16 h-[44px] justify-center">
            <div className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${activeTab === 'main' ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              <LayoutDashboard size={20} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === 'main' ? 'text-primary' : 'text-muted'}`}>Home</span>
          </button>
          <button onClick={() => setActiveTab('learn')} className="flex flex-col items-center gap-1 w-16 h-[44px] justify-center">
            <div className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${activeTab === 'learn' ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              <BookOpen size={20} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === 'learn' ? 'text-primary' : 'text-muted'}`}>Learn</span>
          </button>
          <button onClick={() => setActiveTab('reviewer')} className="flex flex-col items-center gap-1 w-16 h-[44px] justify-center">
            <div className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${activeTab === 'reviewer' ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              <FileText size={20} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === 'reviewer' ? 'text-primary' : 'text-muted'}`}>Reviewer</span>
          </button>
          <button onClick={() => setActiveTab('stats')} className="flex flex-col items-center gap-1 w-16 h-[44px] justify-center">
            <div className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${activeTab === 'stats' ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              <BarChart3 size={20} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === 'stats' ? 'text-primary' : 'text-muted'}`}>Stats</span>
          </button>
          <button onClick={() => setActiveTab('community')} className="flex flex-col items-center gap-1 w-16 h-[44px] justify-center">
            <div className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${activeTab === 'community' ? 'bg-accent/15 text-accent' : 'text-muted'}`}>
              <Users size={20} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === 'community' ? 'text-primary' : 'text-muted'}`}>Community</span>
          </button>
        </div>
      </div>
    </div>
  );
}


function InnerApp() {
  const { session, loading } = useAuth();

  // Initialize theme globally so AuthPage respects the user's preference
  useEffect(() => {
    const root = document.documentElement;
    try {
      const storedTheme = window.localStorage.getItem('aralko-theme');
      const theme = storedTheme ? JSON.parse(storedTheme) : 'light';
      if (theme === 'light') root.classList.add('light');
      else root.classList.remove('light');
    } catch (e) {
      // fallback to light
      root.classList.add('light');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse" />
          <p className="text-xs text-muted">Loading Aralko...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <ErrorBoundary>
        <AuthPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <UserSettingsProvider>
      <StudyGroupsProvider>
        <ToastProvider>
          <InnerApp />
        </ToastProvider>
      </StudyGroupsProvider>
    </UserSettingsProvider>
  );
}


