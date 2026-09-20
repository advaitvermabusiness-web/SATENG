import os
import re

def rewrite_app():
    with open('artifacts/sat-vocabulary-coach/src/App.tsx', 'r') as f:
        content = f.read()

    # 1. Update useStoredState
    old_state = """function useStoredState<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? { ...initial, ...JSON.parse(stored) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}"""
    
    new_state = """function useStoredState<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return initial;
      const parsed = JSON.parse(stored);
      if (parsed === null || parsed === undefined) return initial;
      if (Array.isArray(initial)) {
        return Array.isArray(parsed) ? (parsed as T) : initial;
      }
      if (typeof initial === 'object') {
        return { ...initial, ...(typeof parsed === 'object' ? parsed : {}) } as T;
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}"""

    content = content.replace(old_state, new_state)

    # Add HAS_PREMIUM and streak helpers
    helpers = """const HAS_PREMIUM = false;

function getUniqueSortedDates(sessions: Session[]) {
  return [...new Set(sessions.map(s => new Date(s.date).toDateString()))]
    .map(d => new Date(d).getTime())
    .sort((a, b) => b - a);
}

function getStreak(sessions: Session[]) {
  const dates = getUniqueSortedDates(sessions);
  if (dates.length === 0) return 0;
  
  const today = new Date(new Date().toDateString()).getTime();
  const yesterday = today - 86400000;
  
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i-1] - dates[i] === 86400000) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getBestStreak(sessions: Session[]) {
  const dates = getUniqueSortedDates(sessions).reverse();
  if (dates.length === 0) return 0;
  let maxStreak = 1;
  let currStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] - dates[i-1] === 86400000) {
      currStreak++;
      maxStreak = Math.max(maxStreak, currStreak);
    } else {
      currStreak = 1;
    }
  }
  return maxStreak;
}

function getMinutesThisWeek(sessions: Session[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions
    .filter(s => new Date(s.date).getTime() >= weekAgo)
    .reduce((sum, s) => sum + s.duration, 0);
}
"""
    content = content.replace("const defaultSettings: StudySettings =", helpers + "\nconst defaultSettings: StudySettings =")

    # Clean up Home component metrics
    content = content.replace(
        "const nextWords = WORDS.filter(word => word.difficulty === settings.level);",
        """const nextWords = WORDS.filter(word => word.difficulty === settings.level);
  const streak = getStreak(sessions);
  const bestStreak = getBestStreak(sessions);
  const minutesThisWeek = getMinutesThisWeek(sessions);"""
    )

    content = content.replace(
        """<StatCard icon={<Flame size={18} />} label="Study streak" value="7 days" detail="Best: 12 days" color="coral" /></div>
          <div className="animate-in-up delay-2"><StatCard icon={<Trophy size={18} />} label="Words mastered" value={`${mastered || 18}`} detail={`${familiar || 32} words explored`} /></div>
          <div className="animate-in-up delay-3"><StatCard icon={<Clock3 size={18} />} label="This week" value="42 min" detail="+18% from last week" />""",
        """<StatCard icon={<Flame size={18} />} label="Study streak" value={`${streak} days`} detail={`Best: ${bestStreak} days`} color="coral" /></div>
          <div className="animate-in-up delay-2"><StatCard icon={<Trophy size={18} />} label="Words mastered" value={`${mastered}`} detail={`${familiar} words explored`} /></div>
          <div className="animate-in-up delay-3"><StatCard icon={<Clock3 size={18} />} label="This week" value={`${minutesThisWeek} min`} detail="Time spent learning" />"""
    )
    
    content = content.replace("{Math.round((mastered / WORDS.length) * 100) || 24}%", "{Math.round((mastered / WORDS.length) * 100) || 0}%")
    content = content.replace("Math.max(24, (mastered / WORDS.length) * 100)", "Math.max(0, (mastered / WORDS.length) * 100)")
    content = content.replace("{explored || (index === 0 ? 4 : 0)}", "{explored || 0}")
    
    # Progress component metrics
    content = content.replace("{Math.max(coverage(level), index === 0 ? 40 : 4)}", "{coverage(level)}")
    content = content.replace("{masteredWords.length || 18}", "{masteredWords.length}")
    content = content.replace("<strong>12 days</strong>", "<strong>{getBestStreak(sessions)} days</strong>")
    content = content.replace("<strong>{sessions.length || 8}</strong>", "<strong>{sessions.length}</strong>")

    # Router logic
    old_router = """  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (!settings.hasCompletedOnboarding && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [settings.hasCompletedOnboarding, location, setLocation]);
  
  if (!settings.hasCompletedOnboarding) {
    return <Onboarding settings={settings} setSettings={setSettings} />;
  }"""

    new_router = """  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    let needsUpdate = false;
    const updates: Partial<StudySettings> = {};

    if (!settings.hasCompletedOnboarding && (progress.length > 0 || sessions.length > 0)) {
      updates.hasCompletedOnboarding = true;
      needsUpdate = true;
    }

    if (!HAS_PREMIUM && (settings.level === 'Advanced' || settings.level === 'Challenge')) {
      updates.level = 'Foundational';
      needsUpdate = true;
    }

    if (needsUpdate) {
      setSettings(s => ({ ...s, ...updates }));
    }
  }, [settings.hasCompletedOnboarding, settings.level, progress.length, sessions.length, setSettings]);

  useEffect(() => {
    const isExistingUser = progress.length > 0 || sessions.length > 0;
    if (!settings.hasCompletedOnboarding && !isExistingUser && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [settings.hasCompletedOnboarding, location, setLocation, progress.length, sessions.length]);
  
  if (!settings.hasCompletedOnboarding && progress.length === 0 && sessions.length === 0) {
    return <Onboarding settings={settings} setSettings={setSettings} />;
  }"""
    content = content.replace(old_router, new_router)

    # Pass setSettings to Quick
    content = content.replace(
        "<Quick settings={settings} progress={progress} setProgress={setProgress} />",
        "<Quick settings={settings} progress={progress} setProgress={setProgress} setSettings={setSettings} />"
    )

    with open('artifacts/sat-vocabulary-coach/src/App.tsx', 'w') as f:
        f.write(content)


