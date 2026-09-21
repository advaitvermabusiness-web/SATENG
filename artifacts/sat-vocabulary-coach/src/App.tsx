import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  BookOpen,
  Brain,
  Coffee,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flame,
  House,
  Cloud,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Scale,
  Sparkles,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
  Info,
  Languages,
  Wind
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import './index.css';

import { type DiscoveryHistoryItem, type Level, type WordProgress, type Session, type StudySettings, type Word, type SatPhase } from './types';
import { WORDS } from './data/words';
import { EVERYDAY_WORDS } from './data/everydayWords';
import { EXPERT_WORDS } from './data/expertWords';
import { getSatRecallContent, type SatMorpheme } from './data/satRecall';
import { FocusCheck } from './components/FocusCheck';
import { Quick } from './pages/Quick';
import { Discover } from './pages/Discover';
import { PronunciationGuide } from './pages/PronunciationGuide';
import { Onboarding } from './pages/Onboarding';
import { TermsOfUse } from './pages/TermsOfUse';
import { Paywall } from './components/Paywall';
import { Achievements } from './pages/Achievements';
import { BreathingReset } from './components/BreathingReset';
import { WordActions } from './components/WordActions';
import { GeneratedScenario } from './components/GeneratedScenario';
import { useAccountSync, type AccountSyncStatus } from './components/AccountSync';
import { getReviewIntervalDays, getScheduledWords, isReviewDue, recordWordReview } from './lib/spacedRepetition';
import { blankTargetWord, buildSatContextQuestion, formatSatPassageForChoices, getSatAnswerChoices, getSatDefinitionChoices, getSatOptionRationale, getSatUsageChoices, type SatTier } from './lib/satQuiz';
import { isStoredVocabularySlice } from './lib/vocabularyStateValidation';

// Temporary preview mode: make the full learning experience available while billing is offline.
// Restore this to false when a real entitlement service is connected.
const HAS_PREMIUM = true;
const ALL_WORDS = [...WORDS, ...EVERYDAY_WORDS, ...EXPERT_WORDS];
type StudyMode = 'everyday' | 'sat' | 'expert';
const getStudyMode = (settings: StudySettings): StudyMode =>
  settings.expertMode ? 'expert' : settings.satMode ? 'sat' : 'everyday';
const INTERRUPTED_LESSON_KEY = 'wordwell-interrupted-lesson';
type EverydayLessonDraft = {
  revealed: boolean;
  recallAttempted: boolean;
  recallSkipped: boolean;
  recallDraft: string;
  sentenceDraft: string;
};
type SatLessonDraft = {
  phase: SatPhase;
  previewSeconds: number;
  prediction: string;
  inventedWord: string;
  traceStarted: boolean;
  traceMode: 'pointer' | 'keyboard' | null;
  traceIndex: number;
  selectedChoice: string | null;
  morphologyOrder: string[];
  internDraft: string;
};
type InterruptedLesson = {
  mode: StudyMode;
  level: Level;
  wordIds: string[];
  index: number;
  savedAt: string;
  everyday?: EverydayLessonDraft;
  sat?: SatLessonDraft;
};

function readInterruptedLesson(): InterruptedLesson | null {
  try {
    const stored = localStorage.getItem(INTERRUPTED_LESSON_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('mode' in parsed) ||
      !('level' in parsed) ||
      !('wordIds' in parsed) ||
      !('index' in parsed) ||
      !('savedAt' in parsed) ||
      !['everyday', 'sat', 'expert'].includes(parsed.mode as string) ||
      !['Foundational', 'Advanced', 'Challenge'].includes(parsed.level as string) ||
      !Array.isArray(parsed.wordIds) ||
      !parsed.wordIds.every(wordId => typeof wordId === 'string') ||
      typeof parsed.index !== 'number' ||
      typeof parsed.savedAt !== 'string'
    ) return null;
    return parsed as InterruptedLesson;
  } catch {
    return null;
  }
}

function writeInterruptedLesson(lesson: InterruptedLesson) {
  try {
    localStorage.setItem(INTERRUPTED_LESSON_KEY, JSON.stringify(lesson));
  } catch {
    // The lesson can still be left safely when browser storage is unavailable.
  }
}

function clearInterruptedLesson() {
  try {
    localStorage.removeItem(INTERRUPTED_LESSON_KEY);
  } catch {
    // Leaving the lesson still succeeds when browser storage is unavailable.
  }
}

function restoreLessonWords(pool: Word[], wordIds: string[]) {
  const wordsById = new Map(pool.map(word => [word.id, word]));
  const restored = wordIds.map(wordId => wordsById.get(wordId));
  return restored.every(Boolean) ? restored as Word[] : null;
}

const getStudyWords = (settings: StudySettings) => {
  const mode = getStudyMode(settings);
  if (mode === 'expert') return EXPERT_WORDS;
  if (mode === 'sat') return WORDS;
  return EVERYDAY_WORDS.filter(word => word.difficulty === settings.level);
};
const selectStudyMode = (mode: StudyMode) => (current: StudySettings): StudySettings => ({
  ...current,
  satMode: mode === 'sat',
  expertMode: mode === 'expert',
  level: mode === 'expert' ? 'Challenge' : current.level,
});
const LEARN_REST_KEY = 'wordwell-learn-rest-until';
const DEVELOPER_SUGGESTIONS_KEY = 'wordwell-developer-suggestions';
type DeveloperSuggestion = { key: string; text: string; submittedAt: string };
type SentenceAssessment = {
  correct: boolean;
  feedback: string;
  correction: string | null;
  complexity: {
    score: number;
    label: string;
    feedback: string;
  };
  grammar: {
    score: number;
    label: string;
    feedback: string;
  };
};
type SatRelationshipLabel = 'Contrast' | 'Cause' | 'Concession' | 'Continuation' | 'Unclear';
type SatRelationshipAssessment = {
  correct: boolean;
  submitted: SatRelationshipLabel;
  expected: Exclude<SatRelationshipLabel, 'Unclear'>;
  feedback: string;
};
type QuizBankId = 'daily' | 'sat' | 'everyday' | 'expert' | 'all' | 'endless';
type QuizBankOption = {
  id: QuizBankId;
  label: string;
  description: string;
};
type SatQuestionKind = 'context' | 'meaning' | 'usage';
type QuizQuestion = {
  word: Word;
  kind: SatQuestionKind | 'everyday';
};

const SAT_PHASE_ORDER: SatPhase[] = ['preview', 'invent', 'trace', 'postmortem', 'morphology', 'intern'];
const SAT_PREVIEW_SECONDS = 15;

const SAT_RELATIONSHIP_GUIDE = [
  { title: 'Contrast', signals: 'however, but, yet, whereas, unlike, in contrast', prompt: 'The blank should show that the next idea differs from the previous one.' },
  { title: 'Concession', signals: 'although, even though, despite, admittedly, nevertheless, still', prompt: 'The blank should acknowledge an opposing point while preserving the main claim.' },
  { title: 'Cause', signals: 'because, since, owing to, due to, as a result of', prompt: 'The blank should explain why something happened.' },
  { title: 'Effect or result', signals: 'therefore, thus, consequently, hence, as a result, so', prompt: 'The blank should introduce the consequence of the previous idea.' },
  { title: 'Continuation or addition', signals: 'also, furthermore, moreover, in addition, likewise', prompt: 'The blank should add a compatible idea or strengthen the same line of thought.' },
  { title: 'Comparison or similarity', signals: 'similarly, likewise, just as, in the same way', prompt: 'The blank should show that the next idea resembles the previous one.' },
  { title: 'Qualification or limitation', signals: 'only, merely, in some cases, to some extent, generally, primarily', prompt: 'The blank should narrow or soften a claim instead of making it absolute.' },
  { title: 'Clarification or restatement', signals: 'in other words, that is, namely, specifically', prompt: 'The blank should restate or define the previous idea more precisely.' },
  { title: 'Example or illustration', signals: 'for example, for instance, such as, including, notably', prompt: 'The blank should introduce a specific case that supports a general point.' },
  { title: 'Elaboration', signals: 'in fact, indeed, particularly, especially, more specifically', prompt: 'The blank should develop the previous idea with more detail or evidence.' },
  { title: 'Sequence or chronology', signals: 'first, initially, later, subsequently, meanwhile, finally', prompt: 'The blank should show when something happened or what happened next.' },
  { title: 'Change or development', signals: 'initially, once, later, gradually, increasingly, eventually', prompt: 'The blank should show a shift in an idea, condition, or attitude over time.' },
  { title: 'Condition', signals: 'if, unless, provided that, as long as, only if', prompt: 'The blank should state the requirement for something to happen.' },
  { title: 'Purpose', signals: 'to, so that, in order to, for the purpose of', prompt: 'The blank should explain the goal of an action.' },
  { title: 'Problem and solution', signals: 'problem, challenge, obstacle, to address this, one solution is', prompt: 'The blank should identify a difficulty or present a response to it.' },
  { title: 'Emphasis', signals: 'indeed, above all, notably, importantly, especially', prompt: 'The blank should draw attention to the most important detail.' },
  { title: 'Correction or reversal', signals: 'in fact, actually, rather, instead, contrary to', prompt: 'The blank should correct or overturn an earlier assumption.' },
  { title: 'Alternative', signals: 'alternatively, instead, otherwise, or rather', prompt: 'The blank should introduce another explanation, method, or choice.' },
  { title: 'Generalization', signals: 'thus, overall, generally, taken together, in general', prompt: 'The blank should move from specific details to a broader claim.' },
  { title: 'Conclusion or inference', signals: 'therefore, thus, consequently, this suggests, it follows that', prompt: 'The blank should state what logically follows from the evidence.' },
] as const;

const BREAK_QUOTES = [
  { text: 'All work and no play makes Jack a dull boy.', author: 'Proverb' },
  { text: 'The time to relax is when you don’t have time for it.', author: 'Sydney J. Harris' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott' },
  { text: 'Rest is not idleness, and to lie sometimes on the grass on a summer day is hardly wasting time.', author: 'John Lubbock' },
  { text: 'You can’t pour from an empty cup.', author: 'Common saying' },
  { text: 'Take rest; a field that has rested gives a bountiful crop.', author: 'Ovid' },
];

function makeBreakQuestions(words: Word[]) {
  return words.slice(0, Math.min(3, words.length)).map(word => {
    const distractors = words
      .filter(candidate => candidate.id !== word.id)
      .map(candidate => candidate.definition);
    const choices = [word.definition, ...distractors.slice(0, 2)];
    for (let choiceIndex = choices.length - 1; choiceIndex > 0; choiceIndex -= 1) {
      const swapIndex = Math.floor(Math.random() * (choiceIndex + 1));
      [choices[choiceIndex], choices[swapIndex]] = [choices[swapIndex], choices[choiceIndex]];
    }
    return { word, choices };
  });
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: 'simple' as const,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
  },
  variables: {
    colorPrimary: '#2f7797',
    colorForeground: '#213740',
    colorMutedForeground: '#677d86',
    colorDanger: '#c64d45',
    colorBackground: '#fcfaf4',
    colorInput: '#f2eee4',
    colorInputForeground: '#213740',
    colorNeutral: '#dcd4c4',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '16px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fcfaf4] rounded-[28px] w-[440px] max-w-full overflow-hidden border border-[#dcd4c4] shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#213740] font-bold',
    headerSubtitle: 'text-[#677d86]',
    socialButtonsBlockButtonText: 'text-[#213740] font-semibold',
    formFieldLabel: 'text-[#213740] font-semibold',
    footerActionLink: 'text-[#2f7797] font-bold',
    footerActionText: 'text-[#677d86]',
    dividerText: 'text-[#677d86]',
    identityPreviewEditButton: 'text-[#2f7797]',
    formFieldSuccessText: 'text-[#2f7797]',
    alertText: 'text-[#213740]',
    logoBox: 'h-14',
    logoImage: 'h-12 w-auto',
    socialButtonsBlockButton: 'border-[#dcd4c4] bg-white hover:bg-[#f2eee4]',
    formButtonPrimary: 'bg-[#2f7797] hover:bg-[#286985] text-white shadow-none',
    formFieldInput: 'border-[#dcd4c4] bg-white text-[#213740]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#dcd4c4]',
    alert: 'border-[#dcd4c4] bg-[#f2eee4]',
    otpCodeFieldInput: 'border-[#dcd4c4] bg-white text-[#213740]',
    formFieldRow: 'text-[#213740]',
    main: 'gap-5',
  },
};

function getUniqueSortedDates(sessions: Session[]) {
  return [...new Set(sessions.map(s => new Date(s.date).toDateString()))]
    .map(d => new Date(d).getTime())
    .sort((a, b) => b - a);
}

function getStreak(sessions: Session[]) {
  const dates = getUniqueSortedDates(sessions);
  if (dates.length === 0) return 0;
  
  const today = new Date(new Date().toDateString()).getTime();
  const yesterday = today - 86400000;
  
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i-1] - dates[i] === 86400000) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getBestStreak(sessions: Session[]) {
  const dates = getUniqueSortedDates(sessions).reverse();
  if (dates.length === 0) return 0;
  let maxStreak = 1;
  let currStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] - dates[i-1] === 86400000) {
      currStreak++;
      maxStreak = Math.max(maxStreak, currStreak);
    } else {
      currStreak = 1;
    }
  }
  return maxStreak;
}

function getMinutesThisWeek(sessions: Session[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions
    .filter(s => new Date(s.date).getTime() >= weekAgo)
    .reduce((sum, s) => sum + s.duration, 0);
}

function localDayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isRestingUntilTomorrow() {
  try {
    const restUntil = localStorage.getItem(LEARN_REST_KEY);
    return Boolean(restUntil && restUntil > localDayKey(new Date()));
  } catch {
    return false;
  }
}

function saveRestUntilTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  try {
    localStorage.setItem(LEARN_REST_KEY, localDayKey(tomorrow));
  } catch {
    // The in-memory lesson still completes when storage is unavailable.
  }
}

function clearLearnRest() {
  try {
    localStorage.removeItem(LEARN_REST_KEY);
  } catch {
    // Refresh still works when storage is unavailable.
  }
}

function normalizeSuggestion(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const defaultSettings: StudySettings = { level: 'Foundational', dailyGoal: 5, reminderEnabled: false, satMode: false, expertMode: false, hasCompletedOnboarding: false, paywallSeen: false };
const queryClient = new QueryClient();

function useStoredState<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return initial;
      const parsed = JSON.parse(stored);
      if (parsed === null || parsed === undefined) return initial;
      if (Array.isArray(initial)) {
        return Array.isArray(parsed) && isStoredVocabularySlice(key, parsed)
          ? (parsed as T)
          : initial;
      }
      if (typeof initial === 'object') {
        const parsedObject =
          typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        if (
          key === 'wordwell-settings' &&
          !Object.prototype.hasOwnProperty.call(
            parsedObject,
            'hasCompletedOnboarding',
          )
        ) {
          parsedObject.hasCompletedOnboarding = true;
        }
        const merged = { ...initial, ...parsedObject };
        return isStoredVocabularySlice(key, merged) ? (merged as T) : initial;
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the in-memory experience working when storage is blocked or full.
    }
  }, [key, value]);
  return [value, setValue];
}

function IconMark() {
  return <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"><Sparkles size={18} strokeWidth={2.5} /></div>;
}

function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, testId }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'quiet' | 'outline' | 'coral'; className?: string; type?: 'button' | 'submit'; disabled?: boolean; testId?: string }) {
  const styles = {
    primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_18px_hsl(var(--primary)/.18)] hover:brightness-95',
    quiet: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--sidebar-accent))]',
    outline: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--secondary)/.55)]',
    coral: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:brightness-95',
  }[variant];
  return <button type={type} disabled={disabled} onClick={onClick} data-testid={testId} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}>{children}</button>;
}

function LessonExitDialog({ onSave, onDiscard, onClose }: { onSave: () => void; onDiscard: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] p-5 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="lesson-exit-title" className="w-full max-w-md rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl md:p-8" onClick={event => event.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><Cloud size={19} /></div>
          <div>
            <h2 id="lesson-exit-title" className="font-display text-3xl tracking-[-.04em]">Save your stopping point?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">You can save this lesson and come back to the same word and practice later.</p>
          </div>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="quiet" onClick={onDiscard} testId="button-leave-lesson-without-saving">Leave without saving</Button>
          <Button variant="outline" onClick={onClose}>Keep studying</Button>
          <Button onClick={onSave} testId="button-save-lesson-progress">Save progress and leave <ArrowRight size={15} /></Button>
        </div>
      </section>
    </div>
  );
}

function ResumeLessonDialog({ mode, onResume, onStartFresh }: { mode: StudyMode; onResume: () => void; onStartFresh: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] p-5 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="resume-lesson-title" className="w-full max-w-md rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl md:p-8">
        <div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Saved lesson found</div>
        <h2 id="resume-lesson-title" className="mt-2 font-display text-3xl tracking-[-.04em]">Continue where you stopped?</h2>
        <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your unfinished {mode === 'sat' ? 'SAT' : mode === 'expert' ? 'Expert' : 'Everyday'} lesson is ready. Continue from the saved word or start a fresh set.</p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="quiet" onClick={onStartFresh} testId="button-start-fresh-lesson">Start a fresh lesson</Button>
          <Button onClick={onResume} testId="button-resume-lesson">Resume lesson <ArrowRight size={15} /></Button>
        </div>
      </section>
    </div>
  );
}

