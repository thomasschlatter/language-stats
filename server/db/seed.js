// Seed script — creates the starter languages and a few linked German/English
// words so the site isn't empty on first run. Safe to run repeatedly.
//
//   npm run seed
//
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import db from './index.js';
import { getLanguageByCode, createLanguage } from '../models/languages.js';
import { findWord, createWord, linkExists, createLink } from '../models/words.js';
import { frequencyLoaded } from '../models/frequency.js';
import { lexiconLoaded } from '../models/lexicon.js';
import { findArticleBySlug, createArticle } from '../models/articles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function ensureLanguage(code, lang, country, name) {
  return getLanguageByCode(code) || createLanguage({ code, lang, country, name });
}

function ensureWord(languageId, text, meaning) {
  return findWord(languageId, text) || createWord({ languageId, text, meaning });
}

function ensureLink(a, b) {
  if (!linkExists(a.id, b.id, 'translation')) {
    createLink({ sourceId: a.id, targetId: b.id, type: 'translation' });
  }
}

const german = ensureLanguage('de-DE', 'de', 'DE', 'German (Germany)');
const english = ensureLanguage('en-US', 'en', 'US', 'English (US)');
// A dialect, to show country-level locales are first-class:
const swiss = ensureLanguage('de-CH', 'de', 'CH', 'German (Switzerland)');
// A second native language, so cards can be shown per learner's native tongue:
const spanish = ensureLanguage('es-ES', 'es', 'ES', 'Spanish (Spain)');

// Starter words. Each entry has a word + a monolingual gloss in its OWN
// language, so the words inside a definition are themselves clickable and
// translate too. German <-> English words are wired together as graph edges.
//   [germanWord, germanGloss, englishWord, englishGloss]
const pairs = [
  ['Hallo', 'eine Begrüßung', 'hello', 'a greeting'],
  ['Danke', 'ein Ausdruck der Dankbarkeit', 'thanks', 'an expression of gratitude'],
  ['Katze', 'ein kleines Haustier', 'cat', 'a small pet'],
  ['Hund', 'ein treues Haustier', 'dog', 'a loyal pet'],
  ['Wasser', 'eine klare Flüssigkeit', 'water', 'a clear liquid'],
  ['Haus', 'ein Gebäude zum Wohnen', 'house', 'a building for living'],
  ['lernen', 'Wissen erwerben', 'learn', 'to gain knowledge'],
  ['ich', 'die eigene Person', 'I', 'the speaker themselves'],
  ['heiße', 'werde genannt', 'am', 'the present of to be'],
];

const tx = db.transaction(() => {
  for (const [de, deGloss, en, enGloss] of pairs) {
    const w1 = ensureWord(german.id, de, deGloss);
    const w2 = ensureWord(english.id, en, enGloss);
    ensureLink(w1, w2);
  }

  // Swiss German dialect: "Grüezi" == German "Hallo" == English "hello".
  const gruezi = ensureWord(swiss.id, 'Grüezi', 'e Begrüessig');
  ensureLink(gruezi, ensureWord(english.id, 'hello', 'a greeting'));
  ensureLink(gruezi, ensureWord(german.id, 'Hallo', 'eine Begrüßung'));
});
tx();

// ---------------------------------------------------------------------------
// Load OpenSubtitles German word frequencies (for the coverage buttons).
// ---------------------------------------------------------------------------
function loadFrequencies(language, file) {
  if (frequencyLoaded(language.id)) {
    console.log(`Frequencies already loaded for ${language.code}, skipping.`);
    return;
  }
  const raw = readFileSync(file, 'utf8');
  const insert = db.prepare(
    'INSERT OR IGNORE INTO word_frequencies (language_id, rank, word, count, cum) VALUES (?, ?, ?, ?, ?)'
  );
  const load = db.transaction((lines) => {
    let rank = 0;
    let cum = 0;
    for (const line of lines) {
      const sp = line.indexOf(' ');
      if (sp < 1) continue;
      const word = line.slice(0, sp);
      const count = parseInt(line.slice(sp + 1), 10);
      if (!word || !Number.isFinite(count)) continue;
      rank += 1;
      cum += count;
      insert.run(language.id, rank, word, count, cum);
    }
    return rank;
  });
  const n = load(raw.split('\n'));
  console.log(`Loaded ${n} ${language.code} word frequencies from OpenSubtitles.`);
}