def rewrite_quick():
    with open('artifacts/sat-vocabulary-coach/src/pages/Quick.tsx', 'r') as f:
        content = f.read()

    # signature
    old_sig = """export function Quick({ 
  settings, 
  progress, 
  setProgress 
}: { 
  settings: StudySettings; 
  progress: WordProgress[]; 
  setProgress: (val: WordProgress[] | ((curr: WordProgress[]) => WordProgress[])) => void 
}) {"""
    new_sig = """export function Quick({ 
  settings, 
  progress, 
  setProgress,
  setSettings
}: { 
  settings: StudySettings; 
  progress: WordProgress[]; 
  setProgress: (val: WordProgress[] | ((curr: WordProgress[]) => WordProgress[])) => void;
  setSettings: (val: StudySettings | ((curr: StudySettings) => StudySettings)) => void;
}) {"""
    content = content.replace(old_sig, new_sig)

    # add tracking
    tracking = """
  const newSeen = useRef(0);
  const seenIndexes = useRef(new Set<number>());

  useEffect(() => {
    if (!seenIndexes.current.has(activeIndex) && activeIndex < quickWords.length) {
      seenIndexes.current.add(activeIndex);
      newSeen.current += 1;
    }
  }, [activeIndex, quickWords.length]);

  useEffect(() => {
    return () => {
      if (newSeen.current > 0) {
        setSettings(s => ({ ...s, quickWordsSeen: (s.quickWordsSeen || 0) + newSeen.current }));
      }
    };
  }, [setSettings]);
"""
    content = content.replace("// Track quick words seen\n  useEffect(() => {\n    // Optional: save quick mode usage if we wanted to\n  }, [activeIndex]);", tracking)
    
    with open('artifacts/sat-vocabulary-coach/src/pages/Quick.tsx', 'w') as f:
        f.write(content)

