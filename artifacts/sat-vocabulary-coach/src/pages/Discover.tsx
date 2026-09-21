import { type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Brain, Check, ChevronDown, Clock3, History, Search, Sparkles, ThumbsUp } from 'lucide-react';
import { useUser } from '@clerk/react';
import { Link } from 'wouter';
import { EVERYDAY_WORDS } from '../data/everydayWords';
import { DISCOVERY_ELABORATIONS } from '../data/discoveryElaborations';
import { DISCOVERY_FIELDS, makeRecommendationKey, type DiscoveryField } from '../data/discoveryFields';
import { type DiscoveryHistoryItem, type Word } from '../types';
import { WordActions } from '../components/WordActions';
import { GeneratedScenario } from '../components/GeneratedScenario';
import { type AccountSyncStatus } from '../components/AccountSync';

type HistorySetter = (
  value: DiscoveryHistoryItem[] | ((current: DiscoveryHistoryItem[]) => DiscoveryHistoryItem[]),
) => void;

type SentenceEvaluation = {
  correct: boolean;
  feedback: string;
  correction: string | null;
  grammar: {
    score: number;
    label: string;
    feedback: string;
  };
};

type ReviewRating = 'again' | 'soon' | 'known';
type RecommendationSummary = {
  wordKey: string;
  word: string;
  field: DiscoveryField;
  count: number;
  recommendedByMe: boolean;
};

type DictionaryEntry = {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  field: DiscoveryField;
  fieldExplanation: string;
  context: string;
  synonyms: string[];
  antonyms: string[];
  wordFamily: string;
  etymology: string;
};

function hash(value: string) {
  return value.split('').reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function makeBatch(round: number, history: DiscoveryHistoryItem[], previousWordId?: string): Word[] {
  const now = Date.now();
  const historyByWord = new Map(history.map(item => [item.wordId, item]));
  const dueWords = history
    .filter(item => item.confidence < 5 && new Date(item.nextReview).getTime() <= now)
    .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime())
    .map(item => EVERYDAY_WORDS.find(word => word.id === item.wordId))
    .filter((word): word is Word => Boolean(word));
  const freshOrder = [...EVERYDAY_WORDS].sort(
    (a, b) => hash(`${a.id}-${round}`) - hash(`${b.id}-${round}`),
  );
  const unseenWords = freshOrder.filter(word => !historyByWord.has(word.id));
  const scheduledFallback = [...EVERYDAY_WORDS]
    .filter(word => {
      const item = historyByWord.get(word.id);
      return item !== undefined && item.confidence < 5;
    })
    .sort((a, b) => (
      new Date(historyByWord.get(a.id)!.nextReview).getTime() -
      new Date(historyByWord.get(b.id)!.nextReview).getTime()
    ));
  const queue = [...dueWords, ...unseenWords, ...scheduledFallback];
  const uniqueWords = [...new Map(queue.map(word => [word.id, word])).values()];

  if (previousWordId && uniqueWords[0]?.id === previousWordId && uniqueWords.length > 1) {
    uniqueWords.push(uniqueWords.shift()!);
  }
  return uniqueWords;
}

