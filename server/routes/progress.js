// /api/progress — per-user word progress + coverage stats.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { markWord, wordStatus, summary, suggestions } from '../models/progress.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/progress?lang=de-DE  -> summary + what to learn next
router.get('/', requireAuth, (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  res.json({
    summary: summary(req.user.id, language.id),
    suggestions: suggestions(req.user.id, language.id),
  });
});

// GET /api/progress/word?lang=de-DE&word=Haus  -> status of one word
router.get('/word', requireAuth, (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  if (!req.query.word) return res.status(400).json({ error: 'word is required' });
  res.json({ status: wordStatus(req.user.id, language.id, String(req.query.word).toLowerCase()) });
});

// POST /api/progress/mark  { languageCode, word, status }
router.post('/mark', requireAuth, (req, res) => {
  const { languageCode, word, status } = req.body ?? {};
  if (!languageCode || !word || !status) {
    return res.status(400).json({ error: 'languageCode, word and status are required' });
  }
  if (!['known', 'learning', 'none'].includes(status)) {
    return res.status(400).json({ error: 'status must be known, learning or none' });
  }
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });

  markWord({ userId: req.user.id, languageId: language.id, wordLc: String(word).toLowerCase(), status });
  res.json({ status, summary: summary(req.user.id, language.id) });
});

export default router;