function ModeToggle({ settings, setSettings, compact = false }: { settings: StudySettings; setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void; compact?: boolean }) {
  const activeMode = getStudyMode(settings);
  const modes: { id: StudyMode; label: string; description: string }[] = [
    { id: 'everyday', label: 'Everyday', description: 'Useful words for daily life' },
    { id: 'sat', label: 'SAT', description: 'Exam-focused vocabulary' },
    { id: 'expert', label: 'Expert', description: 'Separate challenge bank' },
  ];

  return (
    <div className={`rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--card)/.45)] p-1 ${compact ? 'grid grid-cols-3' : 'space-y-1'}`} aria-label="Study mode">
      {modes.map(mode => {
        const active = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setSettings(selectStudyMode(mode.id))}
            aria-pressed={active}
            data-testid={`button-mode-${mode.id}${compact ? '-mobile' : ''}`}
            className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${active ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))]'}`}
          >
            <span className="block text-[11px] font-extrabold">{mode.label}</span>
            {!compact && <span className={`mt-0.5 block text-[9px] ${active ? 'text-[hsl(var(--primary-foreground)/.72)]' : 'text-[hsl(var(--muted-foreground))]'}`}>{mode.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

function AccountPanel({ syncStatus, compact = false }: { syncStatus: AccountSyncStatus; compact?: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    for (const key of ['wordwell-settings', 'wordwell-progress', 'wordwell-sessions', 'wordwell-bookmarks', 'wordwell-discovery-history', 'wordwell-state-owner', 'wordwell-learn-rest-until']) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Signing out still succeeds when browser storage is unavailable.
      }
    }
    await signOut();
    window.location.assign(basePath || '/');
  };

  if (!user) {
    return (
      <Link href="/sign-in" className={`flex items-center gap-2 rounded-xl font-bold no-underline ${compact ? 'px-3 py-3 text-sm' : 'border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--card)/.55)] px-3 py-3 text-xs text-[hsl(var(--primary))]'}`}>
        <LogIn size={16} /> Log in to sync
      </Link>
    );
  }

  const statusLabel = syncStatus === 'synced'
    ? 'Saved to your account'
    : syncStatus === 'offline'
      ? 'Changes saved on this device'
      : syncStatus === 'local'
        ? 'Preparing sync'
        : 'Saving your progress…';

  return (
    <div className={compact ? 'rounded-xl bg-[hsl(var(--secondary)/.55)] p-3' : 'rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--card)/.55)] p-3'}>
      <div className="flex items-center gap-3">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">
            {(user.firstName || user.primaryEmailAddress?.emailAddress || 'W').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">{user.firstName || 'Wordwell learner'}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground))]">
            <Cloud size={10} /> {statusLabel}
          </div>
        </div>
        <button type="button" onClick={handleSignOut} aria-label="Log out" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]">
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

const POMODORO_FOCUS_SECONDS = 25 * 60;
const POMODORO_BREAK_SECONDS = 5 * 60;

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function PomodoroTimer({ openRequest, isHome }: { openRequest: number; isHome: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'focus' | 'break'>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState(POMODORO_FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (openRequest > 0) setExpanded(true);
  }, [openRequest]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setSecondsRemaining(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || secondsRemaining > 0) return;
    if (phase === 'focus') {
      setRounds(value => value + 1);
      setPhase('break');
      setSecondsRemaining(POMODORO_BREAK_SECONDS);
      setExpanded(true);
      return;
    }
    setPhase('idle');
    setSecondsRemaining(POMODORO_FOCUS_SECONDS);
    setRunning(false);
    setExpanded(true);
  }, [phase, running, secondsRemaining]);

  const startFocus = () => {
    setPhase('focus');
    setSecondsRemaining(POMODORO_FOCUS_SECONDS);
    setRunning(true);
    setExpanded(true);
  };

  const togglePause = () => setRunning(value => !value);

  const endRhythm = () => {
    setPhase('idle');
    setSecondsRemaining(POMODORO_FOCUS_SECONDS);
    setRunning(false);
    setExpanded(false);
  };

  const title = phase === 'focus'
    ? 'Focus time'
    : phase === 'break'
      ? 'Break time'
      : 'Study rhythm';
  const subtitle = phase === 'focus'
    ? 'One focused stretch. You do not need to do more than this.'
    : phase === 'break'
      ? 'Step away for five minutes. The break is part of the plan.'
      : '25 minutes of focus, then 5 minutes to reset.';
  const headerPlacement = !isHome;

  if (!expanded && (phase === 'idle' || isHome)) {
    return null;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`fixed ${headerPlacement ? 'right-16 top-2 md:right-6 md:top-4' : 'bottom-24 right-4 md:bottom-6 md:right-6'} z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] px-4 text-xs font-bold text-[hsl(var(--foreground))] shadow-lift backdrop-blur-md transition-colors hover:border-[hsl(var(--primary)/.45)]`}
        data-testid="button-open-pomodoro"
      >
        <Timer size={15} className="text-[hsl(var(--primary))]" />
        {phase === 'idle' ? 'Study rhythm' : formatTimer(secondsRemaining)}
      </button>
    );
  }

  return (
    <section className={`fixed ${headerPlacement ? 'right-4 top-[4.5rem] md:right-6 md:top-6' : 'bottom-24 right-4 md:bottom-6 md:right-6'} z-40 w-[calc(100vw-2rem)] max-w-sm rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.98)] p-5 shadow-lift backdrop-blur-md`} aria-label="Pomodoro study rhythm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${phase === 'break' ? 'bg-[hsl(var(--accent)/.18)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]'}`}>
            {phase === 'break' ? <Coffee size={19} /> : <Timer size={19} />}
          </div>
          <div>
            <div className="font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{subtitle}</p>
          </div>
        </div>
        <button type="button" onClick={() => setExpanded(false)} aria-label="Minimize study rhythm" className="rounded-lg p-1 text-lg leading-none text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]">×</button>
      </div>

      {phase === 'idle' ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="font-mono-ui text-3xl tracking-[-.04em]">25:00</div>
          <button type="button" onClick={startFocus} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:brightness-95" data-testid="button-start-pomodoro">
            <Play size={14} /> Start focus
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono-ui text-4xl tracking-[-.05em]">{formatTimer(secondsRemaining)}</div>
              <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{rounds > 0 ? `${rounds} focus round${rounds === 1 ? '' : 's'} completed` : 'Your first round today'}</div>
            </div>
            <button type="button" onClick={togglePause} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-3 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--sidebar-accent))]" data-testid="button-pause-pomodoro">
              {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
            </button>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
            <div className={`h-full transition-[width] duration-500 ${phase === 'break' ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary))]'}`} style={{ width: `${((phase === 'break' ? POMODORO_BREAK_SECONDS : POMODORO_FOCUS_SECONDS) - secondsRemaining) / (phase === 'break' ? POMODORO_BREAK_SECONDS : POMODORO_FOCUS_SECONDS) * 100}%` }} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{running ? (phase === 'break' ? 'Rest is part of learning.' : 'Keep going gently.') : 'Paused whenever you need.'}</span>
            <button type="button" onClick={endRhythm} className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-end-pomodoro">End rhythm</button>
          </div>
        </>
      )}
    </section>
  );
}

