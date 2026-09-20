import { useState } from 'react';
import { type StudySettings, type FocusProfile } from '../types';
import { X, Check } from 'lucide-react';

export function FocusCheck({ 
  settings, 
  setSettings,
  onClose 
}: { 
  settings: StudySettings; 
  setSettings: (val: StudySettings | ((current: StudySettings) => StudySettings)) => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const questions = [
    {
      question: "How much time do you realistically have right now?",
      options: [
        { label: "Under 5 minutes", value: 1 }, // Quick
        { label: "About 10 minutes", value: 2 }, // Standard
        { label: "15+ minutes", value: 3 } // Deep
      ]
    },
    {
      question: "What's your current energy level?",
      options: [
            { label: "Low (I need an easy start)", value: 1 },
            { label: "Medium (I can read for a bit)", value: 2 },
            { label: "High (I’m ready to think)", value: 3 }
      ]
    },
    {
      question: "How distracting is your environment?",
      options: [
        { label: "Very (noisy/busy)", value: 1 },
        { label: "Somewhat (some background noise)", value: 2 },
        { label: "Quiet (mostly just me)", value: 3 }
      ]
    }
  ];

  const handleAnswer = (val: number) => {
    const newAnswers = [...answers, val];
    if (newAnswers.length < questions.length) {
      setAnswers(newAnswers);
      setStep(step + 1);
    } else {
      // Calculate profile
      const total = newAnswers.reduce((acc, curr) => acc + curr, 0);
      let profile: FocusProfile = 'Standard';
      if (total <= 4) profile = 'Quick';
      else if (total >= 7) profile = 'Deep';
      
      setSettings(prev => ({
        ...prev,
        focusProfile: profile,
        dailyGoal: profile === 'Quick' ? 3 : profile === 'Standard' ? 5 : 10
      }));
      setAnswers(newAnswers);
      setStep(step + 1);
    }
  };

  if (step === questions.length) {
    return (
      <div className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))]">
            <Check size={20} />
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              <X size={18} />
            </button>
          )}
        </div>
        <h3 className="font-display text-2xl">You’ve got a kind, workable plan.</h3>
        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          I set you up with <strong>{settings.focusProfile || 'Standard'} Mode</strong> and a {settings.dailyGoal}-word goal for now. It’s a suggestion, not a test—you can change it whenever your day changes.
        </p>
        <button 
          onClick={onClose}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] hover:brightness-95"
        >
          Got it
        </button>
      </div>
    );
  }

  const q = questions[step];

  return (
    <div className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-soft">
      <div className="mb-6 flex items-center justify-between">
        <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">
          Focus Check {step + 1} of {questions.length}
        </div>
        {onClose ? (
          <button onClick={onClose} className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X size={18} />
          </button>
        ) : (
          <button onClick={() => {
            setSettings(p => ({ ...p, focusProfile: 'Standard' }));
          }} className="text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Skip for now
          </button>
        )}
      </div>
      <h3 className="font-display text-2xl md:text-3xl">{q.question}</h3>
      <div className="mt-6 flex flex-col gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(opt.value)}
            className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-left shadow-sm transition-colors hover:border-[hsl(var(--primary)/.6)] hover:-translate-y-0.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] font-mono-ui text-[10px] font-bold">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-sm font-bold">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
