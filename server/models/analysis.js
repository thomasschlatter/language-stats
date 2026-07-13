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

// The nouns in the coverage set whose gender CANNOT be guessed from their
// ending — no gender-predictive suffix, or an exception to their suffix's
// majority rule. These are the ones a learner must memorise. Returned most-
// frequent-first with cased form, gender, article and (if known) a gloss.
export function unpredictableGenderNouns(languageId, threshold = 1, limit = 500) {
  const total = totalCount(languageId);
  if (!total) return [];
  const target = threshold * total;

  const raw = db
    .prepare(
      `SELECT f.word AS lc, l.gender AS gender, COALESCE(l.form, f.word) AS form,
              (SELECT w.meaning FROM words w
                 WHERE w.language_id = f.language_id AND lower(w.text) = f.word
                   AND w.meaning IS NOT NULL AND w.meaning <> '' LIMIT 1) AS meaning
         FROM word_frequencies f
         JOIN lexicon l ON l.language_id = f.language_id AND l.word_lc = f.word
        WHERE f.language_id = ? AND (f.cum - f.count) < ?
          AND l.pos = 'NOUN' AND l.gender IS NOT NULL
        ORDER BY f.count DESC`
    )
    .all(languageId, target);

  // The lexicon is noisy (numbers, units, lowercase adverbs, single letters).
  // Keep only clean noun-shaped forms: capitalised, letters-only, ≥3 chars.
  const CLEAN = /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{2,}$/;
  const rows = raw.filter((r) => CLEAN.test(r.form));

  // Majority gender per ending, over every gendered noun in the set.
  const buckets = new Map();
  for (const { lc, gender } of rows) {
    const ending = ENDINGS.find((e) => lc.length > e.length && lc.endsWith(e));
    if (!ending) continue;
    if (!buckets.has(ending)) buckets.set(ending, { m: 0, f: 0, n: 0 });
    buckets.get(ending)[gender] += 1;
  }
  const predictedFor = new Map();
  for (const [ending, counts] of buckets) predictedFor.set(ending, majority(counts).key);

  const ARTICLE = { m: 'der', f: 'die', n: 'das' };
  const seen = new Set();
  const out = [];
  for (const { lc, gender, form, meaning } of rows) {
    const ending = ENDINGS.find((e) => lc.length > e.length && lc.endsWith(e));
    if (ending && predictedFor.get(ending) === gender) continue; // rule already right
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push({ word: form, gender, article: ARTICLE[gender] || '', meaning: meaning || '' });
    if (out.length >= limit) break;
  }
  return out;
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