function createHistoryItem(wordId: string, now: Date): DiscoveryHistoryItem {
  return {
    wordId,
    firstSeen: now.toISOString(),
    lastSeen: now.toISOString(),
    seenCount: 1,
    confidence: 0,
    nextReview: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function Discover({
  bookmarks,
  onToggleBookmark,
  history,
  setHistory,
  syncStatus,
}: {
  bookmarks: string[];
  onToggleBookmark: (wordId: string) => void;
  history: DiscoveryHistoryItem[];
  setHistory: HistorySetter;
  syncStatus: AccountSyncStatus;
}) {
  const { user, isLoaded: userLoaded } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const appendingRef = useRef(false);
  const [view, setView] = useState<'feed' | 'search' | 'history'>('feed');
  const [activeIndex, setActiveIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [feed, setFeed] = useState<Word[]>(() => makeBatch(0, history));
  const activeWord = feed[activeIndex];
  const needsHydrationRefreshRef = useRef(false);
  const [recommendations, setRecommendations] = useState<Record<string, RecommendationSummary>>({});
  const [recommendationError, setRecommendationError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/discover/recommendations', {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`Recommendations failed (${response.status})`);
        return response.json() as Promise<{ recommendations?: RecommendationSummary[] }>;
      })
      .then(payload => {
        const next: Record<string, RecommendationSummary> = {};
        for (const item of payload.recommendations ?? []) next[item.wordKey] = item;
        setRecommendations(next);
      })
      .catch(error => {
        if ((error as Error).name !== 'AbortError') setRecommendationError('Recommendation counts are temporarily unavailable.');
      });
    return () => controller.abort();
  }, [user?.id]);

  useEffect(() => {
    if (syncStatus === 'loading') {
      needsHydrationRefreshRef.current = true;
      return;
    }
    if (syncStatus === 'synced' && needsHydrationRefreshRef.current) {
      setFeed(makeBatch(0, history));
      setActiveIndex(0);
      setRound(1);
      needsHydrationRefreshRef.current = false;
      containerRef.current?.scrollTo({ top: 0 });
    }
  }, [history, syncStatus]);

  useEffect(() => {
    if (!activeWord || view !== 'feed') return;
    const timer = window.setTimeout(() => {
      const now = new Date();
      setHistory(items => {
        const existing = items.find(item => item.wordId === activeWord.id);
        if (!existing) return [createHistoryItem(activeWord.id, now), ...items];
        if (now.getTime() - new Date(existing.lastSeen).getTime() < 30_000) return items;
        return items.map(item => item.wordId === activeWord.id
          ? { ...item, lastSeen: now.toISOString(), seenCount: item.seenCount + 1 }
          : item);
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeWord, setHistory, view]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const nextIndex = Math.round(container.scrollTop / container.clientHeight);
    if (nextIndex !== activeIndex && nextIndex < feed.length) setActiveIndex(nextIndex);

    if (nextIndex >= feed.length - 4 && !appendingRef.current) {
      appendingRef.current = true;
      setFeed(current => {
        const nextBatch = makeBatch(round, history, current.at(-1)?.id);
        return [...current, ...nextBatch];
      });
      setRound(value => value + 1);
      window.requestAnimationFrame(() => {
        appendingRef.current = false;
      });
    }
  };

  const reviewWord = (wordId: string, rating: ReviewRating) => {
    const now = new Date();
    setHistory(items => {
      const existing = items.find(item => item.wordId === wordId) ?? createHistoryItem(wordId, now);
      const nextConfidence = rating === 'again'
        ? Math.max(0, existing.confidence - 1)
        : rating === 'known'
          ? 5
          : Math.min(4, existing.confidence + 1);
      const intervalMs = rating === 'again'
        ? 10 * 60 * 1000
        : rating === 'soon'
          ? 24 * 60 * 60 * 1000
          : Math.min(14, 2 ** Math.max(1, nextConfidence)) * 24 * 60 * 60 * 1000;
      const updated = {
        ...existing,
        confidence: nextConfidence,
        lastSeen: now.toISOString(),
        nextReview: new Date(now.getTime() + intervalMs).toISOString(),
      };
      return items.some(item => item.wordId === wordId)
        ? items.map(item => item.wordId === wordId ? updated : item)
        : [updated, ...items];
    });
    setFeed(current => [
      ...current.slice(0, activeIndex + 1),
      ...current.slice(activeIndex + 1).filter(word => word.id !== wordId),
    ]);

    window.setTimeout(() => {
      const container = containerRef.current;
      if (container) container.scrollTo({ top: (activeIndex + 1) * container.clientHeight, behavior: 'smooth' });
    }, 250);
  };

  const saveNote = (wordId: string, note: string) => {
    const cleanNote = note.trim().slice(0, 300);
    if (!cleanNote) return;
    const now = new Date();
    setHistory(items => {
      const existing = items.find(item => item.wordId === wordId) ?? createHistoryItem(wordId, now);
      const updated = { ...existing, note: cleanNote, lastSeen: now.toISOString() };
      return items.some(item => item.wordId === wordId)
        ? items.map(item => item.wordId === wordId ? updated : item)
        : [updated, ...items];
    });
  };

  const recommendWord = async (
    word: string,
    field: DiscoveryField,
    source: 'library' | 'search',
    knownWordId?: string,
  ) => {
    const wordKey = knownWordId ?? makeRecommendationKey(word);
    if (!wordKey) throw new Error('Enter a word to recommend.');
    setRecommendationError('');
    const response = await fetch('/api/discover/recommendations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wordKey, word, field, source }),
    });
    const payload = await response.json() as {
      recommendation?: RecommendationSummary;
      error?: string;
    };
    if (!response.ok || !payload.recommendation) {
      const message = response.status === 401
        ? 'Sign in to recommend a word.'
        : payload.error ?? 'This recommendation could not be sent.';
      setRecommendationError(message);
      throw new Error(message);
    }
    setRecommendations(current => ({
      ...current,
      [payload.recommendation!.wordKey]: payload.recommendation!,
    }));
  };

  const historyWords = useMemo(
    () => [...history]
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .map(item => ({ item, word: EVERYDAY_WORDS.find(word => word.id === item.wordId) }))
      .filter((entry): entry is { item: DiscoveryHistoryItem; word: Word } => Boolean(entry.word)),
    [history],
  );

  return (
    <div className="relative h-[calc(100dvh-68px)] overflow-hidden bg-[hsl(var(--background))] md:h-[100dvh]">
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b border-[hsl(var(--border)/.65)] bg-[hsl(var(--background)/.9)] px-4 py-3 backdrop-blur-md md:px-8">
        <div>
          <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">
            <Sparkles size={12} /> Discover
          </div>
           <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">A few words to explore · take your time</div>
        </div>
        <div className="flex rounded-xl bg-[hsl(var(--secondary)/.7)] p-1">
          <button type="button" onClick={() => setView('feed')} className={`rounded-lg px-3 py-2 text-xs font-bold ${view === 'feed' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>
            Feed
          </button>
          <button type="button" onClick={() => setView('search')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${view === 'search' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>
            <Search size={13} /> Search
          </button>
          <button type="button" onClick={() => setView('history')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${view === 'history' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>
            <History size={13} /> History <span className="font-mono-ui text-[9px]">{history.length}</span>
          </button>
        </div>
      </div>

      {view === 'feed' ? (
        <div ref={containerRef} onScroll={handleScroll} className="h-full snap-y snap-mandatory overflow-y-auto">
          {feed.map((word, feedIndex) => (
            <DiscoveryCard
              key={`${word.id}-${feedIndex}`}
              word={word}
              isActive={feedIndex === activeIndex}
              isBookmarked={bookmarks.includes(word.id)}
              historyItem={history.find(item => item.wordId === word.id)}
              onToggleBookmark={() => onToggleBookmark(word.id)}
              onReview={rating => reviewWord(word.id, rating)}
              onSaveNote={note => saveNote(word.id, note)}
            />
          ))}
        </div>
      ) : view === 'search' ? (
        <SearchView
          recommendations={recommendations}
          isSignedIn={userLoaded && Boolean(user)}
          recommendationError={recommendationError}
          onRecommend={recommendWord}
        />
      ) : (
        <HistoryView entries={historyWords} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />
      )}
    </div>
  );
}

function SearchView({
  recommendations,
  isSignedIn,
  recommendationError,
  onRecommend,
}: {
  recommendations: Record<string, RecommendationSummary>;
  isSignedIn: boolean;
  recommendationError: string;
  onRecommend: (word: string, field: DiscoveryField, source: 'library' | 'search', knownWordId?: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [searchedWord, setSearchedWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitSearch = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    const word = query.trim().replace(/\s+/g, ' ');
    if (word.length < 2) {
      setError('Enter a word or short phrase to look up.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/discover/dictionary?word=${encodeURIComponent(word)}`, {
        credentials: 'include',
      });
      const payload = await response.json() as DictionaryEntry & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The dictionary is temporarily unavailable.');
      setEntry(payload);
      setSearchedWord(word);
    } catch (requestError) {
      setEntry(null);
      setError(requestError instanceof Error ? requestError.message : 'The dictionary is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const entryWordKey = entry ? makeRecommendationKey(entry.word) : '';

  return (
    <div className="h-full overflow-y-auto px-5 pb-28 pt-24 md:px-10 md:pb-12">
      <div className="mx-auto max-w-[1050px]">
        <div className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-soft md:p-7">
          <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--primary))]"><Search size={13} /> Search Discover</div>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em]">Your specialized vocabulary dictionary.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Look up any word or short phrase. Get its meaning, pronunciation, natural context, and the field where it is most useful.</p>
          <label htmlFor="discover-search" className="sr-only">Search for a word, meaning, category, or field</label>
          <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={18} />
              <input
                id="discover-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Try inflation, empathetic, or reasoning…"
                className="min-h-12 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-11 pr-4 text-sm outline-none focus:border-[hsl(var(--primary))]"
              />
            </div>
            <button type="submit" disabled={loading} className="min-h-12 rounded-2xl bg-[hsl(var(--primary))] px-5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-wait disabled:opacity-60">
              {loading ? 'Looking up…' : 'Look up word'}
            </button>
          </form>
          <div className="mt-5">
            <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Dictionary fields</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISCOVERY_FIELDS.map(field => (
                <span key={field} className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 text-center text-sm font-bold text-[hsl(var(--destructive))]">{error}</p>}
        {entry && (
          <DictionaryEntryCard
            entry={entry}
            searchedWord={searchedWord}
            recommendation={recommendations[entryWordKey]}
            isSignedIn={isSignedIn}
            onRecommend={onRecommend}
          />
        )}
        {recommendationError && <p role="alert" className="mt-4 text-center text-sm font-bold text-[hsl(var(--destructive))]">{recommendationError}</p>}
      </div>
    </div>
  );
}

function DictionaryEntryCard({
  entry,
  searchedWord,
  recommendation,
  isSignedIn,
  onRecommend,
}: {
  entry: DictionaryEntry;
  searchedWord: string;
  recommendation?: RecommendationSummary;
  isSignedIn: boolean;
  onRecommend: (word: string, field: DiscoveryField, source: 'library' | 'search', knownWordId?: string) => Promise<void>;
}) {
  const wordKey = makeRecommendationKey(entry.word);
  return (
    <section className="mt-6 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">Dictionary entry · searched “{searchedWord}”</div>
          <h2 className="mt-2 font-display text-5xl tracking-[-.05em]">{entry.word}</h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{entry.partOfSpeech} · {entry.pronunciation}</p>
        </div>
        <RecommendButton
          word={entry.word}
          field={entry.field}
          wordKey={wordKey}
          recommendation={recommendation}
          isSignedIn={isSignedIn}
          source="search"
          onRecommend={onRecommend}
        />
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)]">
        <div className="rounded-2xl bg-[hsl(var(--primary)/.07)] p-5">
          <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--primary))]">Meaning</div>
          <p className="mt-2 text-lg font-semibold leading-relaxed">{entry.definition}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(var(--secondary)/.7)] p-5">
          <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Field</div>
          <div className="mt-2 text-xl font-extrabold text-[hsl(var(--primary))]">{entry.field}</div>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{entry.fieldExplanation}</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] p-5">
        <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Natural context</div>
        <p className="mt-2 text-sm leading-relaxed">“{entry.context}”</p>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <WordList label="Synonyms" words={entry.synonyms} tone="primary" />
        <WordList label="Antonyms" words={entry.antonyms} tone="accent" />
      </div>
      <div className="mt-5 grid gap-4 border-t border-[hsl(var(--border))] pt-5 text-sm sm:grid-cols-2">
        <div><span className="font-bold">Word family:</span> {entry.wordFamily || 'No common forms listed.'}</div>
        <div><span className="font-bold">Origin:</span> {entry.etymology || 'No concise origin note available.'}</div>
      </div>
    </section>
  );
}

