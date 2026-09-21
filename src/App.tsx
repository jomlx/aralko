import { useState, useCallback, useEffect, useRef } from 'react';
import { Smartphone } from 'lucide-react';
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

import { useActivities } from './hooks/useActivities';
import { useSessions } from './hooks/useSessions';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePomodoro } from './hooks/usePomodoro';
import { useSpotify } from './hooks/useSpotify';
import { useUserSettings } from './hooks/useUserSettings';
import { useStreakLogic } from './hooks/useStreakLogic';
import { useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';

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

function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setIsMobile(isSmallScreen || (isMobileUA && hasTouch));
    };

    // Check immediately
    checkMobile();

    // Re-check on resize or orientation change
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return isMobile;
}

function AppContent() {
  const isMobile = useMobileDetect();
  const [activeTab, setActiveTab] = useState<MainTab>('main');
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // ── Supabase connection diagnostic ──────────────────────────────────────
  useEffect(() => {
    import('./lib/supabase').then(async ({ supabase }) => {
      console.group('[Supabase Diagnostic]');
      console.log('URL:', import.meta.env.VITE_SUPABASE_URL);

      // 1. Auth session — app uses anon key, so we expect NO session
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Auth session:', sessionData?.session ? 'LOGGED IN' : 'anon (no session — expected)');

      // 2. Test read
      const { data, error } = await supabase.from('user_settings').select('*').limit(1);
      if (error) {
        console.error('❌ user_settings SELECT failed:', error.code, '-', error.message);
        if (error.code === '42501') console.error('  → CAUSE: RLS is blocking the anon role. Run the fix SQL below.');
        if (error.code === 'PGRST301') console.error('  → CAUSE: JWT expired or invalid.');
      } else {
        console.log('✅ SELECT succeeded. Rows:', data);
      }

      // 3. Test write
      const { error: we } = await supabase
        .from('user_settings')
        .upsert({ user_id: 'diagnostic-test' }, { onConflict: 'user_id' });
      if (we) {
        console.error('❌ user_settings UPSERT failed:', we.code, '-', we.message);
      } else {
        console.log('✅ UPSERT succeeded.');
        // Clean up the test row
        await supabase.from('user_settings').delete().eq('user_id', 'diagnostic-test');
      }

      console.groupEnd();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { sessions, addSession } = useSessions(userSettings.addXP);
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

  const streakLogic = useStreakLogic({
    sessions,
    streakFreezes: userSettings.streakFreezes,
    savedStreak: userSettings.savedStreak,
    updateStreakData: userSettings.updateStreakData
  });

  const handleSessionComplete = useCallback(() => {
    const currentActId = selectedActivityIdRef.current;
    const currentActs = activitiesRef.current;
    const currentAct = currentActs.find(a => a.id === currentActId) || currentActs[0];

    const newSession: StudySession = {
      date: new Date().toISOString(),
      minutes: 25,
      activityId: currentAct?.id || 1,
      activityName: currentAct?.name || 'Unknown Activity'
    };

    addSession(newSession);
    streakLogic.incrementStreak();
  }, [addSession, streakLogic]);
  const pomodoro = usePomodoro({
    onSessionComplete: handleSessionComplete,
    preset:    userSettings.preset,
    autoStart: userSettings.autoStart,
  });

  const handleResizeMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newWidth = Math.max(280, Math.min(360, e.clientX));
    setSidebarWidth(newWidth);
  }, [isDragging]);

  const handleResizeEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleActivityAdded = (newActivity: Activity) => {
    // addActivity is fire-and-forget — returns tempId immediately, syncs DB in background
    addActivity(newActivity).then(newId => {
      if (newId) setSelectedActivityId(newId);
    });
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-6 text-center" data-theme={theme}>
        <div className="max-w-md w-full bg-surface border border-token rounded-3xl p-8 flex flex-col items-center shadow-2xl mx-4">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-accent/20">
            <Smartphone size={32} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-3">
            Aralko is desktop-only for now
          </h1>
          <p className="text-secondary leading-relaxed">
            Unfortunately, Aralko isn't available on mobile phones yet. Please open it on a desktop or laptop to study.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-theme={theme}
      className={`h-screen overflow-hidden bg-app text-slate-100 flex flex-col ${isDragging ? 'no-select' : ''}`}
      onMouseMove={handleResizeMove}
      onMouseUp={handleResizeEnd}
      onMouseLeave={handleResizeEnd}
    >
      {/* Header */}
      <div className="flex-shrink-0 h-[60px]">
        <Header activeTab={activeTab} onTabChange={setActiveTab} onOpenSettings={() => setIsSettingsOpen(true)} />
      </div>
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <Sidebar width={sidebarWidth} onResizeStart={() => setIsDragging(true)}>
            <StudyTracker 
              secondsLeft={pomodoro.secondsLeft}
              phase={pomodoro.phase}
              isRunning={pomodoro.isRunning}
              sessionsCompleted={pomodoro.sessionsCompleted}
              streak={userSettings.savedStreak}
              streakFreezes={userSettings.streakFreezes}
              onStart={pomodoro.start}
              onPause={pomodoro.pause}
              onReset={pomodoro.reset}
              preset={userSettings.preset}
              setPreset={userSettings.setPreset}
              autoStart={userSettings.autoStart}
              setAutoStart={userSettings.setAutoStart}
              WORK_TIME={pomodoro.WORK_TIME}
            />
            <div className="flex-1 min-h-0 flex flex-col">
              <MusicPlayerCompact />
            </div>
            
            <ProfilePopover 
              onLogout={logout}
              streak={userSettings.savedStreak}
              xp={userSettings.xp}
              totalMinutes={sessions.reduce((a, s) => a + s.minutes, 0)}
              sessionsCount={sessions.length}
            />
          </Sidebar>
        </div>

        {/* Settings Dialog (rendered at app root to float above everything) */}
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
          isAuthenticated={isAuthenticated}
          onLogin={login}
          onLogout={logout}
        />

        <main className="flex-1 flex flex-col min-h-0 bg-app">

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
                  <StatsView sessions={sessions} streak={userSettings.savedStreak} />
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
      </div>

      {streakLogic.toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-sky-500/10 border border-sky-500/20 text-sky-400 px-6 py-3 rounded-2xl shadow-xl shadow-black/40 font-medium backdrop-blur-md flex items-center gap-3">
            <span className="text-xl">❄️</span>
            {streakLogic.toastMessage}
          </div>
        </div>
      )}

      <AddActivityModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onActivityAdded={handleActivityAdded}
      />
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
    <ToastProvider>
      <InnerApp />
    </ToastProvider>
  );
}
