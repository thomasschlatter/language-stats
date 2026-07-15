// /api/messages — the per-language chat room.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { detectLanguageCode } from '../models/langDetect.js';
import { getUserLanguages } from '../models/users.js';
import { listMessages, createMessage } from '../models/messages.js';
import { blockedIds } from '../models/moderation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages?lang=de-DE&since=42  (hides messages from users you blocked)
// Chat history is private to members, just like posting to the room.
router.get('/', requireAuth, (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const since = Number(req.query.since) || 0;
  let messages = listMessages(language.id, since);
  const blocked = blockedIds(req.user.id);
  if (blocked.size) messages = messages.filter((m) => !blocked.has(m.author_id));
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
  const clean = body.trim().slice(0, 2000);
  // Auto-detect the writing language (constrained to the user's languages), else
  // the client's selection.
  const detected = detectLanguageCode(clean, getUserLanguages(req.user.id).map((l) => l.code));
  const bodyLang = getLanguageByCode(detected || bodyLanguageCode || '');
  const message = createMessage({
    languageId: language.id,
    bodyLangId: bodyLang?.id,
    userId: req.user.id,
    body: clean,
  });
  res.status(201).json({ message });
});

export default router;
