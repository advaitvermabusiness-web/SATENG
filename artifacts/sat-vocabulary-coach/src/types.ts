export type Level = 'Foundational' | 'Advanced' | 'Challenge';

export type WordForms = {
  verb?: { present: string; past: string; pastParticiple: string; future: string };
  other?: string[];
};

export type Word = {
  id: string;
  word: string;
  pronunciation: string;
  ukSpelling?: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  difficulty: Level;
  synonyms: string[];
  antonyms: string[];
  distractors: string[];
  category: string;
  sourceNote?: string;
  expandedSentence: string;
  etymology: string;
  wordFamily: string;
  memoryCue: string;
  activeRecallPrompt: string;
  forms: WordForms;
  track?: 'sat' | 'everyday' | 'expert';
};

export type WordProgress = {
  wordId: string;
  status: 'new' | 'learning' | 'mastered';
  confidence: number;
  correctCount: number;
  seenCount: number;
  lastSeen: string;
  nextReview?: string;
  reviewIntervalDays?: number;
};

export type Session = { 
  id: string; 
  date: string; 
  wordsReviewed: number; 
  quizScore: number; 
  duration: number; 
  kind?: 'lesson' | 'quiz';
  mode?: 'sat' | 'everyday' | 'expert';
  level?: Level;
  bankId?: string;
  questionCount?: number;
  wordIds?: string[];
  phaseCompletion?: Partial<Record<SatPhase, boolean>>;
};

export type SatPhase = 'preview' | 'invent' | 'trace' | 'postmortem' | 'morphology' | 'intern';

export type DiscoveryHistoryItem = {
  wordId: string;
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
  confidence: number;
  nextReview: string;
  note?: string;
};

export type FocusProfile = 'Quick' | 'Standard' | 'Deep' | null;

export type StudySettings = { 
  level: Level; 
  dailyGoal: number; 
  reminderEnabled: boolean;
  satMode?: boolean;
  expertMode?: boolean;
  focusProfile?: FocusProfile;
  hasCompletedOnboarding?: boolean;
  confidenceLevel?: string;
  targetTiming?: string;
  paywallSeen?: boolean;
  quickWordsSeen?: number;
  satRecallPoints?: number;
};