function Shell({ children, onPaywall, syncStatus, settings, setSettings }: { children: (onOpenStudyRhythm: () => void) => ReactNode, onPaywall: () => void, syncStatus: AccountSyncStatus; settings: StudySettings; setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarHintDismissed, setSidebarHintDismissed] = useStoredState('wordwell-sidebar-hint-dismissed', false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wordwell-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [studyRhythmRequest, setStudyRhythmRequest] = useState(0);
  const isQuickMode = location === '/quick';
  const satMode = getStudyMode(settings) === 'sat';
  const focusedMode = getStudyMode(settings) !== 'everyday';
  const studyMode = getStudyMode(settings);
  const openStudyRhythm = () => setStudyRhythmRequest(value => value + 1);

  useEffect(() => {
    try {
      localStorage.setItem('wordwell-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Keep the current layout when browser storage is unavailable.
    }
  }, [sidebarCollapsed]);
  
  const allNav = [
    { href: '/', label: 'Home', description: 'Your study overview', icon: House },
    { href: '/quick', label: 'Quick', description: 'Fast word review', icon: Zap },
    { href: '/learn', label: 'Learn', description: 'A guided lesson', icon: BookOpen },
    { href: '/discover', label: 'Discover', description: 'Browse new words', icon: Sparkles, satVisible: false },
    { href: '/sounds', label: 'Sounds', description: 'Pronunciation practice', icon: Languages, bottom: false, satVisible: false },
    { href: '/quiz', label: 'Quiz', description: 'Test your recall', icon: Brain },
    { href: '/history', label: 'History', description: 'Past study sessions', icon: Clock3 },
    { href: '/progress', label: 'Progress', description: 'Growth and settings', icon: BarChart3 },
    { href: '/saved', label: 'Saved', description: 'Words kept for later', icon: Bookmark },
    { href: '/achievements', label: 'Awards', description: 'Study milestones', icon: Trophy },
  ];
  const nav = focusedMode ? allNav.filter(item => item.satVisible !== false) : allNav;

  return <div className="app-shell min-h-[100dvh] text-[hsl(var(--foreground))]">
     <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-y-auto border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] py-6 transition-[width,padding] duration-200 md:flex ${sidebarCollapsed ? 'w-[76px] px-3' : 'w-[238px] px-5'}`}>
       <div className={`relative flex items-center ${sidebarCollapsed ? 'mb-4 justify-center' : 'mb-12 justify-between gap-3'}`}>
       <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-brand" title={sidebarCollapsed ? 'Wordwell home' : undefined}>
        <IconMark />
         {!sidebarCollapsed && <span className="text-[15px] font-extrabold tracking-[-.03em]">wordwell<span className="text-[hsl(var(--accent))]">.</span></span>}
      </Link>
       {!sidebarCollapsed ? (
         <button type="button" onClick={() => setSidebarCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]" data-testid="button-collapse-sidebar">
           <PanelLeftClose size={17} />
         </button>
       ) : (
         <span aria-hidden="true" />
       )}
       </div>
       {sidebarCollapsed && (
         <button type="button" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar" className="mb-4 self-center rounded-lg border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] p-2 text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]" data-testid="button-expand-sidebar">
           <PanelLeftOpen size={17} />
         </button>
       )}
       {sidebarCollapsed && !sidebarHintDismissed && (
         <div className="absolute left-[64px] top-[67px] z-50 w-56 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--card))] p-3 text-xs leading-relaxed text-[hsl(var(--foreground))] shadow-lift" role="status">
           <button type="button" onClick={() => setSidebarHintDismissed(true)} aria-label="Dismiss sidebar hint" className="absolute right-2 top-2 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]">
             <X size={13} />
           </button>
           <div className="pr-5 font-extrabold">Your navigation is collapsed</div>
           <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Hover an icon for its name, or use the arrow to expand the menu.</p>
         </div>
       )}
       {!sidebarCollapsed && <div className="mb-3 px-3 font-mono-ui text-[10px] font-medium uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your desk</div>}
       <div className="mb-4">
         {sidebarCollapsed ? (
           <button type="button" onClick={() => setSidebarCollapsed(false)} aria-label={`Expand sidebar to change study mode. Current mode: ${studyMode}`} title={`Current mode: ${studyMode}`} className={`flex w-full items-center justify-center rounded-xl border p-3 hover:bg-[hsl(var(--sidebar-accent))] ${studyMode === 'expert' ? 'border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : studyMode === 'sat' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--sidebar-border))] bg-[hsl(var(--card)/.45)] text-[hsl(var(--primary))]'}`} data-testid="button-sidebar-current-mode">
             <Target size={18} />
           </button>
         ) : <ModeToggle settings={settings} setSettings={setSettings} />}
       </div>
      <nav className="space-y-1">
         {nav.map(({ href, label, description, icon: NavIcon }) => {
          const isActive = location === href;
           return <Link key={href} href={href} aria-current={isActive ? 'page' : undefined} aria-label={`${label}: ${description}`} title={sidebarCollapsed ? `${label} — ${description}` : description} data-testid={`link-nav-${label.toLowerCase()}`} className={`group relative flex items-center rounded-xl py-3 text-sm font-bold no-underline transition-colors ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${isActive ? 'bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-sm' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'}`}>
            {isActive && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[hsl(var(--accent))]" />}
            <NavIcon size={18} strokeWidth={isActive ? 2.5 : 2} />
             {!sidebarCollapsed && <span>{label}</span>}
          </Link>;
        })}
      </nav>
      <div className="mt-auto mb-3">
         {sidebarCollapsed ? (
           <button type="button" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar for account controls" title="Expand sidebar for account controls" className="flex w-full items-center justify-center rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--card)/.55)] p-3 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))]" data-testid="button-sidebar-account">
             <Cloud size={17} />
           </button>
         ) : <AccountPanel syncStatus={syncStatus} />}
      </div>
       {!sidebarCollapsed && <div className="rounded-2xl bg-[hsl(var(--primary)/.1)] p-4">
        <div className="mb-2 flex items-center gap-2 text-[hsl(var(--primary))]"><Target size={16} /><span className="font-mono-ui text-[10px] font-medium uppercase tracking-[.12em]">Daily rhythm</span></div>
        <p className="text-xs leading-relaxed text-[hsl(var(--foreground)/.68)]">Small, steady sessions become a bigger vocabulary.</p>
       </div>}
       {!HAS_PREMIUM && <button onClick={onPaywall} title={sidebarCollapsed ? 'Unlock Premium' : undefined} className={`mt-3 flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] ${sidebarCollapsed ? 'justify-center px-3' : 'px-3'}`}><Sparkles size={15} /> {!sidebarCollapsed && 'Unlock Premium'}</button>}
       <Link href="/progress" title={sidebarCollapsed ? 'Study settings' : undefined} className={`mt-3 flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] no-underline hover:text-[hsl(var(--primary))] ${sidebarCollapsed ? 'justify-center px-3' : 'px-3'}`}><SlidersHorizontal size={15} /> {!sidebarCollapsed && 'Study settings'}</Link>
       <Link href="/terms" title={sidebarCollapsed ? 'Terms of Use' : undefined} className={`mt-3 flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] no-underline hover:text-[hsl(var(--primary))] ${sidebarCollapsed ? 'justify-center px-3' : 'px-3'}`}><Scale size={15} /> {!sidebarCollapsed && 'Terms of Use'}</Link>
    </aside>
    {!isQuickMode && <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[hsl(var(--border)/.7)] bg-[hsl(var(--background)/.92)] px-5 backdrop-blur-md md:hidden">
      <Link href="/" className="flex items-center gap-2.5 no-underline"><IconMark /><span className="font-extrabold tracking-[-.03em]">wordwell<span className="text-[hsl(var(--accent))]">.</span></span></Link>
      <button className="rounded-xl p-2 text-[hsl(var(--foreground))]" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open navigation" data-testid="button-open-menu"><Menu size={22} /></button>
      {menuOpen && (
        <div className="absolute left-3 right-3 top-[60px] max-h-[calc(100dvh-76px)] overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-lift">
          <div className="mb-2"><ModeToggle settings={settings} setSettings={setSettings} compact /></div>
          {nav.map(({ href, label, description, icon: NavIcon }) => {
            const isActive = location === href;
            return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={isActive ? 'page' : undefined} aria-label={`${label}: ${description}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold no-underline ${isActive ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--secondary))]'}`}>
              <NavIcon size={17} />
              <span>{label}</span>
              <span className="ml-auto text-[10px] font-medium text-[hsl(var(--muted-foreground))]">{description}</span>
              {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
            </Link>;
          })}
          {!HAS_PREMIUM && <button onClick={() => { setMenuOpen(false); onPaywall(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[hsl(var(--accent))] hover:bg-[hsl(var(--secondary))]">
            <Sparkles size={17} /> Unlock Premium
          </button>}
           <Link href="/terms" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold no-underline text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]">
             <Scale size={17} /> Terms of Use
           </Link>
          <AccountPanel syncStatus={syncStatus} compact />
        </div>
      )}
    </header>}
    <main className={`min-h-[100dvh] transition-[margin] duration-200 ${sidebarCollapsed ? 'md:ml-[76px]' : 'md:ml-[238px]'}`}>{children(openStudyRhythm)}</main>
    {!isQuickMode && <nav aria-label="Primary navigation" className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden">
      {nav.filter(item => item.href !== '/achievements' && item.bottom !== false).map(({ href, label, description, icon: NavIcon }) => {
        const isActive = location === href;
        return <Link key={href} href={href} aria-current={isActive ? 'page' : undefined} aria-label={`${label}: ${description}`} data-testid={`link-mobile-${label.toLowerCase()}`} className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold no-underline transition-colors ${isActive ? 'bg-[hsl(var(--secondary)/.7)] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
          <NavIcon size={18} strokeWidth={isActive ? 2.5 : 2} /><span className="truncate">{label}</span>
        </Link>;
      })}
    </nav>}
    {!isQuickMode && <PomodoroTimer openRequest={studyRhythmRequest} isHome={location === '/'} />}
  </div>;
}

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-[hsl(var(--primary))]">{eyebrow}</div><h1 className="font-display text-4xl leading-[.98] tracking-[-.04em] md:text-5xl">{title}</h1>{subtitle && <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{subtitle}</p>}</div>{action}</div>;
}

function LevelSelect({ settings, setSettings, onPaywall, onRefresh }: { settings: StudySettings; setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void; onPaywall: () => void; onRefresh?: () => void; }) {
  const handleSelect = (level: Level) => {
    if (!HAS_PREMIUM && (level === 'Advanced' || level === 'Challenge')) {
      onPaywall();
      return;
    }
    setSettings(current => ({ ...current, level }));
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
      <div className="flex items-center gap-1">
        <span className="hidden px-2 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] sm:block">Level</span>
        {(['Foundational', 'Advanced', 'Challenge'] as Level[]).map(level => (
          <button key={level} type="button" onClick={() => handleSelect(level)} data-testid={`button-level-${level.toLowerCase()}`} className={`rounded-lg px-2.5 py-2 text-xs font-bold transition-colors ${settings.level === level ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'}`}>
            {level}
            {(level === 'Advanced' || level === 'Challenge') && <Sparkles className="ml-1 inline opacity-50" size={12} />}
          </button>
        ))}
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} aria-label={`Refresh ${settings.level.toLowerCase()} words`} title={`Refresh ${settings.level.toLowerCase()} words`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]" data-testid="button-refresh-level-words">
          <RotateCcw size={14} /> <span className="hidden sm:inline">Refresh words</span>
        </button>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, detail, color = 'primary' }: { icon: ReactNode; label: string; value: string; detail: string; color?: 'primary' | 'coral' }) {
  return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-soft"><div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl ${color === 'coral' ? 'bg-[hsl(var(--accent)/.18)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--primary)/.13)] text-[hsl(var(--primary))]'}`}>{icon}</div><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{label}</div><div className="mt-1 text-2xl font-extrabold tracking-[-.05em]">{value}</div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{detail}</div></div>;
}

function QuickRevisionCheck({ words, satMode, onClose }: { words: Word[]; satMode: boolean; onClose: () => void }) {
  const [questions] = useState(() => makeBreakQuestions(words));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [quote] = useState(() => BREAK_QUOTES[Math.floor(Math.random() * BREAK_QUOTES.length)]);
  const current = questions[index];
  const passed = questions.length > 0 && score >= Math.ceil(questions.length * 2 / 3);

  const choose = (choice: string) => {
    if (picked || !current) return;
    setPicked(choice);
    if (choice === current.word.definition) setScore(value => value + 1);
  };

  const next = () => {
    if (!picked) return;
    if (index === questions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex(value => value + 1);
    setPicked(null);
  };

  if (finished || !current) {
    return (
      <div className="min-h-[100dvh] px-5 py-12 pb-28 md:px-10 md:py-20">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))]">
            <Brain size={37} />
          </div>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Quick revision check</div>
          <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">
            {passed ? <>That’s enough.<br /><em className="text-[hsl(var(--primary))]">Take your break.</em></> : <>You’re close.<br /><em className="text-[hsl(var(--primary))]">No need to push.</em></>}
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {passed
              ? `You got ${score} of ${questions.length}. That is a well-earned break—go live a little and let the memory settle.`
              : `You got ${score} of ${questions.length}. The words are still settling, and that’s okay. Stopping now will not undo today’s work.`}
          </p>
          <blockquote className="mx-auto mt-8 max-w-md rounded-2xl bg-[hsl(var(--secondary)/.6)] p-5 text-left">
            <p className="font-display text-xl leading-relaxed">“{quote.text}”</p>
            <footer className="mt-3 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">— {quote.author}</footer>
          </blockquote>
          <Button className="mt-8" onClick={onClose} testId="button-close-break-check">{passed ? 'Take the break' : 'Close for today'} <ArrowRight size={16} /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-44 md:px-10 md:py-12 md:pb-28 lg:px-20">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-8 flex items-center justify-between">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><ChevronLeft size={16} /> Back to your stopping point</button>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{satMode ? 'SAT quick check' : 'Quick revision check'}</div>
        </div>
        <div className="mb-8">
          <div className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">A little reassurance · {index + 1} of {questions.length}</div>
          <h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">What does <em className="text-[hsl(var(--primary))]">{current.word.word}</em> mean?</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Choose the answer that feels closest. This is a check-in, not another exam.</p>
        </div>
        <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-soft md:p-10">
          <div className="grid gap-3">
            {current.choices.map((choice, choiceIndex) => {
              const isCorrect = choice === current.word.definition;
              const isPicked = picked === choice;
              return (
                <button key={choice} type="button" onClick={() => choose(choice)} disabled={Boolean(picked)} className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors ${!picked ? 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/.6)]' : isCorrect ? 'border-[hsl(var(--primary)/.55)] bg-[hsl(var(--primary)/.1)]' : isPicked ? 'border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.12)]' : 'border-[hsl(var(--border))] opacity-60'}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] font-mono-ui text-[11px]">{String.fromCharCode(65 + choiceIndex)}</span>
                  <span className="pt-1 text-sm font-bold leading-relaxed">{choice}</span>
                </button>
              );
            })}
          </div>
          {picked && <p role="status" className="mt-5 text-sm font-bold text-[hsl(var(--muted-foreground))]">{picked === current.word.definition ? 'Nice. That one is in there.' : 'That’s okay—this is useful information, not a grade.'}</p>}
          <div className="mt-6 flex justify-end">
            <Button onClick={next} disabled={!picked} testId="button-next-break-check">{index === questions.length - 1 ? 'See my result' : 'Next word'} <ArrowRight size={16} /></Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Home({ settings, setSettings, progress, sessions, onPaywall, onOpenStudyRhythm, onRefreshWords }: { settings: StudySettings; setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void; progress: WordProgress[]; sessions: Session[]; onPaywall: () => void; onOpenStudyRhythm: () => void; onRefreshWords: () => void; }) {
  const { user } = useUser();
  const studyMode = getStudyMode(settings);
  const satMode = studyMode === 'sat';
  const expertMode = studyMode === 'expert';
  const mastered = progress.filter(item => item.status === 'mastered').length;
  const familiar = progress.filter(item => item.seenCount > 0).length;
  const studyWords = getStudyWords(settings);
  const nextWords = satMode
    ? studyWords.filter(word => word.difficulty === settings.level)
    : studyWords;
  const levelProgress = (['Foundational', 'Advanced', 'Challenge'] as Level[])
    .map(level => {
      const levelWords = studyWords.filter(word => word.difficulty === level);
      const explored = levelWords.filter(word => progress.some(item => item.wordId === word.id && item.seenCount > 0)).length;
      const masteredInLevel = levelWords.filter(word => progress.some(item => item.wordId === word.id && item.status === 'mastered')).length;
      return {
        level,
        total: levelWords.length,
        explored,
        mastered: masteredInLevel,
        percent: levelWords.length ? Math.round((explored / levelWords.length) * 100) : 0,
      };
    })
    .filter(item => item.total > 0);
  const pathMastered = studyWords.filter(word => progress.some(item => item.wordId === word.id && item.status === 'mastered')).length;
  const pathCoverage = studyWords.length ? Math.round((pathMastered / studyWords.length) * 100) : 0;
  const selectedLevelProgress = levelProgress.find(item => item.level === settings.level);
  const everydayLevelProgress = selectedLevelProgress ?? {
    level: settings.level,
    total: 0,
    explored: 0,
    mastered: 0,
    percent: 0,
  };
  const snapshotLevels = studyMode === 'everyday' ? [everydayLevelProgress] : levelProgress;
  const snapshotCoverage = studyMode === 'everyday' ? everydayLevelProgress.total ? Math.round((everydayLevelProgress.mastered / everydayLevelProgress.total) * 100) : 0 : pathCoverage;
  const satRecallPoints = settings.satRecallPoints ?? 0;
  const satRecallTarget = Math.max(10, studyWords.length * 10);
  const satRecallPercent = Math.min(100, Math.round((satRecallPoints / satRecallTarget) * 100));
  const satRecallWords = Math.min(studyWords.length, Math.floor(satRecallPoints / 10));
  const dueForReview = nextWords.filter(word => {
    const item = progress.find(progressItem => progressItem.wordId === word.id);
    return item ? isReviewDue(item) : false;
  }).length;
  const streak = getStreak(sessions);
  const bestStreak = getBestStreak(sessions);
  const minutesThisWeek = getMinutesThisWeek(sessions);
  const showFirstSessionGuide = progress.length === 0 && sessions.length === 0;
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const [showBreathing, setShowBreathing] = useState(false);
  const [showOrientation, setShowOrientation] = useState(false);
  
  useEffect(() => {
    // Show paywall after first real session if not seen
    if (!HAS_PREMIUM && sessions.length === 1 && !settings.paywallSeen) {
      const timer = setTimeout(() => {
        onPaywall();
        setSettings(s => ({ ...s, paywallSeen: true }));
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [sessions.length, settings.paywallSeen, onPaywall, setSettings]);

  return (
    <div className="paper-grid min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-16">
      <div className="mx-auto max-w-[1120px]">
        {showBreathing && <BreathingReset onClose={() => setShowBreathing(false)} />}
        {showOrientation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="orientation-title" onClick={() => setShowOrientation(false)}>
            <div className="w-full max-w-lg rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl md:p-8" onClick={event => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">A quick orientation</div>
                  <h2 id="orientation-title" className="mt-1 font-display text-3xl tracking-[-.04em]">How Wordwell works</h2>
                </div>
                <button type="button" onClick={() => setShowOrientation(false)} aria-label="Close orientation" className="rounded-xl p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]">
                  <X size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">You only need one small step today. The rest of the app supports that habit.</p>
              <div className="mt-6 space-y-3">
                <div className="flex gap-3 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-extrabold text-[hsl(var(--primary-foreground))]">1</span>
                  <div><div className="text-sm font-extrabold">Choose a path</div><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Everyday builds useful vocabulary, SAT focuses on exam words, and Expert is for uncommon challenges.</p></div>
                </div>
                <div className="flex gap-3 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-extrabold text-[hsl(var(--primary-foreground))]">2</span>
                  <div><div className="text-sm font-extrabold">Learn a small set</div><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Learn gives you a guided lesson with context, recall, and a confidence check for each word.</p></div>
                </div>
                <div className="flex gap-3 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-extrabold text-[hsl(var(--primary-foreground))]">3</span>
                  <div><div className="text-sm font-extrabold">Review when ready</div><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Quick is a fast review. Quiz tests what you remember after you have met some words.</p></div>
                </div>
              </div>
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowOrientation(false)} className="min-h-11 rounded-xl px-4 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]">Keep exploring</button>
                <Link href="/learn" onClick={() => setShowOrientation(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-extrabold text-[hsl(var(--primary-foreground))] no-underline">Start a guided lesson <ArrowRight size={15} /></Link>
              </div>
            </div>
          </div>
        )}
        {!settings.focusProfile && (
          <div className="mb-10 animate-in-up">
            <FocusCheck settings={settings} setSettings={setSettings} />
          </div>
        )}
        
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="animate-in-up">
            <div className="mb-3 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
              <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> {todayLabel}
              <span className="rounded-full bg-[hsl(var(--primary)/.12)] px-2 py-1 text-[9px] tracking-[.12em]">{satMode ? 'SAT MODE · TEST TAKERS' : expertMode ? 'EXPERT MODE · AMERICAN ENGLISH' : 'EVERYDAY VOCABULARY'}</span>
            </div>
            <h1 className="max-w-[680px] font-display text-5xl leading-[.93] tracking-[-.05em] md:text-7xl">
              {user?.firstName ? <>Good to see you, {user.firstName}.<br /><em className="text-[hsl(var(--primary))]">Let’s take one useful step.</em></> : <>A few good words<br /><em className="text-[hsl(var(--primary))]">are plenty for today.</em></>}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              {satMode
                ? 'You do not need to catch up all at once. Meet a small set of SAT words, practice them in context, and let the rest wait.'
                : expertMode
                  ? 'Work through uncommon, demanding words with clear context and direct links to Merriam-Webster for deeper reference.'
                : 'You do not need to learn everything today. Meet a small set of useful words, practice them in context, and let the rest wait.'}
            </p>
            <div className="mt-5 flex max-w-md items-start gap-3 rounded-2xl border border-[hsl(var(--primary)/.18)] bg-[hsl(var(--primary)/.05)] px-4 py-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
              <Info size={16} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />
              <p><strong className="text-[hsl(var(--foreground))]">A friendly reminder:</strong> You’re not behind. One small session counts, and taking a day off does not erase your progress.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="animate-in-up delay-1 flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.8)] px-4 py-3 shadow-soft">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))]">
                <Flame size={21} fill="currentColor" />
              </div>
              <div>
                <div className="text-xl font-extrabold leading-none">{streak} {streak === 1 ? 'day' : 'days'}</div>
                <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Days you showed up</div>
              </div>
            </div>
             <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
               <button type="button" onClick={() => setShowOrientation(true)} className="animate-in-up delay-1 flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-4 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]" data-testid="button-home-orientation">
                 <CircleHelp size={14} /> Orientation
               </button>
               <button type="button" onClick={() => setShowBreathing(true)} className="animate-in-up delay-1 flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--secondary)/.5)] px-4 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]" data-testid="button-home-breathing">
                 <Wind size={14} /> Take a breath
               </button>
             </div>
          </div>
        </div>
        
         <div className="mb-7">
           <section className={`rounded-[24px] border p-4 shadow-soft md:p-5 ${satMode || expertMode ? 'border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.08)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/.8)]'}`} aria-labelledby="home-study-path-title">
             <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
               <div className="flex min-w-0 items-center gap-3">
                 <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${expertMode ? 'bg-[hsl(var(--destructive)/.14)] text-[hsl(var(--destructive))]' : satMode ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>
                   <Target size={18} />
                 </div>
                 <div className="min-w-0">
                   <div id="home-study-path-title" className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Study path</div>
                   <div className="mt-0.5 truncate text-sm font-extrabold">{satMode ? 'SAT Mode · exam-focused words' : expertMode ? 'Expert Mode · uncommon American English' : 'Everyday vocabulary'}</div>
                 </div>
               </div>
               <div className="grid w-full grid-cols-3 rounded-xl bg-[hsl(var(--secondary)/.7)] p-1 lg:w-auto lg:min-w-[360px]">
                 {([
                   ['everyday', 'Everyday'],
                   ['sat', 'SAT'],
                   ['expert', 'Expert'],
                 ] as const).map(([mode, label]) => (
                   <button type="button" key={mode} onClick={() => setSettings(selectStudyMode(mode))} aria-pressed={studyMode === mode} data-testid={`button-home-${mode}-mode`} className={`rounded-lg px-3 py-2.5 text-xs font-extrabold transition-colors ${studyMode === mode ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))]'}`}>{label}</button>
                 ))}
               </div>
             </div>
             <div className="mt-4 flex flex-col gap-3 border-t border-[hsl(var(--border)/.7)] pt-4 sm:flex-row sm:items-center sm:justify-between">
               {expertMode ? (
                 <div className="flex items-center gap-2 text-xs">
                   <Sparkles size={15} className="text-[hsl(var(--accent-foreground))]" />
                   <span className="font-extrabold">Challenge level</span>
                   <span className="text-[hsl(var(--muted-foreground))]">Uncommon, demanding vocabulary</span>
                 </div>
               ) : (
                 <div>
                   <div className="text-xs font-extrabold">{satMode ? 'SAT difficulty' : 'Everyday level'}</div>
                   <div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">Adjust how demanding your next words feel.</div>
                 </div>
               )}
                {!expertMode && <LevelSelect settings={settings} setSettings={setSettings} onPaywall={onPaywall} onRefresh={onRefreshWords} />}
             </div>
           </section>
         </div>
          {showFirstSessionGuide && (
            <section className="mb-7 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.88)] p-5 shadow-soft md:p-6" aria-labelledby="first-session-guide-title">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Start here</div>
                  <h2 id="first-session-guide-title" className="mt-1 font-display text-2xl tracking-[-.03em]">Your first Wordwell session</h2>
                </div>
                <p className="max-w-md text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Choose a path, complete one guided lesson, then use Quick or Quiz when you want extra recall practice.</p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4">
                  <div className="flex items-center gap-2 text-xs font-extrabold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] text-[hsl(var(--primary-foreground))]">1</span> Choose your path</div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">You selected <strong className="text-[hsl(var(--foreground))]">{expertMode ? 'Expert' : satMode ? 'SAT' : 'Everyday'}</strong>. You can switch above at any time.</p>
                </div>
                <Link href="/learn" className="group rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] p-4 no-underline transition-colors hover:bg-[hsl(var(--primary)/.11)]" data-testid="link-first-session-lesson">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[hsl(var(--foreground))]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] text-[hsl(var(--primary-foreground))]">2</span> Start a guided lesson <ArrowRight size={14} className="ml-auto text-[hsl(var(--primary))] transition-transform group-hover:translate-x-0.5" /></div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Meet a small set of words and practice recall before each reveal.</p>
                </Link>
                <div className="rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4">
                  <div className="flex items-center gap-2 text-xs font-extrabold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] text-[hsl(var(--primary-foreground))]">3</span> Review when ready</div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">Quick</strong> is a fast review. <strong className="text-[hsl(var(--foreground))]">Quiz</strong> tests what you remember.</p>
                </div>
              </div>
            </section>
          )}
         <section className="mb-7 overflow-hidden rounded-[26px] border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.07)] p-5 shadow-soft md:p-6" aria-labelledby="home-study-rhythm-title">
           <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
             <div className="flex items-start gap-4">
               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm">
                 <Timer size={22} />
               </div>
               <div>
                 <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Study rhythm</div>
                 <h2 id="home-study-rhythm-title" className="mt-1 font-display text-2xl tracking-[-.03em]">Make space for one focused session.</h2>
                 <p className="mt-2 max-w-xl text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Twenty-five minutes of focus, then five minutes to reset. A steady rhythm is enough.</p>
               </div>
             </div>
             <button type="button" onClick={onOpenStudyRhythm} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-xs font-extrabold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5" data-testid="button-home-study-rhythm">
               <Play size={14} /> Open study rhythm <ArrowRight size={15} />
             </button>
           </div>
         </section>
        <div className="mb-7 flex justify-end">
          <span className="font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">
            {satMode ? `${nextWords.length} SAT words in this path` : expertMode ? `${nextWords.length} expert words · Merriam-Webster references` : `${nextWords.length} everyday words`}
          </span>
        </div>

        {studyMode === 'everyday' && <Link href="/discover" className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.1)] px-5 py-4 no-underline transition-colors hover:bg-[hsl(var(--accent)/.16)]">
          <div>
            <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--accent-foreground)/.75)]">Everyday vocabulary</div>
            <div className="mt-1 text-sm font-bold">Discover one useful word for the rest of your life.</div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-[hsl(var(--accent-foreground))]" />
        </Link>}
        
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
           <div className="animate-in-up delay-1"><StatCard icon={<Flame size={18} />} label="Gentle rhythm" value={`${streak} days`} detail="Your pace, not a deadline" color="coral" /></div>
           <div className="animate-in-up delay-2"><StatCard icon={<Trophy size={18} />} label="Words getting familiar" value={`${mastered}`} detail={`${dueForReview} ready for a check-in · ${familiar} explored`} /></div>
           <div className="animate-in-up delay-3"><StatCard icon={<Clock3 size={18} />} label="Time you gave yourself" value={`${minutesThisWeek} min`} detail="Small moments count" /></div>
        </section>
        
        <section className="grid gap-6 lg:grid-cols-[1.35fr_.85fr]">
          <div className="animate-in-up delay-2 relative overflow-hidden rounded-[26px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-lift md:p-8">
            <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[24px] border-[hsl(var(--accent)/.35)]" />
            <div className="absolute bottom-[-70px] right-[20%] h-44 w-44 rounded-full border-[18px] border-[hsl(var(--primary-foreground)/.08)]" />
            <div className="relative">
              <div className="mb-10 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--primary-foreground)/.72)]">
                   <BookOpen size={14} /> {satMode ? 'SAT prep path' : expertMode ? 'Expert vocabulary path' : 'Everyday path'}
                </div>
                <span className="rounded-full border border-[hsl(var(--primary-foreground)/.24)] px-3 py-1 font-mono-ui text-[10px]">
                  {settings.dailyGoal} words
                </span>
              </div>
              <h2 className="max-w-lg font-display text-4xl leading-none tracking-[-.04em] md:text-5xl">
                Make room for<br /><em className="text-[hsl(var(--accent))]">lucid</em> thinking.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-[hsl(var(--primary-foreground)/.72)]">
                 {dueForReview > 0 ? 'A few familiar words are ready for a gentle check-in. New words can wait.' : `A small set of ${satMode ? 'SAT' : expertMode ? 'expert' : 'everyday'} words, with active recall before every reveal.`}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/learn" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[hsl(var(--card))] px-5 text-sm font-extrabold text-[hsl(var(--foreground))] no-underline transition-transform hover:-translate-y-0.5" data-testid="link-start-lesson">
                   {dueForReview > 0 ? `Check in on ${Math.min(dueForReview, settings.dailyGoal)} words` : 'Start a gentle lesson'} <ArrowRight size={17} />
                </Link>
                <Link href="/quick" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[hsl(var(--primary-foreground)/.3)] bg-transparent px-5 text-sm font-extrabold text-[hsl(var(--primary-foreground))] no-underline transition-colors hover:bg-[hsl(var(--primary-foreground)/.1)]" data-testid="link-quick-mode">
                  <Zap size={17} /> Quick Mode
                </Link>
              </div>
            </div>
          </div>
          
          <div className={`animate-in-up delay-3 rounded-[26px] border p-6 shadow-soft md:p-7 ${satMode ? 'border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{satMode ? 'SAT progress' : 'Progress snapshot'}</div>
                <div className="mt-2 text-lg font-extrabold">{satMode ? 'Your recall ladder' : 'Your word garden'}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl text-[hsl(var(--primary))]">{satMode ? satRecallPercent : snapshotCoverage}%</div>
                <div className="font-mono-ui text-[9px] uppercase text-[hsl(var(--muted-foreground))]">{satMode ? 'recall complete' : studyMode === 'everyday' ? `${settings.level} mastery` : 'mastery coverage'}</div>
              </div>
            </div>
            <div className="mb-7 h-3 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
              <div className={`h-full rounded-full transition-all duration-700 ${satMode ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary))]'}`} style={{ width: `${satMode ? satRecallPercent : snapshotCoverage}%` }} />
            </div>
            {satMode && <div className="mb-7 flex items-center justify-between gap-3 text-[10px] text-[hsl(var(--muted-foreground))]"><span>{satRecallWords} / {studyWords.length} words through the SAT recall sequence</span><span className="font-mono-ui">{satRecallPoints} pts</span></div>}
            <div className="space-y-4">
              {snapshotLevels.map(({ level, total, explored, mastered: masteredInLevel, percent }, index) => {
                return (
                  <div key={level}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-[hsl(var(--primary))]' : index === 1 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--chart-3))]'}`} />
                      <span className="flex-1 text-xs font-bold">{level}</span>
                      <span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{explored} / {total} explored</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                      <div className={`h-full rounded-full transition-all duration-700 ${index === 0 ? 'bg-[hsl(var(--primary))]' : index === 1 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--chart-3))]'}`} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{total ? `${masteredInLevel} mastered · ${percent}% explored` : `No ${studyMode === 'everyday' ? 'Everyday ' : ''}words in this level yet`}</div>
                  </div>
                ); 
              })}
            </div>
            <Link href="/progress" className="mt-8 flex items-center gap-2 text-xs font-extrabold text-[hsl(var(--primary))] no-underline" data-testid="link-see-progress">
              See detailed progress <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* Methodology Note */}
        <section className="mt-12 max-w-2xl animate-in-up delay-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
          <div className="flex gap-4 text-[hsl(var(--muted-foreground))]">
            <Info size={20} className="shrink-0 text-[hsl(var(--primary))]" />
            <p className="text-xs leading-relaxed">
              <strong>Methodology:</strong> Lessons in Wordwell are grounded in proven retention principles—spaced repetition, active recall, morphology, and high-utility context mapping. Everyday examples stay close to real life; SAT Mode adds academic passages and exam-focused practice. We are not affiliated with the College Board.
            </p>
          </div>
        </section>

         <DeveloperSuggestionBox />

      </div>
    </div>
  );
}

type LearnProps = {
  settings: StudySettings;
  setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void;
  progress: WordProgress[];
  setProgress: (value: WordProgress[] | ((current: WordProgress[]) => WordProgress[])) => void;
  setSessions: (value: Session[] | ((current: Session[]) => Session[])) => void;
  bookmarks: string[];
  onToggleBookmark: (wordId: string) => void;
  wordPoolRevision: number;
};

function Learn(props: LearnProps) {
  return getStudyMode(props.settings) === 'sat' ? <SatLearn {...props} /> : <EverydayLearn {...props} />;
}