def rewrite_onboarding():
    with open('artifacts/sat-vocabulary-coach/src/pages/Onboarding.tsx', 'r') as f:
        content = f.read()
    
    # Import FocusCheck
    content = content.replace("import { ArrowRight, Sparkles, BookOpen, Clock, Zap, Check } from 'lucide-react';", 
                              "import { ArrowRight, Sparkles, BookOpen, Clock, Zap, Check } from 'lucide-react';\nimport { FocusCheck } from '../components/FocusCheck';")
    
    old_complete = """  const complete = (wantsFocusCheck: boolean) => {
    setSettings(s => ({ ...s, hasCompletedOnboarding: true }));
    if (wantsFocusCheck) {
      setLocation('/?focus=true');
    } else {
      setLocation('/');
    }
  };"""

    new_complete = """  const [showFocusCheck, setShowFocusCheck] = useState(false);

  const complete = (wantsFocusCheck: boolean) => {
    if (wantsFocusCheck) {
      setShowFocusCheck(true);
    } else {
      setSettings(s => ({ ...s, focusProfile: 'Standard', hasCompletedOnboarding: true }));
      setLocation('/');
    }
  };

  if (showFocusCheck) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[hsl(var(--background))] p-6 text-[hsl(var(--foreground))] md:p-12">
        <div className="w-full max-w-md animate-in-up">
           <FocusCheck 
             settings={settings} 
             setSettings={setSettings} 
             onClose={() => {
                setSettings(s => ({ ...s, hasCompletedOnboarding: true }));
                setLocation('/');
             }} 
           />
        </div>
      </div>
    );
  }"""
    content = content.replace(old_complete, new_complete)

    with open('artifacts/sat-vocabulary-coach/src/pages/Onboarding.tsx', 'w') as f:
        f.write(content)

def rewrite_paywall():
    with open('artifacts/sat-vocabulary-coach/src/components/Paywall.tsx', 'r') as f:
        content = f.read()
    
    content = content.replace("Adaptive Review", "Adaptive Review (Planned)")
    content = content.replace("Track every milestone and milestone.", "Track every vocabulary milestone.")
    
    old_billing = """<div className="mb-6 flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-1">
              <button 
                onClick={() => setBilling('monthly')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${billing === 'monthly' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBilling('yearly')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${billing === 'yearly' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
              >
                Yearly
              </button>
            </div>

            <div className="mb-8 rounded-2xl border-2 border-[hsl(var(--primary))] p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono-ui text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--primary))]">
                  {billing === 'yearly' ? 'Annual Plan' : 'Monthly Plan'}
                </span>
                {billing === 'yearly' && (
                  <span className="rounded-full bg-[hsl(var(--accent)/.15)] px-2 py-0.5 font-mono-ui text-[9px] font-bold text-[hsl(var(--accent-foreground))]">
                    Save 33%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[hsl(var(--muted-foreground))]">$</span>
                <span className="font-display text-5xl tracking-[-.04em]">{billing === 'yearly' ? '39.99' : '4.99'}</span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">/ {billing === 'yearly' ? 'year' : 'month'}</span>
              </div>
              {billing === 'yearly' && <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Billed as one payment of $39.99</div>}
            </div>"""
            
    new_billing = """<div className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.3)] p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono-ui text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--primary))]">
                  Premium Preview
                </span>
                <span className="rounded-full bg-[hsl(var(--primary)/.15)] px-2 py-0.5 font-mono-ui text-[9px] font-bold text-[hsl(var(--primary))]">
                  Coming Soon
                </span>
              </div>
              <div className="text-sm font-bold text-[hsl(var(--foreground))]">
                Pricing to be confirmed when billing launches.
              </div>
              <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                We are currently finalizing our premium plans. Check back soon for unlimited features.
              </div>
            </div>"""
    
    content = content.replace(old_billing, new_billing)
    content = content.replace("disabled className=\"flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] opacity-70 cursor-not-allowed", "disabled className=\"flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] opacity-70 cursor-not-allowed\"")
    content = content.replace("<button className=\"flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] opacity-70 cursor-not-allowed\">", "<button disabled className=\"flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] opacity-70 cursor-not-allowed\">")
    
    with open('artifacts/sat-vocabulary-coach/src/components/Paywall.tsx', 'w') as f:
        f.write(content)

def rewrite_achievements():
    with open('artifacts/sat-vocabulary-coach/src/pages/Achievements.tsx', 'r') as f:
        content = f.read()
    
    content = content.replace("Context Builder", "Diligent Explorer")
    content = content.replace("Revealed 10 deep context examples.", "Reviewed words 10 times to build familiarity.")

    with open('artifacts/sat-vocabulary-coach/src/pages/Achievements.tsx', 'w') as f:
        f.write(content)

rewrite_app()
rewrite_quick()
rewrite_onboarding()
rewrite_paywall()
rewrite_achievements()
