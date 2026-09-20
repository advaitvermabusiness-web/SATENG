import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { Word } from '../types';

type GeneratedScenarioResponse = {
  scenario: string;
  contextLabel: string;
};

const scenarioStorageKey = (wordId: string) => `wordwell-generated-scenarios:${wordId}`;

function isGeneratedScenarioResponse(value: unknown): value is GeneratedScenarioResponse {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as GeneratedScenarioResponse).scenario === 'string' &&
    (value as GeneratedScenarioResponse).scenario.trim().length >= 20 &&
    typeof (value as GeneratedScenarioResponse).contextLabel === 'string' &&
    (value as GeneratedScenarioResponse).contextLabel.trim().length > 0,
  );
}

export function GeneratedScenario({ word, compact = false }: { word: Word; compact?: boolean }) {
  const [generated, setGenerated] = useState<GeneratedScenarioResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  useEffect(() => {
    requestVersion.current += 1;
    setGenerated(null);
    try {
      const stored = localStorage.getItem(scenarioStorageKey(word.id));
      const parsed = stored ? JSON.parse(stored) : [];
      setHistory(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string').slice(-12) : []);
    } catch {
      setHistory([]);
    }
    setGenerating(false);
    setError('');
  }, [word.id]);

  const generateScenario = async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate-word-scenario', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordId: word.id,
          word: word.word,
          partOfSpeech: word.partOfSpeech,
          definition: word.definition,
          track: word.track ?? 'sat',
          existingExamples: [word.example, word.expandedSentence, ...history].slice(-8),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || 'A new scenario is temporarily unavailable.');
      }

      const next: unknown = await response.json();
      if (!isGeneratedScenarioResponse(next)) throw new Error('The generated scenario was not valid.');
      if (version !== requestVersion.current) return;
      setGenerated(next);
      setHistory(items => {
        const updated = [...items, next.scenario].slice(-12);
        try {
          localStorage.setItem(scenarioStorageKey(word.id), JSON.stringify(updated));
        } catch {
          // The current scenario remains usable when browser storage is unavailable.
        }
        return updated;
      });
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(requestError instanceof Error ? requestError.message : 'A new scenario is temporarily unavailable.');
    } finally {
      if (version === requestVersion.current) setGenerating(false);
    }
  };

  return (
    <div className={`${compact ? 'mt-3' : 'mt-5'} rounded-2xl border border-[hsl(var(--primary)/.24)] bg-[hsl(var(--primary)/.05)] p-4`} data-testid={`generated-scenario-${word.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--primary))]"><Sparkles size={13} /> AI scenario · Premium variation</div>
          {!compact && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Meet the same word in a different setting to strengthen recall.</p>}
        </div>
        <button
          type="button"
          onClick={() => void generateScenario()}
          disabled={generating}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--card))] px-3 text-xs font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))] disabled:cursor-wait disabled:opacity-60"
          data-testid={`button-generate-scenario-${word.id}`}
        >
          {generating ? <><RefreshCw size={14} className="animate-spin" /> Creating…</> : generated ? <><RefreshCw size={14} /> Another scenario</> : <><Sparkles size={14} /> Generate scenario</>}
        </button>
      </div>
      {generated && (
        <div className="mt-4 rounded-xl bg-[hsl(var(--card))] p-4 shadow-sm" aria-live="polite">
          <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{generated.contextLabel}</div>
          <p className="mt-2 text-sm leading-relaxed">“{generated.scenario}”</p>
        </div>
      )}
      {error && <p className="mt-3 text-xs font-bold text-[hsl(var(--destructive))]" role="alert">{error}</p>}
    </div>
  );
}