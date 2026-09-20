import { AudioLines, BookOpenText, Languages, Volume2 } from 'lucide-react';

const REGIONAL_ACCENTS = [
  {
    name: 'American English',
    locale: 'en-US',
    note: 'Often pronounces r after vowels; t may sound like a quick d in words such as “water.”',
  },
  {
    name: 'British English',
    locale: 'en-GB',
    note: 'Many varieties do not pronounce r after a vowel unless another vowel follows.',
  },
  {
    name: 'Canadian English',
    locale: 'en-CA',
    note: 'Usually pronounces r and may raise the first vowel in words such as “about” and “write.”',
  },
  {
    name: 'Indian English',
    locale: 'en-IN',
    note: 'Often uses clear syllable timing and tongue-curled t and d sounds in many regional varieties.',
  },
  {
    name: 'Australian English',
    locale: 'en-AU',
    note: 'Often does not pronounce final r and uses distinctive vowel movement in words such as “day.”',
  },
];

const IPA_SYMBOLS = [
  { symbol: 'ˈ', name: 'Primary stress', example: '/ˈluː.sɪd/', explanation: 'The next syllable receives the strongest emphasis.' },
  { symbol: 'ˌ', name: 'Secondary stress', example: '/ˌser.ənˈdɪp.ə.ti/', explanation: 'The next syllable has lighter emphasis.' },
  { symbol: 'ə', name: 'Schwa', example: 'about /əˈbaʊt/', explanation: 'A relaxed “uh” sound in an unstressed syllable.' },
  { symbol: 'ː', name: 'Length mark', example: 'see /siː/', explanation: 'The vowel is held longer.' },
  { symbol: 'θ / ð', name: 'Two th sounds', example: 'thin /θɪn/ · this /ðɪs/', explanation: 'The first is unvoiced; the second uses the voice.' },
  { symbol: 'ʃ / tʃ', name: 'sh and ch', example: 'ship /ʃɪp/ · chip /tʃɪp/', explanation: 'One flows continuously; the other begins with a stop.' },
  { symbol: 'ŋ', name: 'Ng sound', example: 'sing /sɪŋ/', explanation: 'The sound at the end of “sing,” without a separate hard g.' },
  { symbol: 'dʒ', name: 'J sound', example: 'judge /dʒʌdʒ/', explanation: 'The consonant sound at the beginning and end of “judge.”' },
];

const WRITTEN_MARKS = [
  { mark: 'á', name: 'Acute accent', example: 'Spanish más', explanation: 'Often marks stress or a particular vowel quality. Its exact sound depends on the language.' },
  { mark: 'è', name: 'Grave accent', example: 'French père', explanation: 'May signal an open vowel or distinguish one word from another.' },
  { mark: 'ê', name: 'Circumflex', example: 'French fête', explanation: 'Can change vowel quality or show that a historical letter disappeared.' },
  { mark: 'ë', name: 'Diaeresis', example: 'Zoë', explanation: 'Often tells you to pronounce this vowel separately from the vowel beside it.' },
  { mark: 'ě', name: 'Caron or háček', example: 'Czech město', explanation: 'Changes pronunciation by language; Czech ě commonly adds a y-like glide before the vowel.' },
  { mark: 'ñ', name: 'Tilde', example: 'Spanish niño', explanation: 'Spanish ñ represents a sound close to “ny” in “canyon.”' },
  { mark: 'ā', name: 'Macron', example: 'Māori', explanation: 'Commonly marks a long vowel in dictionaries, transliteration, and several writing systems.' },
  { mark: 'ç', name: 'Cedilla', example: 'French façade', explanation: 'Under c, it commonly signals an s sound rather than a k sound.' },
];

export function PronunciationGuide() {
  return (
    <div className="min-h-[100dvh] px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-16">
      <div className="mx-auto max-w-[1100px]">
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
            <AudioLines size={14} /> Sounds & marks
          </div>
          <h1 className="font-display text-5xl leading-[.95] tracking-[-.05em] md:text-7xl">
            See the sound.<br /><em className="text-[hsl(var(--primary))]">Then hear the difference.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            IPA describes individual sounds. Regional accents describe patterns across an entire variety of speech. Written marks such as á and ě belong to particular spelling systems, so the same mark can behave differently across languages.
          </p>
        </div>

        <section className="mt-10 rounded-[28px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-lift md:p-8">
          <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary-foreground)/.7)]">
            <Languages size={14} /> Five English voice options
          </div>
          <h2 className="mt-3 font-display text-3xl tracking-[-.04em]">One language, many valid sound patterns.</h2>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[hsl(var(--primary-foreground)/.75)]">
            Use the Accents button beside any vocabulary word to request American, British, Canadian, Indian, or Australian playback. These descriptions are broad tendencies—not rules for every speaker.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {REGIONAL_ACCENTS.map(accent => (
              <article key={accent.locale} className="rounded-2xl bg-[hsl(var(--primary-foreground)/.1)] p-4">
                <div className="flex items-center gap-2 text-sm font-bold"><Volume2 size={14} /> {accent.name}</div>
                <div className="mt-2 font-mono-ui text-[9px] text-[hsl(var(--accent))]">{accent.locale}</div>
                <p className="mt-3 text-[11px] leading-relaxed text-[hsl(var(--primary-foreground)/.72)]">{accent.note}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-[10px] text-[hsl(var(--primary-foreground)/.65)]">
            Playback uses voices installed in the browser or operating system. A device may substitute its closest available English voice.
          </p>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">
            <BookOpenText size={14} /> Reading IPA
          </div>
          <h2 className="mt-2 font-display text-4xl tracking-[-.04em]">The symbols beside each word</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {IPA_SYMBOLS.map(item => (
              <article key={item.symbol} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-soft">
                <div className="font-display text-4xl text-[hsl(var(--primary))]">{item.symbol}</div>
                <h3 className="mt-3 text-sm font-extrabold">{item.name}</h3>
                <div className="mt-2 font-mono-ui text-[10px] text-[hsl(var(--accent-foreground))]">{item.example}</div>
                <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{item.explanation}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Accent and diacritic marks</div>
          <h2 className="mt-2 font-display text-4xl tracking-[-.04em]">What á, ě, and related marks tell you</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            These marks modify letters; they are not accents in the same sense as British or Indian English. Always interpret them using the language the word comes from.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WRITTEN_MARKS.map(item => (
              <article key={item.mark} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-soft">
                <div className="font-display text-5xl text-[hsl(var(--accent-foreground))]">{item.mark}</div>
                <h3 className="mt-3 text-sm font-extrabold">{item.name}</h3>
                <div className="mt-2 font-mono-ui text-[10px] text-[hsl(var(--primary))]">{item.example}</div>
                <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{item.explanation}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}