function RecommendButton({
  word,
  field,
  wordKey,
  recommendation,
  isSignedIn,
  source,
  onRecommend,
}: {
  word: string;
  field: DiscoveryField;
  wordKey: string;
  recommendation?: RecommendationSummary;
  isSignedIn: boolean;
  source: 'library' | 'search';
  onRecommend: (word: string, field: DiscoveryField, source: 'library' | 'search', knownWordId?: string) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  if (!isSignedIn) {
    return <Link href="/sign-in" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-xs font-bold text-[hsl(var(--primary-foreground))] no-underline"><ThumbsUp size={14} /> Sign in to recommend</Link>;
  }
  return (
    <button
      type="button"
      disabled={sending || recommendation?.recommendedByMe}
      onClick={() => {
        setSending(true);
        void onRecommend(word, field, source, wordKey)
          .catch(() => undefined)
          .finally(() => setSending(false));
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-default disabled:opacity-70"
    >
      <ThumbsUp size={14} />
      {sending
        ? 'Sending…'
        : recommendation?.recommendedByMe
          ? `Recommended${recommendation.count > 1 ? ` · ${recommendation.count}` : ''}`
          : `Recommend${recommendation?.count ? ` · ${recommendation.count}` : ''}`}
    </button>
  );
}

function DiscoveryCard({
  word,
  isActive,
  isBookmarked,
  historyItem,
  onToggleBookmark,
  onReview,
  onSaveNote,
}: {
  word: Word;
  isActive: boolean;
  isBookmarked: boolean;
  historyItem?: DiscoveryHistoryItem;
  onToggleBookmark: () => void;
  onReview: (rating: ReviewRating) => void;
  onSaveNote: (note: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState(historyItem?.note ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [checkingSentence, setCheckingSentence] = useState(false);
  const [sentenceEvaluation, setSentenceEvaluation] = useState<SentenceEvaluation | null>(null);
  const [sentenceError, setSentenceError] = useState('');

  useEffect(() => {
    if (!isActive) {
      setRevealed(false);
      setNoteSaved(false);
      setSentenceEvaluation(null);
      setSentenceError('');
    }
  }, [isActive]);

  const checkSentence = async () => {
    const sentence = note.trim();
    if (!sentence || checkingSentence) return;

    setCheckingSentence(true);
    setSentenceEvaluation(null);
    setSentenceError('');
    setNoteSaved(false);
    try {
      const response = await fetch('/api/check-word-usage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          word: word.word,
          partOfSpeech: word.partOfSpeech,
          definition: word.definition,
          sentence,
        }),
      });
      if (!response.ok) throw new Error(`Sentence check failed (${response.status})`);

      const evaluation = await response.json() as SentenceEvaluation;
      setSentenceEvaluation(evaluation);
      if (evaluation.correct) {
        onSaveNote(sentence);
        setNoteSaved(true);
      }
    } catch {
      setSentenceError('We could not check this sentence right now. Your writing is still here—please try again.');
    } finally {
      setCheckingSentence(false);
    }
  };

  return (
    <article className="flex h-full snap-start items-center justify-center px-5 pb-28 pt-24 md:px-10 md:pb-16">
      <div className="relative max-h-full w-full max-w-[900px] overflow-x-hidden overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lift md:p-10">
        <div className="absolute -right-20 -top-24 hidden h-64 w-64 rounded-full border-[28px] border-[hsl(var(--accent)/.16)] md:block" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{word.category} · {word.partOfSpeech}</div>
              <h1 className="mt-3 font-display text-6xl tracking-[-.06em] text-[hsl(var(--foreground))] md:text-8xl">{word.word}</h1>
              <div className="mt-3 font-mono-ui text-xs text-[hsl(var(--primary))]">IPA {word.pronunciation}</div>
            </div>
            {historyItem && new Date(historyItem.nextReview).getTime() <= Date.now() && (
              <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--accent)/.16)] px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">
                 <Clock3 size={11} /> Ready for another look
              </span>
            )}
          </div>

          <div className="mt-6">
            <WordActions word={word} isBookmarked={isBookmarked} onToggleBookmark={onToggleBookmark} />
          </div>

          {!revealed ? (
            <div className="mt-8 rounded-2xl bg-[hsl(var(--secondary)/.58)] p-5 md:p-6">
              <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]"><Brain size={13} /> Retrieval practice</div>
              <p className="mt-3 font-display text-2xl tracking-[-.02em]">Before revealing it, can you explain this word in your own words?</p>
              <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Trying to retrieve a meaning first—even unsuccessfully—strengthens the memory that follows.</p>
              <button type="button" onClick={() => setRevealed(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))]">
                Reveal and check <ChevronDown size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-8 animate-in-up">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[hsl(var(--primary)/.09)] p-5">
                  <div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">Meaning</div>
                  <p className="mt-2 text-lg font-bold leading-relaxed">{word.definition}</p>
                </div>
                <div className="rounded-2xl bg-[hsl(var(--secondary)/.58)] p-5">
                  <div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">In context</div>
                  <p className="mt-2 font-display text-xl leading-relaxed">“{word.example}”</p>
                </div>
              </div>
               <GeneratedScenario word={word} />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="border-l-2 border-[hsl(var(--accent))] pl-4">
                  <div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Memory cue</div>
                  <p className="mt-2 text-sm leading-relaxed">{word.memoryCue}</p>
                </div>
                <div className="border-l-2 border-[hsl(var(--border))] pl-4">
                  <div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Word roots</div>
                  <p className="mt-2 text-sm leading-relaxed">{word.etymology}</p>
                </div>
              </div>

              <ElaborationPanel word={word} />

              <div className="mt-6 min-w-0 max-w-full overflow-hidden rounded-2xl border border-[hsl(var(--border))] p-4">
                <label className="text-xs font-bold" htmlFor={`sentence-${word.id}`}>Use it in your own sentence</label>
                <div className="mt-2 flex min-w-0 max-w-full flex-col gap-2 sm:flex-row">
                  <textarea id={`sentence-${word.id}`} rows={2} value={note} onChange={event => { setNote(event.target.value); setNoteSaved(false); setSentenceEvaluation(null); setSentenceError(''); }} maxLength={300} placeholder={`Write a sentence with “${word.word}”…`} className="min-h-14 w-full min-w-0 max-w-full flex-1 resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm leading-relaxed outline-none focus:border-[hsl(var(--primary))]" />
                  <button type="button" onClick={checkSentence} disabled={!note.trim() || checkingSentence} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
                    {checkingSentence ? 'Checking…' : noteSaved ? <><Check size={14} /> Correct & saved</> : 'Check sentence'}
                  </button>
                </div>
                {sentenceEvaluation && (
                  <div role="status" className={`mt-3 min-w-0 max-w-full break-words rounded-xl p-3 text-xs leading-relaxed ${sentenceEvaluation.correct ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--foreground))]' : 'bg-[hsl(var(--accent)/.13)] text-[hsl(var(--foreground))]'}`}>
                    <div className="font-extrabold">{sentenceEvaluation.correct ? 'Good use of the word.' : 'This use needs a small change.'}</div>
                    <p className="mt-1">{sentenceEvaluation.feedback}</p>
                    <div className="mt-3 border-t border-[hsl(var(--border)/.7)] pt-3">
                      <div className="flex items-center justify-between gap-2 font-bold">
                        <span>Grammar</span>
                        <span>{sentenceEvaluation.grammar.score}/5 · {sentenceEvaluation.grammar.label}</span>
                      </div>
                      <div className="mt-2 flex gap-1" aria-label={`Sentence grammar ${sentenceEvaluation.grammar.score} out of 5`}>
                        {Array.from({ length: 5 }, (_, score) => (
                          <div key={score} className={`h-1.5 flex-1 rounded-full ${score < sentenceEvaluation.grammar.score ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--border))]'}`} />
                        ))}
                      </div>
                      <p className="mt-2">{sentenceEvaluation.grammar.feedback}</p>
                    </div>
                    {!sentenceEvaluation.correct && sentenceEvaluation.correction && (
                      <div className="mt-3">
                        <div className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Suggested revision</div>
                        <p className="mt-1 italic">“{sentenceEvaluation.correction}”</p>
                        <button type="button" onClick={() => { setNote(sentenceEvaluation.correction ?? note); setSentenceEvaluation(null); }} className="mt-2 rounded-lg bg-[hsl(var(--card))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary))]">Use this revision</button>
                      </div>
                    )}
                  </div>
                )}
                {sentenceError && <p role="alert" className="mt-3 text-xs leading-relaxed text-[hsl(var(--destructive))]">{sentenceError}</p>}
              </div>

              <RetentionSwipeMeter onReview={onReview} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const SWIPE_THRESHOLD = 72;

function RetentionSwipeMeter({ onReview }: { onReview: (rating: ReviewRating) => void }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [committed, setCommitted] = useState<ReviewRating | null>(null);
  const pointerStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const commitTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
  }, []);

  const activeDirection = Math.abs(offset.x) > Math.max(24, Math.abs(offset.y))
    ? offset.x < 0 ? 'left' : 'right'
    : offset.y < -24 ? 'up' : null;

  const commit = (rating: ReviewRating) => {
    if (committed) return;
    setCommitted(rating);
    setDragging(false);
    setOffset(rating === 'again'
      ? { x: -420, y: 10 }
      : rating === 'soon'
        ? { x: 420, y: 10 }
        : { x: 0, y: -360 });
    commitTimer.current = window.setTimeout(() => onReview(rating), 190);
  };

  const reset = () => {
    pointerStart.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (committed || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId || committed) return;
    setOffset({
      x: Math.max(-170, Math.min(170, event.clientX - start.x)),
      y: Math.max(-145, Math.min(38, event.clientY - start.y)),
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId || committed) return;
    pointerStart.current = null;

    const horizontalDistance = Math.abs(offset.x);
    const upwardDistance = Math.max(0, -offset.y);
    if (horizontalDistance >= SWIPE_THRESHOLD && horizontalDistance > upwardDistance) {
      commit(offset.x < 0 ? 'again' : 'soon');
    } else if (upwardDistance >= SWIPE_THRESHOLD && upwardDistance > horizontalDistance) {
      commit('known');
    } else {
      reset();
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commit('again');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      commit('soon');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      commit('known');
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.38)] p-4 md:p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono-ui text-[9px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Retention meter</div>
          <h2 className="mt-1 text-sm font-extrabold">Swipe based on what your memory needs.</h2>
        </div>
        <span className="hidden font-mono-ui text-[9px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))] sm:block">Arrow keys work too</span>
      </div>

      <div className="relative mt-4 h-56 overflow-hidden rounded-2xl bg-[hsl(var(--background)/.72)]">
        <div className={`pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-[hsl(var(--primary)/.12)] px-3 py-1.5 text-center transition-opacity ${activeDirection === 'up' ? 'opacity-100' : 'opacity-55'}`}>
          <ArrowUp className="mx-auto text-[hsl(var(--primary))]" size={15} />
          <div className="mt-0.5 font-mono-ui text-[8px] font-bold uppercase tracking-[.08em]">Feels familiar</div>
        </div>
        <div className={`pointer-events-none absolute bottom-5 left-3 z-10 max-w-[88px] transition-opacity ${activeDirection === 'left' ? 'opacity-100' : 'opacity-55'}`}>
          <ArrowLeft className="text-[hsl(var(--accent-foreground))]" size={17} />
          <div className="mt-1 text-[10px] font-extrabold">Need help</div>
          <div className="text-[9px] text-[hsl(var(--muted-foreground))]">I’d like another look</div>
        </div>
        <div className={`pointer-events-none absolute bottom-5 right-3 z-10 max-w-[100px] text-right transition-opacity ${activeDirection === 'right' ? 'opacity-100' : 'opacity-55'}`}>
          <ArrowRight className="ml-auto text-[hsl(var(--primary))]" size={17} />
          <div className="mt-1 text-[10px] font-extrabold">I get the gist</div>
          <div className="text-[9px] text-[hsl(var(--muted-foreground))]">Tell me a little more</div>
        </div>

        <div
          role="group"
          tabIndex={0}
          aria-label="Retention rating. Swipe left or press Left Arrow for another look. Swipe right or press Right Arrow for more information. Swipe up or press Up Arrow when the word feels familiar."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={reset}
          onKeyDown={handleKeyDown}
          className="absolute left-1/2 top-1/2 z-20 flex h-32 w-[min(64%,260px)] touch-none select-none flex-col items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 text-center shadow-lift outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${offset.x / 18}deg)`,
            transition: dragging ? 'none' : 'transform 190ms ease-out',
          }}
        >
          <Sparkles size={18} className="text-[hsl(var(--primary))]" />
          <div className="mt-2 text-sm font-extrabold">
            {activeDirection === 'left'
              ? 'I need help'
              : activeDirection === 'right'
                ? 'I’d like more information'
                : activeDirection === 'up'
                  ? 'This feels familiar'
                  : 'Drag this card'}
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Left for another look · Right for more · Up when it feels familiar
          </div>
        </div>
      </div>
    </section>
  );
}