loadFrequencies(german, join(__dirname, '..', 'seed-data', 'opensubtitles', 'de_50k.txt'));

// ---------------------------------------------------------------------------
// Load POS + gender from the Universal Dependencies German treebank.
// Aggregate a dominant POS (and, for nouns, a dominant gender) per lowercased
// word form. Keyed lowercased to match the OpenSubtitles frequency list.
// ---------------------------------------------------------------------------
function loadLexicon(language, files) {
  if (lexiconLoaded(language.id)) {
    console.log(`Lexicon already loaded for ${language.code}, skipping.`);
    return;
  }
  const GENDER = { Masc: 'm', Fem: 'f', Neut: 'n' };
  const posCount = new Map();    // key -> { pos: n }
  const genderCount = new Map(); // key -> { m/f/n: n }
  const formCount = new Map();   // key -> { casedForm: n } (to restore German case)

  const bump = (map, key, sub) => {
    let m = map.get(key);
    if (!m) map.set(key, (m = {}));
    m[sub] = (m[sub] || 0) + 1;
  };

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (!line || line[0] === '#') continue;
      const c = line.split('\t');
      if (c.length < 6) continue;
      if (c[0].includes('-') || c[0].includes('.')) continue; // multiword / empty nodes
      const cased = c[1];
      const key = cased.toLowerCase();
      const upos = c[3];
      if (!key || !upos || upos === 'PUNCT') continue;
      bump(posCount, key, upos);
      bump(formCount, key, cased); // remember the actual casing seen in the corpus
      if (upos === 'NOUN') {
        const g = /Gender=(Masc|Fem|Neut)/.exec(c[5]);
        if (g) bump(genderCount, key, GENDER[g[1]]);
      }
    }
  }

  const dominant = (obj) => {
    let best = null;
    let bestN = -1;
    for (const [k, v] of Object.entries(obj)) if (v > bestN) { bestN = v; best = k; }
    return best;
  };

  const insert = db.prepare(
    'INSERT OR REPLACE INTO lexicon (language_id, word_lc, form, pos, gender) VALUES (?, ?, ?, ?, ?)'
  );
  const load = db.transaction(() => {
    let n = 0;
    for (const [key, poss] of posCount) {
      const pos = dominant(poss);
      const gender = genderCount.has(key) ? dominant(genderCount.get(key)) : null;
      const form = dominant(formCount.get(key));
      insert.run(language.id, key, form, pos, gender);
      n += 1;
    }
    return n;
  });
  const n = load();
  console.log(`Loaded lexicon for ${language.code}: ${n} word forms (POS + gender) from UD.`);
}

loadLexicon(german, [
  join(__dirname, '..', 'seed-data', 'ud', 'de_gsd-ud-train.conllu'),
  join(__dirname, '..', 'seed-data', 'ud', 'de_gsd-ud-dev.conllu'),
  join(__dirname, '..', 'seed-data', 'ud', 'de_gsd-ud-test.conllu'),
]);

