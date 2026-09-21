import { useState, useRef, useEffect, useMemo } from 'react';
import { type Word, type WordProgress, type StudySettings } from '../types';
import { WORDS } from '../data/words';
import { EVERYDAY_WORDS } from '../data/everydayWords';
import { EXPERT_WORDS } from '../data/expertWords';
import { 
  Volume2, 
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { WordActions } from '../components/WordActions';
import { GeneratedScenario } from '../components/GeneratedScenario';
import { recordWordReview } from '../lib/spacedRepetition';

export function Quick({ 
  settings, 
  progress, 
  setProgress,
  setSettings,
  bookmarks,
  onToggleBookmark,
}: { 
  settings: StudySettings; 
  progress: WordProgress[]; 
  setProgress: (val: WordProgress[] | ((curr: WordProgress[]) => WordProgress[])) => void;
  setSettings: (val: StudySettings | ((curr: StudySettings) => StudySettings)) => void;
  bookmarks: string[];
  onToggleBookmark: (wordId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const quickWords = useMemo(
    () => settings.expertMode
      ? EXPERT_WORDS
      : settings.satMode
        ? WORDS.filter(w => w.difficulty === settings.level)
        : EVERYDAY_WORDS.filter(w => w.difficulty === settings.level),
    [settings.expertMode, settings.level, settings.satMode],
  );

  
  const seenIndexes = useRef(new Set<number>());

  useEffect(() => {
    setActiveIndex(0);
    seenIndexes.current.clear();
    containerRef.current?.scrollTo({ top: 0 });
  }, [quickWords]);

  useEffect(() => {
    if (!seenIndexes.current.has(activeIndex) && activeIndex < quickWords.length) {
      seenIndexes.current.add(activeIndex);
      setSettings(current => ({
        ...current,
        quickWordsSeen: (current.quickWordsSeen || 0) + 1,
      }));
    }
  }, [activeIndex, quickWords.length, setSettings]);


  // Handle scroll to detect active card
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, clientHeight } = containerRef.current;
      const newIndex = Math.round(scrollTop / clientHeight);
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    };
    const el = containerRef.current;
    if (el) el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { if (el) el.removeEventListener('scroll', handleScroll); };
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        containerRef.current.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        containerRef.current.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Top Nav Overlay */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-[hsl(var(--background))] to-transparent px-5 py-6">
        <Link href="/" aria-label="Exit Quick Mode" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--card)/.4)] backdrop-blur-md transition-colors hover:bg-[hsl(var(--card)/.8)]">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--card)/.4)] px-3 py-1.5 backdrop-blur-md">
           <Zap size={14} className={settings.expertMode ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--accent))]'} />
           <span className="font-mono-ui text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--foreground))]">{settings.expertMode ? 'Quick Mode · Expert' : settings.satMode ? 'Quick Mode · SAT' : 'Quick Mode · Everyday'}</span>
        </div>
      </div>

      {/* Progress Bar Overlay */}
      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex flex-col items-center gap-2">
        {quickWords.map((_, i) => (
          <div 
            key={i} 
            className={`w-1 rounded-full transition-all duration-300 ${i === activeIndex ? 'h-6 bg-[hsl(var(--primary))]' : 'h-2 bg-[hsl(var(--border))] opacity-50'}`}
          />
        ))}
      </div>

      {/* Feed Container */}
      <div 
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        {quickWords.map((word, i) => (
          <QuickCard 
            key={word.id} 
            word={word} 
             satMode={settings.satMode === true && !settings.expertMode}
            isActive={i === activeIndex} 
            setProgress={setProgress}
            isBookmarked={bookmarks.includes(word.id)}
            onToggleBookmark={() => onToggleBookmark(word.id)}
          />
        ))}
      </div>
    </div>
  );
}

