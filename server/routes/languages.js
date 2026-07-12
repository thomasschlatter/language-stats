// /api/languages — the list shown in the left sidebar.
import { Router } from 'express';
import { listLanguages, getLanguageByCode, createLanguage, deleteLanguage, languageHasContent } from '../models/languages.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/languages
router.get('/', (_req, res) => {
  res.json({ languages: listLanguages() });
});

// GET /api/languages/:code
router.get('/:code', (req, res) => {
  const language = getLanguageByCode(req.params.code);
  if (!language) return res.status(404).json({ error: 'language not found' });
  res.json({ language });
});

// POST /api/languages  (signed-in users can add a language/dialect)
router.post('/', requireAuth, (req, res) => {
  const { code, lang, country, name } = req.body ?? {};
  if (!code || !lang || !name) {
    return res.status(400).json({ error: 'code, lang and name are required' });
  }
  try {
    res.status(201).json({ language: createLanguage({ code, lang, country, name, createdBy: req.user.id }) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'language code already exists' });
    }
    throw err;
  }
});

// DELETE /api/languages/:code
// Anyone can remove an EMPTY language; a language that already has content can
// only be removed by whoever created it (protects seeded/shared content).
router.delete('/:code', requireAuth, (req, res) => {
  const language = getLanguageByCode(req.params.code);
  if (!language) return res.status(404).json({ error: 'language not found' });
  if (language.created_by !== req.user.id && languageHasContent(language.id)) {
    return res.status(403).json({ error: 'only its creator can remove a language that has content' });
  }
  deleteLanguage(req.params.code);
  res.json({ ok: true });
});

export default router;
