import { type Word } from '../types';

type SatExpansionSeed = {
  id?: string;
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  category: string;
  sourceNote: string;
};

function satExpansionWord(seed: SatExpansionSeed): Word {
  return {
    id: seed.id ?? seed.word.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    word: seed.word,
    pronunciation: seed.pronunciation,
    partOfSpeech: seed.partOfSpeech,
    definition: seed.definition,
    example: seed.example,
    difficulty: 'Advanced',
    synonyms: [],
    antonyms: [],
    distractors: [],
    category: seed.category,
    sourceNote: seed.sourceNote,
    expandedSentence: seed.example,
    etymology: '',
    wordFamily: seed.word,
    memoryCue: `Connect ${seed.word} to this meaning: ${seed.definition}`,
    activeRecallPrompt: `What does "${seed.word}" mean in this context?`,
    forms: { other: [seed.word] },
    track: 'sat',
  };
}

const changeCategory = 'Words Related to Change, Agreement, & Contrast';
const changeNote = 'These words are highly frequent in reading passages that contrast two arguments or track an evolution in a scientific or historical narrative.';
const intellectCategory = 'Words Related to Intellect, Knowledge, & Clarity';
const intellectNote = "Use these words when evaluating authors' arguments, hypotheses, or clarity of expression in the text.";
const emotionCategory = 'Words Related to Emotion, Attitude, & Criticism';
const emotionNote = "These terms often appear in questions asking about the author's tone, a character's stance, or a researcher's perspective.";
const quantityCategory = 'Words Related to Quantity, Scarcity, & Excess';
const quantityNote = 'These words appear regularly in scientific data interpretations or passages describing historical wealth and resources.';
const languageCategory = 'Words Related to Language, Style, & Communication';
const languageNote = 'These words help identify an author’s style, precision, and the effects of language in reading passages.';

