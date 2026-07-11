// Analyse a frequency-coverage set: how many of the words are nouns / verbs /
// etc., and — for the nouns — how well their ENDING predicts their gender.
//
// "Predicted" gender for an ending is the MAJORITY gender among the nouns with
// that ending *in this data* (not a hardcoded rule). The exception rate is the
// share of nouns with that ending whose gender differs from the majority.

import db from '../db/index.js';
import { totalCount } from './frequency.js';

// Candidate German noun endings, checked longest-first so "-ung" wins over "-e".
const ENDINGS = [
  'schaft', 'ismus', 'ung', 'heit', 'keit', 'tät', 'ion', 'ment', 'chen',
  'lein', 'ling', 'enz', 'anz', 'tum', 'ik', 'ei', 'ur', 'or', 'ant', 'ent',
  'ich', 'ig', 'ma', 'um', 'er', 'el', 'en', 'ie', 'e',
].sort((a, b) => b.length - a.length);

const POS_LABELS = {
  NOUN: 'Nouns', PROPN: 'Proper nouns', VERB: 'Verbs', AUX: 'Auxiliaries',
  ADJ: 'Adjectives', ADV: 'Adverbs', DET: 'Articles / determiners',
  PRON: 'Pronouns', ADP: 'Prepositions', CCONJ: 'Conjunctions',
  SCONJ: 'Subordinating conj.', NUM: 'Numerals', PART: 'Particles',
  INTJ: 'Interjections', X: 'Other', SYM: 'Symbols', PUNCT: 'Punctuation',
};

function majority(counts) {
  let best = null;
  let bestN = -1;
  let total = 0;
  for (const [k, v] of Object.entries(counts)) {
    total += v;
    if (v > bestN) { bestN = v; best = k; }
  }
  return { key: best, n: bestN, total };
}

export function coverageAnalysis(languageId, threshold) {
  const total = totalCount(languageId);
  if (!total) return null;
  const target = threshold * total;

  // Every word in the coverage set, joined to its lexicon entry (if any).
  const rows = db
    .prepare(
      `SELECT f.word, l.pos, l.gender
       FROM word_frequencies f
       LEFT JOIN lexicon l
         ON l.language_id = f.language_id AND l.word_lc = f.word
       WHERE f.language_id = ? AND (f.cum - f.count) < ?`
    )
    .all(languageId, target);

  // --- POS breakdown ---
  const posCounts = {};
  let unknown = 0;
  for (const r of rows) {
    if (r.pos) posCounts[r.pos] = (posCounts[r.pos] || 0) + 1;
    else unknown += 1;
  }
  const pos = Object.entries(posCounts)
    .map(([p, count]) => ({ pos: p, label: POS_LABELS[p] || p, count }))
    .sort((a, b) => b.count - a.count);

  // --- Noun gender by ending ---
  const nouns = rows.filter((r) => r.pos === 'NOUN' && r.gender);
  const buckets = new Map(); // ending -> { m, f, n }

  for (const { word, gender } of nouns) {
    const w = word.toLowerCase();
    const ending = ENDINGS.find((e) => w.length > e.length && w.endsWith(e));
    if (!ending) continue;
    if (!buckets.has(ending)) buckets.set(ending, { m: 0, f: 0, n: 0 });
    buckets.get(ending)[gender] += 1;
  }

  let bucketedNouns = 0;
  let correctByRule = 0;
  const endings = [];
  for (const [ending, counts] of buckets) {
    const { key: predicted, n: predictedN, total: t } = majority(counts);
    bucketedNouns += t;
    correctByRule += predictedN;
    endings.push({
      ending: `-${ending}`,
      count: t,
      genders: counts,
      predicted,                                   // 'm' | 'f' | 'n'
      predictedPct: Math.round((predictedN / t) * 100),
      exceptionPct: Math.round(((t - predictedN) / t) * 100),
    });
  }
  endings.sort((a, b) => b.count - a.count);

  return {
    threshold,
    wordsNeeded: rows.length,
    matched: rows.length - unknown,
    unknown,
    pos,
    nouns: {
      total: nouns.length,
      withPredictiveEnding: bucketedNouns,
      withPredictiveEndingPct: nouns.length ? Math.round((bucketedNouns / nouns.length) * 100) : 0,
      // If you always guess an ending's majority gender, how often are you right?
      ruleAccuracyPct: bucketedNouns ? Math.round((correctByRule / bucketedNouns) * 100) : 0,
      endings,
    },
  };
}
