import type { Word } from '../types';

export type SatAcademicDomain = 'Literature' | 'Science' | 'Humanities' | 'Social Science';
export type SatTier = 1 | 2 | 3;

export type SatContextQuestion = {
  domain: SatAcademicDomain;
  formatLabel: string;
  passage: string;
  prompt: string;
};

const SAT_DOMAINS: SatAcademicDomain[] = ['Literature', 'Science', 'Humanities', 'Social Science'];

function lowercaseOpening(text: string) {
  return text ? `${text[0].toLowerCase()}${text.slice(1)}` : text;
}

export function blankTargetWord(current: Word) {
  const verbForms = current.forms.verb ? Object.values(current.forms.verb) : [];
  const candidateForms = [current.word, ...(current.forms.other ?? []), ...verbForms]
    .sort((first, second) => second.length - first.length);
  const sourceSentence = [current.expandedSentence, current.example]
    .find(sentence => candidateForms.some(form => new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sentence)));

  if (!sourceSentence) {
    return `${current.example} In this context, the central idea is best captured by ______.`;
  }
  for (const form of candidateForms) {
    const pattern = new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(sourceSentence)) return sourceSentence.replace(pattern, '______');
  }
  return sourceSentence;
}

export function formatSatPassageForChoices(passage: string, choices: string[]) {
  const hasVowelStartingChoice = choices.some(choice => /^[aeiou]/i.test(choice.trim()));
  return hasVowelStartingChoice
    ? passage.replace(/\ban(?=\s+_{2,})/gi, 'a/an')
    : passage;
}

export function buildSatContextQuestion(current: Word, sequence: number, tier: SatTier = 2): SatContextQuestion {
  const domain = SAT_DOMAINS[Math.abs(sequence) % SAT_DOMAINS.length];
  if (tier === 1) {
    return {
      domain,
      formatLabel: 'Tier 1 · Short context',
      passage: blankTargetWord(current),
      prompt: 'Which word best completes the sentence?',
    };
  }

  const meaning = lowercaseOpening(current.definition.replace(/\.$/, ''));
  const semanticRequirement = current.partOfSpeech.includes('v.')
    ? `name an action that would ${meaning.replace(/^to\s+/i, '')}`
    : current.partOfSpeech.includes('n.')
      ? `name ${meaning.replace(/^(a|an|the)\s+/i, '')}`
      : `describe something as ${meaning}`;
  const category = current.category.toLowerCase();
  const passages: Record<SatAcademicDomain, string> = {
    Literature: `A critic examining a nineteenth-century novel notes that the narrator initially describes every social custom with calm precision. Midway through the work, however, that measured voice changes, and the surrounding images establish a sharper judgment about the society being portrayed. This shift is not incidental: it changes how readers interpret the protagonist’s choices. Taken together, the contrast and tone require a word that can ${semanticRequirement}. In this discussion of ${category}, the critic needs one precise term for the altered voice. The most logical choice is ______.`,
    Science: `Researchers studying a newly observed pattern collected measurements under several controlled conditions. The first trial appeared decisive, but later trials established a narrower relationship and ruled out broader claims that the data could not support. The report’s transition from the initial result to the repeated observations is therefore essential. Those structural clues require a word that can ${semanticRequirement}. When the researchers summarize the evidence in the formal language of ${category}, the blank must name that exact relationship rather than merely sound scientific. The result is best characterized as ______.`,
    Humanities: `An art historian compares two interpretations of a public monument. One account treats the work as a simple celebration, whereas the other emphasizes the placement of the figures, the inscription, and the political debate surrounding the commission. Together, these details narrow the intended claim and prevent a merely decorative reading. The contrast requires a word that can ${semanticRequirement}. To state the argument with the precision expected in a discussion of ${category}, the historian concludes that the monument’s meaning is ______.`,
    'Social Science': `A social scientist reviews a study in which participants changed their responses after receiving new information. The change was not random: interviews connected the transition to a consistent motive, while the study’s limits eliminated several competing explanations for the same numerical pattern. The contrast between those possibilities requires a word that can ${semanticRequirement}. The researcher therefore links the behavioral evidence to the study’s structure before choosing a term. In this analysis of ${category}, the participants’ response is most accurately described as ______.`,
  };
  const advancedPassages: Record<SatAcademicDomain, string> = {
    Literature: `Two critics interpret the narrator’s changing voice in sharply different ways. The first treats the shift as decorative, arguing that it merely varies the novel’s rhythm. The second points to a sequence of increasingly charged images, a reversal introduced by “yet,” and the narrator’s later judgment of the protagonist. Those details make the decorative account difficult to sustain. Still, the second critic avoids claiming that every passage carries the same force; the judgment applies only after the reversal. In this qualified discussion of ${category}, the missing term must distinguish a precise semantic change from both a neutral variation and an absolute transformation. It must ${semanticRequirement}. The narrator’s later voice is therefore ______.`,
    Science: `A preliminary experiment appeared to support a broad hypothesis, but a replication produced the same pattern only under one tightly controlled condition. Some researchers dismissed the replication as inconsistent; others argued that it clarified the boundary of the original claim. The report sides with neither position completely. Instead, it emphasizes the contrast between the apparently general first result and the conditional evidence that followed, while noting that measurement error cannot explain the difference. In this discussion of ${category}, the blank must capture the exact status of the evidence without implying either total confirmation or total rejection. The required term must ${semanticRequirement}. The replicated result is best described as ______.`,
    Humanities: `Scholars once read the monument’s inscription as a straightforward endorsement of the ruler who commissioned it. A newer interpretation, however, compares the inscription with the figures placed at the monument’s edge and with records of public opposition at the time. The visual and historical evidence complicates the older account, yet it does not prove that the monument secretly rejects the ruler. Instead, it narrows the range of defensible interpretations. In this analysis of ${category}, the missing word must preserve that qualification while identifying the relationship established by the converging clues. It must ${semanticRequirement}. The monument’s political message is most precisely characterized as ______.`,
    'Social Science': `Survey participants initially endorsed a policy by a wide margin. After reading a neutral summary of its costs, support changed, but interviews revealed two competing explanations: some participants revised their judgment because of the evidence, while others merely adjusted the strength of views they already held. The researchers separated these groups before interpreting the aggregate decline. Consequently, the blank cannot name any change whatsoever; it must identify the more specific response supported by the interviews and the study’s contrastive design. In this account of ${category}, the best term must ${semanticRequirement} without overstating what the numerical trend alone can establish. The first group’s response was ______.`,
  };

  return {
    domain,
    formatLabel: `Tier ${tier} · ${domain}`,
    passage: tier === 3 ? advancedPassages[domain] : passages[domain],
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
  };
}