export const SAT_EXPANSION_WORDS: Word[] = [
  satExpansionWord({ word: 'Abate', pronunciation: '/əˈbeɪt/', partOfSpeech: 'v.', definition: 'To reduce, lessen, or diminish in intensity.', example: 'The winds began to abate before the research team returned to the field.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Ameliorate', pronunciation: '/əˈmiːl.jə.reɪt/', partOfSpeech: 'v.', definition: 'To make a bad or difficult situation better.', example: 'The revised policy was designed to ameliorate the shortage of affordable housing.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Aquiesce', pronunciation: '/ˌæk.wiˈes/', partOfSpeech: 'v.', definition: 'To accept something reluctantly but without protest.', example: 'After hours of debate, the committee chose to aquiesce to the revised proposal.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Anachronism', pronunciation: '/əˈnæk.rə.nɪ.zəm/', partOfSpeech: 'n.', definition: 'Something belonging to a period other than that in which it exists.', example: 'The handwritten ledger seemed like an anachronism in the automated laboratory.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Concur', pronunciation: '/kənˈkɝː/', partOfSpeech: 'v.', definition: 'To be of the same opinion; to agree.', example: 'Several independent reviewers concur that the evidence supports the new theory.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Evanescent', pronunciation: '/ˌev.əˈnes.ənt/', partOfSpeech: 'adj.', definition: 'Soon passing out of sight, memory, or existence; quickly fading.', example: 'The artist attempted to preserve the evanescent colors of the evening sky.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Immutable', pronunciation: '/ɪˈmjuː.t̬ə.bəl/', partOfSpeech: 'adj.', definition: 'Unchanging over time or unable to be changed.', example: 'The discovery challenged the belief that the region’s boundaries were immutable.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Malleable', pronunciation: '/ˈmæl.i.ə.bəl/', partOfSpeech: 'adj.', definition: 'Easily influenced; pliable or able to be shaped.', example: 'Because public opinion remained malleable, both campaigns continued their outreach.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Oscillate', pronunciation: '/ˈɑː.sə.leɪt/', partOfSpeech: 'v.', definition: 'To move or swing back and forth at a regular speed.', example: 'The recorded values oscillate between two extremes as the temperature changes.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Spurious', pronunciation: '/ˈspjʊr.i.əs/', partOfSpeech: 'adj.', definition: 'Not being what it purports to be; false or fake.', example: 'The researchers rejected the spurious correlation after reviewing the larger sample.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Transient', pronunciation: '/ˈtræn.zi.ənt/', partOfSpeech: 'adj.', definition: 'Lasting only for a short time; impermanent.', example: 'The initial increase proved transient and disappeared by the following quarter.', category: changeCategory, sourceNote: changeNote }),
  satExpansionWord({ word: 'Arcane', pronunciation: '/ɑːrˈkeɪn/', partOfSpeech: 'adj.', definition: 'Understood by few; mysterious or secret.', example: 'The guide translated the arcane terminology into language a general audience could follow.', category: intellectCategory, sourceNote: intellectNote }),
  satExpansionWord({ word: 'Didactic', pronunciation: '/daɪˈdæk.tɪk/', partOfSpeech: 'adj.', definition: 'Intended to teach, particularly in having moral instruction as an ulterior motive.', example: 'The novel is didactic without allowing its lesson to overwhelm the characters.', category: intellectCategory, sourceNote: intellectNote }),
  satExpansionWord({ word: 'Elucidate', pronunciation: '/iˈluː.sə.deɪt/', partOfSpeech: 'v.', definition: 'To make something clear; to explain.', example: 'The additional experiment helped elucidate the relationship between the two variables.', category: intellectCategory, sourceNote: intellectNote }),
  satExpansionWord({ word: 'Erudite', pronunciation: '/ˈer.jə.daɪt/', partOfSpeech: 'adj.', definition: 'Having or showing great knowledge or learning.', example: 'Her erudite commentary connected the poem to several centuries of literary history.', category: intellectCategory, sourceNote: intellectNote }),
  satExpansionWord({ word: 'Inscrutable', pronunciation: '/ɪnˈskruː.t̬ə.bəl/', partOfSpeech: 'adj.', definition: 'Impossible to understand or interpret.', example: 'Without the missing records, the sudden shift in policy remained inscrutable.', category: intellectCategory, sourceNote: intellectNote }),
  satExpansionWord({ word: 'Nebulous', pronunciation: '/ˈneb.jə.ləs/', partOfSpeech: 'adj.', definition: 'Unclear, vague, or ill-defined.', example: 'The proposal’s goals were too nebulous to support a reliable evaluation.', category: intellectCategory, sourceNote: intellectNote }),
  satExpansionWord({ word: 'Apathy', pronunciation: '/ˈæp.ə.θi/', partOfSpeech: 'n.', definition: 'Lack of interest, enthusiasm, or concern.', example: 'The campaign sought to replace public apathy with sustained civic participation.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Cynical', pronunciation: '/ˈsɪn.ɪ.kəl/', partOfSpeech: 'adj.', definition: 'Believing that people are motivated purely by self-interest.', example: 'The essay presents a cynical view of the donors’ reasons for supporting the museum.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Deride', pronunciation: '/dɪˈraɪd/', partOfSpeech: 'v.', definition: 'To express contempt for; to ridicule or mock.', example: 'Early critics would deride the invention before its practical value became clear.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Disdain', pronunciation: '/dɪsˈdeɪn/', partOfSpeech: 'n./v.', definition: "The feeling that someone or something is unworthy of one's consideration or respect.", example: 'The narrator’s disdain for convention shapes both her choices and her tone.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Dispassionate', pronunciation: '/dɪsˈpæʃ.ən.ət/', partOfSpeech: 'adj.', definition: 'Not influenced by strong emotion, and so able to be rational and impartial.', example: 'The review offers a dispassionate assessment of the policy’s benefits and costs.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Indignant', pronunciation: '/ɪnˈdɪɡ.nənt/', partOfSpeech: 'adj.', definition: 'Feeling or showing anger or annoyance at what is perceived as unfair treatment.', example: 'Residents were indignant that the decision had been made without public input.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Lament', pronunciation: '/ləˈment/', partOfSpeech: 'v.', definition: 'To express passionate grief or regret.', example: 'The author does not merely lament the loss of the forest but proposes a path to recovery.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Partisan', pronunciation: '/ˈpɑːr.t̬ə.zən/', partOfSpeech: 'adj.', definition: 'Prejudiced in favor of a particular cause or side.', example: 'The researchers used nonpartisan reviewers to reduce the risk of a partisan interpretation.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Supercilious', pronunciation: '/ˌsuː.pɚˈsɪl.i.əs/', partOfSpeech: 'adj.', definition: 'Behaving or looking as though one thinks one is superior to others.', example: 'His supercilious response dismissed the community’s concerns without addressing them.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Venerate', pronunciation: '/ˈven.ə.reɪt/', partOfSpeech: 'v.', definition: 'To regard with great respect; to revere.', example: 'Later generations would venerate the scientist for her persistence and integrity.', category: emotionCategory, sourceNote: emotionNote }),
  satExpansionWord({ word: 'Dearth', pronunciation: '/dɝːθ/', partOfSpeech: 'n.', definition: 'A scarcity or lack of something.', example: 'A dearth of long-term data prevented the team from drawing a firm conclusion.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Copious', pronunciation: '/ˈkoʊ.pi.əs/', partOfSpeech: 'adj.', definition: 'Abundant in supply or quantity.', example: 'Copious rainfall transformed the dry basin into a temporary wetland.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Glut', pronunciation: '/ɡlʌt/', partOfSpeech: 'n.', definition: 'An excessively abundant supply of something.', example: 'A glut of inexpensive imports forced local producers to reconsider their strategy.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Paucity', pronunciation: '/ˈpɑː.sə.t̬i/', partOfSpeech: 'n.', definition: 'The presence of something only in small or insufficient quantities or amounts.', example: 'The paucity of surviving documents makes the period difficult to reconstruct.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Prodigal', pronunciation: '/ˈprɑː.dɪ.ɡəl/', partOfSpeech: 'adj.', definition: 'Wasteful or extravagant in spending or resources.', example: 'The report criticized the administration’s prodigal use of limited water resources.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Profuse', pronunciation: '/prəˈfjuːs/', partOfSpeech: 'adj.', definition: 'Plentiful; abundant.', example: 'Profuse evidence from several archives supports the historian’s interpretation.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Scrupulous', pronunciation: '/ˈskruː.pjə.ləs/', partOfSpeech: 'adj.', definition: 'Diligent, thorough, and extremely attentive to details.', example: 'The team kept scrupulous records so that every result could be independently verified.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ word: 'Superfluous', pronunciation: '/suːˈpɝː.flu.əs/', partOfSpeech: 'adj.', definition: 'Unnecessary, especially through being more than enough.', example: 'The editor removed several superfluous examples that repeated the same point.', category: quantityCategory, sourceNote: quantityNote }),
  satExpansionWord({ id: 'sat-pernicious', word: 'Pernicious', pronunciation: '/pɚˈnɪʃ.əs/', partOfSpeech: 'adj.', definition: 'Having a harmful effect, especially one that is gradual, subtle, or difficult to notice.', example: 'The pernicious rumor spread quietly until it damaged the team’s trust.', category: 'Words Related to Cause, Effect, & Consequence', sourceNote: 'This word is useful when a passage traces harm that accumulates gradually rather than appearing all at once.' }),
  satExpansionWord({ id: 'sat-sesquipedalian', word: 'Sesquipedalian', pronunciation: '/ˌses.kwɪ.pəˈdeɪ.li.ən/', partOfSpeech: 'adj.', definition: 'Characterized by the use of long, complicated words.', example: 'The editor trimmed the essay’s sesquipedalian prose so its central idea could reach more readers.', category: languageCategory, sourceNote: languageNote }),
];