function HistoryView({
  entries,
  bookmarks,
  onToggleBookmark,
}: {
  entries: { item: DiscoveryHistoryItem; word: Word }[];
  bookmarks: string[];
  onToggleBookmark: (wordId: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-5 pb-28 pt-24 md:px-10 md:pb-12">
      <div className="mx-auto max-w-[1000px]">
        <div className="mb-6">
          <h1 className="font-display text-4xl tracking-[-.04em]">Discovery history</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Every word you paused on stays here, so you can save it even if the moment passed.</p>
        </div>
        {entries.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {entries.map(({ item, word }) => (
              <HistoryCard
                key={word.id}
                item={item}
                word={word}
                isBookmarked={bookmarks.includes(word.id)}
                onToggleBookmark={() => onToggleBookmark(word.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-14 text-center">
            <History className="mx-auto text-[hsl(var(--primary))]" size={28} />
            <h2 className="mt-4 font-display text-3xl">Your trail starts in the feed.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[hsl(var(--muted-foreground))]">Pause on a word for a moment and it will appear here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryCard({
  item,
  word,
  isBookmarked,
  onToggleBookmark,
}: {
  item: DiscoveryHistoryItem;
  word: Word;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <article className="self-start rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-3xl tracking-[-.04em]">{word.word}</h2>
                    <p className="mt-2 text-sm leading-relaxed">{word.definition}</p>
                  </div>
                  <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono-ui text-[9px]">{item.seenCount}× seen</span>
                </div>
                {item.note && <p className="mt-4 border-l-2 border-[hsl(var(--accent))] pl-3 text-xs italic text-[hsl(var(--muted-foreground))]">Your sentence: “{item.note}”</p>}
                <ElaborationPanel word={word} />
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="font-mono-ui text-[9px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">
                    Last seen {new Date(item.lastSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <WordActions word={word} isBookmarked={isBookmarked} onToggleBookmark={onToggleBookmark} compact />
                </div>
    </article>
  );
}

function ElaborationPanel({ word }: { word: Word }) {
  const [elaborated, setElaborated] = useState(false);
  const details = DISCOVERY_ELABORATIONS[word.id];
  if (!details) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setElaborated(value => !value)}
        aria-expanded={elaborated}
        aria-controls={`elaboration-${word.id}`}
        className="flex min-h-10 w-full items-center justify-between rounded-xl bg-[hsl(var(--secondary)/.65)] px-3 text-xs font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))]"
      >
        Elaborate
        <ChevronDown size={15} className={`transition-transform ${elaborated ? 'rotate-180' : ''}`} />
      </button>
      {elaborated && (
        <div id={`elaboration-${word.id}`} className="mt-3 animate-in-up space-y-4 rounded-xl border border-[hsl(var(--border))] p-4">
          <div>
            <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Usage across time</div>
            <dl className="mt-3 space-y-3 text-xs leading-relaxed">
              <div><dt className="font-bold text-[hsl(var(--primary))]">Past</dt><dd className="mt-0.5">“{details.past}”</dd></div>
              <div><dt className="font-bold text-[hsl(var(--primary))]">Present</dt><dd className="mt-0.5">“{details.present}”</dd></div>
              <div><dt className="font-bold text-[hsl(var(--primary))]">Future</dt><dd className="mt-0.5">“{details.future}”</dd></div>
            </dl>
          </div>
          <div className="grid gap-3 border-t border-[hsl(var(--border))] pt-4 sm:grid-cols-2">
            <WordList label="Synonyms" words={details.synonyms} tone="primary" />
            <WordList label="Antonyms" words={details.antonyms} tone="accent" />
          </div>
        </div>
      )}
    </div>
  );
}

function WordList({ label, words, tone }: { label: string; words: string[]; tone: 'primary' | 'accent' }) {
  if (words.length === 0) return null;

  const colorClass = tone === 'primary'
    ? 'bg-[hsl(var(--primary)/.09)] text-[hsl(var(--primary))]'
    : 'bg-[hsl(var(--accent)/.13)] text-[hsl(var(--accent-foreground))]';

  return (
    <div>
      <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {words.map(item => <span key={item} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${colorClass}`}>{item}</span>)}
      </div>
    </div>
  );
}