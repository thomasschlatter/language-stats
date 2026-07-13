// /api/dm — 1-on-1 direct messages and corrections.
import { Router } from 'express';
import { getUserByUsername, getUserLanguages } from '../models/users.js';
import { getLanguageByCode } from '../models/languages.js';
import { sendDM, thread, conversations, getMessage, addCorrection, unreadDmCount, markDmsRead } from '../models/dm.js';
import { blockedBetween } from '../models/moderation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/dm  -> conversation list. Opening the inbox marks DMs as read.
router.get('/', requireAuth, (req, res) => {
  const list = conversations(req.user.id);
  markDmsRead(req.user.id);
  res.json({ conversations: list });
});

// GET /api/dm/unread  -> number of unseen DMs (for the nav badge).
router.get('/unread', requireAuth, (req, res) => {
  res.json({ count: unreadDmCount(req.user.id) });
});

// POST /api/dm/messages/:id/correct  { correctedText, note? }
// The recipient of a message proposes a corrected version of it.
router.post('/messages/:id(\\d+)/correct', requireAuth, (req, res) => {
  const message = getMessage(Number(req.params.id));
  if (!message) return res.status(404).json({ error: 'message not found' });
  if (message.recipient_id !== req.user.id) {
    return res.status(403).json({ error: 'you can only correct messages sent to you' });
  }
  const { correctedText, note } = req.body ?? {};
  if (!correctedText || !correctedText.trim()) {
    return res.status(400).json({ error: 'correctedText is required' });
  }
  const correction = addCorrection({
    messageId: message.id,
    correctorId: req.user.id,
    correctedText: correctedText.trim(),
    note: note?.trim() || null,
  });
  res.status(201).json({ correction });
});

// GET /api/dm/:username?since=42  -> thread with a user
router.get('/:username', requireAuth, (req, res) => {
  const other = getUserByUsername(req.params.username);
  if (!other) return res.status(404).json({ error: 'user not found' });
  const since = Number(req.query.since) || 0;
  const langs = getUserLanguages(other.id);
  res.json({
    partner: other.username,
    partner_native: langs.filter((l) => l.role === 'native').map((l) => l.name),
    partner_learning: langs.filter((l) => l.role === 'learning').map((l) => l.name),
    blocked: blockedBetween(req.user.id, other.id),
    messages: thread(req.user.id, other.id, since),
  });
});

// POST /api/dm/:username  { body, bodyLanguageCode? }
router.post('/:username', requireAuth, (req, res) => {
  const other = getUserByUsername(req.params.username);
  if (!other) return res.status(404).json({ error: 'user not found' });
  if (other.id === req.user.id) return res.status(400).json({ error: 'cannot message yourself' });
  if (blockedBetween(req.user.id, other.id)) return res.status(403).json({ error: 'you cannot message this user' });
  const { body, bodyLanguageCode } = req.body ?? {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });
  const bodyLang = bodyLanguageCode ? getLanguageByCode(bodyLanguageCode) : null;
  const message = sendDM({
    senderId: req.user.id,
    recipientId: other.id,
    bodyLangId: bodyLang?.id,
    body: body.trim().slice(0, 2000),
  });
  res.status(201).json({ message });
});

export default router;