function SatLearn({ settings, progress, setProgress, setSessions, setSettings, bookmarks, onToggleBookmark, wordPoolRevision }: LearnProps & { setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void }) {
  const [, setLocation] = useLocation();
  const lessonPool = useMemo(() => WORDS.filter(word => word.difficulty === settings.level), [settings.level]);
  const [lessonWords, setLessonWords] = useState(() => getScheduledWords(lessonPool, progress, settings.dailyGoal));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<SatPhase>('preview');
  const [previewSeconds, setPreviewSeconds] = useState(SAT_PREVIEW_SECONDS);
  const [prediction, setPrediction] = useState('');
  const [relationshipAssessment, setRelationshipAssessment] = useState<SatRelationshipAssessment | null>(null);
  const [relationshipChecking, setRelationshipChecking] = useState(false);
  const [relationshipError, setRelationshipError] = useState('');
  const [inventedWord, setInventedWord] = useState('');
  const [traceStarted, setTraceStarted] = useState(false);
  const [traceMode, setTraceMode] = useState<'pointer' | 'keyboard' | null>(null);
  const [traceIndex, setTraceIndex] = useState(-1);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [morphologyOrder, setMorphologyOrder] = useState<string[]>([]);
  const [draggedMorpheme, setDraggedMorpheme] = useState<string | null>(null);
  const [internDraft, setInternDraft] = useState('');
  const [internAssessment, setInternAssessment] = useState<{ accepted: boolean; feedback: string } | null>(null);
  const [internChecking, setInternChecking] = useState(false);
  const [internError, setInternError] = useState('');
  const [satStarted, setSatStarted] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [showBreakCheck, setShowBreakCheck] = useState(false);
   const [showRelationshipGuide, setShowRelationshipGuide] = useState(false);
  const [resting, setResting] = useState(isRestingUntilTomorrow);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [savedLesson] = useState<InterruptedLesson | null>(() => {
    const saved = readInterruptedLesson();
    return saved?.mode === 'sat' && saved.level === settings.level ? saved : null;
  });
  const [showResumePrompt, setShowResumePrompt] = useState(Boolean(savedLesson));
  const current = lessonWords[index];
  const recallContent = current ? getSatRecallContent(current.id) : null;
  const choices = useMemo(() => current ? getSatAnswerChoices(current, WORDS) : [], [current]);
  const traceTokens = useMemo(() => current ? blankTargetWord(current).split(/\s+/) : [], [current]);
  const selectedTrap = selectedChoice && current
    ? selectedChoice === current.word
      ? choices.find(choice => choice !== current.word) ?? current.word
      : selectedChoice
    : '';
  const morphologyReady = Boolean(recallContent && morphologyOrder.length === recallContent.morphemes.length && morphologyOrder.every((id, morphemeIndex) => id === recallContent.morphemes[morphemeIndex]?.id));
  const traceComplete = traceIndex >= traceTokens.length - 1 && traceTokens.length > 0;

  useEffect(() => {
    setLessonWords(getScheduledWords(lessonPool, progress, settings.dailyGoal));
    setIndex(0);
    setPhase('preview');
    setPreviewSeconds(SAT_PREVIEW_SECONDS);
    setPrediction('');
    setRelationshipAssessment(null);
    setRelationshipError('');
    setInventedWord('');
    setSatStarted(Date.now());
  }, [lessonPool, settings.dailyGoal, wordPoolRevision]);

  useEffect(() => {
    if (phase !== 'preview') return undefined;
    const timer = window.setInterval(() => setPreviewSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!recallContent) return;
    const ids = recallContent.morphemes.map(morpheme => morpheme.id);
    if (ids.length > 1) {
      const first = ids[0];
      ids[0] = ids[1];
      ids[1] = first;
    }
    setMorphologyOrder(ids);
  }, [current?.id, recallContent]);

  const resetWordState = () => {
    setPhase('preview');
    setPreviewSeconds(SAT_PREVIEW_SECONDS);
    setPrediction('');
    setRelationshipAssessment(null);
    setRelationshipError('');
    setInventedWord('');
    setTraceStarted(false);
    setTraceMode(null);
    setTraceIndex(-1);
    setSelectedChoice(null);
    setMorphologyOrder([]);
    setDraggedMorpheme(null);
    setInternDraft('');
    setInternAssessment(null);
    setInternError('');
   setShowRelationshipGuide(false);
  };

  const saveCurrentLesson = useCallback(() => {
    if (!current || completed || resting) return;
    writeInterruptedLesson({
      mode: 'sat',
      level: settings.level,
      wordIds: lessonWords.map(word => word.id),
      index,
      savedAt: new Date().toISOString(),
      sat: {
        phase,
        previewSeconds,
        prediction,
        inventedWord,
        traceStarted,
        traceMode,
        traceIndex,
        selectedChoice,
        morphologyOrder,
        internDraft,
      },
    });
  }, [completed, current, index, inventedWord, internDraft, lessonWords, morphologyOrder, phase, prediction, previewSeconds, resting, selectedChoice, settings.level, traceIndex, traceMode, traceStarted]);

  const resumeSavedLesson = () => {
    if (!savedLesson || savedLesson.mode !== 'sat') return;
    const restoredWords = restoreLessonWords(lessonPool, savedLesson.wordIds);
    if (!restoredWords) {
      clearInterruptedLesson();
      setShowResumePrompt(false);
      return;
    }
    const draft = savedLesson.sat;
    setLessonWords(restoredWords);
    setIndex(Math.min(savedLesson.index, restoredWords.length - 1));
    setSatStarted(Date.now());
    setCompleted(false);
    setResting(false);
    if (draft) {
      setPhase(draft.phase);
      setPreviewSeconds(Math.min(draft.previewSeconds, SAT_PREVIEW_SECONDS));
      setPrediction(draft.prediction);
      setInventedWord(draft.inventedWord);
      setTraceStarted(draft.traceStarted);
      setTraceMode(draft.traceMode);
      setTraceIndex(draft.traceIndex);
      setSelectedChoice(draft.selectedChoice);
      setMorphologyOrder(draft.morphologyOrder);
      setInternDraft(draft.internDraft);
    } else {
      resetWordState();
    }
    setInternAssessment(null);
    setInternError('');
    clearInterruptedLesson();
    setShowResumePrompt(false);
  };

  const startFreshLesson = () => {
    clearInterruptedLesson();
    setShowResumePrompt(false);
  };

  const requestExit = () => {
    if (!current || completed || resting) {
      setLocation('/');
      return;
    }
    setShowExitPrompt(true);
  };

  const saveAndExit = () => {
    saveCurrentLesson();
    setShowExitPrompt(false);
    setLocation('/');
  };

  const leaveWithoutSaving = () => {
    clearInterruptedLesson();
    setShowExitPrompt(false);
    setLocation('/');
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!current || completed || resting) return;
      saveCurrentLesson();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [completed, current, resting, saveCurrentLesson]);

  const completeIntern = () => {
    if (
      !current ||
      phase !== 'intern' ||
      !prediction.trim() ||
      !inventedWord.trim() ||
      !traceComplete ||
      !selectedChoice ||
      !morphologyReady ||
      !internAssessment?.accepted
    ) return;
    const answeredCorrectly = selectedChoice === current.word;
    setProgress(items => recordWordReview(items, current.id, answeredCorrectly ? 5 : 1, answeredCorrectly));
    setSettings(settingsState => ({ ...settingsState, satRecallPoints: (settingsState.satRecallPoints ?? 0) + 10 }));
    if (index === lessonWords.length - 1) {
      clearInterruptedLesson();
      const completedLesson: Session = {
        id: `sat-lesson-${Date.now()}`,
        date: new Date().toISOString(),
        kind: 'lesson',
        mode: 'sat',
        level: settings.level,
        wordsReviewed: lessonWords.length,
        quizScore: 0,
        duration: Math.max(1, Math.round((Date.now() - satStarted) / 60000)),
        wordIds: lessonWords.map(word => word.id),
        phaseCompletion: {
          preview: true,
          invent: true,
          trace: true,
          postmortem: true,
          morphology: true,
          intern: true,
        },
      };
      setSessions(items => [completedLesson, ...items].slice(0, 50));
      setCompleted(true);
      return;
    }
    setIndex(value => value + 1);
    resetWordState();
  };

  const advanceTrace = (nextIndex: number) => {
    if (!traceStarted || nextIndex > traceIndex + 1) return;
    setTraceIndex(value => Math.max(value, nextIndex));
  };

  const beginPointerTrace = () => {
    setTraceMode('pointer');
    setTraceStarted(true);
  };

  const beginKeyboardTrace = () => {
    setTraceMode('keyboard');
    setTraceStarted(true);
    setTraceIndex(-1);
  };

  const moveMorpheme = (morphemeId: string, direction: -1 | 1) => {
    setMorphologyOrder(order => {
      const currentIndex = order.indexOf(morphemeId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return order;
      const next = [...order];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  };

  const dropMorpheme = (targetId: string) => {
    if (!draggedMorpheme || draggedMorpheme === targetId) return;
    setMorphologyOrder(order => {
      const next = [...order];
      const from = next.indexOf(draggedMorpheme);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return order;
      next.splice(from, 1);
      next.splice(to, 0, draggedMorpheme);
      return next;
    });
    setDraggedMorpheme(null);
  };

  const advancePhase = (nextPhase: SatPhase, selectedChoiceForTransition?: string) => {
    const currentPhaseIndex = SAT_PHASE_ORDER.indexOf(phase);
    const nextPhaseIndex = SAT_PHASE_ORDER.indexOf(nextPhase);
    if (nextPhaseIndex !== currentPhaseIndex + 1) return;

    const canAdvance =
      (phase === 'preview' && previewSeconds === 0 && Boolean(prediction.trim())) ||
      (phase === 'invent' && Boolean(inventedWord.trim())) ||
      (phase === 'trace' && traceComplete && Boolean(selectedChoiceForTransition ?? selectedChoice)) ||
      (phase === 'postmortem' && Boolean(selectedChoice)) ||
      (phase === 'morphology' && morphologyReady);

    if (canAdvance) setPhase(nextPhase);
  };

  const assessRelationship = async () => {
    const learnerPrediction = prediction.trim();
    if (!current || phase !== 'preview' || previewSeconds > 0 || !learnerPrediction || relationshipChecking) return;

    setRelationshipChecking(true);
    setRelationshipAssessment(null);
    setRelationshipError('');
    try {
      const response = await fetch('/api/check-sat-relationship', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          word: current.word,
          passage: traceTokens.join(' '),
          prediction: learnerPrediction,
        }),
      });
      if (!response.ok) throw new Error(`Relationship assessment failed (${response.status})`);

      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('correct' in result) ||
        !('submitted' in result) ||
        !('expected' in result) ||
        !('feedback' in result) ||
        typeof result.correct !== 'boolean' ||
        !['Contrast', 'Cause', 'Concession', 'Continuation', 'Unclear'].includes(result.submitted as string) ||
        !['Contrast', 'Cause', 'Concession', 'Continuation'].includes(result.expected as string) ||
        typeof result.feedback !== 'string'
      ) {
        throw new Error('Invalid relationship assessment response');
      }
      setRelationshipAssessment(result as SatRelationshipAssessment);
    } catch {
      setRelationshipError('We could not check that relationship right now. Your prediction is still here—please try again.');
    } finally {
      setRelationshipChecking(false);
    }
  };

  const assessIntern = async () => {
    const explanation = internDraft.trim();
    if (!current || !selectedTrap || !explanation || internChecking) return;
    setInternChecking(true);
    setInternAssessment(null);
    setInternError('');
    try {
      const response = await fetch('/api/check-trap-explanation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          word: current.word,
          definition: current.definition,
          distractor: selectedTrap,
          authoredTrap: recallContent?.trapExplanation ?? '',
          explanation,
        }),
      });
      if (!response.ok) throw new Error(`Intern assessment failed (${response.status})`);
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('accepted' in result) || !('feedback' in result) || typeof result.accepted !== 'boolean' || typeof result.feedback !== 'string') {
        throw new Error('Invalid Intern assessment response');
      }
      setInternAssessment({ accepted: result.accepted, feedback: result.feedback });
    } catch {
      setInternError('The Intern could not check that explanation right now. Your draft is still here—please try again.');
    } finally {
      setInternChecking(false);
    }
  };

  if (resting) return (
    <div className="min-h-[100dvh] px-5 py-12 pb-28 md:px-10 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Clock3 size={37} /></div>
        <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">SAT lesson complete</div>
        <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">Let the words<br /><em className="text-[hsl(var(--primary))]">settle in.</em></h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your completed sequence is saved in History. A little rest helps today’s words settle in.</p>
        <Button className="mt-9" onClick={() => setLocation('/history')} testId="button-sat-history">Open history <ArrowRight size={16} /></Button>
      </div>
    </div>
  );

  if (showBreakCheck) return <QuickRevisionCheck words={lessonWords} satMode onClose={() => setShowBreakCheck(false)} />;

  if (showResumePrompt && savedLesson) {
    return (
      <>
        <div className="min-h-[100dvh]" />
        <ResumeLessonDialog mode="sat" onResume={resumeSavedLesson} onStartFresh={startFreshLesson} />
      </>
    );
  }

  if (completed) return (
    <div className="min-h-[100dvh] px-5 py-12 pb-28 md:px-10 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))] animate-float"><Check size={37} /></div>
        <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">SAT sequence complete</div>
        <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">You did the work.<br /><em className="text-[hsl(var(--primary))]">Let it settle in.</em></h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">You moved through all six retrieval phases for {lessonWords.length} words and earned {lessonWords.length * 10} progression points. Nothing else is required today.</p>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          <Button variant="outline" onClick={() => setShowBreakCheck(true)} testId="button-sat-break-check"><Brain size={16} /> Quick check</Button>
          <Button variant="outline" onClick={() => { clearLearnRest(); setResting(false); setCompleted(false); setLessonWords(getScheduledWords(lessonPool, progress, settings.dailyGoal, lessonWords.map(word => word.id))); setIndex(0); setSatStarted(Date.now()); resetWordState(); }} disabled={lessonPool.length <= lessonWords.length} testId="button-sat-refresh"><RotateCcw size={16} /> New SAT set</Button>
          <Button onClick={() => setLocation('/history')} testId="button-sat-history-complete">View history <ArrowRight size={16} /></Button>
        </div>
        {lessonPool.length <= lessonWords.length && <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">You’ve covered every word in this level for now.</p>}
      </div>
    </div>
  );

  if (!current || !recallContent) return <EmptyState title="No SAT words in this path yet" text="Choose another level to keep your study session moving." />;

  const cluePattern = /despite|although|however|but|yet|while|because|therefore|rather than|without|so that|even though/i;
  const renderPassage = (passage: string) => passage.split(/(\s+)/).map((part, partIndex) => cluePattern.test(part) ? <mark key={`${part}-${partIndex}`} className="rounded bg-[hsl(var(--accent)/.35)] px-1 text-inherit">{part}</mark> : <span key={`${part}-${partIndex}`}>{part}</span>);
  cluePattern.lastIndex = 0;
  const phaseLabels: Array<{ id: SatPhase; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'invent', label: 'Invent' },
    { id: 'trace', label: 'Trace' },
    { id: 'postmortem', label: 'Review' },
    { id: 'morphology', label: 'Map' },
    { id: 'intern', label: 'Teach' },
  ];
  const currentPhaseIndex = phaseLabels.findIndex(item => item.id === phase);

  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-20">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={requestExit} className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]" data-testid="button-exit-sat-lesson"><ChevronLeft size={16} /> Exit lesson</button>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">SAT prep / {settings.level}</div>
       </div>
        </div>
        <div className="mb-6 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--secondary))]"><div className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500" style={{ width: `${((index + currentPhaseIndex / phaseLabels.length) / lessonWords.length) * 100}%` }} /></div>
          <span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{String(index + 1).padStart(2, '0')} / {String(lessonWords.length).padStart(2, '0')}</span>
        </div>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="SAT lesson phases">
          {phaseLabels.map((item, itemIndex) => <span key={item.id} className={`rounded-full px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.1em] ${itemIndex < currentPhaseIndex ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : itemIndex === currentPhaseIndex ? 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--secondary)/.7)] text-[hsl(var(--muted-foreground))]'}`}>{itemIndex + 1}. {item.label}</span>)}
        </div>
         <section className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.42)] p-5" aria-labelledby="sat-learn-instructions-title">
           <div className="flex items-start gap-3">
             <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><Info size={16} /></div>
             <div className="min-w-0">
               <h2 id="sat-learn-instructions-title" className="text-sm font-extrabold">How this lesson works</h2>
               <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Move through the six phases in order. Build the logic first, then confirm the word.</p>
             </div>
           </div>
           <ol className="mt-4 grid gap-3 sm:grid-cols-2">
             {[
               ['Preview', 'Scan the passage and write what relationship the blank needs: contrast, cause, concession, or continuation.'],
               ['Invent', 'Enter a simple placeholder word that could fit. It does not need to be the exact answer.'],
               ['Trace', 'Follow the sentence from left to right. The answer choices unlock after the full trace.'],
               ['Review', 'Study why the correct word fits and why a tempting distractor is a trap.'],
               ['Map', 'Arrange the word’s morphemes into the structure that best connects form to meaning.'],
               ['Teach', 'Explain the trap in your own words. A clear explanation completes the word.'],
             ].map(([label, instruction], instructionIndex) => (
               <li key={label} className={`flex gap-3 rounded-xl p-3 ${instructionIndex === currentPhaseIndex ? 'bg-[hsl(var(--card))] shadow-sm' : ''}`}>
                 <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono-ui text-[10px] font-bold ${instructionIndex === currentPhaseIndex ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>{instructionIndex + 1}</span>
                 <span className="text-xs leading-relaxed"><strong>{label}:</strong> {instruction}</span>
               </li>
             ))}
           </ol>
         </section>
        <div className="mb-8">
          <div className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Word {index + 1} · {phaseLabels[currentPhaseIndex]?.label}</div>
          <h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">
            {phase === 'preview' ? 'Scan the structure.' : phase === 'invent' ? 'Make a prediction of your own.' : phase === 'trace' ? `Trace the logic of ${current.word}.` : phase === 'postmortem' ? 'Read the test-maker’s move.' : phase === 'morphology' ? `Map the anatomy of ${current.word}.` : 'Teach the Intern.'}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
             {phase === 'preview' ? `Study the transition and structure for ${SAT_PREVIEW_SECONDS} seconds. Do not hunt for the word yet.` : phase === 'invent' ? 'Before official choices appear, supply a simple placeholder that would fit the sentence.' : phase === 'trace' ? 'Move across the sentence from left to right. Choices unlock only after the full trace.' : phase === 'postmortem' ? 'A wrong answer is useful data. Name what made the trap convincing.' : phase === 'morphology' ? 'Arrange the word blocks into their most useful structure, then connect that structure to meaning.' : 'Explain the trap in plain English so the idea becomes yours.'}
          </p>
        </div>
        <section className="overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-soft">
          <div className="relative p-7 md:p-12">
            {phase !== 'preview' && phase !== 'invent' && <div className="mb-10 flex items-start justify-between gap-4"><div><div className="font-display text-6xl leading-none tracking-[-.06em] md:text-8xl">{current.word}</div><div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full bg-[hsl(var(--primary)/.08)] px-2.5 py-1 font-mono-ui text-xs text-[hsl(var(--primary))]">IPA {current.pronunciation}</span><span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-[.08em]">{current.partOfSpeech}</span></div><div className="mt-4"><WordActions word={current} isBookmarked={bookmarks.includes(current.id)} onToggleBookmark={() => onToggleBookmark(current.id)} /></div></div><div className="rounded-full bg-[hsl(var(--primary)/.1)] p-3 text-[hsl(var(--primary))]"><Brain size={21} /></div></div>}
            {(phase === 'preview' || phase === 'invent') && <div className="rounded-[24px] bg-[hsl(var(--secondary)/.62)] p-6 md:p-8"><div className="mb-3 flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]"><BookOpen size={14} /> Context under examination</div><p className="font-display text-xl leading-relaxed tracking-[-.01em] md:text-2xl">“{renderPassage(traceTokens.join(' '))}”</p></div>}
             {phase === 'preview' && (
               <div className="mt-6 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] p-5">
                 <div className="flex items-center justify-between gap-3">
                   <div className="flex items-center gap-2 text-sm font-extrabold"><Clock3 size={16} className="text-[hsl(var(--primary))]" /> Strategic preview</div>
                   <span className="font-mono-ui text-xs font-bold text-[hsl(var(--primary))]">{previewSeconds}s</span>
                 </div>
                 <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">What relationship does the sentence demand here—contrast, cause, concession, or continuation?</p>
                 <button type="button" onClick={() => setShowRelationshipGuide(true)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card)/.7)] px-3 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]" data-testid="button-sat-preview-help"><CircleHelp size={14} /> Help</button>
                 <textarea value={prediction} onChange={event => { setPrediction(event.target.value); setRelationshipAssessment(null); setRelationshipError(''); }} rows={2} maxLength={240} placeholder="Write your first structural prediction…" aria-label="Write your structural prediction" className="mt-4 min-h-20 w-full resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[hsl(var(--primary))]" />
                 {relationshipAssessment && (
                   <div role="status" className={`mt-4 rounded-xl p-4 ${relationshipAssessment.correct ? 'bg-[hsl(var(--primary)/.1)]' : 'bg-[hsl(var(--accent)/.13)]'}`}>
                     <div className="flex flex-wrap items-center justify-between gap-2">
                       <div className="text-xs font-extrabold">{relationshipAssessment.correct ? 'Correct relationship' : 'Relationship to revisit'}</div>
                       <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${relationshipAssessment.correct ? 'bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))]'}`}>
                         {relationshipAssessment.correct ? relationshipAssessment.expected : `Expected: ${relationshipAssessment.expected}`}
                       </span>
                     </div>
                     <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                       {relationshipAssessment.submitted !== 'Unclear' && `You identified ${relationshipAssessment.submitted}. `}
                       {relationshipAssessment.feedback}
                     </p>
                   </div>
                 )}
                 {relationshipError && <p role="alert" className="mt-3 text-xs leading-relaxed text-[hsl(var(--destructive))]">{relationshipError}</p>}
                 <div className="mt-3 flex items-center justify-between gap-3">
                   <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{previewSeconds > 0 ? 'Keep scanning until the timer ends.' : relationshipAssessment ? 'Your prediction has been checked.' : 'Check your relationship prediction.'}</span>
                   {relationshipError ? (
                     <div className="flex flex-wrap justify-end gap-2">
                       <Button variant="outline" onClick={() => setPhase('invent')} disabled={!prediction.trim() || previewSeconds > 0 || relationshipChecking} testId="button-skip-sat-relationship-check">Continue without check <ArrowRight size={15} /></Button>
                       <Button onClick={() => void assessRelationship()} disabled={!prediction.trim() || previewSeconds > 0 || relationshipChecking} testId="button-retry-sat-relationship-check">{relationshipChecking ? 'Checking…' : 'Try again'} <RotateCcw size={14} /></Button>
                     </div>
                   ) : (
                     <Button onClick={() => relationshipAssessment ? advancePhase('invent') : void assessRelationship()} disabled={!prediction.trim() || previewSeconds > 0 || relationshipChecking} testId="button-lock-sat-preview">
                       {previewSeconds > 0 ? `Scan ${previewSeconds}s` : relationshipChecking ? 'Checking…' : relationshipAssessment ? 'Continue to Invent' : 'Check relationship'}
                       {previewSeconds > 0 || relationshipChecking ? <Clock3 size={15} /> : <ArrowRight size={15} />}
                     </Button>
                   )}
                 </div>
               </div>
             )}
            {phase === 'invent' && <div className="mt-6 rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.08)] p-5"><div className="flex items-center gap-2 text-sm font-extrabold"><Sparkles size={16} className="text-[hsl(var(--accent-foreground))]" /> Field note</div><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Formal writing often uses a single precise word to turn a broad claim into a defensible one. Invent the simplest word that fits your prediction.</p><input value={inventedWord} onChange={event => setInventedWord(event.target.value)} maxLength={80} placeholder="Your placeholder word…" aria-label="Write a placeholder word" className="mt-4 h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 text-sm outline-none focus:border-[hsl(var(--primary))]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-[hsl(var(--muted-foreground))]">No exact answer is needed yet.</span><Button onClick={() => { advancePhase('trace'); setTraceMode(null); setTraceStarted(false); setTraceIndex(-1); }} disabled={!inventedWord.trim()} testId="button-lock-sat-invention">Reveal and trace <ArrowRight size={15} /></Button></div></div>}
            {phase === 'trace' && <div className="animate-in-up"><div className="rounded-2xl bg-[hsl(var(--secondary)/.62)] p-5"><div className="mb-3 flex items-center justify-between gap-3"><div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">Shadow trace · {traceComplete ? 'complete' : `${Math.max(0, traceIndex + 1)} / ${traceTokens.length} words`}</div>{!traceStarted && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Choose a tracing method</span>}</div><div className="flex flex-wrap gap-x-2 gap-y-1 text-lg leading-relaxed md:text-xl">{traceTokens.map((token, tokenIndex) => { const isClue = cluePattern.test(token); return traceMode === 'keyboard' ? <button key={`${token}-${tokenIndex}`} type="button" onClick={() => advanceTrace(tokenIndex)} disabled={!traceStarted || tokenIndex > traceIndex + 1} className={`rounded px-1 text-left transition-colors ${tokenIndex <= traceIndex ? 'bg-[hsl(var(--accent)/.35)]' : isClue ? 'bg-[hsl(var(--accent)/.2)]' : 'hover:bg-[hsl(var(--card)/.7)] disabled:opacity-50'}`}>{token}</button> : <span key={`${token}-${tokenIndex}`} onPointerDown={() => { beginPointerTrace(); advanceTrace(tokenIndex); }} onPointerEnter={() => advanceTrace(tokenIndex)} className={`rounded px-1 transition-colors ${tokenIndex <= traceIndex ? 'bg-[hsl(var(--accent)/.35)]' : isClue ? 'bg-[hsl(var(--accent)/.2)]' : ''}`}>{token}</span>; })}</div></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={beginPointerTrace} disabled={traceComplete} testId="button-start-pointer-trace">Start pointer trace</Button><Button variant="quiet" onClick={beginKeyboardTrace} disabled={traceComplete} testId="button-start-keyboard-trace">Trace with keyboard</Button></div><p className="mt-3 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Pointer mode follows your mouse or finger across the words. Keyboard mode advances one word at a time and remains available for switch, screen reader, and touch users.</p><div className="mt-6 grid gap-3">{choices.map((choice, choiceIndex) => <button key={choice} type="button" onClick={() => { if (traceComplete) { setSelectedChoice(choice); advancePhase('postmortem', choice); } }} disabled={!traceComplete} className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${traceComplete ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.6)]' : 'cursor-not-allowed border-[hsl(var(--border))] bg-[hsl(var(--background)/.45)] opacity-50'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] font-mono-ui text-[11px]">{String.fromCharCode(65 + choiceIndex)}</span><span className="pt-1 text-sm font-bold">{choice}</span></button>)}</div></div>}
            {phase === 'postmortem' && selectedChoice && <div className="animate-in-up"><div className={`rounded-2xl p-5 ${selectedChoice === current.word ? 'bg-[hsl(var(--primary)/.1)]' : 'bg-[hsl(var(--accent)/.13)]'}`}><div className="flex items-center gap-2 text-sm font-extrabold">{selectedChoice === current.word ? <><Check size={17} className="text-[hsl(var(--primary))]" /> Strong choice.</> : <><Sparkles size={17} className="text-[hsl(var(--accent-foreground))]" /> The trap was plausible.</>}<span className="ml-auto font-mono-ui text-[10px] uppercase tracking-[.1em]">{selectedChoice === current.word ? 'Correct' : 'Review'}</span></div><p className="mt-3 text-sm leading-relaxed">{selectedChoice === current.word ? `${current.word} matches the passage’s structure and precision.` : `${selectedChoice} was tempting because it belongs to the same formal vocabulary neighborhood.`}</p><p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{recallContent.trapExplanation}</p></div><div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.55)] p-5"><div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">The exact clue</div><p className="mt-2 text-lg leading-relaxed">{renderPassage(traceTokens.join(' '))}</p></div><div className="mt-6 flex justify-end"><Button onClick={() => advancePhase('morphology')} testId="button-continue-sat-mortem">Map the word <ArrowRight size={16} /></Button></div></div>}
            {phase === 'morphology' && <div className="animate-in-up"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-5"><div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">Structure formula</div><div className="mt-4 flex min-h-16 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-3">{morphologyOrder.map(morphemeId => { const morpheme = recallContent.morphemes.find(item => item.id === morphemeId)!; return <div key={morpheme.id} draggable onDragStart={() => setDraggedMorpheme(morpheme.id)} onDragOver={event => event.preventDefault()} onDrop={() => dropMorpheme(morpheme.id)} className="flex items-center gap-1 rounded-xl bg-[hsl(var(--primary)/.12)] px-3 py-2 text-sm font-extrabold text-[hsl(var(--primary))]"><span>{morpheme.label}</span><button type="button" onClick={() => moveMorpheme(morpheme.id, -1)} aria-label={`Move ${morpheme.label} left`} className="rounded px-1 text-xs hover:bg-[hsl(var(--primary)/.15)]">←</button><button type="button" onClick={() => moveMorpheme(morpheme.id, 1)} aria-label={`Move ${morpheme.label} right`} className="rounded px-1 text-xs hover:bg-[hsl(var(--primary)/.15)]">→</button></div>; })}</div><div className="mt-4 flex flex-wrap gap-2">{recallContent.morphemes.map(morpheme => <span key={morpheme.id} className={`rounded-full px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.1em] ${morphologyOrder.includes(morpheme.id) ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]' : 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))]'}`}>{morpheme.kind}: {morpheme.label}</span>)}</div></div><p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{recallContent.morphologyExplanation}</p><div className="mt-5 flex justify-end"><Button onClick={() => advancePhase('intern')} disabled={!morphologyReady} testId="button-complete-sat-morphology">{morphologyReady ? 'Ask the Intern' : 'Arrange the formula'} <ArrowRight size={16} /></Button></div></div>}
            {phase === 'intern' && <div className="animate-in-up"><div className="flex items-start gap-3"><div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><Brain size={17} /></div><div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--secondary)/.6)] px-5 py-4 text-sm leading-relaxed"><strong>The Intern:</strong> I thought <em>{selectedTrap}</em> might work. Can you explain why it is a trap when the target is <strong>{current.word}</strong>?</div></div><textarea value={internDraft} onChange={event => { setInternDraft(event.target.value); setInternAssessment(null); setInternError(''); }} rows={3} maxLength={320} placeholder="Explain the distinction in one clear sentence…" aria-label={`Explain why ${selectedTrap} is a trap`} className="mt-5 min-h-24 w-full resize-none rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[hsl(var(--primary))]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="font-mono-ui text-[9px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{internDraft.length}/320</span><Button onClick={() => void assessIntern()} disabled={!internDraft.trim() || internChecking} testId="button-assess-intern">{internChecking ? 'Checking…' : 'Check explanation'} <ArrowRight size={15} /></Button></div>{internError && <p role="alert" className="mt-3 text-xs text-[hsl(var(--destructive))]">{internError}</p>}{internAssessment && <div role="status" className={`mt-5 rounded-2xl p-5 ${internAssessment.accepted ? 'bg-[hsl(var(--primary)/.1)]' : 'bg-[hsl(var(--accent)/.13)]'}`}><div className="text-sm font-extrabold">{internAssessment.accepted ? 'The Intern understands.' : 'Try the distinction again.'}</div><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{internAssessment.feedback}</p>{internAssessment.accepted && <div className="mt-4 flex justify-end"><Button onClick={completeIntern} testId="button-complete-sat-word">Complete this word <Check size={16} /></Button></div>}</div>}</div>}
          </div>
        </section>
         {showRelationshipGuide && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] px-4 py-6" role="presentation" onClick={() => setShowRelationshipGuide(false)}>
           <section role="dialog" aria-modal="true" aria-labelledby="sat-relationship-guide-title" className="flex max-h-[min(86dvh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl" onClick={event => event.stopPropagation()}>
             <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] p-5 md:p-6">
               <div>
                 <div className="flex items-center gap-2 text-[hsl(var(--primary))]"><CircleHelp size={18} /><span className="font-mono-ui text-[10px] uppercase tracking-[.14em]">SAT structure guide</span></div>
                 <h2 id="sat-relationship-guide-title" className="mt-2 font-display text-3xl tracking-[-.03em]">What can the blank need?</h2>
                 <p className="mt-2 max-w-xl text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Use the transition, surrounding claims, and evidence to predict the relationship before you look for a word.</p>
               </div>
               <button type="button" onClick={() => setShowRelationshipGuide(false)} aria-label="Close relationship guide" className="rounded-xl p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"><X size={18} /></button>
             </div>
             <div className="overflow-y-auto p-5 md:p-6">
               <div className="grid gap-3 md:grid-cols-2">
                 {SAT_RELATIONSHIP_GUIDE.map(relationship => (
                   <article key={relationship.title} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)] p-4">
                     <h3 className="text-sm font-extrabold">{relationship.title}</h3>
                     <p className="mt-2 text-[10px] font-bold uppercase tracking-[.08em] text-[hsl(var(--primary))]">Signals: <span className="font-normal normal-case tracking-normal text-[hsl(var(--muted-foreground))]">{relationship.signals}</span></p>
                     <p className="mt-2 text-xs leading-relaxed">{relationship.prompt}</p>
                   </article>
                 ))}
               </div>
             </div>
            </section>
          </div>}
       </div>
       {showExitPrompt && <LessonExitDialog onSave={saveAndExit} onDiscard={leaveWithoutSaving} onClose={() => setShowExitPrompt(false)} />}
    </div>
  );
}

function EverydayLearn({ settings, progress, setProgress, setSessions, bookmarks, onToggleBookmark, wordPoolRevision }: LearnProps) {
  const [, setLocation] = useLocation();
  const studyMode = getStudyMode(settings);
  const lessonPool = useMemo(
    () => getStudyWords(settings),
    [settings.expertMode, settings.level, settings.satMode],
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [recallAttempted, setRecallAttempted] = useState(false);
  const [recallSkipped, setRecallSkipped] = useState(false);
  const [recallDraft, setRecallDraft] = useState('');
  const [sentenceDraft, setSentenceDraft] = useState('');
  const [sentenceAssessment, setSentenceAssessment] = useState<SentenceAssessment | null>(null);
  const [sentenceChecking, setSentenceChecking] = useState(false);
  const [sentenceError, setSentenceError] = useState('');
  const [started, setStarted] = useState(Date.now());
  const [lessonStarted, setLessonStarted] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [showBreakCheck, setShowBreakCheck] = useState(false);
  const [resting, setResting] = useState(isRestingUntilTomorrow);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [savedLesson] = useState<InterruptedLesson | null>(() => {
    const saved = readInterruptedLesson();
    return saved?.mode === studyMode && saved.level === settings.level ? saved : null;
  });
  const [showResumePrompt, setShowResumePrompt] = useState(Boolean(savedLesson));
  const [lessonWords, setLessonWords] = useState(() => getScheduledWords(lessonPool, progress, settings.dailyGoal));
  const current = lessonWords[index];
  
  useEffect(() => {
    setLessonWords(getScheduledWords(lessonPool, progress, settings.dailyGoal));
    setIndex(0);
    setCompleted(false);
    setLessonStarted(Date.now());
    setRevealed(false);
    setRecallAttempted(false);
    setRecallSkipped(false);
    setRecallDraft('');
    setSentenceDraft('');
    setSentenceAssessment(null);
    setSentenceError('');
  }, [lessonPool, settings.dailyGoal, settings.expertMode, settings.level, settings.satMode, wordPoolRevision]);

  const resetWord = () => {
    setRevealed(false);
    setRecallAttempted(false);
    setRecallSkipped(false);
    setRecallDraft('');
    setSentenceDraft('');
    setSentenceAssessment(null);
    setSentenceError('');
    setStarted(Date.now());
  };

  const saveCurrentLesson = useCallback(() => {
    if (!current || completed || resting) return;
    writeInterruptedLesson({
      mode: studyMode,
      level: settings.level,
      wordIds: lessonWords.map(word => word.id),
      index,
      savedAt: new Date().toISOString(),
      everyday: {
        revealed,
        recallAttempted,
        recallSkipped,
        recallDraft,
        sentenceDraft,
      },
    });
  }, [completed, current, index, lessonWords, recallAttempted, recallDraft, recallSkipped, revealed, resting, sentenceDraft, settings.level, studyMode]);

  const resumeSavedLesson = () => {
    if (!savedLesson || savedLesson.mode !== studyMode) return;
    const restoredWords = restoreLessonWords(lessonPool, savedLesson.wordIds);
    if (!restoredWords) {
      clearInterruptedLesson();
      setShowResumePrompt(false);
      return;
    }
    const draft = savedLesson.everyday;
    setLessonWords(restoredWords);
    setIndex(Math.min(savedLesson.index, restoredWords.length - 1));
    setLessonStarted(Date.now());
    setCompleted(false);
    setResting(false);
    if (draft) {
      setRevealed(draft.revealed);
      setRecallAttempted(draft.recallAttempted);
      setRecallSkipped(draft.recallSkipped);
      setRecallDraft(draft.recallDraft);
      setSentenceDraft(draft.sentenceDraft);
    } else {
      resetWord();
    }
    setSentenceAssessment(null);
    setSentenceError('');
    clearInterruptedLesson();
    setShowResumePrompt(false);
  };

  const startFreshLesson = () => {
    clearInterruptedLesson();
    setShowResumePrompt(false);
  };

  const requestExit = () => {
    if (!current || completed || resting) {
      setLocation('/');
      return;
    }
    setShowExitPrompt(true);
  };

  const saveAndExit = () => {
    saveCurrentLesson();
    setShowExitPrompt(false);
    setLocation('/');
  };

  const leaveWithoutSaving = () => {
    clearInterruptedLesson();
    setShowExitPrompt(false);
    setLocation('/');
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!current || completed || resting) return;
      saveCurrentLesson();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [completed, current, resting, saveCurrentLesson]);

  const advanceAfterReview = () => {
    if (index === lessonWords.length - 1) {
      clearInterruptedLesson();
      const completedLesson: Session = {
        id: `lesson-${Date.now()}`,
        date: new Date().toISOString(),
        kind: 'lesson',
        mode: studyMode,
        level: settings.level,
        wordsReviewed: lessonWords.length,
        quizScore: 0,
        duration: Math.max(1, Math.round((Date.now() - lessonStarted) / 60000)),
        wordIds: lessonWords.map(word => word.id),
      };
      setSessions(items => [completedLesson, ...items].slice(0, 50));
      setCompleted(true);
    } else {
      setIndex(value => value + 1);
      resetWord();
    }
  };

  const finish = (confidence: number) => {
    if (!current || (!recallAttempted && !recallSkipped)) return;
    setProgress(items => recordWordReview(items, current.id, confidence, confidence >= 3));
    advanceAfterReview();
  };

  const skipWord = (choice: 'known' | 'later') => {
    if (!current) return;
    setProgress(items => recordWordReview(
      items,
      current.id,
      choice === 'known' ? 5 : 1,
      choice === 'known',
    ));
    advanceAfterReview();
  };

  const refreshLesson = () => {
    if (lessonPool.length <= lessonWords.length) return;
    clearLearnRest();
    setResting(false);
    setLessonWords(getScheduledWords(lessonPool, progress, settings.dailyGoal, lessonWords.map(word => word.id)));
    setIndex(0);
    setCompleted(false);
    setRevealed(false);
    setRecallAttempted(false);
    setRecallSkipped(false);
    setRecallDraft('');
    setSentenceDraft('');
    setSentenceAssessment(null);
    setSentenceError('');
    setStarted(Date.now());
    setLessonStarted(Date.now());
  };

  const restForToday = () => {
    saveRestUntilTomorrow();
    setResting(true);
    setCompleted(false);
  };

  const assessSentence = async () => {
    const sentence = sentenceDraft.trim();
    if (!current || !sentence || sentenceChecking) return;

    setSentenceChecking(true);
    setSentenceAssessment(null);
    setSentenceError('');
    try {
      const response = await fetch('/api/check-word-usage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          word: current.word,
          partOfSpeech: current.partOfSpeech,
          definition: current.definition,
          sentence,
        }),
      });
      if (!response.ok) throw new Error(`Sentence assessment failed (${response.status})`);

      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('correct' in result) ||
        !('feedback' in result) ||
        !('correction' in result) ||
        !('complexity' in result) ||
        !('grammar' in result) ||
        typeof result.correct !== 'boolean' ||
        typeof result.feedback !== 'string' ||
        (result.correction !== null && typeof result.correction !== 'string') ||
        !result.complexity ||
        typeof result.complexity !== 'object' ||
        !('score' in result.complexity) ||
        !('label' in result.complexity) ||
        !('feedback' in result.complexity) ||
        typeof result.complexity.score !== 'number' ||
        typeof result.complexity.label !== 'string' ||
        typeof result.complexity.feedback !== 'string' ||
        !result.grammar ||
        typeof result.grammar !== 'object' ||
        !('score' in result.grammar) ||
        !('label' in result.grammar) ||
        !('feedback' in result.grammar) ||
        typeof result.grammar.score !== 'number' ||
        typeof result.grammar.label !== 'string' ||
        typeof result.grammar.feedback !== 'string'
      ) {
        throw new Error('Invalid sentence assessment response');
      }
      setSentenceAssessment(result as SentenceAssessment);
    } catch {
      setSentenceError('We could not assess that sentence right now. Your sentence is still here—please try again.');
    } finally {
      setSentenceChecking(false);
    }
  };
  
  if (resting) return (
    <div className="min-h-[100dvh] px-5 py-12 pb-28 md:px-10 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
          <Clock3 size={37} />
        </div>
        <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Lesson complete</div>
        <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">You made space<br /><em className="text-[hsl(var(--primary))]">for the words.</em></h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your next learning set will be ready tomorrow. A little rest helps today’s words settle in.</p>
        <Button className="mt-9" onClick={() => setLocation('/')} testId="button-rest-home">Back to today <ArrowRight size={16} /></Button>
      </div>
    </div>
  );

  if (showBreakCheck) return <QuickRevisionCheck words={lessonWords} satMode={false} onClose={() => setShowBreakCheck(false)} />;

  if (showResumePrompt && savedLesson) {
    return (
      <>
        <div className="min-h-[100dvh]" />
        <ResumeLessonDialog mode={studyMode} onResume={resumeSavedLesson} onStartFresh={startFreshLesson} />
      </>
    );
  }

  if (completed) return (
    <div className="min-h-[100dvh] px-5 py-12 pb-28 md:px-10 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))] animate-float">
          <Check size={37} />
        </div>
        <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">A good stopping point</div>
        <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">You showed up<br /><em className="text-[hsl(var(--primary))]">for yourself today.</em></h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          You worked through {lessonWords.length} words. Let them settle, or take another small set—both are good choices.
        </p>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          <Button variant="outline" onClick={() => setShowBreakCheck(true)} testId="button-break-check"><Brain size={16} /> Quick check</Button>
          <Button variant="outline" onClick={restForToday} testId="button-rest-until-tomorrow">
            <Clock3 size={16} /> Rest for today
          </Button>
          <Button onClick={refreshLesson} disabled={lessonPool.length <= lessonWords.length} testId="button-refresh-words">
            <RotateCcw size={16} /> Refresh for new words
          </Button>
        </div>
        {lessonPool.length <= lessonWords.length && (
          <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">You’ve met every word in this path for now. That’s plenty.</p>
        )}
        <button type="button" onClick={() => setLocation('/quiz')} className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid="button-take-recall-quiz">
          Take the recall quiz <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );

  if (!current) return <EmptyState title="No words in this path yet" text="Choose another level to keep your study session moving." />;
  
  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-20">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-8 flex items-center justify-between">
          <button type="button" onClick={requestExit} className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]" data-testid="button-exit-everyday-lesson"><ChevronLeft size={16} /> Exit lesson</button>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{getStudyMode(settings) === 'expert' ? 'Expert vocabulary' : settings.satMode ? `SAT prep / ${settings.level}` : 'Everyday words'}</div>
        </div>
        <div className="mb-5 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
            <div className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500" style={{ width: `${((index + 1) / lessonWords.length) * 100}%` }} />
          </div>
          <span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{String(index + 1).padStart(2, '0')} / {String(lessonWords.length).padStart(2, '0')}</span>
        </div>
         <div className="mb-8">
           <div className="mb-3 flex flex-wrap items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">
             <span>Word {index + 1} · {current.category}</span>
             <span className="text-[hsl(var(--border))]">/</span>
             <span>{revealed ? 'Study and recall' : 'Meet and predict'}</span>
           </div>
           <h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">{revealed ? 'Build a working memory of it.' : 'Meet a new word.'}</h1>
           <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
             {revealed
               ? 'Connect the meaning to its context, related words, and a memory cue before you choose your confidence.'
               : 'Make a quick guess before revealing the meaning. Retrieval is the first step of the lesson.'}
           </p>
         </div>
        <div className="relative overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-soft">
          <div className="absolute right-5 top-5 h-20 w-20 rounded-full border-[12px] border-[hsl(var(--secondary))]" />
          <div className="relative p-7 md:p-12">
            <div className="mb-14">
              <div>
                <div className="font-display text-6xl leading-none tracking-[-.06em] md:text-8xl">{current.word}</div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[hsl(var(--primary)/.08)] px-2.5 py-1 font-mono-ui text-xs text-[hsl(var(--primary))]" title="International Phonetic Alphabet">IPA {current.pronunciation}</span>
                  <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-[.08em] text-[hsl(var(--secondary-foreground))]">{current.partOfSpeech}</span>
                  <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{current.difficulty}</span>
                </div>
                <div className="mt-4">
                  <WordActions
                    word={current}
                    isBookmarked={bookmarks.includes(current.id)}
                    onToggleBookmark={() => onToggleBookmark(current.id)}
                  />
                </div>
               <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] p-4">
                 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                   <div>
                     <div className="text-xs font-extrabold">Skip word</div>
                     <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Choose a path that matches where this word is today.</p>
                   </div>
                   <div className="grid gap-2 sm:grid-cols-2">
                     <button
                       type="button"
                       onClick={() => skipWord('known')}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] px-3 text-[11px] font-extrabold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary)/.12)] active:scale-[.98] sm:text-[10px]"
                       data-testid="button-skip-known"
                     >
                         <Brain size={25} className="h-[23px] w-[23px] sm:h-[25px] sm:w-[25px]" /> <b> Well known </b>
                     </button>
                     <button
                       type="button"
                       onClick={() => skipWord('later')}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-[11px] font-extrabold text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--accent)/.6)] hover:bg-[hsl(var(--accent)/.08)] active:scale-[.98] sm:text-[10px]"
                       data-testid="button-skip-later"
                     >
                       <Clock3 size={14} /> Learn later
                     </button>
                   </div>
                 </div>
               </div>
              </div>
            </div>
            {!revealed ? (
              <div className="rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] p-5">
                <div className="flex items-center gap-2 text-sm font-extrabold"><Brain size={16} className="text-[hsl(var(--primary))]" /> Recall before reveal</div>
                <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{current.activeRecallPrompt}</p>
                <textarea
                  value={recallDraft}
                  onChange={event => {
                    setRecallDraft(event.target.value);
                    setRecallAttempted(false);
                  }}
                  rows={2}
                  maxLength={240}
                  placeholder="Write what you remember or predict…"
                  aria-label={`Recall the meaning of ${current.word}`}
                  className="mt-4 min-h-20 w-full resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-[hsl(var(--primary))]"
                />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{recallDraft.length}/240 · A genuine attempt is enough.</span>
                   {!recallAttempted ? (
                     <div className="flex flex-wrap justify-end gap-2">
                       <Button
                         onClick={() => setRecallAttempted(true)}
                         disabled={!recallDraft.trim()}
                         testId="button-lock-recall"
                       >
                         Lock in my recall <Check size={15} />
                       </Button>
                       <Button
                         variant="outline"
                         onClick={() => {
                           setRecallSkipped(true);
                           setRevealed(true);
                           setStarted(Date.now());
                         }}
                         testId="button-reveal-without-recall"
                       >
                         Reveal word <ArrowRight size={15} />
                       </Button>
                     </div>
                  ) : (
                    <Button onClick={() => { setRevealed(true); setStarted(Date.now()); }} testId="button-reveal">
                      Reveal and compare <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-in-up">
                <div className="border-l-2 border-[hsl(var(--accent))] pl-5">
                  <div className="mb-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Definition</div>
                  <p className="text-lg font-bold leading-relaxed">{current.definition}</p>
                </div>
                <div className="mt-8 rounded-2xl bg-[hsl(var(--secondary)/.62)] p-5">
                  <div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]"><Sparkles size={13} /> In context</div>
                  <p className="font-display text-xl leading-relaxed tracking-[-.01em]">“{current.expandedSentence}”</p>
                </div>
                 <GeneratedScenario word={current} />
                 {(current.synonyms.length > 0 || current.antonyms.length > 0) && (
                   <div className="mt-8 grid gap-4 sm:grid-cols-2">
                     {current.synonyms.length > 0 && (
                       <div className="rounded-2xl border border-[hsl(var(--border))] p-5">
                         <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Synonyms</div>
                         <div className="mt-2 flex flex-wrap gap-2">
                           {current.synonyms.map(item => (
                             <span key={item} className="rounded-full bg-[hsl(var(--primary)/.09)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--primary))]">{item}</span>
                           ))}
                         </div>
                       </div>
                     )}
                     {current.antonyms.length > 0 && (
                       <div className="rounded-2xl border border-[hsl(var(--border))] p-5">
                         <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Antonyms</div>
                         <div className="mt-2 flex flex-wrap gap-2">
                           {current.antonyms.map(item => (
                             <span key={item} className="rounded-full bg-[hsl(var(--accent)/.13)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--accent-foreground))]">{item}</span>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}
                 <div className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--primary)/.04)] p-5">
                   <div className="mb-4 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">
                     <BookOpen size={14} /> Word toolkit
                   </div>
                   <div className="grid gap-4 text-sm sm:grid-cols-3">
                     <div>
                       <div className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Roots</div>
                       <p className="mt-1 leading-relaxed">{current.etymology}</p>
                     </div>
                     <div>
                       <div className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Word family</div>
                       <p className="mt-1 leading-relaxed">{current.wordFamily}</p>
                     </div>
                     <div>
                       <div className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Memory cue</div>
                       <p className="mt-1 leading-relaxed">{current.memoryCue}</p>
                     </div>
                   </div>
                 </div>
                  <div className="mt-8 overflow-hidden rounded-2xl border border-[hsl(var(--border))]">
                    <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.5)] px-5 py-4">
                      <div className="flex items-center gap-2 font-mono-ui text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">
                        <Sparkles size={14} /> Sentence assessor
                      </div>
                      <p className="mt-2 max-w-xl text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                        Write a sentence using <strong className="text-[hsl(var(--foreground))]">{current.word}</strong>. I’ll check whether you used it effectively and rate both its complexity and grammar.
                      </p>
                    </div>
                    <div className="space-y-3 p-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]">
                          <Brain size={14} />
                        </div>
                        <div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--secondary)/.6)] px-4 py-3 text-xs leading-relaxed">
                          Show me how you would use this word in real life.
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <textarea
                          value={sentenceDraft}
                          onChange={event => {
                            setSentenceDraft(event.target.value);
                            setSentenceAssessment(null);
                            setSentenceError('');
                          }}
                          onKeyDown={event => {
                            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                              event.preventDefault();
                              void assessSentence();
                            }
                          }}
                          rows={3}
                          maxLength={300}
                          placeholder={`Write a sentence with “${current.word}”…`}
                          aria-label={`Write a sentence using ${current.word}`}
                          className="min-h-20 min-w-0 flex-1 resize-none rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-[hsl(var(--primary))]"
                        />
                        <button
                          type="button"
                          onClick={() => void assessSentence()}
                          disabled={!sentenceDraft.trim() || sentenceChecking}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 text-xs font-extrabold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {sentenceChecking ? 'Checking…' : 'Assess'}
                          {!sentenceChecking && <ArrowRight size={14} />}
                        </button>
                      </div>
                      <div className="flex justify-between gap-3 font-mono-ui text-[9px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">
                        <span>Ctrl/⌘ + Enter to assess</span>
                        <span>{sentenceDraft.length}/300</span>
                      </div>
                      {sentenceError && <p role="alert" className="text-xs leading-relaxed text-[hsl(var(--destructive))]">{sentenceError}</p>}
                      {sentenceAssessment && (
                        <div role="status" className="space-y-4 rounded-2xl bg-[hsl(var(--primary)/.06)] p-4">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-extrabold">
                                {sentenceAssessment.correct ? 'Effective use' : 'Almost there'}
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sentenceAssessment.correct ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.16)] text-[hsl(var(--accent-foreground))]'}`}>
                                {sentenceAssessment.correct ? 'Word used well' : 'Needs a small change'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{sentenceAssessment.feedback}</p>
                            {!sentenceAssessment.correct && sentenceAssessment.correction && (
                              <div className="mt-3 rounded-xl bg-[hsl(var(--card))] p-3 text-xs">
                                <div className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Suggested revision</div>
                                <p className="mt-1 italic leading-relaxed">“{sentenceAssessment.correction}”</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSentenceDraft(sentenceAssessment.correction ?? '');
                                    setSentenceAssessment(null);
                                  }}
                                  className="mt-2 rounded-lg bg-[hsl(var(--secondary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary))]"
                                >
                                  Try this revision
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="border-t border-[hsl(var(--border))] pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-xs font-extrabold">Sentence complexity</div>
                                {!sentenceAssessment.correct && (
                                  <span className="rounded-full bg-[hsl(var(--destructive)/.12)] px-2 py-1 text-[10px] font-bold text-[hsl(var(--destructive))]">
                                    Incorrect usage
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-[hsl(var(--primary))]">{sentenceAssessment.complexity.score}/5 · {sentenceAssessment.complexity.label}</div>
                            </div>
                            <div className="mt-2 flex gap-1" aria-label={`Sentence complexity ${sentenceAssessment.complexity.score} out of 5`}>
                              {Array.from({ length: 5 }, (_, score) => (
                                <div key={score} className={`h-2 flex-1 rounded-full ${score < sentenceAssessment.complexity.score ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`} />
                              ))}
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{sentenceAssessment.complexity.feedback}</p>
                          </div>
                          <div className="border-t border-[hsl(var(--border))] pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-extrabold">Grammar</div>
                              <div className="text-xs font-bold text-[hsl(var(--primary))]">{sentenceAssessment.grammar.score}/5 · {sentenceAssessment.grammar.label}</div>
                            </div>
                            <div className="mt-2 flex gap-1" aria-label={`Sentence grammar ${sentenceAssessment.grammar.score} out of 5`}>
                              {Array.from({ length: 5 }, (_, score) => (
                                <div key={score} className={`h-2 flex-1 rounded-full ${score < sentenceAssessment.grammar.score ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--border))]'}`} />
                              ))}
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{sentenceAssessment.grammar.feedback}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                <div className="mt-8">
                  <div className="rounded-2xl bg-[hsl(var(--accent)/.08)] p-5">
                    <div className="flex items-center gap-2 text-xs font-extrabold"><Brain size={15} className="text-[hsl(var(--primary))]" /> Compare your recall</div>
                    <p className="mt-3 text-sm italic leading-relaxed">“{recallDraft}”</p>
                    <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
                      <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Meaning</div>
                      <p className="mt-1 text-sm font-bold leading-relaxed">{current.definition}</p>
                    </div>
                  </div>
                  <div className="mb-3 mt-6 text-xs font-bold text-[hsl(var(--muted-foreground))]">How well did this one land?</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" onClick={() => finish(1)} className="rounded-xl border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.08)] active:scale-[.98]" data-testid="button-rating-learning">
                      <div className="mb-1 text-sm font-extrabold">Still foggy</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Review tomorrow</div>
                    </button>
                    <button type="button" onClick={() => finish(3)} className="rounded-xl border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)] active:scale-[.98]" data-testid="button-rating-good">
                      <div className="mb-1 text-sm font-extrabold">Getting there</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Review in {getReviewIntervalDays(3)} days</div>
                    </button>
                    <button type="button" onClick={() => finish(5)} className="rounded-xl border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)] active:scale-[.98]" data-testid="button-rating-mastered">
                      <div className="mb-1 text-sm font-extrabold">It’s mine</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Review in {getReviewIntervalDays(5)}+ days</div>
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" onClick={advanceAfterReview} testId="button-next-word">
                      {index === lessonWords.length - 1 ? 'Finish lesson' : 'Next word'} <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
         <div className="mt-5 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>{Math.max(1, Math.round((Date.now() - started) / 1000))} sec with this word</span>
          <span className="flex items-center gap-1"><CircleHelp size={14} /> No pressure, just practice.</span>
        </div>
      </div>
       {showExitPrompt && <LessonExitDialog onSave={saveAndExit} onDiscard={leaveWithoutSaving} onClose={() => setShowExitPrompt(false)} />}
    </div>
  );
}

