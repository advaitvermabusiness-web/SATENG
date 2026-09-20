import type {
  DiscoveryHistoryItem,
  SatPhase,
  Session,
  StudySettings,
  WordProgress,
} from '../types';

export type VocabularyState = {
  settings: StudySettings;
  progress: WordProgress[];
  sessions: Session[];
  bookmarks: string[];
  discoveryHistory?: DiscoveryHistoryItem[];
};

const SAT_PHASES: SatPhase[] = [
  'preview',
  'invent',
  'trace',
  'postmortem',
  'morphology',
  'intern',
];
const LEVELS = ['Foundational', 'Advanced', 'Challenge'] as const;
const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function isText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    value.normalize('NFC').length <= maximum &&
    !UNSAFE_CONTROL_CHARACTERS.test(value);
}

function isInteger(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum;
}

function isDateText(value: unknown) {
  return isText(value, 80) && Number.isFinite(Date.parse(value));
}

function isWithinStateSizeLimit(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 60 * 1024;
  } catch {
    return false;
  }
}

function isSettings(value: unknown): value is StudySettings {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'level',
      'dailyGoal',
      'reminderEnabled',
      'satMode',
      'expertMode',
      'focusProfile',
      'hasCompletedOnboarding',
      'confidenceLevel',
      'targetTiming',
      'paywallSeen',
      'quickWordsSeen',
      'satRecallPoints',
    ]) ||
    !hasKeys(value, ['level', 'dailyGoal', 'reminderEnabled'])
  ) return false;

  if (
    !LEVELS.includes(value.level as (typeof LEVELS)[number]) ||
    !isInteger(value.dailyGoal, 1, 100) ||
    typeof value.reminderEnabled !== 'boolean'
  ) return false;

  if ('satMode' in value && typeof value.satMode !== 'boolean') return false;
  if ('expertMode' in value && typeof value.expertMode !== 'boolean') return false;
  if (
    'focusProfile' in value &&
    !['Quick', 'Standard', 'Deep', null].includes(value.focusProfile as string | null)
  ) return false;
  if (
    'hasCompletedOnboarding' in value &&
    typeof value.hasCompletedOnboarding !== 'boolean'
  ) return false;
  if ('paywallSeen' in value && typeof value.paywallSeen !== 'boolean') return false;
  if ('confidenceLevel' in value && !isText(value.confidenceLevel, 80)) return false;
  if ('targetTiming' in value && !isText(value.targetTiming, 80)) return false;
  if ('quickWordsSeen' in value && !isInteger(value.quickWordsSeen, 0, 1_000_000)) {
    return false;
  }
  if ('satRecallPoints' in value && !isInteger(value.satRecallPoints, 0, 1_000_000)) {
    return false;
  }
  return true;
}

function isProgressItem(value: unknown): value is WordProgress {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'wordId',
      'status',
      'confidence',
      'correctCount',
      'seenCount',
      'lastSeen',
      'nextReview',
      'reviewIntervalDays',
    ]) ||
    !hasKeys(value, [
      'wordId',
      'status',
      'confidence',
      'correctCount',
      'seenCount',
      'lastSeen',
    ])
  ) return false;

  return (
    isText(value.wordId, 120) &&
    ['new', 'learning', 'mastered'].includes(value.status as string) &&
    isInteger(value.confidence, 0, 5) &&
    isInteger(value.correctCount, 0, 1_000_000) &&
    isInteger(value.seenCount, 0, 1_000_000) &&
    isDateText(value.lastSeen) &&
    (!('nextReview' in value) || isDateText(value.nextReview)) &&
    (!('reviewIntervalDays' in value) ||
      isInteger(value.reviewIntervalDays, 0, 100_000))
  );
}

function isPhaseCompletion(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, SAT_PHASES)) return false;
  let blocked = false;
  for (const phase of SAT_PHASES) {
    if (!(phase in value)) {
      blocked = true;
      continue;
    }
    if (typeof value[phase] !== 'boolean' || (blocked && value[phase])) return false;
    if (!value[phase]) blocked = true;
  }
  return true;
}

