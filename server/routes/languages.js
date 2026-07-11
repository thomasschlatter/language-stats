// /api/languages — the list shown in the left sidebar.
import { Router } from 'express';
import { listLanguages, getLanguageByCode, createLanguage } from '../models/languages.js';
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

// POST /api/languages  (signed-in users can add a language)
router.post('/', requireAuth, (req, res) => {
  const { code, name } = req.body ?? {};
  if (!code || !name) {
    return res.status(400).json({ error: 'code and name are required' });
  }
  try {
    res.status(201).json({ language: createLanguage({ code, name }) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'language code already exists' });
    }
    throw err;
  }
});

export default router;