// ---------------------------------------------------------------------------
// Official article ("card"): Gender in German. Uses the article markup:
//   #          heading
//   -          bullet
//   {{loc|txt}} inline text tagged with a locale (so German inside English prose
//              is clickable as German)
//   [coverage] the interactive % of conversation widget
// ---------------------------------------------------------------------------
const GENDER_ARTICLE = `# Gender in German

Every German noun carries one of three genders: masculine ({{de-DE|der}}), feminine ({{de-DE|die}}), or neuter ({{de-DE|das}}). Gender is not just a label on the noun — it decides the article in front of it, the adjective endings, and the pronouns around it.

Here is the striking part: the three definite articles are among the most common words in the whole language. In the OpenSubtitles data behind this site, {{de-DE|das}} is the 3rd most frequent German word, {{de-DE|die}} is 7th, and {{de-DE|der}} is 10th. The indefinite {{de-DE|ein}} is 15th. You cannot speak a single sentence without touching gender.

# The three genders

- {{de-DE|der}} — masculine
- {{de-DE|die}} — feminine
- {{de-DE|das}} — neuter

Because {{de-DE|der}}, {{de-DE|die}} and {{de-DE|das}} appear so often, learning a noun without its gender is like learning half a word. Always store the article with the noun: not {{de-DE|Tisch}}, but {{de-DE|der Tisch}}.

# How many words do you actually need?

The buttons below use real OpenSubtitles frequency data. Pick a coverage level to see how many of the most common German words make up that share of everyday conversation — and how early the articles {{de-DE|der}}, {{de-DE|die}}, {{de-DE|das}} show up.

[coverage]

# What kind of words are they — and can we guess gender?

Not every frequent word is a noun. The breakdown below splits the same coverage set into nouns, verbs, articles, pronouns and the rest — and then, for the nouns, checks how far the ENDING predicts the gender. For each ending we take the majority gender in the real data and report how often nouns break that rule.

[gender-stats]

# Patterns that help

Some endings strongly predict gender. Nouns ending in -ung, -heit, -keit or -schaft are almost always {{de-DE|die}} (feminine). Nouns ending in -chen or -lein are {{de-DE|das}} (neuter) — which is why {{de-DE|das Mädchen}} (the girl) is grammatically neuter. Many -er nouns for people and tools are {{de-DE|der}} (masculine).

These are tendencies, not laws — but they cover a lot of ground while the exceptions catch up.`;

if (!findArticleBySlug(german.id, 'gender-in-german')) {
  createArticle({
    languageId: german.id,
    bodyLangId: english.id, // written in English, about German
    slug: 'gender-in-german',
    title: 'Gender in German',
    summary: 'der, die, das — why German gender is unavoidable, and how much vocabulary really covers a conversation.',
    body: GENDER_ARTICLE,
    authorId: null,
    isOfficial: true,
  });
  console.log('Created official article: Gender in German.');
}

// Spanish version of the same topic — a Spanish native learning German sees
// THIS card instead of the English one (cards are relative to native language).
const GENERO_ARTICLE = `# El género en alemán

Cada sustantivo alemán tiene uno de tres géneros: masculino ({{de-DE|der}}), femenino ({{de-DE|die}}) o neutro ({{de-DE|das}}). El género no es solo una etiqueta: decide el artículo, las terminaciones de los adjetivos y los pronombres.

Lo llamativo es que los tres artículos están entre las palabras más frecuentes del idioma. En los datos de OpenSubtitles de este sitio, {{de-DE|das}} es la 3ª palabra alemana más frecuente, {{de-DE|die}} la 7ª y {{de-DE|der}} la 10ª. No se puede decir una sola frase sin tocar el género.

# ¿Cuántas palabras necesitas de verdad?

Elige un nivel de cobertura para ver cuántas de las palabras más frecuentes forman esa parte de una conversación cotidiana.

[coverage]

# ¿Qué tipo de palabras son y se puede adivinar el género?

[gender-stats]

# Reglas útiles

Los sustantivos terminados en -ung, -heit, -keit o -schaft son casi siempre {{de-DE|die}} (femenino). Los terminados en -chen o -lein son {{de-DE|das}} (neutro): por eso {{de-DE|das Mädchen}} (la chica) es neutro. Son tendencias, no leyes.`;

if (!findArticleBySlug(german.id, 'el-genero-en-aleman')) {
  createArticle({
    languageId: german.id,
    bodyLangId: spanish.id, // written in Spanish, about German
    slug: 'el-genero-en-aleman',
    title: 'El género en alemán',
    summary: 'der, die, das — por qué el género alemán es inevitable, con datos reales de OpenSubtitles.',
    body: GENERO_ARTICLE,
    authorId: null,
    isOfficial: true,
  });
  console.log('Created official article (es): El género en alemán.');
}

console.log('Seed complete: languages, words, frequencies, lexicon and articles ready.');