function isSession(value: unknown): value is Session {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'date',
      'wordsReviewed',
      'quizScore',
      'duration',
      'kind',
      'mode',
      'level',
      'bankId',
      'questionCount',
      'wordIds',
      'phaseCompletion',
    ]) ||
    !hasKeys(value, ['id', 'date', 'wordsReviewed', 'quizScore', 'duration'])
  ) return false;

  return (
    isText(value.id, 160) &&
    isDateText(value.date) &&
    isInteger(value.wordsReviewed, 0, 1_000) &&
    isInteger(value.quizScore, 0, 1_000) &&
    isInteger(value.duration, 0, 1_000_000) &&
    (!('kind' in value) || value.kind === 'lesson' || value.kind === 'quiz') &&
    (!('mode' in value) || value.mode === 'sat' || value.mode === 'everyday' || value.mode === 'expert') &&
    (!('level' in value) ||
      LEVELS.includes(value.level as (typeof LEVELS)[number])) &&
    (!('bankId' in value) || isText(value.bankId, 80)) &&
    (!('questionCount' in value) || isInteger(value.questionCount, 0, 1_000)) &&
    (!('wordIds' in value) ||
      (Array.isArray(value.wordIds) &&
        value.wordIds.length <= 500 &&
        value.wordIds.every(wordId => isText(wordId, 120)))) &&
    (!('phaseCompletion' in value) || isPhaseCompletion(value.phaseCompletion))
  );
}

function isDiscoveryItem(value: unknown): value is DiscoveryHistoryItem {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'wordId',
      'firstSeen',
      'lastSeen',
      'seenCount',
      'confidence',
      'nextReview',
      'note',
    ]) ||
    !hasKeys(value, [
      'wordId',
      'firstSeen',
      'lastSeen',
      'seenCount',
      'confidence',
      'nextReview',
    ])
  ) return false;

  return (
    isText(value.wordId, 120) &&
    isDateText(value.firstSeen) &&
    isDateText(value.lastSeen) &&
    isInteger(value.seenCount, 0, 1_000_000) &&
    isInteger(value.confidence, 0, 5) &&
    isDateText(value.nextReview) &&
    (!('note' in value) || isText(value.note, 300))
  );
}

export function isVocabularyState(value: unknown): value is VocabularyState {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'settings',
      'progress',
      'sessions',
      'bookmarks',
      'discoveryHistory',
    ]) ||
    !hasKeys(value, ['settings', 'progress', 'sessions', 'bookmarks'])
  ) return false;

  return (
    isSettings(value.settings) &&
    Array.isArray(value.progress) &&
    value.progress.length <= 500 &&
    value.progress.every(isProgressItem) &&
    Array.isArray(value.sessions) &&
    value.sessions.length <= 100 &&
    value.sessions.every(isSession) &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.length <= 500 &&
    value.bookmarks.every(bookmark => isText(bookmark, 120)) &&
    (!('discoveryHistory' in value) ||
      (Array.isArray(value.discoveryHistory) &&
        value.discoveryHistory.length <= 500 &&
        value.discoveryHistory.every(isDiscoveryItem))) &&
    isWithinStateSizeLimit(value)
  );
}

export function isStoredVocabularySlice(key: string, value: unknown) {
  if (key === 'wordwell-settings') return isSettings(value);
  if (key === 'wordwell-progress') {
    return Array.isArray(value) && value.length <= 500 && value.every(isProgressItem);
  }
  if (key === 'wordwell-sessions') {
    return Array.isArray(value) && value.length <= 100 && value.every(isSession);
  }
  if (key === 'wordwell-bookmarks') {
    return Array.isArray(value) &&
      value.length <= 500 &&
      value.every(bookmark => isText(bookmark, 120));
  }
  if (key === 'wordwell-discovery-history') {
    return Array.isArray(value) &&
      value.length <= 500 &&
      value.every(isDiscoveryItem);
  }
  return true;
}