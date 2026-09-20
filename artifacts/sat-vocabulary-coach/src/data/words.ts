import { type Word } from '../types';
import { SAT_EXPANSION_WORDS } from './satExpansionWords';

const CORE_WORDS: Word[] = [
  {
    id: 'lucid', word: 'lucid', pronunciation: '/ˈluː.sɪd/', partOfSpeech: 'adjective',
    definition: 'Expressed clearly; easy to understand.',
    example: 'Her lucid explanation made a complicated theory feel within reach.',
    difficulty: 'Foundational', synonyms: ['clear', 'intelligible'], antonyms: ['confused', 'obscure'], distractors: ['hidden', 'noisy', 'uncertain'], category: 'Communication',
    expandedSentence: 'Despite the dense subject matter, the author’s lucid prose allowed readers of all backgrounds to grasp the fundamental arguments without resorting to external references.',
    etymology: 'From Latin lucidus "light, bright, clear," from lucere "to shine."',
    wordFamily: 'lucidity (noun), lucidly (adverb)',
    memoryCue: 'Think of a "lucid dream" where you see everything clearly and are fully aware.',
    activeRecallPrompt: 'What is a word for an explanation that is bright and clear?',
    forms: { other: ['lucid', 'lucider', 'lucidest', 'lucidity'] }
  },
  {
    id: 'mitigate', word: 'mitigate', pronunciation: '/ˈmɪt̬.ə.ɡeɪt/', partOfSpeech: 'verb',
    definition: 'To make something less severe, painful, or difficult.',
    example: 'Planting trees can mitigate the heat of a city street.',
    difficulty: 'Foundational', synonyms: ['alleviate', 'ease'], antonyms: ['aggravate', 'intensify'], distractors: ['predict', 'ignore', 'assemble'], category: 'Change & Impact',
    expandedSentence: 'To mitigate the environmental impact of the new facility, the corporation pledged to restore twice as many acres of wetlands as they developed.',
    etymology: 'From Latin mitigare "to soften," from mitis "mild, soft."',
    wordFamily: 'mitigation (noun), unmitigated (adjective)',
    memoryCue: 'Mitigate = Make it great(er) by reducing the bad stuff.',
    activeRecallPrompt: 'If you take painkillers for a headache, you are trying to ______ the pain.',
    forms: { verb: { present: 'mitigate(s)', past: 'mitigated', pastParticiple: 'mitigated', future: 'will mitigate' } }
  },
  {
    id: 'pragmatic', word: 'pragmatic', pronunciation: '/præɡˈmæt̬.ɪk/', partOfSpeech: 'adjective',
    definition: 'Focused on practical results rather than theory.',
    example: 'Taking the bus was a pragmatic choice on a rainy afternoon.',
    difficulty: 'Foundational', synonyms: ['practical', 'realistic'], antonyms: ['idealistic', 'impractical'], distractors: ['careless', 'ornamental', 'distant'], category: 'Reasoning',
    expandedSentence: 'The committee adopted a pragmatic approach, abandoning their utopian vision in favor of policies that could be enacted immediately with existing funds.',
    etymology: 'From Greek pragmatikos "fit for action," from pragma "deed, act."',
    wordFamily: 'pragmatism (noun), pragmatist (noun)',
    memoryCue: 'A PRAGmatic person cares about PRACtical results.',
    activeRecallPrompt: 'What adjective describes someone who focuses on what works right now rather than perfect theories?',
    forms: { other: ['pragmatic', 'pragmatically', 'pragmatism'] }
  },
  {
    id: 'resilient', word: 'resilient', pronunciation: '/rɪˈzɪl.jənt/', partOfSpeech: 'adjective',
    definition: 'Able to recover quickly from difficulty.',
    example: 'The resilient team revised its plan after the first experiment failed.',
    difficulty: 'Foundational', synonyms: ['durable', 'adaptable'], antonyms: ['fragile', 'vulnerable'], distractors: ['distant', 'rigid', 'hasty'], category: 'Character',
    expandedSentence: 'Ecologists were astounded by the resilient nature of the coral reef, which began exhibiting signs of recovery mere months after the devastating temperature spike.',
    etymology: 'From Latin resilire "to rebound, recoil," from re- "back" + salire "to jump."',
    wordFamily: 'resilience (noun), resiliently (adverb)',
    memoryCue: 'Resilient things "spring back" to their original shape.',
    activeRecallPrompt: 'When a community rebuilds stronger after a disaster, they are showing what quality?',
    forms: { other: ['resilient', 'resilience', 'resiliency'] }
  },
  {
    id: 'scrutinize', word: 'scrutinize', pronunciation: '/ˈskruː.t̬ən.aɪz/', ukSpelling: 'scrutinise', partOfSpeech: 'verb',
    definition: 'To examine something very carefully.',
    example: 'Before signing, she scrutinized every line of the agreement.',
    difficulty: 'Foundational', synonyms: ['inspect', 'analyze'], antonyms: ['glance', 'skim'], distractors: ['celebrate', 'assemble', 'ignore'], category: 'Analysis',
    expandedSentence: 'Historians continue to scrutinize the newly discovered letters, hoping to find subtle clues about the monarch’s unrecorded motivations.',
    etymology: 'From Latin scrutari "to search, examine," originally "to sort trash."',
    wordFamily: 'scrutiny (noun), scrutinizer (noun)',
    memoryCue: 'Scrutinize sounds like "screw" + "eyes"—screwing up your eyes to look really closely.',
    activeRecallPrompt: 'What verb means to look at something with intense and critical attention?',
    forms: { verb: { present: 'scrutinize(s)', past: 'scrutinized', pastParticiple: 'scrutinized', future: 'will scrutinize' } }
  },
  {
    id: 'ambivalent', word: 'ambivalent', pronunciation: '/æmˈbɪv.ə.lənt/', partOfSpeech: 'adjective',
    definition: 'Having mixed or contradictory feelings about something.',
    example: 'He felt ambivalent about moving: excited for change, sad to leave.',
    difficulty: 'Advanced', synonyms: ['undecided', 'conflicted'], antonyms: ['certain', 'resolute'], distractors: ['generous', 'enthusiastic', 'truthful'], category: 'Emotion',
    expandedSentence: 'Public reaction to the technological breakthrough was deeply ambivalent; while many praised its efficiency, others feared the inevitable loss of traditional jobs.',
    etymology: 'From Latin ambi- "both" + valere "to be strong."',
    wordFamily: 'ambivalence (noun), ambivalently (adverb)',
    memoryCue: 'Ambi (both) + valent (values) = having both values/feelings pulling at you at once.',
    activeRecallPrompt: 'If you are torn between two choices and feel both good and bad about them, you are...?',
    forms: { other: ['ambivalent', 'ambivalence', 'ambivalently'] }
  },
  {
    id: 'conundrum', word: 'conundrum', pronunciation: '/kəˈnʌn.drəm/', partOfSpeech: 'noun',
    definition: 'A confusing and difficult problem or question.',
    example: 'Choosing between two equally good paths was a genuine conundrum.',
    difficulty: 'Advanced', synonyms: ['puzzle', 'dilemma'], antonyms: ['solution', 'clarification'], distractors: ['routine', 'celebration', 'shortcut'], category: 'Reasoning',
    expandedSentence: 'The central conundrum of the modern economy is how to maintain continuous growth without depleting the finite resources of the planet.',
    etymology: 'Origin unknown; popularized in the late 16th century as a mock-Latin term for a pedant\'s whim.',
    wordFamily: 'conundrums (plural)',
    memoryCue: 'A conundrum is like a complex drum you can\'t figure out how to play.',
    activeRecallPrompt: 'What is a noun for a riddle or puzzle that is seemingly unanswerable?',
    forms: { other: ['conundrum', 'conundrums'] }
  },
  {
    id: 'disparate', word: 'disparate', pronunciation: '/ˈdɪs.pər.ət/', partOfSpeech: 'adjective',
    definition: 'Fundamentally different or unrelated.',
    example: 'The exhibit brought together disparate objects around one shared idea.',
    difficulty: 'Advanced', synonyms: ['different', 'unlike'], antonyms: ['identical', 'homogeneous'], distractors: ['nearby', 'familiar', 'flexible'], category: 'Comparison',
    expandedSentence: 'The challenge of the federal system is creating a single unified policy that satisfies the highly disparate needs of fifty completely distinct states.',
    etymology: 'From Latin disparatus, from dis- "apart" + parare "to prepare, make ready."',
    wordFamily: 'disparity (noun), disparately (adverb)',
    memoryCue: 'Disparate = Dis- (separate) + parts. Parts that are so separate they don\'t match.',
    activeRecallPrompt: 'What word describes things that are so unalike there is no basis for comparison?',
    forms: { other: ['disparate', 'disparity', 'disparately'] }
  },
  {
    id: 'fastidious', word: 'fastidious', pronunciation: '/fæˈstɪd.i.əs/', partOfSpeech: 'adjective',
    definition: 'Very attentive to detail and accuracy.',
    example: 'His fastidious notes made the research easy for others to verify.',
    difficulty: 'Advanced', synonyms: ['meticulous', 'demanding'], antonyms: ['careless', 'sloppy'], distractors: ['flexible', 'hasty', 'certain'], category: 'Character',
    expandedSentence: 'Known for her fastidious editing process, the author would often spend an entire afternoon agonizing over the placement of a single comma.',
    etymology: 'From Latin fastidium "loathing, squeamishness," reflecting an older meaning of being hard to please.',
    wordFamily: 'fastidiously (adverb), fastidiousness (noun)',
    memoryCue: 'A fastidious person makes things "fast" (firm/secure) because they are so detailed, even though they might not be "fast" (quick) at doing it.',
    activeRecallPrompt: 'What adjective describes someone who demands perfection and is incredibly detail-oriented?',
    forms: { other: ['fastidious', 'fastidiously', 'fastidiousness'] }
  },
  {
    id: 'equivocal', word: 'equivocal', pronunciation: '/ɪˈkwɪv.ə.kəl/', partOfSpeech: 'adjective',
    definition: 'Open to more than one interpretation; intentionally unclear.',
    example: 'The spokesperson gave an equivocal answer instead of committing to a date.',
    difficulty: 'Advanced', synonyms: ['ambiguous', 'uncertain'], antonyms: ['direct', 'unequivocal'], distractors: ['truthful', 'visible', 'steady'], category: 'Communication',
    expandedSentence: 'When questioned about the sudden drop in quarterly earnings, the CEO offered only an equivocal statement that left investors feeling anxious.',
    etymology: 'From Late Latin aequivocus, from aequus "equal" + vocare "to call." Meaning "called equally (by the same name)."',
    wordFamily: 'equivocate (verb), equivocation (noun)',
    memoryCue: 'Equi (equal) + vocal (voice) = giving equal voice to two different meanings so no one knows which you mean.',
    activeRecallPrompt: 'If a politician dodges a question by giving a vague, double-meaning answer, their answer is...?',
    forms: { other: ['equivocal', 'equivocally', 'equivocation'] }
  },
  {
    id: 'capricious', word: 'capricious', pronunciation: '/kəˈprɪʃ.əs/', partOfSpeech: 'adjective',
    definition: 'Changing suddenly and unpredictably.',
    example: 'The capricious weather shifted from sun to hail in minutes.',
    difficulty: 'Challenge', synonyms: ['fickle', 'erratic'], antonyms: ['steady', 'consistent'], distractors: ['generous', 'precise', 'unyielding'], category: 'Change & Impact',
    expandedSentence: 'Investors struggled to navigate the capricious market, where a single unverified rumor could wipe out millions in value within an hour.',
    etymology: 'From Italian capriccioso, from capriccio "sudden start, whim" (possibly related to capra "goat," like the skipping of a goat).',
    wordFamily: 'caprice (noun), capriciously (adverb)',
    memoryCue: 'Capri-cious like a Capri Sun—you capriciously poke the straw in suddenly and erratically.',
    activeRecallPrompt: 'What word describes a boss whose mood and demands change completely from one minute to the next?',
    forms: { other: ['capricious', 'capriciousness', 'caprice'] }
  },
  {
    id: 'intransigent', word: 'intransigent', pronunciation: '/ɪnˈtræn.sə.dʒənt/', partOfSpeech: 'adjective',
    definition: 'Unwilling to change a position or agree.',
    example: 'The intransigent negotiator rejected every compromise.',
    difficulty: 'Challenge', synonyms: ['unyielding', 'stubborn'], antonyms: ['open-minded', 'pliable'], distractors: ['helpful', 'temporary', 'reckless'], category: 'Character',
    expandedSentence: 'Despite overwhelming evidence proving the safety of the new protocol, the intransigent board member refused to withdraw his formal objection.',
    etymology: 'From Spanish intransigente, from Latin in- "not" + transigere "to come to an agreement."',
    wordFamily: 'intransigence (noun)',
    memoryCue: 'IN-TRANS-igent: someone who will NOT TRANSfer or shift from their spot.',
    activeRecallPrompt: 'What is a formal word for someone who absolutely refuses to compromise?',
    forms: { other: ['intransigent', 'intransigence', 'intransigently'] }
  },
  {
    id: 'sagacious', word: 'sagacious', pronunciation: '/səˈɡeɪ.ʃəs/', partOfSpeech: 'adjective',
    definition: 'Having good judgment and a deep understanding.',
    example: 'Her sagacious advice helped the club spend its limited funds wisely.',
    difficulty: 'Challenge', synonyms: ['wise', 'perceptive'], antonyms: ['foolish', 'obtuse'], distractors: ['dull', 'impulsive', 'certainty'], category: 'Reasoning',
    expandedSentence: 'In a culture obsessed with rapid reactions, the sagacious leader chose to pause and observe, ultimately avoiding a disastrous long-term commitment.',
    etymology: 'From Latin sagax "of quick perception, acute," related to sagire "to perceive keenly."',
    wordFamily: 'sagacity (noun), sagaciously (adverb)',
    memoryCue: 'A "sage" is a wise person; someone who is sagacious has the wisdom of a sage.',
    activeRecallPrompt: 'What adjective describes someone who possesses profound, perceptive wisdom?',
    forms: { other: ['sagacious', 'sagacity', 'sagaciously'] }
  },
  {
    id: 'vicissitude', word: 'vicissitude', pronunciation: '/vɪˈsɪs.ɪ.tuːd/', partOfSpeech: 'noun',
    definition: 'A change of circumstances, especially one that is difficult.',
    example: 'The memoir follows the vicissitudes of a family rebuilding after a flood.',
    difficulty: 'Challenge', synonyms: ['upheaval', 'fluctuation'], antonyms: ['stability', 'constancy'], distractors: ['comfort', 'shortcut', 'idealistic'], category: 'Change & Impact',
    expandedSentence: 'He learned to accept the inevitable vicissitudes of the farming life, knowing that a season of abundant harvest might easily be followed by a year of severe drought.',
    etymology: 'From Latin vicissitudo "change, turn," from vicis "turn, change."',
    wordFamily: 'vicissitudes (plural)',
    memoryCue: 'Vicissitude sounds like "visas" and "attitudes" - things that change frequently when you travel through life.',
    activeRecallPrompt: 'What noun refers to the unpredictable ups and downs of life or fortune?',
    forms: { other: ['vicissitude', 'vicissitudes'] }
  },
  {
    id: 'corroborate', word: 'corroborate', pronunciation: '/kəˈrɑː.bə.reɪt/', partOfSpeech: 'verb',
    definition: 'To confirm or give support to a statement or theory.',
    example: 'Multiple witnesses can corroborate the timeline of events.',
    difficulty: 'Foundational', synonyms: ['verify', 'substantiate'], antonyms: ['contradict', 'refute'], distractors: ['inspect', 'alleviate', 'ignore'], category: 'Analysis',
    expandedSentence: 'The forensic analysis served to corroborate the detective’s initial hypothesis, transforming a mere hunch into a fully supported legal case.',
    etymology: 'From Latin corroborare "to strengthen," from cor- "together" + robur "strength."',
    wordFamily: 'corroboration (noun), corroborative (adjective)',
    memoryCue: 'Co (together) + robor (robust/strength). Together making a story stronger.',
    activeRecallPrompt: 'When you provide evidence that backs up someone else\'s claim, you do what to their claim?',
    forms: { verb: { present: 'corroborate(s)', past: 'corroborated', pastParticiple: 'corroborated', future: 'will corroborate' } }
  },
  {
    id: 'juxtapose', word: 'juxtapose', pronunciation: '/ˈdʒʌk.stə.poʊz/', partOfSpeech: 'verb',
    definition: 'To place different things together in order to create an interesting effect or to show how they are the same or different.',
    example: 'The museum chose to juxtapose modern abstract art with classical Renaissance sculptures.',
    difficulty: 'Advanced', synonyms: ['compare', 'contrast'], antonyms: ['isolate', 'separate'], distractors: ['intensify', 'examine', 'ease'], category: 'Comparison',
    expandedSentence: 'By deciding to juxtapose the stark, brutalist architecture with the soft, organic forms of the surrounding garden, the designer highlighted the inherent beauty of both.',
    etymology: 'From Latin juxta "beside, very near" + French poser "to place."',
    wordFamily: 'juxtaposition (noun)',
    memoryCue: 'JUXTA (next to) + POSE (place) = place next to each other to compare.',
    activeRecallPrompt: 'What verb means placing two contrasting things side by side for effect?',
    forms: { verb: { present: 'juxtapose(s)', past: 'juxtaposed', pastParticiple: 'juxtaposed', future: 'will juxtapose' } }
  },
  {
    id: 'obfuscate', word: 'obfuscate', pronunciation: '/ˈɑːb.fə.skeɪt/', partOfSpeech: 'verb',
    definition: 'To make something less clear and harder to understand, especially intentionally.',
    example: 'The politician used complex jargon to obfuscate the reality of the tax cuts.',
    difficulty: 'Challenge', synonyms: ['obscure', 'complicate'], antonyms: ['clarify', 'elucidate'], distractors: ['analyze', 'rebound', 'alleviate'], category: 'Communication',
    expandedSentence: 'Rather than answering the journalist’s direct inquiry, the executive issued a statement heavily padded with technical acronyms designed to obfuscate the company’s massive losses.',
    etymology: 'From Latin obfuscare "to darken," from ob- "over" + fuscus "dark."',
    wordFamily: 'obfuscation (noun), obfuscatory (adjective)',
    memoryCue: 'Obfuscate sounds like "obstacle"—putting mental obstacles in the way of understanding.',
    activeRecallPrompt: 'If someone uses fancy words to deliberately hide the truth, they are trying to ______ the issue.',
    forms: { verb: { present: 'obfuscate(s)', past: 'obfuscated', pastParticiple: 'obfuscated', future: 'will obfuscate' } }
  },
  {
    id: 'synthesize', word: 'synthesize', pronunciation: '/ˈsɪn.θə.saɪz/', ukSpelling: 'synthesise', partOfSpeech: 'verb',
    definition: 'To combine a number of things into a coherent whole.',
    example: 'A great essay will synthesize evidence from multiple sources into a single argument.',
    difficulty: 'Advanced', synonyms: ['integrate', 'blend'], antonyms: ['separate', 'dissect'], distractors: ['obscure', 'verify', 'soften'], category: 'Reasoning',
    expandedSentence: 'To write a compelling review of the decade’s literature, the critic had to synthesize disparate trends and competing philosophies into one overarching narrative.',
    etymology: 'From Greek synthesis "composition, a putting together," from syn- "together" + tithenai "to put, place."',
    wordFamily: 'synthesis (noun), synthetic (adjective)',
    memoryCue: 'Synthesis is what a synthesizer does with sounds—blends them into one unified chord.',
    activeRecallPrompt: 'What verb describes pulling together bits of information from various sources into one conclusion?',
    forms: { verb: { present: 'synthesize(s)', past: 'synthesized', pastParticiple: 'synthesized', future: 'will synthesize' } }
  }
];

export const WORDS: Word[] = [...CORE_WORDS, ...SAT_EXPANSION_WORDS];
