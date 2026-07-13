// /api/tips — community language-learning tips.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { listTips, createTip, updateTip } from '../models/tips.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/tips?lang=de
router.get('/', (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  res.json({ tips: listTips(language.id) });
});

// POST /api/tips  { languageCode, bodyLanguageCode?, title, body }
router.post('/', requireAuth, (req, res) => {
  const { languageCode, bodyLanguageCode, title, body } = req.body ?? {};
  if (!languageCode || !title || !body) {
    return res.status(400).json({ error: 'languageCode, title and body are required' });
  }
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const bodyLang = bodyLanguageCode ? getLanguageByCode(bodyLanguageCode) : null;
  const tip = createTip({
    languageId: language.id,
    bodyLangId: bodyLang?.id,
    userId: req.user.id,
    title,
    body,
  });
  res.status(201).json({ tip });
});

// PUT /api/tips/:id  { title, body, bodyLanguageCode? } — author-only edit.
router.put('/:id(\\d+)', requireAuth, (req, res) => {
  const { title, body, bodyLanguageCode } = req.body ?? {};
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const bodyLang = bodyLanguageCode ? getLanguageByCode(bodyLanguageCode) : null;
  const tip = updateTip({
    id: Number(req.params.id),
    userId: req.user.id,
    title,
    body,
    bodyLangId: bodyLang?.id,
  });
  if (!tip) return res.status(404).json({ error: 'tip not found or not yours' });
  res.json({ tip });
});

export default router;
