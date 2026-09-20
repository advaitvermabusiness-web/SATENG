export type SatMorphemeKind = 'prefix' | 'root' | 'suffix' | 'whole';

export type SatMorpheme = {
  id: string;
  kind: SatMorphemeKind;
  label: string;
};

export type SatRecallContent = {
  morphemes: SatMorpheme[];
  morphologyExplanation: string;
  trapExplanation: string;
};

const content = (morphemes: SatMorpheme[], morphologyExplanation: string, trapExplanation: string): SatRecallContent => ({
  morphemes,
  morphologyExplanation,
  trapExplanation,
});

export const SAT_RECALL_CONTENT: Record<string, SatRecallContent> = {
  lucid: content(
    [{ id: 'luc', kind: 'root', label: 'luc' }, { id: 'id', kind: 'suffix', label: '-id' }],
    'The root luc relates to light or clarity. Lucid describes thought or language that is bright, clear, and easy to follow.',
    'A word such as equivocal can feel academic, but it means open to multiple interpretations—the opposite of lucid clarity.',
  ),
  mitigate: content(
    [{ id: 'mitig', kind: 'root', label: 'mitig' }, { id: 'ate', kind: 'suffix', label: '-ate' }],
    'The root mitig means to soften. To mitigate something is to make its force, severity, or harm less intense.',
    'Obfuscate is tempting because difficult situations can involve confusion, but it means to make unclear rather than reduce harm.',
  ),
  pragmatic: content(
    [{ id: 'prag', kind: 'root', label: 'prag' }, { id: 'matic', kind: 'suffix', label: '-matic' }],
    'The root prag points toward action or practice. A pragmatic choice focuses on what works in the real situation.',
    'Sagacious means wise or perceptive, which sounds positive, but it does not specifically contrast practical results with ideal theories.',
  ),
  resilient: content(
    [{ id: 're', kind: 'prefix', label: 're-' }, { id: 'sil', kind: 'root', label: 'sil' }, { id: 'ent', kind: 'suffix', label: '-ent' }],
    'The prefix re- suggests returning, while the root relates to springing back. Resilient things recover after pressure or damage.',
    'Capricious describes unpredictable change, not the ability to recover after difficulty.',
  ),
  scrutinize: content(
    [{ id: 'scrutin', kind: 'root', label: 'scrutin' }, { id: 'ize', kind: 'suffix', label: '-ize' }],
    'The root scrutin carries the idea of searching or examining. To scrutinize is to inspect something with sustained critical attention.',
    'Synthesize means to combine ideas into a whole; it may follow close reading, but it is not the act of examining every detail.',
  ),
  ambivalent: content(
    [{ id: 'ambi', kind: 'prefix', label: 'ambi-' }, { id: 'val', kind: 'root', label: 'val' }, { id: 'ent', kind: 'suffix', label: '-ent' }],
    'The prefix ambi- means both. Ambivalent feelings pull in two strong or contradictory directions at once.',
    'Equivocal describes unclear language or commitment, while ambivalent describes mixed feelings. The emotional distinction is the trap.',
  ),
  conundrum: content(
    [{ id: 'whole', kind: 'whole', label: 'conundrum' }],
    'Conundrum has no reliable productive prefix-and-suffix decomposition. Treat the whole word as a named puzzle: a confusing problem that is difficult to solve.',
    'Vicissitude means a change of circumstances, often a difficult one. A change can create a conundrum, but it is not itself the puzzle.',
  ),
  disparate: content(
    [{ id: 'dis', kind: 'prefix', label: 'dis-' }, { id: 'par', kind: 'root', label: 'par' }, { id: 'ate', kind: 'suffix', label: '-ate' }],
    'The prefix dis- signals separation. Disparate things are set so far apart in kind or nature that they do not naturally belong together.',
    'Equivocal concerns uncertainty in meaning; disparate concerns fundamental difference. Both can appear in comparisons, which makes the distinction easy to miss.',
  ),
  fastidious: content(
    [{ id: 'fastidi', kind: 'root', label: 'fastidi' }, { id: 'ous', kind: 'suffix', label: '-ous' }],
    'Fastidious comes from a root associated with being hard to please. A fastidious person demands careful detail and accuracy.',
    'Pragmatic people may accept an imperfect solution if it works; fastidious people focus on precision and exactness.',
  ),
  equivocal: content(
    [{ id: 'equi', kind: 'prefix', label: 'equi-' }, { id: 'voc', kind: 'root', label: 'voc' }, { id: 'al', kind: 'suffix', label: '-al' }],
    'The prefix equi- suggests equal or balanced possibilities, and voc relates to voice. An equivocal statement leaves more than one interpretation open.',
    'Lucid language is clear and direct, while equivocal language preserves ambiguity. “Careful” wording is not always clear wording.',
  ),
  capricious: content(
    [{ id: 'capri', kind: 'root', label: 'capri' }, { id: 'ous', kind: 'suffix', label: '-ous' }],
    'Capricious is associated with a sudden, changeable impulse. A capricious decision is unpredictable rather than steady or reasoned.',
    'Resilient describes recovery from difficulty, not unpredictability. A resilient person may adapt, but that does not make the person capricious.',
  ),
  intransigent: content(
    [{ id: 'in', kind: 'prefix', label: 'in-' }, { id: 'transig', kind: 'root', label: 'transig' }, { id: 'ent', kind: 'suffix', label: '-ent' }],
    'The prefix in- gives a negative force, and the root relates to compromise or agreement. Intransigent describes someone unwilling to change position.',
    'Resilient people recover and adapt; intransigent people refuse to yield. Both can look strong, but only one signals rigidity.',
  ),
  sagacious: content(
    [{ id: 'sag', kind: 'root', label: 'sag' }, { id: 'acious', kind: 'suffix', label: '-acious' }],
    'Sagacious describes sound judgment and practical wisdom. It names a quality of perception, not merely academic knowledge.',
    'Pragmatic focuses on practical action, while sagacious focuses on wise judgment. A wise person may still choose an impractical plan.',
  ),
  vicissitude: content(
    [{ id: 'viciss', kind: 'root', label: 'viciss' }, { id: 'itude', kind: 'suffix', label: '-itude' }],
    'The root viciss carries the idea of change or alternation. A vicissitude is a change in circumstances, often one that tests a person.',
    'A conundrum is a difficult problem; a vicissitude is a change or reversal in life circumstances. Hard does not make the nouns interchangeable.',
  ),
  corroborate: content(
    [{ id: 'corrobor', kind: 'root', label: 'corrobor' }, { id: 'ate', kind: 'suffix', label: '-ate' }],
    'Corroborate means to strengthen a claim by supporting it with confirming evidence or testimony.',
    'Scrutinize means to examine evidence carefully, but corroborate means to confirm a claim. Looking closely is not the same as supporting.',
  ),
  juxtapose: content(
    [{ id: 'juxta', kind: 'prefix', label: 'juxta-' }, { id: 'pos', kind: 'root', label: 'pos' }, { id: 'e', kind: 'suffix', label: '-e' }],
    'The prefix juxta- means beside, while the root pos relates to placing. To juxtapose is to place things side by side for contrast or comparison.',
    'Synthesize means to combine parts into a unified whole; juxtapose deliberately keeps the parts side by side so their differences can be seen.',
  ),
  obfuscate: content(
    [{ id: 'ob', kind: 'prefix', label: 'ob-' }, { id: 'fusc', kind: 'root', label: 'fusc' }, { id: 'ate', kind: 'suffix', label: '-ate' }],
    'The root fusc relates to darkness or obscurity. To obfuscate is to make an idea harder to understand by clouding or disguising it.',
    'Mitigate reduces severity, whereas obfuscate reduces clarity. Both can describe an intentional change, but they affect different qualities.',
  ),
  synthesize: content(
    [{ id: 'syn', kind: 'prefix', label: 'syn-' }, { id: 'thes', kind: 'root', label: 'thes' }, { id: 'ize', kind: 'suffix', label: '-ize' }],
    'The prefix syn- means together, and the root thes relates to placing. To synthesize is to bring separate ideas together into a new whole.',
    'Juxtapose places ideas beside each other for comparison; synthesize combines them. “Together” can mean side by side or integrated, and that is the trap.',
  ),
  'sat-pernicious': content(
    [{ id: 'per', kind: 'prefix', label: 'per-' }, { id: 'nic', kind: 'root', label: 'nic' }, { id: 'ous', kind: 'suffix', label: '-ous' }],
    'Pernicious describes harm that works gradually or subtly. In a passage, look for consequences that accumulate before the damage becomes obvious.',
    'Deleterious also means harmful, but pernicious emphasizes harm that is especially hidden, gradual, or insidious.',
  ),
  'sat-sesquipedalian': content(
    [{ id: 'sesqui', kind: 'prefix', label: 'sesqui-' }, { id: 'ped', kind: 'root', label: 'ped' }, { id: 'alian', kind: 'suffix', label: '-alian' }],
    'The Latin parts suggest “a foot and a half long.” Sesquipedalian language uses unusually long or complicated words, often at the expense of directness.',
    'Eloquent language can be clear and persuasive, while sesquipedalian language is defined by its length and complexity. Long does not automatically mean effective.',
  ),
};

export function getSatRecallContent(wordId: string): SatRecallContent {
  const recall = SAT_RECALL_CONTENT[wordId];
  if (recall) return recall;
  return content(
    [{ id: 'whole', kind: 'whole', label: wordId }],
    `Treat ${wordId} as a whole word first. Use its sentence context and exact definition before trying to infer smaller word parts.`,
    `The strongest trap will be a word from the same topic or part of speech. Return to the exact definition and the sentence’s logical role.`,
  );
}