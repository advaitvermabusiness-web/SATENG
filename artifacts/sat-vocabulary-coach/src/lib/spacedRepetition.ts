import type { Word, WordProgress } from '../types';

const REVIEW_INTERVALS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
};

export function getReviewIntervalDays(confidence: number) {
  const normalizedConfidence = Math.max(1, Math.min(5, Math.round(confidence)));
  return REVIEW_INTERVALS[normalizedConfidence];
}

export function getNextReviewDate(confidence: number, from = new Date()) {
  return getNextReviewDateForInterval(getReviewIntervalDays(confidence), from);
}

function getNextReviewDateForInterval(intervalDays: number, from = new Date()) {
  const nextReview = new Date(from);
  nextReview.setDate(nextReview.getDate() + intervalDays);
  return nextReview.toISOString();
}

export function isReviewDue(progress: WordProgress, now = Date.now()) {
  if (!progress.nextReview) return true;
  const reviewTime = new Date(progress.nextReview).getTime();
  return !Number.isFinite(reviewTime) || reviewTime <= now;
}

export function recordWordReview(
  items: WordProgress[],
  wordId: string,
  confidence: number,
  correct: boolean,
) {
  const normalizedConfidence = Math.max(1, Math.min(5, Math.round(confidence)));
  const existing = items.find(item => item.wordId === wordId);
  const baseInterval = getReviewIntervalDays(normalizedConfidence);
  const intervalMultiplier = normalizedConfidence === 5 ? 2 : 1.5;
  const reviewIntervalDays = correct && normalizedConfidence >= 4 && existing?.reviewIntervalDays
    ? Math.min(60, Math.max(baseInterval, Math.round(existing.reviewIntervalDays * intervalMultiplier)))
    : baseInterval;
  const next: WordProgress = {
    wordId,
    status: correct && normalizedConfidence >= 4 ? 'mastered' : 'learning',
    confidence: normalizedConfidence,
    correctCount: (existing?.correctCount ?? 0) + (correct ? 1 : 0),
    seenCount: (existing?.seenCount ?? 0) + 1,
    lastSeen: new Date().toISOString(),
    nextReview: getNextReviewDateForInterval(reviewIntervalDays),
    reviewIntervalDays,
  };

  return existing
    ? items.map(item => item.wordId === wordId ? next : item)
    : [...items, next];
}

export function getScheduledWords(
  pool: Word[],
  progress: WordProgress[],
  count: number,
  excludeWordIds: string[] = [],
) {
  const progressByWord = new Map(progress.map(item => [item.wordId, item]));
  const excluded = new Set(excludeWordIds);
  const due = pool
    .filter(word => {
      const item = progressByWord.get(word.id);
      return item ? isReviewDue(item) : false;
    })
    .sort((first, second) => {
      const firstReview = progressByWord.get(first.id)?.nextReview ?? '';
      const secondReview = progressByWord.get(second.id)?.nextReview ?? '';
      return firstReview.localeCompare(secondReview);
    });
  const unseen = pool.filter(word => !progressByWord.has(word.id));
  const waiting = pool
    .filter(word => {
      const item = progressByWord.get(word.id);
      return item ? !isReviewDue(item) : false;
    })
    .sort((first, second) => {
      const firstReview = progressByWord.get(first.id)?.nextReview ?? '';
      const secondReview = progressByWord.get(second.id)?.nextReview ?? '';
      return firstReview.localeCompare(secondReview);
    });
  const ordered = [...due, ...unseen, ...waiting];
  const fresh = ordered.filter(word => !excluded.has(word.id));
  const fallback = ordered.filter(word => excluded.has(word.id));

  return [...fresh, ...fallback].slice(0, Math.min(count, pool.length));
}