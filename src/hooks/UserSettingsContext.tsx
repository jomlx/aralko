import { createContext, useContext, type ReactNode } from 'react';
import { useUserSettings } from './useUserSettings';

type UserSettingsContextType = ReturnType<typeof useUserSettings>;

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const value = useUserSettings();
  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

/** Use this instead of useUserSettings() directly — shares one instance. */
export function useUserSettingsContext(): UserSettingsContextType {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) throw new Error('useUserSettingsContext must be used inside UserSettingsProvider');
  return ctx;
}
