// /api/messages — the per-language chat room.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { listMessages, createMessage } from '../models/messages.js';
import { blockedIds } from '../models/moderation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages?lang=de-DE&since=42  (hides messages from users you blocked)
router.get('/', (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const since = Number(req.query.since) || 0;
  let messages = listMessages(language.id, since);
  if (req.user) {
    const blocked = blockedIds(req.user.id);
    if (blocked.size) messages = messages.filter((m) => !blocked.has(m.author_id));
  }
  res.json({ messages });
});

// POST /api/messages  { languageCode, bodyLanguageCode?, body }
router.post('/', requireAuth, (req, res) => {
  const { languageCode, bodyLanguageCode, body } = req.body ?? {};
  if (!languageCode || !body || !body.trim()) {
    return res.status(400).json({ error: 'languageCode and body are required' });
  }
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const bodyLang = bodyLanguageCode ? getLanguageByCode(bodyLanguageCode) : null;
  const message = createMessage({
    languageId: language.id,
    bodyLangId: bodyLang?.id,
    userId: req.user.id,
    body: body.trim().slice(0, 2000),
  });
  res.status(201).json({ message });
});

export default router;
