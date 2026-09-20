import { useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Mail,
  Share2,
  Volume2,
} from 'lucide-react';
import { Link } from 'wouter';
import { type Word } from '../types';

type WordActionsProps = {
  word: Word;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  compact?: boolean;
};

const ACCENTS = [
  { locale: 'en-US', label: 'American', shortLabel: 'US' },
  { locale: 'en-GB', label: 'British', shortLabel: 'UK' },
  { locale: 'en-CA', label: 'Canadian', shortLabel: 'CA' },
  { locale: 'en-IN', label: 'Indian', shortLabel: 'IN' },
  { locale: 'en-AU', label: 'Australian', shortLabel: 'AU' },
] as const;

function shareText(word: Word) {
  return `${word.word} ${word.pronunciation}\n${word.partOfSpeech}: ${word.definition}\n\nExample: ${word.example}`;
}

export function WordActions({
  word,
  isBookmarked,
  onToggleBookmark,
  compact = false,
}: WordActionsProps) {
  const [showShare, setShowShare] = useState(false);
  const [showAccents, setShowAccents] = useState(false);
  const [status, setStatus] = useState('');

  const speak = (locale = 'en-US', accentLabel = 'American') => {
    if (!('speechSynthesis' in window)) {
      setStatus(`${accentLabel} pronunciation is unavailable in this browser.`);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      locale === 'en-GB' && word.ukSpelling ? word.ukSpelling : word.word,
    );
    utterance.lang = locale;
    utterance.rate = 0.82;
    const voice = window.speechSynthesis
      .getVoices()
      .find(candidate => candidate.lang.toLowerCase() === locale.toLowerCase());
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus(
      voice
        ? `Playing ${accentLabel} pronunciation with ${voice.name}.`
        : `Playing ${accentLabel} pronunciation with the closest voice available.`,
    );
    utterance.onend = () => setStatus('Pronunciation finished.');
    utterance.onerror = () => setStatus(`${accentLabel} pronunciation could not be played on this device.`);
    try {
      setStatus('Starting pronunciation…');
      window.speechSynthesis.speak(utterance);
    } catch {
      setStatus(`${accentLabel} pronunciation could not be played on this device.`);
    }
  };

  const openExternal = (url: string, label: string) => {
    const popup = window.open(url, '_blank');
    if (!popup) {
      setStatus(`${label} was blocked by the browser.`);
      return;
    }
    popup.opener = null;
    setStatus(`${label} opened.`);
  };

  const openWhatsApp = () => {
    openExternal(`https://wa.me/?text=${encodeURIComponent(shareText(word))}`, 'WhatsApp');
  };

  const openGmail = () => {
    const subject = `Wordwell word: ${word.word}`;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText(word))}`;
    openExternal(url, 'Gmail');
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText(word));
        return true;
      }

      const textArea = document.createElement('textarea');
      textArea.value = shareText(word);
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch {
      return false;
    }
  };

  const shareToInstalledApps = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
            title: `Wordwell word: ${word.word}`,
          text: shareText(word),
        });
        setStatus('Share sheet opened.');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('Could not open the share sheet.');
      }
      return;
    }

    const copied = await copyToClipboard();
    setStatus(copied ? 'Copied. Paste it into another app.' : 'Could not copy this word.');
  };

  const copyWord = async () => {
    const copied = await copyToClipboard();
    setStatus(copied ? 'Word copied.' : 'Could not copy this word.');
  };

  const actionClass = compact
    ? 'inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs font-bold transition-colors hover:bg-[hsl(var(--secondary))]'
    : 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs font-bold transition-colors hover:bg-[hsl(var(--secondary))]';

  return (
    <div className="relative" onClick={event => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => speak()} className={actionClass} aria-label={`Hear ${word.word} in American English`}>
          <Volume2 size={15} /> {!compact && 'Listen'}
        </button>
        <button
          type="button"
          onClick={onToggleBookmark}
          className={`${actionClass} ${isBookmarked ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : ''}`}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? `Remove ${word.word} from saved words` : `Save ${word.word} for later`}
        >
          {isBookmarked ? <Check size={15} /> : <Bookmark size={15} />}
          {!compact && (isBookmarked ? 'Saved' : 'Save')}
        </button>
        <button type="button" onClick={() => setShowShare(value => !value)} className={actionClass} aria-expanded={showShare} aria-label={`Share ${word.word}`}>
          <Share2 size={15} /> {!compact && 'Share'}
        </button>
        <button
          type="button"
          onClick={() => setShowAccents(value => !value)}
          className={`${actionClass} ${showAccents ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : ''}`}
          aria-expanded={showAccents}
          aria-label={`Choose an English accent for ${word.word}`}
        >
          <Globe2 size={15} /> {!compact && 'Accents'}
        </button>
        {word.track === 'expert' && (
          <a
            href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.word)}`}
            target="_blank"
            rel="noreferrer noopener"
            className={actionClass}
            aria-label={`View ${word.word} in Merriam-Webster`}
          >
            <ExternalLink size={15} /> {!compact && 'Merriam-Webster'}
          </a>
        )}
      </div>

      {showAccents && (
        <div className="mt-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-soft">
          <div className="flex flex-col gap-1 border-b border-[hsl(var(--border))] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">British spelling</div>
              <strong className="mt-1 block text-sm">{word.ukSpelling ?? word.word}</strong>
            </div>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {word.ukSpelling ? 'Spelling differs in British English' : 'Same spelling in British English'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ACCENTS.map(accent => (
              <button
                key={accent.locale}
                type="button"
                onClick={() => speak(accent.locale, accent.label)}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--secondary)/.7)] px-2 text-xs font-bold hover:bg-[hsl(var(--secondary))]"
                aria-label={`Hear ${word.word} in ${accent.label} English`}
              >
                <Volume2 size={13} /> <span>{accent.shortLabel}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between">
            <p>Accent voices come from your device. If a requested regional voice is unavailable, the browser may use its closest English voice.</p>
            <Link href="/sounds" className="shrink-0 font-bold text-[hsl(var(--primary))] no-underline hover:underline">How to read phonetics</Link>
          </div>
        </div>
      )}

      {showShare && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-soft sm:grid-cols-2">
          <button type="button" onClick={openWhatsApp} className={actionClass}>WhatsApp</button>
          <button type="button" onClick={openGmail} className={actionClass}><Mail size={15} /> Gmail</button>
          <button type="button" onClick={shareToInstalledApps} className={actionClass}><Share2 size={15} /> Share to other apps</button>
          <button type="button" onClick={copyWord} className={actionClass}><Copy size={15} /> Copy</button>
        </div>
      )}

      <div aria-live="polite" className="mt-2 min-h-4 text-[10px] text-[hsl(var(--muted-foreground))]">
        {status}
      </div>
    </div>
  );
}