function Quiz({ settings, setSettings, progress, setProgress, setSessions }: { settings: StudySettings; setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void; progress: WordProgress[]; setProgress: (value: WordProgress[] | ((current: WordProgress[]) => WordProgress[])) => void; setSessions: (value: Session[] | ((current: Session[]) => Session[])) => void }) {
  const [, setLocation] = useLocation();
  const studyMode = getStudyMode(settings);
  const isSatQuiz = studyMode === 'sat';
  const isExpertQuiz = studyMode === 'expert';
  const [bankId, setBankId] = useState<QuizBankId>('daily');
  const [satTier, setSatTier] = useState<SatTier>(1);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  const [quizStarted, setQuizStarted] = useState(Date.now());
  const bankOptions: QuizBankOption[] = isSatQuiz
    ? [
       { id: 'daily', label: 'SAT daily path', description: `${settings.dailyGoal} ${settings.level.toLowerCase()} SAT words · ${settings.dailyGoal * 3} recall checks` },
       { id: 'sat', label: 'Full SAT bank', description: `${WORDS.length} words · ${WORDS.length * 3} recall checks` },
       { id: 'endless', label: 'Unlimited SAT mix', description: 'Fresh words with context, meaning, and usage checks' },
    ]
    : isExpertQuiz ? [
      { id: 'daily', label: 'Expert daily path', description: `${settings.dailyGoal} demanding words` },
      { id: 'expert', label: 'Full Expert bank', description: `${EXPERT_WORDS.length} challenge-level words` },
      { id: 'endless', label: 'Unlimited Expert mix', description: 'Fresh advanced recall rounds with no finish line' },
    ] : [
      { id: 'daily', label: 'Everyday path', description: `${settings.dailyGoal} useful words` },
      { id: 'everyday', label: 'Everyday bank', description: `${EVERYDAY_WORDS.length} words for daily life` },
      { id: 'all', label: 'Full library', description: `${ALL_WORDS.length} SAT + everyday words` },
      { id: 'endless', label: 'Unlimited everyday mix', description: 'Fresh everyday rounds with no finish line' },
    ];

  useEffect(() => {
    const bankDoesNotMatchMode =
      (studyMode === 'sat' && !['daily', 'sat', 'endless'].includes(bankId)) ||
      (studyMode === 'expert' && !['daily', 'expert', 'endless'].includes(bankId)) ||
      (studyMode === 'everyday' && !['daily', 'everyday', 'all', 'endless'].includes(bankId));
    if (bankDoesNotMatchMode) {
      setBankId('daily');
      setRound(0);
      setIndex(0);
      setPicked(null);
      setScore(0);
      setComplete(false);
      setQuizStarted(Date.now());
    }
  }, [bankId, studyMode]);

  const sourceWords = useMemo(() => {
    if (bankId === 'daily') {
      return getStudyWords(settings)
        .filter(word => !isSatQuiz || word.difficulty === settings.level);
    }
    if (bankId === 'sat') return WORDS;
    if (bankId === 'everyday') return EVERYDAY_WORDS;
    if (bankId === 'expert') return EXPERT_WORDS;
    if (bankId === 'all') return studyMode === 'everyday' ? ALL_WORDS : getStudyWords(settings);
    return getStudyWords(settings);
  }, [bankId, isSatQuiz, settings, studyMode]);

  const quizWords = useMemo(() => {
    if (bankId === 'daily') {
      return getScheduledWords(sourceWords, progress, settings.dailyGoal);
    }
    const shuffled = [...sourceWords];
    for (let wordIndex = shuffled.length - 1; wordIndex > 0; wordIndex -= 1) {
      const swapIndex = Math.floor(Math.random() * (wordIndex + 1));
      [shuffled[wordIndex], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[wordIndex]];
    }
    const questionCount = bankId === 'endless'
      ? Math.min(10, shuffled.length)
      : shuffled.length;
    return shuffled.slice(0, questionCount);
  // Keep the current queue stable while answers update progress. A new bank or
  // round rebuilds the queue from the latest spaced-repetition schedule.
  }, [bankId, round, settings.dailyGoal, sourceWords]);

  const quizQuestions = useMemo<QuizQuestion[]>(() => {
    if (!isSatQuiz) {
      return quizWords.map(word => ({ word, kind: 'everyday' }));
    }
    return quizWords.flatMap(word => ([
      { word, kind: 'context' as const },
      { word, kind: 'meaning' as const },
      { word, kind: 'usage' as const },
    ]));
  }, [isSatQuiz, quizWords]);

  const currentQuestion = quizQuestions[index];
  const current = currentQuestion?.word;
  const satContextQuestion = useMemo(() => {
    if (!current || !isSatQuiz || currentQuestion?.kind !== 'context') return null;
    return buildSatContextQuestion(current, Math.floor(index / 3) + round, satTier);
  }, [current, currentQuestion?.kind, index, isSatQuiz, round, satTier]);

  const choices = useMemo(() => {
    if (!current) return [];

    if (isSatQuiz && currentQuestion) {
      if (currentQuestion.kind === 'meaning') return getSatDefinitionChoices(current, WORDS);
      if (currentQuestion.kind === 'usage') return getSatUsageChoices(current, WORDS);
      return getSatAnswerChoices(current, WORDS);
    }

    const choiceWords = bankId === 'all' ? ALL_WORDS : EVERYDAY_WORDS;
    const randomDefinitions = choiceWords
      .filter(word => word.id !== current.id)
      .map(word => word.definition)
      .filter((definition, definitionIndex, definitions) => definitions.indexOf(definition) === definitionIndex);

    for (let definitionIndex = randomDefinitions.length - 1; definitionIndex > 0; definitionIndex -= 1) {
      const swapIndex = Math.floor(Math.random() * (definitionIndex + 1));
      [randomDefinitions[definitionIndex], randomDefinitions[swapIndex]] = [randomDefinitions[swapIndex], randomDefinitions[definitionIndex]];
    }
    const allChoices = [current.definition, ...randomDefinitions.slice(0, 3)];
    for (let choiceIndex = allChoices.length - 1; choiceIndex > 0; choiceIndex -= 1) {
      const swapIndex = Math.floor(Math.random() * (choiceIndex + 1));
      [allChoices[choiceIndex], allChoices[swapIndex]] = [allChoices[swapIndex], allChoices[choiceIndex]];
    }
    return allChoices;
  }, [bankId, current, currentQuestion?.kind, isSatQuiz]);

  const correctChoice = current
    ? isSatQuiz && currentQuestion?.kind === 'context'
      ? current.word
      : isSatQuiz && currentQuestion?.kind === 'usage'
        ? current.example
        : current.definition
    : '';

  const selectSatTier = (tier: SatTier) => {
    setSatTier(tier);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setComplete(false);
    setQuizStarted(Date.now());
  };

  const selectBank = (nextBankId: QuizBankId) => {
    setBankId(nextBankId);
    setRound(0);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setComplete(false);
    setQuizStarted(Date.now());
  };

  const selectQuizMode = (mode: StudyMode) => {
    setSettings(selectStudyMode(mode));
    setBankId('daily');
    setRound(0);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setComplete(false);
    setQuizStarted(Date.now());
  };
  
  const pick = (choice: string) => { 
    if (picked) return; 
    setPicked(choice); 
    const correct = choice === correctChoice;
    if (correct) {
      setScore(value => value + 1); 
    }
    setProgress(items => {
      const existing = items.find(item => item.wordId === current.id);
      const confidence = correct
        ? Math.min(5, Math.max(3, (existing?.confidence ?? 2) + 1))
        : 1;
      return recordWordReview(items, current.id, confidence, correct);
    });
  };
  
  const next = () => { 
    if (index === quizQuestions.length - 1) {
      const completedQuiz: Session = {
        id: `quiz-${Date.now()}`,
        date: new Date().toISOString(),
        kind: 'quiz',
        mode: studyMode,
        level: settings.level,
        bankId,
        wordsReviewed: quizWords.length,
        questionCount: quizQuestions.length,
        quizScore: score,
        duration: Math.max(1, Math.round((Date.now() - quizStarted) / 60000)),
        wordIds: quizWords.map(word => word.id),
      };
      setSessions(items => [completedQuiz, ...items].slice(0, 50));
      setComplete(true); 
    } else { 
      setIndex(value => value + 1); 
      setPicked(null); 
    } 
  };
  
  if (complete) return (
    <div className="min-h-[100dvh] px-5 py-12 pb-28 md:px-10 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))] animate-float">
          <Trophy size={37} />
        </div>
        <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Session complete</div>
        <h1 className="mt-3 font-display text-5xl tracking-[-.05em]">You showed up.<br /><em className="text-[hsl(var(--primary))]">That counts.</em></h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">A little repetition today gives these words somewhere to live tomorrow.</p>
         <div className="my-9 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
           <div className="font-display text-6xl text-[hsl(var(--primary))]">{score} / {quizQuestions.length}</div>
           <div className="mt-2 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{bankId === 'endless' ? 'round recall score' : 'recall score'}</div>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => { setIndex(0); setScore(0); setPicked(null); setRound(value => bankId === 'endless' ? value + 1 : value); setComplete(false); setQuizStarted(Date.now()); }} testId="button-retry-quiz"><RotateCcw size={16} /> {bankId === 'endless' ? 'Keep practicing' : 'Retry quiz'}</Button>
          <Button onClick={() => setLocation('/')} testId="button-continue-home">Back to today <ArrowRight size={16} /></Button>
        </div>
      </div>
    </div>
  );
  
  if (!current) return <EmptyState title="Your first quiz starts after a lesson" text="Complete a guided lesson to meet a few words, then come back here to test what you remember." actionHref="/learn" actionLabel="Start a guided lesson" />;
  
  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-20">
      <div className="mx-auto max-w-[820px]">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/learn" className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] no-underline"><ChevronLeft size={16} /> Back to lesson</Link>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">
            {!isSatQuiz ? 'Recall check' : currentQuestion?.kind === 'context' ? 'SAT passage practice' : currentQuestion?.kind === 'meaning' ? 'SAT meaning check' : 'SAT usage check'}
          </div>
        </div>
        <section className={`mb-5 overflow-hidden rounded-[24px] border p-5 shadow-soft md:p-6 ${isSatQuiz ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`} aria-labelledby="quiz-mode-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isSatQuiz ? 'bg-[hsl(var(--primary-foreground)/.14)]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>
                <Target size={21} />
              </div>
              <div>
                <div id="quiz-mode-title" className={`font-mono-ui text-[10px] uppercase tracking-[.16em] ${isSatQuiz ? 'text-[hsl(var(--primary-foreground)/.72)]' : 'text-[hsl(var(--muted-foreground))]'}`}>Quiz mode</div>
                <h1 className="mt-1 font-display text-3xl tracking-[-.04em]">{isSatQuiz ? 'SAT Mode' : isExpertQuiz ? 'Expert Mode' : 'Everyday Mode'}</h1>
                <p className={`mt-1 max-w-md text-xs leading-relaxed ${isSatQuiz ? 'text-[hsl(var(--primary-foreground)/.76)]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {isSatQuiz ? 'Build durable SAT understanding through context, meaning, and precise usage checks.' : isExpertQuiz ? 'Recall uncommon American English words and verify them with Merriam-Webster.' : 'Strengthen everyday vocabulary by recalling each word’s meaning.'}
                </p>
              </div>
            </div>
            <div className={`grid shrink-0 grid-cols-3 rounded-xl p-1 ${isSatQuiz ? 'bg-[hsl(var(--primary-foreground)/.12)]' : 'bg-[hsl(var(--secondary))]'}`}>
              {(['everyday', 'sat', 'expert'] as StudyMode[]).map(mode => (
                <button key={mode} type="button" onClick={() => selectQuizMode(mode)} aria-pressed={studyMode === mode} data-testid={`button-quiz-mode-${mode}`} className={`rounded-lg px-3 py-2 text-xs font-extrabold capitalize transition-colors ${studyMode === mode ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : isSatQuiz ? 'text-[hsl(var(--primary-foreground)/.72)] hover:bg-[hsl(var(--primary-foreground)/.1)]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card)/.7)]'}`}>{mode}</button>
              ))}
            </div>
          </div>
        </section>
         <section className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] p-4 shadow-soft md:p-5" aria-labelledby="question-bank-title">
           <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
             <div>
               <div id="question-bank-title" className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Question bank</div>
               <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Choose a path or keep generating fresh practice.</p>
             </div>
             {bankId === 'endless' && <span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--accent-foreground))]">No limit</span>}
           </div>
           <div className="mt-4 grid gap-2 sm:grid-cols-2">
             {bankOptions.map(option => (
               <button
                 key={option.id}
                 type="button"
                 aria-pressed={bankId === option.id}
                 onClick={() => selectBank(option.id)}
                 className={`rounded-xl border p-3 text-left transition-colors ${bankId === option.id ? 'border-[hsl(var(--primary)/.55)] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.42)] hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--secondary)/.55)]'}`}
               >
                 <span className="block text-xs font-extrabold">{option.label}</span>
                 <span className="mt-1 block text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">{option.description}</span>
               </button>
             ))}
           </div>
         </section>
          {isSatQuiz && (
            <section className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] p-4 shadow-soft md:p-5" aria-labelledby="sat-tier-title">
              <div>
                <div id="sat-tier-title" className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">SAT context tier</div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Choose how much reasoning the words-in-context passages require.</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {([
                  { tier: 1 as SatTier, label: 'Tier 1 · Direct', description: 'Original short sentence and fill-in-the-blank format.' },
                  { tier: 2 as SatTier, label: 'Tier 2 · Academic', description: '50–150-word passages with explicit structural clues.' },
                  { tier: 3 as SatTier, label: 'Tier 3 · Advanced', description: 'Denser passages, competing interpretations, and tighter distinctions.' },
                ]).map(option => (
                  <button
                    key={option.tier}
                    type="button"
                    aria-pressed={satTier === option.tier}
                    data-testid={`button-sat-tier-${option.tier}`}
                    onClick={() => selectSatTier(option.tier)}
                    className={`rounded-xl border p-3 text-left transition-colors ${satTier === option.tier ? 'border-[hsl(var(--primary)/.55)] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.42)] hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--secondary)/.55)]'}`}
                  >
                    <span className="block text-xs font-extrabold">{option.label}</span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">{option.description}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
         <div className="mb-8 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
             <div className="h-full rounded-full bg-[hsl(var(--accent))] transition-all duration-500" style={{ width: `${((index + 1) / quizQuestions.length) * 100}%` }} />
          </div>
            <span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{bankId === 'endless' && `Round ${round + 1} · `}{index + 1} / {quizQuestions.length}</span>
        </div>
         <div className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">
           {isSatQuiz ? currentQuestion?.kind === 'context' ? 'Words in context' : currentQuestion?.kind === 'meaning' ? 'Meaning check' : 'Precision in use' : 'Meaning under pressure'}
         </div>
         {isSatQuiz && currentQuestion?.kind === 'context' ? (
          <>
             <h2 className="font-display text-4xl tracking-[-.04em] md:text-5xl">{satContextQuestion?.prompt}</h2>
             <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Use the passage’s transitions, contrast, and semantic signals—not an isolated definition.</p>
            <div className="mt-7 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft md:p-8">
               <div className="mb-3 font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{satContextQuestion?.formatLabel}</div>
                <p className="font-display text-xl leading-relaxed tracking-[-.01em] md:text-2xl">“{formatSatPassageForChoices(satContextQuestion?.passage ?? '', choices)}”</p>
            </div>
          </>
         ) : isSatQuiz && currentQuestion?.kind === 'meaning' ? (
           <>
             <h2 className="font-display text-5xl tracking-[-.05em] md:text-7xl">{current.word}<span className="text-[hsl(var(--accent))]">?</span></h2>
             <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Which meaning best captures this word as it is used in formal writing?</p>
           </>
         ) : isSatQuiz && currentQuestion?.kind === 'usage' ? (
           <>
             <h2 className="font-display text-4xl tracking-[-.04em] md:text-5xl">Which sentence uses the word precisely?</h2>
             <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Choose the sentence where the word’s meaning and tone are both correct.</p>
             <div className="mt-7 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft md:p-8">
               <div className="mb-3 font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Target word</div>
               <p className="font-display text-4xl tracking-[-.04em]">{current.word}</p>
             </div>
           </>
        ) : (
          <>
            <h2 className="font-display text-5xl tracking-[-.05em] md:text-7xl">{current.word}<span className="text-[hsl(var(--accent))]">?</span></h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Every choice is a complete definition. Choose the meaning that best fits the word, not the one that looks easiest.</p>
          </>
        )}
        <div className="mt-9 grid gap-3">
          {choices.map((choice, choiceIndex) => { 
            const isCorrect = choice === correctChoice;
            const isPicked = choice === picked; 
            const stateClass = picked ? isCorrect ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : isPicked ? 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/.08)]' : 'border-[hsl(var(--border))] opacity-60' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.6)]'; 
            return (
              <button key={choice} onClick={() => pick(choice)} data-testid={`button-answer-${choiceIndex}`} className={`flex items-start gap-4 rounded-2xl border p-5 text-left shadow-soft transition-all ${stateClass}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] font-mono-ui text-[11px] font-medium">{String.fromCharCode(65 + choiceIndex)}</span>
                <span className="pt-1 text-sm font-bold leading-relaxed">{choice}</span>
                {picked && isCorrect && <Check className="ml-auto mt-1 text-[hsl(var(--primary))]" size={18} />}
                {picked && isPicked && !isCorrect && <X className="ml-auto mt-1 text-[hsl(var(--destructive))]" size={18} />}
              </button>
            ); 
          })}
        </div>
        {picked && (
          <div className={`mt-5 animate-in-up rounded-2xl p-5 ${picked === correctChoice ? 'bg-[hsl(var(--primary)/.1)]' : 'bg-[hsl(var(--accent)/.13)]'}`}>
            <div className="flex items-center gap-2 text-sm font-extrabold">
               {picked === correctChoice ? <><Check size={17} className="text-[hsl(var(--primary))]" /> {isSatQuiz ? 'Strong choice.' : 'Nice recall.'}</> : <><Sparkles size={17} className="text-[hsl(var(--accent-foreground))]" /> {isSatQuiz ? `${current.word} fits best.` : 'Keep this one close.'}</>}
            </div>
             <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{isSatQuiz && currentQuestion?.kind === 'context' ? getSatOptionRationale(current, correctChoice, WORDS) : isSatQuiz && currentQuestion?.kind === 'usage' ? current.definition : isSatQuiz ? current.example : current.example}</p>
             {isSatQuiz && currentQuestion?.kind === 'context' && (
               <div className="mt-4 space-y-2 border-t border-[hsl(var(--border)/.7)] pt-4">
                 {choices.map((choice, choiceIndex) => (
                   <div key={choice} className="flex gap-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                     <span className="font-mono-ui font-bold text-[hsl(var(--foreground))]">{String.fromCharCode(65 + choiceIndex)}.</span>
                     <span>{getSatOptionRationale(current, choice, WORDS)}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
        <div className="mt-8 flex justify-end">
           {picked && <Button onClick={next} testId="button-next-question">{index === quizQuestions.length - 1 ? 'See results' : 'Next question'} <ChevronRight size={17} /></Button>}
        </div>
      </div>
    </div>
  );
}

function StudyHistory({ sessions }: { sessions: Session[] }) {
  const [filter, setFilter] = useState<'all' | 'lesson' | 'quiz'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sortedSessions = useMemo(
    () => [...sessions].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()),
    [sessions],
  );
  const sessionKind = (session: Session) => session.kind ?? 'quiz';
  const visibleSessions = sortedSessions.filter(session => filter === 'all' || sessionKind(session) === filter);
  const selectedSession = sortedSessions.find(session => session.id === selectedId);
  const selectedWords = (selectedSession?.wordIds ?? [])
    .map(wordId => ALL_WORDS.find(word => word.id === wordId))
    .filter((word): word is Word => Boolean(word));

  if (selectedSession) {
    const kind = sessionKind(selectedSession);
    const questionCount = selectedSession.questionCount ?? selectedSession.wordsReviewed;
    return (
      <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-16">
        <div className="mx-auto max-w-[1000px]">
          <button type="button" onClick={() => setSelectedId(null)} className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]">
            <ChevronLeft size={16} /> Back to history
          </button>
          <PageIntro
            eyebrow={kind === 'lesson' ? 'Past lesson' : 'Past quiz'}
            title={kind === 'lesson' ? 'Revisit the words.' : 'Review the result.'}
            subtitle={new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(selectedSession.date))}
            action={<span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{selectedSession.mode === 'sat' ? 'SAT Mode' : selectedSession.mode === 'everyday' ? 'Everyday' : 'Mode not recorded'}</span>}
          />
          <section className="mb-7 grid gap-3 sm:grid-cols-3">
            <StatCard icon={<BookOpen size={18} />} label="Words" value={String(selectedSession.wordsReviewed)} detail={selectedSession.level ?? 'Mixed level'} />
            <StatCard icon={<Clock3 size={18} />} label="Time" value={`${selectedSession.duration} min`} detail="Session duration" />
            <StatCard
              icon={kind === 'quiz' ? <Brain size={18} /> : <Check size={18} />}
              label={kind === 'quiz' ? 'Quiz result' : 'Completed'}
              value={kind === 'quiz' ? `${selectedSession.quizScore}/${questionCount}` : `${selectedSession.wordsReviewed}/${selectedSession.wordsReviewed}`}
              detail={kind === 'quiz' ? `${questionCount} recall checks` : 'Full lesson set'}
            />
          </section>
          {kind === 'lesson' && selectedSession.phaseCompletion && (
            <section className="mb-7 rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">SAT recall sequence</div>
                  <h2 className="mt-2 font-display text-2xl tracking-[-.03em]">Every phase completed</h2>
                </div>
                <Check className="text-[hsl(var(--primary))]" size={21} />
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {([
                  ['preview', 'Strategic preview'],
                  ['invent', 'Placeholder invention'],
                  ['trace', 'Shadow trace'],
                  ['postmortem', 'Trap review'],
                  ['morphology', 'Word mapping'],
                  ['intern', 'Intern explanation'],
                ] as Array<[SatPhase, string]>).map(([phaseId, label]) => (
                  <div key={phaseId} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${selectedSession.phaseCompletion?.[phaseId] ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary)/.6)] text-[hsl(var(--muted-foreground))]'}`}>
                    <Check size={14} /> {label}
                  </div>
                ))}
              </div>
            </section>
          )}
          {selectedWords.length ? (
            <section className="grid gap-4 md:grid-cols-2">
              {selectedWords.map(word => (
                <article key={word.id} className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-4xl tracking-[-.04em]">{word.word}</h2>
                      <div className="mt-2 font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{word.partOfSpeech} · {word.category}</div>
                    </div>
                    <span className="rounded-full bg-[hsl(var(--primary)/.09)] px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--primary))]">{word.difficulty}</span>
                  </div>
                  <p className="mt-5 text-sm font-bold leading-relaxed">{word.definition}</p>
                  <p className="mt-4 border-l-2 border-[hsl(var(--accent))] pl-4 text-sm italic leading-relaxed text-[hsl(var(--muted-foreground))]">“{word.expandedSentence}”</p>
                   <GeneratedScenario word={word} compact />
                </article>
              ))}
            </section>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
              <Clock3 className="mx-auto text-[hsl(var(--primary))]" size={24} />
              <h2 className="mt-4 font-display text-2xl">Summary preserved</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">This session was completed before word-level history was available, so its date, duration, and score remain accessible without the original word list.</p>
            </div>
          )}
          <div className="mt-8 flex justify-end">
            <Link href={kind === 'quiz' ? '/quiz' : '/learn'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] no-underline">
              {kind === 'quiz' ? 'Start another quiz' : 'Start another lesson'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-16">
      <div className="mx-auto max-w-[1000px]">
        <PageIntro eyebrow="Your study archive" title="Lesson and quiz history" subtitle="Open any completed session to revisit its words, context, and result." />
        <div className="mb-7 grid grid-cols-3 rounded-xl bg-[hsl(var(--secondary)/.7)] p-1 sm:w-fit">
          {(['all', 'lesson', 'quiz'] as const).map(option => (
            <button key={option} type="button" onClick={() => setFilter(option)} aria-pressed={filter === option} className={`rounded-lg px-4 py-2 text-xs font-extrabold capitalize transition-colors ${filter === option ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>
              {option === 'all' ? 'All sessions' : `${option}s`}
            </button>
          ))}
        </div>
        {visibleSessions.length ? (
          <div className="space-y-3">
            {visibleSessions.map(session => {
              const kind = sessionKind(session);
              const questionCount = session.questionCount ?? session.wordsReviewed;
              return (
                <button key={session.id} type="button" onClick={() => setSelectedId(session.id)} className="flex w-full items-center gap-4 rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.45)]">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${kind === 'quiz' ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.16)] text-[hsl(var(--accent-foreground))]'}`}>
                    {kind === 'quiz' ? <Brain size={20} /> : <BookOpen size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold">{kind === 'quiz' ? 'Quiz' : 'Lesson'}</span>
                      <span className="rounded-full bg-[hsl(var(--secondary))] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{session.mode === 'sat' ? 'SAT' : session.mode === 'expert' ? 'Expert' : session.mode === 'everyday' ? 'Everyday' : 'Legacy'}</span>
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {session.wordsReviewed} words · {session.duration} min
                    </div>
                  </div>
                  {kind === 'quiz' && <span className="rounded-xl bg-[hsl(var(--primary)/.1)] px-3 py-2 font-mono-ui text-xs font-bold text-[hsl(var(--primary))]">{session.quizScore}/{questionCount}</span>}
                  <ChevronRight size={18} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-14 text-center">
            <Clock3 className="mx-auto text-[hsl(var(--primary))]" size={28} />
            <h2 className="mt-4 font-display text-3xl">No {filter === 'all' ? 'sessions' : `${filter}s`} yet.</h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Completed lessons and quizzes will be saved here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeveloperSuggestionBox() {
  const [suggestion, setSuggestion] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'duplicate' | 'short' | 'error'>('idle');

  const submitSuggestion = () => {
    const text = suggestion.trim().replace(/\s+/g, ' ');
    if (text.length < 8) {
      setStatus('short');
      return;
    }

    const key = normalizeSuggestion(text);
    let storedSuggestions: DeveloperSuggestion[] = [];
    try {
      const stored = localStorage.getItem(DEVELOPER_SUGGESTIONS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        storedSuggestions = parsed.filter(item =>
          item &&
          typeof item.key === 'string' &&
          typeof item.text === 'string' &&
          typeof item.submittedAt === 'string',
        );
      }
    } catch {
      storedSuggestions = [];
    }

    if (storedSuggestions.some(item => item.key === key)) {
      setSuggestion('');
      setStatus('duplicate');
      return;
    }

    try {
      localStorage.setItem(
        DEVELOPER_SUGGESTIONS_KEY,
        JSON.stringify([...storedSuggestions, { key, text, submittedAt: new Date().toISOString() }].slice(-100)),
      );
      setSuggestion('');
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="mt-6 rounded-[26px] border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.05)] p-6 shadow-soft md:p-8" aria-labelledby="developer-suggestion-title">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]"><Sparkles size={14} /> Help shape Wordwell</div>
        <h2 id="developer-suggestion-title" className="mt-2 font-display text-3xl tracking-[-.04em]">Have an idea for the developer?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Tell us what would make studying clearer, kinder, or more useful.</p>
        <form className="mt-5" onSubmit={event => { event.preventDefault(); submitSuggestion(); }}>
          <textarea
            value={suggestion}
            onChange={event => { setSuggestion(event.target.value); if (status !== 'idle') setStatus('idle'); }}
            rows={3}
            maxLength={500}
            placeholder="What would you like to see next?"
            aria-label="Suggestion for the developer"
            className="min-h-24 w-full resize-y rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[hsl(var(--primary))]"
            data-testid="textarea-developer-suggestion"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{suggestion.length}/500 · One clear idea is easiest to act on.</span>
            <Button type="submit" disabled={suggestion.trim().length < 8} testId="button-submit-developer-suggestion"><Sparkles size={15} /> Send suggestion</Button>
          </div>
        </form>
        {status === 'saved' && <p className="mt-4 text-sm font-bold text-[hsl(var(--primary))]" role="status">Thank you for the suggestion. It has been captured for the developer.</p>}
        {status === 'duplicate' && <p className="mt-4 text-sm font-bold text-[hsl(var(--primary))]" role="status">Thank you for sharing your idea.</p>}
        {status === 'short' && <p className="mt-4 text-sm font-bold text-[hsl(var(--accent-foreground))]" role="alert">Please share a little more so the developer can understand the idea.</p>}
        {status === 'error' && <p className="mt-4 text-sm font-bold text-[hsl(var(--destructive))]" role="alert">This suggestion could not be saved on this device. Please try again.</p>}
      </div>
    </section>
  );
}

function Progress({ progress, sessions, settings, setSettings, onPaywall, onRefreshWords }: { progress: WordProgress[]; sessions: Session[]; settings: StudySettings; setSettings: (value: StudySettings | ((current: StudySettings) => StudySettings)) => void; onPaywall: () => void; onRefreshWords: () => void }) {
  const [goal, setGoal] = useState(String(settings.dailyGoal));
  const [showSurvey, setShowSurvey] = useState(false);
  const [, setLocation] = useLocation();
  const studyMode = getStudyMode(settings);
  const studyWords = getStudyWords(settings);
  const progressWords = studyMode === 'everyday'
    ? studyWords.filter(word => word.difficulty === settings.level)
    : studyWords;
  const masteredWords = progressWords.filter(word => progress.find(item => item.wordId === word.id)?.status === 'mastered');
  const dueWords = progressWords.filter(word => {
    const item = progress.find(progressItem => progressItem.wordId === word.id);
    return item ? isReviewDue(item) : false;
  });
  const progressLevels: Level[] = studyMode === 'sat'
    ? ['Foundational', 'Advanced', 'Challenge']
    : [settings.level];
  
  const coverage = (level: Level) => { 
    const wordsInLevel = studyMode === 'everyday'
      ? progressWords
      : studyWords.filter(word => word.difficulty === level);
    const seen = wordsInLevel.filter(word => progress.some(item => item.wordId === word.id && item.seenCount > 0)).length;
    return wordsInLevel.length ? Math.round((seen / wordsInLevel.length) * 100) : 0;
  };
  
  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-16">
      <div className="mx-auto max-w-[1120px]">
       <PageIntro eyebrow="A wider view" title="Your progress" subtitle={studyMode === 'everyday' ? 'Notice what’s becoming familiar. Everyday levels track practical vocabulary; Expert Mode is a separate challenge bank for uncommon words.' : studyMode === 'expert' ? 'Notice what’s becoming familiar in the separate Expert challenge bank.' : 'Notice what’s becoming familiar. There’s no finish line here—just a record of the words you’re making room for.'} action={studyMode === 'everyday' ? <LevelSelect settings={settings} setSettings={setSettings} onPaywall={onPaywall} onRefresh={onRefreshWords} /> : undefined} />
        
        {showSurvey && (
          <div className="mb-8 animate-in-up">
            <FocusCheck settings={settings} setSettings={setSettings} onClose={() => setShowSurvey(false)} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft md:p-8">
            <div className="mb-7 flex items-end justify-between">
              <div>
                <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Path coverage</div>
                <h2 className="mt-2 font-display text-3xl tracking-[-.04em]">Keep following the thread.</h2>
              </div>
              <BarChart3 className="text-[hsl(var(--primary))]" size={23} />
            </div>
            <div className="space-y-6">
              {progressLevels.map((level, index) => (
                <div key={level}>
                  <div className="mb-2 flex justify-between text-sm"><span className="font-bold">{level}</span><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{coverage(level)}%</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                    <div className={`h-full rounded-full transition-all duration-700 ${index === 0 ? 'bg-[hsl(var(--primary))]' : index === 1 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--chart-3))]'}`} style={{ width: `${coverage(level)}%` }} />
                  </div>
                   {!studyWords.some(word => word.difficulty === level) && studyMode === 'everyday' ? (
                     <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[hsl(var(--muted-foreground))]">
                       <span>No Everyday words are assigned to {level} yet.</span>
                       {(level === 'Advanced' || level === 'Challenge') && <button type="button" onClick={() => setSettings(selectStudyMode('expert'))} className="font-extrabold text-[hsl(var(--primary))] hover:underline" data-testid={`button-progress-switch-expert-${level.toLowerCase()}`}>Expert is the challenge bank →</button>}
                     </div>
                   ) : <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{index === 0 ? 'A steady foundation makes harder words easier.' : index === 1 ? 'You are building range and precision.' : 'A few brave steps into the deep end.'}</div>}
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-[26px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-lift md:p-8 flex flex-col justify-between">
            <div>
              <div className="mb-10 flex items-center justify-between">
                <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.7)]">In your toolkit</div>
                <Trophy size={20} className="text-[hsl(var(--accent))]" />
              </div>
              <div className="font-display text-6xl">{masteredWords.length}</div>
               <div className="mt-2 text-sm text-[hsl(var(--primary-foreground)/.7)]">words feeling familiar</div>
            </div>
            
            <div className="mt-8">
              <Link href="/achievements" className="flex items-center justify-between rounded-xl bg-[hsl(var(--primary-foreground)/.1)] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-foreground)/.2)] transition-colors">
                 Notice your small wins <ArrowRight size={16} />
              </Link>
              <div className="my-7 h-px bg-[hsl(var(--primary-foreground)/.15)]" />
               <div className="flex items-center justify-between text-xs"><span className="text-[hsl(var(--primary-foreground)/.7)]">Longest rhythm</span><strong>{getBestStreak(sessions)} days</strong></div>
               <div className="mt-4 flex items-center justify-between text-xs"><span className="text-[hsl(var(--primary-foreground)/.7)]">Sessions you gave yourself</span><strong>{sessions.length}</strong></div>
               <div className="mt-4 flex items-center justify-between text-xs"><span className="text-[hsl(var(--primary-foreground)/.7)]">Ready for a check-in</span><strong>{dueWords.length}</strong></div>
            </div>
          </section>
        </div>
        
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
           <section className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
             <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl tracking-[-.03em]">Recently feeling familiar</h2><BookOpen size={19} className="text-[hsl(var(--primary))]" /></div>
            {masteredWords.length ? (
              <div className="space-y-2">
                {masteredWords.slice(0, 5).map(word => (
                  <div key={word.id} className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/.55)] px-4 py-3">
                    <span className="font-bold">{word.word}</span>
                    <span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{word.category}</span>
                  </div>
                ))}
              </div>
             ) : (
               <div className="rounded-xl bg-[hsl(var(--secondary)/.55)] p-5 text-sm text-[hsl(var(--muted-foreground))]">When a lesson feels complete, your words will appear here. No rush.</div>
            )}
          </section>
          
          <section className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl tracking-[-.03em]">Study settings</h2><SlidersHorizontal size={19} className="text-[hsl(var(--primary))]" /></div>
            
            <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] py-4 text-sm">
                <span>
                  <span className="block font-bold">Study path survey</span>
                  <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Change the pace, challenge, and focus answers from your first setup.</span>
              </span>
              <button 
                onClick={() => {
                  setSettings(s => ({ ...s, hasCompletedOnboarding: false }));
                  setLocation('/onboarding');
                }} 
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
              >
                 Change answers
              </button>
            </div>

            <label className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] py-4 text-sm">
              <span>
                <span className="block font-bold">Daily word goal</span>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">A small target keeps the ritual kind.</span>
              </span>
              <select value={goal} onChange={event => { setGoal(event.target.value); setSettings(current => ({ ...current, dailyGoal: Number(event.target.value) })); }} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm font-bold" data-testid="select-daily-goal">
                <option value="3">3 words</option>
                <option value="5">5 words</option>
                <option value="10">10 words</option>
                <option value="15">15 words</option>
              </select>
            </label>
            
            <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] py-4 text-sm">
              <span>
                <span className="block font-bold">Focus Profile</span>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Currently {settings.focusProfile || 'not set'}</span>
              </span>
              <button 
                onClick={() => setShowSurvey(true)} 
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
              >
                Retake
              </button>
            </div>
            
            <label className="flex items-center justify-between gap-4 py-4 text-sm">
              <span>
                <span className="block font-bold">Gentle reminder</span>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">A nudge when it is time to practice.</span>
              </span>
              <button onClick={() => setSettings(current => ({ ...current, reminderEnabled: !current.reminderEnabled }))} className={`relative h-6 w-11 rounded-full transition-colors ${settings.reminderEnabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))]'}`} data-testid="button-toggle-reminder">
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform ${settings.reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
          </section>
         </div>

         <section className="mt-6 rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Your study trail</div>
              <h2 className="mt-2 font-display text-2xl tracking-[-.03em]">Recent sessions</h2>
            </div>
            <Link href="/history" className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))] no-underline">Open history <ChevronRight size={15} /></Link>
          </div>
          {sessions.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {sessions.slice(0, 6).map(session => (
                <Link key={session.id} href="/history" className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/.55)] px-4 py-3 text-[hsl(var(--foreground))] no-underline">
                  <div>
                    <div className="text-sm font-bold">{(session.kind ?? 'quiz') === 'lesson' ? 'Lesson' : 'Quiz'} · {session.wordsReviewed} words</div>
                    <div className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {session.duration} min</div>
                  </div>
                  {(session.kind ?? 'quiz') === 'quiz' ? <span className="rounded-lg bg-[hsl(var(--primary)/.12)] px-2 py-1 font-mono-ui text-[10px] font-bold text-[hsl(var(--primary))]">{session.quizScore}/{session.questionCount ?? session.wordsReviewed}</span> : <ChevronRight size={15} className="text-[hsl(var(--muted-foreground))]" />}
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-[hsl(var(--secondary)/.55)] p-5 text-sm text-[hsl(var(--muted-foreground))]">Your first finished quiz will leave a mark here.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function SavedWords({ bookmarks, onToggleBookmark, mode }: { bookmarks: string[]; onToggleBookmark: (wordId: string) => void; mode: StudyMode }) {
  const savedWords = bookmarks
    .map(wordId => ALL_WORDS.find(word => word.id === wordId))
    .filter((word): word is Word => word !== undefined && (
      mode === 'expert'
        ? word.track === 'expert'
        : mode === 'sat'
          ? word.track !== 'everyday' && word.track !== 'expert'
          : word.track === 'everyday'
    ));

  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-16">
      <div className="mx-auto max-w-[1000px]">
        <PageIntro
          eyebrow="Your reference shelf"
          title="Saved words"
          subtitle="Keep useful words close, hear them again, or share them when you want to explain what you are learning."
          action={<span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{savedWords.length} saved</span>}
        />

        {savedWords.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {savedWords.map(word => (
              <article key={word.id} className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-4xl tracking-[-.04em]">{word.word}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[hsl(var(--primary)/.08)] px-2.5 py-1 font-mono-ui text-xs text-[hsl(var(--primary))]" title="International Phonetic Alphabet">IPA {word.pronunciation}</span>
                      <span className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{word.partOfSpeech}</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-[hsl(var(--border))] px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{word.difficulty}</span>
                </div>
                <p className="mt-5 text-sm leading-relaxed">{word.definition}</p>
                <p className="mt-3 border-l-2 border-[hsl(var(--accent))] pl-4 text-sm italic text-[hsl(var(--muted-foreground))]">“{word.example}”</p>
                 <GeneratedScenario word={word} compact />
                <div className="mt-5">
                  <WordActions word={word} isBookmarked onToggleBookmark={() => onToggleBookmark(word.id)} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-14 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Bookmark size={24} /></div>
            <h2 className="font-display text-3xl">Your shelf is ready.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-[hsl(var(--muted-foreground))]">Save a word from Learn or Quick Mode and it will appear here for later reference.</p>
            <Link href="/learn" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))] no-underline">Start learning <ArrowRight size={16} /></Link>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, text, actionHref = '/', actionLabel = 'Return to today' }: { title: string; text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="flex min-h-[70dvh] items-center justify-center px-5 text-center"><div><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><CircleHelp size={25} /></div><h1 className="font-display text-3xl">{title}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{text}</p><Link href={actionHref} className="mt-6 inline-flex items-center rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] no-underline">{actionLabel} <ArrowRight size={16} className="ml-2" /></Link></div></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const [location, setLocation] = useLocation();
  const [settings, setSettings] = useStoredState<StudySettings>('wordwell-settings', defaultSettings);
  const [progress, setProgress] = useStoredState<WordProgress[]>('wordwell-progress', []);
  const [sessions, setSessions] = useStoredState<Session[]>('wordwell-sessions', []);
  const [bookmarks, setBookmarks] = useStoredState<string[]>('wordwell-bookmarks', []);
  const [discoveryHistory, setDiscoveryHistory] = useStoredState<DiscoveryHistoryItem[]>('wordwell-discovery-history', []);
  const [wordPoolRevision, setWordPoolRevision] = useState(0);
  const syncStatus = useAccountSync({
    settings,
    setSettings,
    progress,
    setProgress,
    sessions,
    setSessions,
    bookmarks,
    setBookmarks,
    discoveryHistory,
    setDiscoveryHistory,
  });

  const toggleBookmark = (wordId: string) => {
    setBookmarks(current =>
      current.includes(wordId)
        ? current.filter(id => id !== wordId)
        : [...current, wordId],
    );
  };
  const refreshWords = () => setWordPoolRevision(value => value + 1);
  
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    let needsUpdate = false;
    const updates: Partial<StudySettings> = {};

    if (
      !settings.hasCompletedOnboarding &&
      (progress.length > 0 || sessions.length > 0) &&
      location !== '/onboarding'
    ) {
      updates.hasCompletedOnboarding = true;
      needsUpdate = true;
    }

    if (!HAS_PREMIUM && (settings.level === 'Advanced' || settings.level === 'Challenge')) {
      updates.level = 'Foundational';
      needsUpdate = true;
    }

    if (needsUpdate) {
      setSettings(s => ({ ...s, ...updates }));
    }
  }, [settings.hasCompletedOnboarding, settings.level, progress.length, sessions.length, location, setSettings]);

  useEffect(() => {
    const isExistingUser = progress.length > 0 || sessions.length > 0;
    if (!settings.hasCompletedOnboarding && !isExistingUser && location !== '/onboarding' && location !== '/terms') {
      setLocation('/onboarding');
    }
  }, [settings.hasCompletedOnboarding, location, setLocation, progress.length, sessions.length]);
  
  if (location === '/terms') {
    return <TermsOfUse />;
  }

  if (
    location === '/onboarding' &&
    !settings.hasCompletedOnboarding
  ) {
    return <Onboarding settings={settings} setSettings={setSettings} />;
  }

  if (!settings.hasCompletedOnboarding && progress.length === 0 && sessions.length === 0) {
    return <Onboarding settings={settings} setSettings={setSettings} />;
  }

  return (
    <RoutedErrorBoundary>
      <Shell onPaywall={() => setShowPaywall(true)} syncStatus={syncStatus} settings={settings} setSettings={setSettings}>
        {onOpenStudyRhythm => (
          <>
            <Switch>
              <Route path="/">
                <Home settings={settings} setSettings={setSettings} progress={progress} sessions={sessions} onPaywall={() => setShowPaywall(true)} onOpenStudyRhythm={onOpenStudyRhythm} onRefreshWords={refreshWords} />
              </Route>
              <Route path="/quick">
                <Quick settings={settings} progress={progress} setProgress={setProgress} setSettings={setSettings} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} />
              </Route>
              <Route path="/learn">
                <Learn settings={settings} setSettings={setSettings} progress={progress} setProgress={setProgress} setSessions={setSessions} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} wordPoolRevision={wordPoolRevision} />
              </Route>
              <Route path="/discover">
                {getStudyMode(settings) !== 'everyday' ? <SatModeRedirect /> : (
                  <Discover
                    bookmarks={bookmarks}
                    onToggleBookmark={toggleBookmark}
                    history={discoveryHistory}
                    setHistory={setDiscoveryHistory}
                    syncStatus={syncStatus}
                  />
                )}
              </Route>
              <Route path="/sounds">
                {getStudyMode(settings) !== 'everyday' ? <SatModeRedirect /> : <PronunciationGuide />}
              </Route>
              <Route path="/quiz">
                <Quiz settings={settings} setSettings={setSettings} progress={progress} setProgress={setProgress} setSessions={setSessions} />
              </Route>
              <Route path="/history">
                <StudyHistory sessions={sessions} />
              </Route>
              <Route path="/progress">
                <Progress progress={progress} sessions={sessions} settings={settings} setSettings={setSettings} onPaywall={() => setShowPaywall(true)} onRefreshWords={refreshWords} />
              </Route>
              <Route path="/saved">
                <SavedWords bookmarks={bookmarks} onToggleBookmark={toggleBookmark} mode={getStudyMode(settings)} />
              </Route>
              <Route path="/achievements">
                <Achievements progress={progress} sessions={sessions} settings={settings} />
              </Route>
              <Route component={NotFound} />
            </Switch>
            {showPaywall && <Paywall onClose={() => setShowPaywall(false)} />}
          </>
        )}
      </Shell>
    </RoutedErrorBoundary>
  );
}

function SatModeRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/');
  }, [setLocation]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 py-16 text-center">
      <div>
        <Target className="mx-auto text-[hsl(var(--primary))]" size={28} />
        <h1 className="mt-4 font-display text-3xl tracking-[-.04em]">SAT mode is keeping you focused.</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Returning you to your exam study desk.</p>
      </div>
    </div>
  );
}

function NotFound() {
  return <EmptyState title="That page wandered off" text="The study desk is still here when you are ready." />;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <div className="paper-grid flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10">
      <div className="w-full max-w-[440px]">
        {mode === 'sign-in' ? (
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
          />
        ) : (
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
          />
        )}
      </div>
    </div>
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to continue your Wordwell study path',
          },
        },
        signUp: {
          start: {
            title: 'Create your Wordwell account',
            subtitle: 'Keep your words, progress, and study settings together',
          },
        },
      }}
      routerPush={to => setLocation(stripBase(to))}
      routerReplace={to => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/sign-in/*?"><AuthPage mode="sign-in" /></Route>
        <Route path="/sign-up/*?"><AuthPage mode="sign-up" /></Route>
        <Route><Router /></Route>
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
