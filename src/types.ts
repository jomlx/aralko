export type MainTab = 'main' | 'learn' | 'reviewer' | 'techniques' | 'stats' | 'community'

export type PomodoroPhase = 'work' | 'break' | 'idle'

export type Flashcard = {
  front: string
  back: string
  options?: string[]
}

export type QuizQuestion = {
  question: string      // short definition/scenario
  answer: string        // correct answer
  options: string[]     // 4 options including the correct one
  explanation?: string  // brief explanation of correct answer
}

export type Activity = {
  id: number
  name: string
  subject: string
  progress: number
  notes: string
  reviewerContent: string
  technique?: string
  techniqueData?: Flashcard[]
  reviewedCards?: Flashcard[]
  quizData?: QuizQuestion[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type StudySession = {
  date: string        // ISO date string YYYY-MM-DD
  minutes: number
  activityId: number
  activityName: string
}

export type Technique = {
  name: string
  shortDescription: string
  fullDescription: string
  steps: string[]
  icon: string   // lucide icon name as string identifier
}
