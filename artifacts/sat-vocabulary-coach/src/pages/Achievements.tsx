import { useMemo } from 'react';
import { Link } from 'wouter';
import { 
  Trophy, 
  ChevronLeft,
  Medal,
  Flame,
  Zap,
  BookOpen,
  Target,
  Sparkles,
  RefreshCcw,
  Search,
  CheckCircle2
} from 'lucide-react';
import { type WordProgress, type Session, type StudySettings } from '../types';
import { WORDS } from '../data/words';

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  isUnlocked: boolean;
  progressText?: string;
  color: string;
};

export function Achievements({ progress, sessions, settings }: { progress: WordProgress[]; sessions: Session[]; settings: StudySettings }) {
  
  const achievements = useMemo<Achievement[]>(() => {
    const uniqueSessionDates = new Set(sessions.map(s => new Date(s.date).toDateString()));
    
    // Check for a gap of > 2 days in sessions
    let returnedAfterBreak = false;
    if (sessions.length >= 2) {
      const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (let i = 1; i < sorted.length; i++) {
        const gap = (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) / (1000 * 60 * 60 * 24);
        if (gap >= 2) {
          returnedAfterBreak = true;
          break;
        }
      }
    }

    const mistakesMadeUseful = progress.some(p => p.seenCount > (p.correctCount + 1) && p.status === 'mastered');
    
    const foundationalMastered = progress.filter(p => p.status === 'mastered' && WORDS.find(w => w.id === p.wordId)?.difficulty === 'Foundational').length;
    const totalFoundational = WORDS.filter(w => w.difficulty === 'Foundational').length;

    return [
      {
        id: 'first_word',
        title: 'First Encounter',
        description: 'You reviewed your first SAT word. The journey begins.',
        icon: BookOpen,
        isUnlocked: progress.length > 0,
        color: 'text-[hsl(var(--primary))]'
      },
      {
        id: 'context_builder',
        title: 'Diligent Explorer',
        description: 'Reviewed words 10 times to build familiarity.',
        icon: Search,
        isUnlocked: progress.reduce((acc, curr) => acc + curr.seenCount, 0) >= 10,
        progressText: `${Math.min(10, progress.reduce((acc, curr) => acc + curr.seenCount, 0))}/10`,
        color: 'text-[hsl(var(--chart-3))]'
      },
      {
        id: 'recall_rookie',
        title: 'Recall Rookie',
        description: 'Completed your first multiple-choice quiz.',
        icon: Target,
        isUnlocked: sessions.length > 0,
        color: 'text-[hsl(var(--accent))]'
      },
      {
        id: 'three_day_streak',
        title: 'Quiz Rhythm',
        description: 'Completed quizzes on 3 different days.',
        icon: Flame,
        isUnlocked: uniqueSessionDates.size >= 3,
        progressText: `${Math.min(3, uniqueSessionDates.size)}/3`,
        color: 'text-orange-500' // Using explicit tailwind colors for variety or custom chart colors
      },
      {
        id: 'returned_break',
        title: 'Resilient Return',
        description: 'You came back to study after a break of 2+ days.',
        icon: RefreshCcw,
        isUnlocked: returnedAfterBreak,
        color: 'text-[hsl(var(--chart-4))]'
      },
      {
        id: 'mistakes_useful',
        title: 'Mistakes Made Useful',
        description: 'Mastered a word that you initially struggled with.',
        icon: Sparkles,
        isUnlocked: mistakesMadeUseful,
        color: 'text-[hsl(var(--chart-2))]'
      },
      {
        id: 'quick_explorer',
        title: 'Quick Mode Explorer',
        description: 'Reviewed 15 words in Quick Mode.',
        icon: Zap,
        isUnlocked: (settings.quickWordsSeen || 0) >= 15,
        progressText: `${Math.min(15, settings.quickWordsSeen || 0)}/15`,
        color: 'text-yellow-500'
      },
      {
        id: 'focus_check',
        title: 'Self-Aware',
        description: 'Completed a Focus Check to personalize your session.',
        icon: CheckCircle2,
        isUnlocked: settings.focusProfile !== undefined && settings.focusProfile !== null,
        color: 'text-[hsl(var(--chart-5))]'
      },
      {
        id: 'foundational_master',
        title: 'Foundation Built',
        description: 'Mastered all foundational words available.',
        icon: Medal,
        isUnlocked: foundationalMastered > 0 && foundationalMastered >= totalFoundational,
        progressText: `${Math.min(totalFoundational, foundationalMastered)}/${totalFoundational}`,
        color: 'text-[hsl(var(--primary))]'
      }
    ];
  }, [progress, sessions, settings]);

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-20 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/progress" className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] no-underline hover:text-[hsl(var(--primary))]">
            <ChevronLeft size={16} /> Back to Progress
          </Link>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Small wins</div>
        </div>
        
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="animate-in-up">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
              <Trophy size={28} />
            </div>
            <h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">A record of your small wins</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              Every small step builds your vocabulary. These markers celebrate consistency, recovery, and curiosity.
            </p>
          </div>
          <div className="animate-in-up delay-1 shrink-0 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm text-center md:text-right">
            <div className="font-display text-4xl text-[hsl(var(--primary))]">{unlockedCount} <span className="text-xl text-[hsl(var(--muted-foreground))]">/ {achievements.length}</span></div>
            <div className="mt-1 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">noticed so far</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((ach, i) => {
            const Icon = ach.icon;
            return (
              <div 
                key={ach.id} 
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 animate-in-up delay-${Math.min(i+1, 5)} ${
                  ach.isUnlocked 
                    ? 'border-[hsl(var(--primary)/.3)] bg-[hsl(var(--card))] shadow-soft hover:-translate-y-1 hover:border-[hsl(var(--primary)/.6)]' 
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.3)] opacity-70 grayscale'
                }`}
              >
                {ach.isUnlocked && (
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[hsl(var(--primary)/.03)] transition-transform duration-700 group-hover:scale-150" />
                )}
                <div>
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] ${ach.isUnlocked ? ach.color : 'text-[hsl(var(--muted-foreground))]'}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-[hsl(var(--foreground))]">{ach.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{ach.description}</p>
                </div>
                {ach.progressText && !ach.isUnlocked && (
                  <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                    <span className="uppercase tracking-wider">Progress</span>
                    <span className="font-mono-ui">{ach.progressText}</span>
                  </div>
                )}
                {ach.isUnlocked && (
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                     <CheckCircle2 size={12} /> You did this
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
