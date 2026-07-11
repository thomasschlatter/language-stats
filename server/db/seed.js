// Seed script — creates the starter languages and a few linked German/English
// words so the site isn't empty on first run. Safe to run repeatedly.
//
//   npm run seed
//
import db from './index.js';
import { getLanguageByCode, createLanguage } from '../models/languages.js';
import { findWord, createWord, linkExists, createLink } from '../models/words.js';

function ensureLanguage(code, name) {
  return getLanguageByCode(code) || createLanguage({ code, name });
}

function ensureWord(languageId, text, meaning) {
  return findWord(languageId, text) || createWord({ languageId, text, meaning });
}

function ensureLink(a, b) {
  if (!linkExists(a.id, b.id, 'translation')) {
    createLink({ sourceId: a.id, targetId: b.id, type: 'translation' });
  }
}

const german = ensureLanguage('de', 'German');
const english = ensureLanguage('en', 'English');

// A handful of German words with English translations, wired as graph edges.
const pairs = [
  ['Hallo', 'hello', 'a greeting'],
  ['Danke', 'thank you', 'expression of gratitude'],
  ['Katze', 'cat', 'a small domesticated feline'],
  ['Hund', 'dog', 'a domesticated canine'],
  ['Wasser', 'water', 'the clear liquid H2O'],
  ['Haus', 'house', 'a building for living in'],
  ['lernen', 'to learn', 'to acquire knowledge'],
];

const tx = db.transaction(() => {
  for (const [de, en, meaning] of pairs) {
    const w1 = ensureWord(german.id, de, meaning);
    const w2 = ensureWord(english.id, en, meaning);
    ensureLink(w1, w2);
  }
});
tx();

console.log('Seed complete: languages + starter German/English words created.');