export function getSatOptionRationale(current: Word, choice: string, allWords: Word[]) {
  if (choice === current.word) {
    return `${current.word} fits because the passage’s transitions and semantic clues require a word meaning “${current.definition}”`;
  }
  const distractor = allWords.find(word => word.word === choice);
  return distractor
    ? `${choice} means “${distractor.definition}” That meaning does not match the relationship established by the passage.`
    : `${choice} does not match the structural and semantic clues surrounding the blank.`;
}

const SAT_CONFUSABLES: Record<string, string[]> = {
  lucid: ['equivocal', 'pragmatic', 'sagacious'],
  mitigate: ['obfuscate', 'corroborate', 'synthesize'],
  pragmatic: ['sagacious', 'fastidious', 'intransigent'],
  resilient: ['capricious', 'intransigent', 'pragmatic'],
  scrutinize: ['synthesize', 'corroborate', 'juxtapose'],
  ambivalent: ['equivocal', 'capricious', 'intransigent'],
  conundrum: ['vicissitude', 'ambivalence', 'synthesis'],
  disparate: ['equivocal', 'capricious', 'resilient'],
  fastidious: ['pragmatic', 'sagacious', 'intransigent'],
  equivocal: ['lucid', 'ambivalent', 'disparate'],
  capricious: ['resilient', 'ambivalent', 'intransigent'],
  intransigent: ['pragmatic', 'resilient', 'fastidious'],
  sagacious: ['pragmatic', 'fastidious', 'equivocal'],
  vicissitude: ['conundrum', 'ambivalence', 'synthesis'],
  corroborate: ['scrutinize', 'synthesize', 'juxtapose'],
  juxtapose: ['synthesize', 'corroborate', 'obfuscate'],
  obfuscate: ['mitigate', 'corroborate', 'synthesize'],
  synthesize: ['juxtapose', 'scrutinize', 'corroborate'],
};

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getCuratedDistractorWords(current: Word, allWords: Word[]) {
  const curated = SAT_CONFUSABLES[current.id] ?? [];
  const rankedFallbacks = allWords
    .filter(word => word.id !== current.id)
    .map(word => ({
      word,
      score:
        (word.partOfSpeech === current.partOfSpeech ? 6 : 0) +
        (word.category === current.category ? 4 : 0) +
        (word.difficulty === current.difficulty ? 3 : 0),
    }))
    .sort((first, second) => second.score - first.score)
    .map(candidate => candidate.word);
  const fallbackByLabel = new Map(rankedFallbacks.map(word => [word.word, word]));

  return [...curated.map(word => fallbackByLabel.get(word)).filter((word): word is Word => Boolean(word)), ...rankedFallbacks]
    .filter((word, index, words) => words.findIndex(candidate => candidate.id === word.id) === index)
    .slice(0, 3);
}

export function getSatAnswerChoices(
  current: Word,
  allWords: Word[],
  random: () => number = Math.random,
) {
  const distractors = getCuratedDistractorWords(current, allWords).map(word => word.word);
  return shuffle([current.word, ...distractors], random);
}

export function getSatDefinitionChoices(
  current: Word,
  allWords: Word[],
  random: () => number = Math.random,
) {
  const distractors = getCuratedDistractorWords(current, allWords).map(word => word.definition);
  return shuffle([current.definition, ...distractors], random);
}

export function getSatUsageChoices(
  current: Word,
  allWords: Word[],
  random: () => number = Math.random,
) {
  const distractors = getCuratedDistractorWords(current, allWords).map(word => word.example);
  return shuffle([current.example, ...distractors], random);
}

export function getSatConfusables(wordId: string) {
  return SAT_CONFUSABLES[wordId] ?? [];
}