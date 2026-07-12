// /api/words — the graph dictionary: words (nodes) and links (edges).
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import {
  listWords,
  getWordById,
  getEntry,
  findWord,
  createWord,
  updateWord,
  upsertScrapedWord,
  getLinkedWords,
  linkExists,
  createLink,
} from '../models/words.js';
import { fetchDefinition } from '../lib/wiktionary.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/words?lang=de&search=hallo
router.get('/', (req, res) => {
  const { lang, search } = req.query;
  const language = getLanguageByCode(lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  res.json({ words: listWords(language.id, search) });
});

// GET /api/words/entry?lang=de&text=ich
// The core "word as an element" lookup: returns the entry for a (language,
// text) pair — or word:null if that word isn't in the dictionary yet — plus
// its links. Every rendered word points here.
router.get('/entry', async (req, res) => {
  const { lang, text } = req.query;
  const language = getLanguageByCode(lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  if (!text) return res.status(400).json({ error: 'text is required' });

  const word0 = String(text).trim();
  let word = getEntry(language.id, word0);

  // On-demand definition: if we've never fetched this word (no entry, or an
  // entry with no meaning and not yet scraped), pull it from Wiktionary now and
  // cache the result (even a miss, so we don't refetch every view).
  if (!word || (!word.meaning && !word.scraped_at)) {
    try {
      const def = await fetchDefinition(word0, language.lang);
      upsertScrapedWord({ languageId: language.id, text: word0, meaning: def || null });
      word = getEntry(language.id, word0);
    } catch { /* network hiccup — proceed without a definition */ }
  }

  const links = word ? getLinkedWords(word.id) : [];
  res.json({
    languageCode: language.code,
    languageName: language.name,
    text: word0,
    word: word || null,
    links,
  });
});

// GET /api/words/resolve?text=ich&from=de&to=en
// Given a word in language `from`, decide where a click should land, based on
// the reader's native language `to`:
//   - to === from            -> the word's own page
//   - translation exists     -> the translated word's page (native language)
//   - no translation / unknown word -> the source word's page (to add one)
router.get('/resolve', (req, res) => {
  const { text, from, to } = req.query;
  const fromLang = getLanguageByCode(from);
  if (!fromLang) return res.status(404).json({ error: 'unknown source language' });
  if (!text) return res.status(400).json({ error: 'text is required' });

  const word = String(text).trim();
  const toLang = getLanguageByCode(to);

  // Same language (or unknown native) -> just open the word's own page.
  if (!toLang || toLang.code === fromLang.code) {
    return res.json({ target: { languageCode: fromLang.code, text: word }, reason: 'self' });
  }

  const src = getEntry(fromLang.id, word);
  if (src) {
    const translation = getLinkedWords(src.id).find(
      (l) => l.type === 'translation' && l.language_code === toLang.code
    );
    if (translation) {
      return res.json({
        target: { languageCode: toLang.code, text: translation.text },
        reason: 'translation',
      });
    }
    return res.json({ target: { languageCode: fromLang.code, text: src.text }, reason: 'no-translation' });
  }
  // Word not in the dictionary at all -> land on its (source) page to add it.
  return res.json({ target: { languageCode: fromLang.code, text: word }, reason: 'unknown-word' });
});

// GET /api/words/:id  -> word + its linked (clickable) translations
router.get('/:id(\\d+)', (req, res) => {
  const word = getWordById(Number(req.params.id));
  if (!word) return res.status(404).json({ error: 'word not found' });
  res.json({ word, links: getLinkedWords(word.id) });
});

// POST /api/words  { languageCode, text, meaning?, notes? }
router.post('/', requireAuth, (req, res) => {
  const { languageCode, text, meaning, notes } = req.body ?? {};
  if (!languageCode || !text) {
    return res.status(400).json({ error: 'languageCode and text are required' });
  }
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });

  const existing = findWord(language.id, text.trim());
  if (existing) return res.status(200).json({ word: getWordById(existing.id), created: false });

  const word = createWord({
    languageId: language.id,
    text: text.trim(),
    meaning,
    notes,
    userId: req.user.id,
  });
  res.status(201).json({ word, created: true });
});

// PATCH /api/words/:id  { meaning?, notes? }
router.patch('/:id', requireAuth, (req, res) => {
  const word = getWordById(Number(req.params.id));
  if (!word) return res.status(404).json({ error: 'word not found' });
  const { meaning, notes } = req.body ?? {};
  res.json({ word: updateWord(word.id, { meaning, notes }) });
});

// POST /api/words/:id/links  -> link this word to another word (a translation).
// Body accepts either an existing target word id, OR a new word to create:
//   { targetId }                                  -> link to existing word
//   { targetLanguageCode, targetText, ... }       -> create then link
router.post('/:id/links', requireAuth, (req, res) => {
  const source = getWordById(Number(req.params.id));
  if (!source) return res.status(404).json({ error: 'source word not found' });

  const { targetId, targetLanguageCode, targetText, targetMeaning, type } = req.body ?? {};
  const linkType = type || 'translation';

  let target;
  if (targetId) {
    target = getWordById(Number(targetId));
    if (!target) return res.status(404).json({ error: 'target word not found' });
  } else if (targetLanguageCode && targetText) {
    const language = getLanguageByCode(targetLanguageCode);
    if (!language) return res.status(404).json({ error: 'unknown target language' });
    const existing = findWord(language.id, targetText.trim());
    target = existing
      ? getWordById(existing.id)
      : createWord({
          languageId: language.id,
          text: targetText.trim(),
          meaning: targetMeaning,
          userId: req.user.id,
        });
  } else {
    return res
      .status(400)
      .json({ error: 'provide targetId, or targetLanguageCode + targetText' });
  }

  if (target.id === source.id) {
    return res.status(400).json({ error: 'cannot link a word to itself' });
  }
  if (linkExists(source.id, target.id, linkType)) {
    return res.status(200).json({ target, created: false });
  }

  createLink({ sourceId: source.id, targetId: target.id, type: linkType, userId: req.user.id });
  res.status(201).json({ target, created: true });
});

export default router;
