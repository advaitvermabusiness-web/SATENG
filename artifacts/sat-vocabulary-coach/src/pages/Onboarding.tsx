import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { type StudySettings } from '../types';
import { ArrowRight, Sparkles, BookOpen, Target } from 'lucide-react';

export function Onboarding({ settings, setSettings }: { settings: StudySettings; setSettings: (val: StudySettings | ((curr: StudySettings) => StudySettings)) => void }) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => Math.max(0, s - 1));

  const steps = [
    {
      title: "Welcome to Wordwell.",
      subtitle: "You don't need to learn every word today. Wordwell builds lasting vocabulary through calm, focused repetition in context.",
      content: (
        <div className="flex flex-col gap-3">
          <button onClick={handleNext} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] font-bold text-[hsl(var(--primary-foreground))] hover:brightness-95">
            Let's get started <ArrowRight size={17} />
          </button>
          <div className="mt-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
            Already have a study path?{' '}
            <Link href="/sign-in" className="font-bold text-[hsl(var(--primary))] no-underline hover:underline">
              Log in
            </Link>
            <span className="mx-2 text-[hsl(var(--border))]">·</span>
            <Link href="/terms" className="font-bold text-[hsl(var(--primary))] no-underline hover:underline">
              Terms of Use
            </Link>
          </div>
        </div>
      )
    },
    {
      title: "How are you feeling about learning new words?",
      subtitle: "This helps us set the right initial pace. No judgment.",
      content: (
        <div className="flex flex-col gap-3">
          {[
            { id: 'anxious', label: 'Overwhelmed', desc: 'I need to start small and build up.' },
            { id: 'steady', label: 'Okay', desc: 'I know some words, but need practice.' },
            { id: 'confident', label: 'Confident', desc: 'I want to be challenged right away.' }
          ].map(opt => (
            <button key={opt.id} onClick={() => {
              setSettings(s => ({ ...s, confidenceLevel: opt.id, level: opt.id === 'confident' ? 'Advanced' : 'Foundational', dailyGoal: opt.id === 'anxious' ? 3 : 5 }));
              handleNext();
            }} className="flex flex-col gap-1 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-sm transition-colors hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--primary)/.05)]">
              <span className="font-bold text-[hsl(var(--foreground))]">{opt.label}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{opt.desc}</span>
            </button>
          ))}
          <button onClick={handleBack} className="mt-4 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Go back</button>
        </div>
      )
    },
    {
      title: "What kind of pace feels kind to you?",
      subtitle: "There is no wrong timeline. We’ll help you meet new words without turning learning into another deadline.",
      content: (
        <div className="flex flex-col gap-3">
          {[
            { id: 'soon', label: 'I have a near-term goal' },
            { id: 'medium', label: 'I’m building steadily over time' },
            { id: 'far', label: 'No deadline — I’m here to practice' }
          ].map(opt => (
            <button key={opt.id} onClick={() => {
              setSettings(s => ({ ...s, targetTiming: opt.id }));
              handleNext();
            }} className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-sm transition-colors hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--primary)/.05)]">
              <span className="font-bold text-[hsl(var(--foreground))]">{opt.label}</span>
              <ArrowRight size={16} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          ))}
          <button onClick={handleBack} className="mt-4 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Go back</button>
        </div>
      )
    },
    {
      title: "What brings you back?",
      subtitle: "Choose the path you want to return to. You can switch among Everyday, SAT, and Expert later.",
      content: (
        <div className="flex flex-col gap-3">
          <button onClick={() => {
            setSettings(s => ({ ...s, satMode: false, expertMode: false, hasCompletedOnboarding: true }));
            setLocation('/');
          }} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] p-5 text-left transition-colors hover:bg-[hsl(var(--primary)/.15)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="font-bold text-[hsl(var(--foreground))]">I’m here to keep learning</div>
              <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Build a lasting habit with useful everyday words.</div>
            </div>
          </button>
          <button onClick={() => {
            setSettings(s => ({ ...s, satMode: true, expertMode: false, hasCompletedOnboarding: true }));
            setLocation('/');
          }} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-colors hover:bg-[hsl(var(--secondary))]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
              <Target size={18} />
            </div>
            <div>
              <div className="font-bold text-[hsl(var(--foreground))]">I’m preparing for the SAT</div>
              <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Use SAT Mode for exam-focused words and practice.</div>
            </div>
          </button>
          <div className="rounded-xl bg-[hsl(var(--secondary)/.55)] px-4 py-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            Looking for a bigger challenge? <strong className="text-[hsl(var(--foreground))]">Expert Mode</strong> is available after setup for uncommon, demanding vocabulary.
          </div>
          <button onClick={handleBack} className="mt-4 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Go back</button>
        </div>
      )
    }
  ];

  const current = steps[step];

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[hsl(var(--background))] p-6 text-[hsl(var(--foreground))] md:p-12">
      <div className="w-full max-w-md animate-in-up">
        <div className="mb-10 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md">
            <Sparkles size={24} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl tracking-[-.02em] md:text-4xl">{current.title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{current.subtitle}</p>
        </div>

        <div className="w-full">
          {current.content}
        </div>

        <div className="mt-12 text-center">
          <div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Step {step + 1} of {steps.length}</div>
          <div className="mt-3 flex justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={`Onboarding step ${step + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <div key={i} aria-hidden="true" className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-[hsl(var(--primary))]' : 'w-1.5 bg-[hsl(var(--border))]'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
