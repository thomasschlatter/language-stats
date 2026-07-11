// /api/translate — word-gloss a message into the reader's locale.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { glossText } from '../models/translate.js';

const router = Router();

// POST /api/translate  { text, from, to }
router.post('/', (req, res) => {
  const { text, from, to } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  const fromLang = getLanguageByCode(from);
  const toLang = getLanguageByCode(to);
  if (!fromLang || !toLang) return res.status(404).json({ error: 'unknown language' });
  res.json(glossText({ fromLangId: fromLang.id, toCode: toLang.code, text }));
});

export default router;
