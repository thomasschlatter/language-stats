// /api/translate — word-gloss a message into the reader's locale.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { glossText } from '../models/translate.js';
import { aiTranslate, isPairReady } from '../models/aiTranslate.js';

const router = Router();

// POST /api/translate  { text, from, to }  -> instant dictionary word-gloss
router.post('/', (req, res) => {
  const { text, from, to } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  const fromLang = getLanguageByCode(from);
  const toLang = getLanguageByCode(to);
  if (!fromLang || !toLang) return res.status(404).json({ error: 'unknown language' });
  res.json(glossText({ fromLangId: fromLang.id, toCode: toLang.code, text }));
});

// POST /api/translate/ai  { text, from, to }  -> local AI (OPUS-MT) sentence
// translation. First call for a language pair downloads the model (~150MB),
// then it's cached. Unavailable pairs return 503 so the client falls back.
router.post('/ai', async (req, res) => {
  const { text, from, to } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  const fromLang = getLanguageByCode(from);
  const toLang = getLanguageByCode(to);
  if (!fromLang || !toLang) return res.status(404).json({ error: 'unknown language' });
  try {
    const result = await aiTranslate({ fromBase: fromLang.lang, toBase: toLang.lang, text });
    res.json({ ...result, wasReady: isPairReady(fromLang.lang, toLang.lang) });
  } catch {
    res.status(503).json({ error: `no local AI model for ${fromLang.lang}→${toLang.lang}` });
  }
});

export default router;
