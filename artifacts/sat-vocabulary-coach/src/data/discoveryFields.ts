import type { Word } from '../types';

export const DISCOVERY_FIELDS = [
  'Economics',
  'Science',
  'Politics & Society',
  'Literature & Arts',
  'Psychology',
  'Personality & Human Behavior',
  'Medicine & Healthcare',
  'Technology',
  'Everyday Communication',
  'SAT Vocabulary',
  'Expert Vocabulary',
] as const;

export type DiscoveryField = (typeof DISCOVERY_FIELDS)[number];

const FIELD_SIGNALS: Array<{ field: DiscoveryField; signals: string[] }> = [
  {
    field: 'Medicine & Healthcare',
    signals: ['doctor', 'physician', 'medical', 'medicine', 'health', 'disease', 'patient', 'surgery', 'clinical', 'hospital', 'cardiolog', 'neurolog', 'psychiatr'],
  },
  {
    field: 'Economics',
    signals: ['econom', 'inflation', 'price', 'market', 'financial', 'money', 'trade', 'wage', 'interest rate', 'purchasing power', 'recession'],
  },
  {
    field: 'Science',
    signals: ['science', 'scientific', 'biology', 'chemistry', 'physics', 'ecology', 'organism', 'experiment', 'climate', 'energy', 'nature'],
  },
  {
    field: 'Politics & Society',
    signals: ['politic', 'government', 'democra', 'policy', 'election', 'law', 'civic', 'society', 'social behavior', 'institution', 'public'],
  },
  {
    field: 'Literature & Arts',
    signals: ['literature', 'literary', 'poetry', 'novel', 'author', 'art', 'music', 'theatre', 'theater', 'craft', 'expression'],
  },
  {
    field: 'Personality & Human Behavior',
    signals: ['personality', 'character', 'temperament', 'trait', 'behavior', 'empat', 'introvert', 'extrovert', 'convivial', 'candid', 'magnanim'],
  },
  {
    field: 'Psychology',
    signals: ['psycholog', 'memory', 'emotion', 'cognitive', 'mental', 'perception', 'motivation', 'thought'],
  },
  {
    field: 'Technology',
    signals: ['technology', 'digital', 'computer', 'software', 'algorithm', 'internet', 'data', 'machine', 'device'],
  },
];

export function getDiscoveryField(word: Word): DiscoveryField {
  const searchable = [
    word.word,
    word.definition,
    word.category,
    word.example,
    word.expandedSentence,
  ].join(' ').toLocaleLowerCase();

  for (const candidate of FIELD_SIGNALS) {
    if (candidate.signals.some(signal => searchable.includes(signal))) return candidate.field;
  }
  if (word.track === 'expert') return 'Expert Vocabulary';
  if (word.track === 'sat') return 'SAT Vocabulary';
  return 'Everyday Communication';
}

export function makeRecommendationKey(value: string) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}