import { createContext, useContext, type ReactNode } from 'react';
import { useStudyGroups } from './useStudyGroups';

type StudyGroupsContextType = ReturnType<typeof useStudyGroups>;

const StudyGroupsContext = createContext<StudyGroupsContextType | null>(null);

export function StudyGroupsProvider({ children }: { children: ReactNode }) {
  const value = useStudyGroups();
  return (
    <StudyGroupsContext.Provider value={value}>
      {children}
    </StudyGroupsContext.Provider>
  );
}

/** Use this instead of useStudyGroups() directly — shares one instance. */
export function useStudyGroupsContext(): StudyGroupsContextType {
  const ctx = useContext(StudyGroupsContext);
  if (!ctx) throw new Error('useStudyGroupsContext must be used inside StudyGroupsProvider');
  return ctx;
}
