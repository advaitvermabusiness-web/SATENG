import { useState } from 'react';
import { useLocation } from 'wouter';
import { X, Sparkles, Zap, Brain, Target, LineChart, Trophy } from 'lucide-react';

export function Paywall({ onClose }: { onClose: () => void }) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--background)/.8)] p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="relative w-full max-w-2xl animate-in-up overflow-hidden rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lift"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-6 top-6 z-10 rounded-full bg-[hsl(var(--secondary))] p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary-foreground)/.1)] hover:text-[hsl(var(--foreground))]">
          <X size={20} />
        </button>

        <div className="flex flex-col md:flex-row">
          <div className="bg-[hsl(var(--primary)/.05)] p-8 md:w-[45%] md:p-10 border-b md:border-b-0 md:border-r border-[hsl(var(--border))]">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md">
              <Sparkles size={24} strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-3xl leading-tight tracking-[-.02em]">Keep learning at your own pace.</h2>
            <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              If Wordwell is helping, Premium will eventually give you more room to practice. There’s no rush, and you never need to buy anything to keep your progress.
            </p>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <Zap size={18} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-bold">More room for Quick Mode</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Short, focused review when that feels useful.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Target size={18} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-bold">More SAT practice when you’re ready</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Go deeper without needing to rush there.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Brain size={18} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-bold">Adaptive review (planned)</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">A little help choosing what to revisit next.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Trophy size={18} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-bold">A calmer progress view</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Notice what’s becoming familiar over time.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:w-[55%] md:p-10">
            <div className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.3)] p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono-ui text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--primary))]">
                  Premium, when it’s ready
                </span>
                <span className="rounded-full bg-[hsl(var(--primary)/.15)] px-2 py-0.5 font-mono-ui text-[9px] font-bold text-[hsl(var(--primary))]">
                  Coming Soon
                </span>
              </div>
              <div className="text-sm font-bold text-[hsl(var(--foreground))]">
                Billing is not connected yet.
              </div>
              <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                You can keep using the free experience today. No countdown, no lost progress, and no pressure to decide.
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button disabled className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] opacity-70 cursor-not-allowed">
                Billing Not Connected
              </button>
              <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
                Payment integration is currently unavailable. No charges will be made.
              </p>
              
              <div className="my-2 h-px w-full bg-[hsl(var(--border))]"></div>
              
              <button onClick={onClose} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]">
                Keep using Wordwell
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
