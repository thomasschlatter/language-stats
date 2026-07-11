// /api/words — the graph dictionary: words (nodes) and links (edges).
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import {
  listWords,
  getWordById,
  findWord,
  createWord,
  updateWord,
  getLinkedWords,
  linkExists,
  createLink,
} from '../models/words.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/words?lang=de&search=hallo
router.get('/', (req, res) => {
  const { lang, search } = req.query;
  const language = getLanguageByCode(lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  res.json({ words: listWords(language.id, search) });
});

// GET /api/words/:id  -> word + its linked (clickable) translations
router.get('/:id', (req, res) => {
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