function QuickCard({ 
  word, 
  satMode,
  isActive,
  setProgress,
  isBookmarked,
  onToggleBookmark,
}: { 
  word: Word; 
  satMode: boolean;
  isActive: boolean;
  setProgress: (val: WordProgress[] | ((curr: WordProgress[]) => WordProgress[])) => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedConfidence, setSelectedConfidence] = useState<number | null>(null);
  const [showRetentionTactics, setShowRetentionTactics] = useState(false);
  // Reset expanded state if scrolled away
  useEffect(() => {
    if (!isActive) {
      setExpanded(false);
      setShowRetentionTactics(false);
    }
  }, [isActive]);

  useEffect(() => {
    setSelectedConfidence(null);
    setShowRetentionTactics(false);
  }, [word.id]);

  const handleConfidence = (confidence: number) => {
    if (selectedConfidence !== null) return;
    setSelectedConfidence(confidence);
    if (confidence === 5) setShowRetentionTactics(true);
    setProgress(items => recordWordReview(items, word.id, confidence, confidence >= 3));
  };

  return (
    <div className="relative h-[100dvh] w-full snap-start snap-always">
      <div className="flex h-full w-full flex-col justify-center px-6 md:px-12 lg:mx-auto lg:max-w-2xl">
        <div 
          className={`flex h-[85vh] w-full touch-pan-y flex-col overflow-y-auto rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-500 ease-out md:h-[80vh] ${expanded ? 'shadow-lift' : 'cursor-pointer shadow-soft hover:border-[hsl(var(--primary)/.4)]'}`}
          onClick={() => { if (!expanded) setExpanded(true); }}
        >
          {/* Initial View (Top Half or Full if not expanded) */}
          <div className="flex shrink-0 flex-col p-8 md:p-12">
            <div className="mb-8">
              <h2 className="font-display text-5xl tracking-[-.05em] md:text-7xl">{word.word}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[hsl(var(--primary)/.08)] px-2.5 py-1 font-mono-ui text-xs text-[hsl(var(--primary))]" title="International Phonetic Alphabet">
                  IPA {word.pronunciation}
                </span>
                <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-[.08em] text-[hsl(var(--secondary-foreground))]">
                  {word.partOfSpeech}
                </span>
              </div>
              <div className="mt-4">
                <WordActions word={word} isBookmarked={isBookmarked} onToggleBookmark={onToggleBookmark} compact />
              </div>
            </div>

            <div className="border-l-2 border-[hsl(var(--accent))] pl-5">
                 <div className="mb-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">A little context</div>
              <p className="text-xl font-bold leading-relaxed tracking-[-.01em]">"{word.example}"</p>
            </div>

            {!expanded && (
              <div className="mt-12 flex flex-col items-center animate-float text-[hsl(var(--muted-foreground))]">
                 <span className="mb-2 font-mono-ui text-[10px] uppercase tracking-[.15em]">Open when you’re ready</span>
                <ChevronDown size={20} />
              </div>
            )}
          </div>

          {/* Expanded View */}
          <div className={`flex flex-col gap-8 px-8 pb-10 md:px-12 transition-all duration-700 ease-out ${expanded ? 'opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
            
            {/* Definition & Deep Context */}
            <div className="animate-in-up delay-1">
              <p className="text-lg text-[hsl(var(--foreground))]">{word.definition}</p>
              <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.62)] p-5">
                <div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">
                   <Sparkles size={13} /> {satMode ? 'SAT-Style Context' : 'Everyday Context'}
                </div>
                <p className="text-sm leading-relaxed">"{word.expandedSentence}"</p>
              </div>
               <GeneratedScenario word={word} compact />
            </div>

            {/* Word details grid */}
            <div className="grid gap-4 animate-in-up delay-2 md:grid-cols-2">
              {word.synonyms.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <div className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Synonyms</div>
                  <div className="text-sm font-bold">{word.synonyms.join(', ')}</div>
                </div>
              )}
              {word.antonyms.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <div className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Antonyms</div>
                  <div className="text-sm font-bold">{word.antonyms.join(', ')}</div>
                </div>
              )}
              <div className="rounded-xl border border-[hsl(var(--border))] p-4 md:col-span-2">
                <div className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Forms</div>
                {word.forms.verb ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-[hsl(var(--secondary))] px-2 py-1">Base: {word.forms.verb.present}</span>
                    <span className="rounded bg-[hsl(var(--secondary))] px-2 py-1">Past: {word.forms.verb.past}</span>
                    <span className="rounded bg-[hsl(var(--secondary))] px-2 py-1">Participle: {word.forms.verb.pastParticiple}</span>
                    <span className="rounded bg-[hsl(var(--secondary))] px-2 py-1">Future: {word.forms.verb.future}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {word.forms.other?.map(f => <span key={f} className="rounded bg-[hsl(var(--secondary))] px-2 py-1">{f}</span>)}
                  </div>
                )}
              </div>
            </div>

            {/* Etymology & Memory */}
            <div className="animate-in-up delay-3 space-y-4 rounded-2xl bg-[hsl(var(--primary)/.05)] p-5 text-sm">
              <div>
                <strong className="text-[hsl(var(--primary))]">Roots:</strong> {word.etymology}
              </div>
              <div>
                <strong className="text-[hsl(var(--primary))]">Family:</strong> {word.wordFamily}
              </div>
              <div>
                <strong className="text-[hsl(var(--primary))]">Memory Cue:</strong> {word.memoryCue}
              </div>
            </div>

            {/* Active Recall & Confidence */}
            <div className="mt-4 animate-in-up delay-4">
              <div className="mb-4 rounded-xl border-l-2 border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.05)] p-4">
                <div className="mb-1 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--accent-foreground))]">Active Recall</div>
                <div className="text-sm font-bold text-[hsl(var(--foreground))]">{word.activeRecallPrompt}</div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" aria-pressed={selectedConfidence === 1} disabled={selectedConfidence !== null} onClick={(e) => { e.stopPropagation(); handleConfidence(1); }} className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${selectedConfidence === 1 ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.12)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.08)]'}`}>
                  <div className="mb-1 text-sm font-extrabold">Still foggy</div>
                   <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Another pass can help</div>
                </button>
                <button type="button" aria-pressed={selectedConfidence === 3} disabled={selectedConfidence !== null} onClick={(e) => { e.stopPropagation(); handleConfidence(3); }} className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${selectedConfidence === 3 ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.12)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)]'}`}>
                  <div className="mb-1 text-sm font-extrabold">Getting there</div>
                   <div className="text-[11px] text-[hsl(var(--muted-foreground))]">I recognize it a little</div>
                </button>
                <button type="button" aria-pressed={selectedConfidence === 5} disabled={selectedConfidence !== null} onClick={(e) => { e.stopPropagation(); handleConfidence(5); }} className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${selectedConfidence === 5 ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.12)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)]'}`}>
                  <div className="mb-1 text-sm font-extrabold">It’s mine</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">Can use it</div>
                </button>
              </div>
              <div className="mt-3 text-center font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]" aria-live="polite">
                 {selectedConfidence === null ? 'Choose what feels true' : 'Noted for your next visit'}
              </div>
              {showRetentionTactics && (
                <div className="mt-5 rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.07)] p-5" aria-live="polite">
                  <div className="mb-3 flex items-center gap-2 font-mono-ui text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">
                    <Info size={13} /> Make it mine
                  </div>
                   <p className="text-sm font-bold leading-relaxed">Here are a few friendly ways to help this word feel more familiar.</p>
                  <div className="mt-4 grid gap-3 text-xs leading-relaxed">
                    <div><strong>Retrieve first.</strong> Say the meaning and make your own example before looking again.</div>
                    <div><strong>Connect it.</strong> Link the word to its context, roots, or a personal memory.</div>
                    <div><strong>Return later.</strong> Review it after a day, then again at wider intervals.</div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
