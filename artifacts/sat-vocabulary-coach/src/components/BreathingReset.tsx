import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pause, Wind, X } from 'lucide-react';

type BreathPhase = {
  key: 'inhale' | 'hold' | 'exhale';
  label: string;
  cue: string;
  duration: number;
  scale: number;
};

const PHASES: BreathPhase[] = [
  { key: 'inhale', label: 'Breathe in', cue: 'Draw a slow breath through your nose.', duration: 4, scale: 1.42 },
  { key: 'hold', label: 'Hold gently', cue: 'Let the breath settle without forcing it.', duration: 2, scale: 1.42 },
  { key: 'exhale', label: 'Breathe out', cue: 'Release the breath slowly and completely.', duration: 6, scale: 0.84 },
];

const SESSION_SECONDS = 36;

export function BreathingReset({ onClose }: { onClose: () => void }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [phaseEndsAt, setPhaseEndsAt] = useState(() => Date.now() + PHASES[0].duration * 1000);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [orbScale, setOrbScale] = useState(0.84);
  const onCloseRef = useRef(onClose);
  const phase = PHASES[phaseIndex];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (paused) return undefined;
    const delay = Math.max(0, phaseEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      const nextIndex = (phaseIndex + 1) % PHASES.length;
      const nextStartedAt = Date.now();
      setPhaseIndex(nextIndex);
      setStartedAt(nextStartedAt);
      setPhaseEndsAt(nextStartedAt + PHASES[nextIndex].duration * 1000);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase.duration, phaseEndsAt, phaseIndex, paused]);

  useEffect(() => {
    if (paused) return undefined;
    const elapsed = Math.max(0, (now - sessionStartedAt) / 1000);
    if (elapsed >= SESSION_SECONDS) {
      onCloseRef.current();
    }
    return undefined;
  }, [now, paused, sessionStartedAt]);

  useEffect(() => {
    if (paused) return undefined;
    const frame = window.requestAnimationFrame(() => setOrbScale(phase.scale));
    return () => window.cancelAnimationFrame(frame);
  }, [phase.scale, paused]);

  const elapsedInPhase = Math.max(0, (now - startedAt) / 1000);
  const phaseSecondsLeft = Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
  const secondsLeft = Math.max(0, Math.ceil(SESSION_SECONDS - (now - sessionStartedAt) / 1000));
  const cycleProgress = Math.min(1, elapsedInPhase / phase.duration);
  const phaseProgress = useMemo(
    () => `${Math.max(0, Math.min(100, cycleProgress * 100))}%`,
    [cycleProgress],
  );

  const togglePause = () => {
    if (paused) {
      const resumeAt = Date.now();
      const pauseDuration = resumeAt - (pausedAt ?? resumeAt);
      setStartedAt(value => value + pauseDuration);
      setPhaseEndsAt(value => value + pauseDuration);
      setSessionStartedAt(value => value + pauseDuration);
      setPausedAt(null);
      setNow(resumeAt);
      setPaused(false);
      return;
    }
    setPausedAt(Date.now());
    setPaused(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[hsl(var(--background)/.96)] p-5 backdrop-blur-lg"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="breathing-reset-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close breathing reset"
        className="absolute right-5 top-5 rounded-full bg-[hsl(var(--secondary))] p-2.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary-foreground)/.1)] hover:text-[hsl(var(--foreground))]"
      >
        <X size={20} />
      </button>

      <div className="flex w-full max-w-md flex-col items-center text-center" onClick={event => event.stopPropagation()}>
        <div className="mb-7 flex items-center gap-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-[hsl(var(--primary))]">
          <Wind size={14} /> Study reset
        </div>
        <h2 id="breathing-reset-title" className="font-display text-4xl tracking-[-.04em] md:text-5xl">
          Make some room.
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          Follow the circle through a calm 4–2–6 breathing pattern.
        </p>

        <div className="relative mt-10 flex h-64 w-64 items-center justify-center">
          <div
            className="absolute h-48 w-48 rounded-full border border-[hsl(var(--primary)/.14)] transition-transform ease-in-out"
            style={{ transform: `scale(${orbScale * 1.08})`, transitionDuration: `${phase.duration * 1000}ms` }}
            aria-hidden="true"
          />
          <div
            className="absolute h-48 w-48 rounded-full border-[hsl(var(--primary)/.14)] transition-transform ease-in-out"
            style={{ borderWidth: phase.key === 'inhale' ? 12 : 7, transform: `scale(${orbScale * 1.24})`, transitionDuration: `${phase.duration * 1000}ms` }}
            aria-hidden="true"
          />
          <div
            className="absolute h-36 w-36 rounded-full bg-[hsl(var(--primary)/.12)] transition-transform ease-in-out"
            style={{ transform: `scale(${orbScale})`, transitionDuration: `${phase.duration * 1000}ms` }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_12px_30px_hsl(var(--primary)/.26)]">
            {paused ? <Pause size={27} /> : <Wind size={28} />}
          </div>
        </div>

        <div className="min-h-[92px]">
          <div className="font-display text-3xl tracking-[-.03em]">{paused ? 'Paused' : phase.label}</div>
          <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{paused ? 'Resume whenever you are ready.' : phase.cue}</p>
          {!paused && (
            <div className="mt-3 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">
              {phaseSecondsLeft}s · {phase.key}
            </div>
          )}
        </div>

        <div className="mt-7 w-full max-w-xs">
          <div className="mb-2 flex items-center justify-between font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">
            <span>{paused ? 'Paused' : 'Current breath'}</span>
            <span>{secondsLeft}s left</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
            <div className="h-full rounded-full bg-[hsl(var(--primary))] transition-[width] duration-100" style={{ width: phaseProgress }} />
          </div>
        </div>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={togglePause}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-4 text-xs font-bold text-[hsl(var(--secondary-foreground))] transition-colors hover:bg-[hsl(var(--sidebar-accent))]"
          >
            {paused ? <><Check size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Finish reset
          </button>
        </div>
      </div>
    </div>
  );
}