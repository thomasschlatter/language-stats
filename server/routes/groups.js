// /api/groups — user-made group chats joined via an invite link.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getLanguageByCode } from '../models/languages.js';
import {
  createGroup, getGroup, listMyGroups, joinByCode, leaveGroup,
  isMember, postGroupMessage, groupMessages, listOpenGroups, joinOpenGroup,
} from '../models/groups.js';
import { getBotUserId, mentionsFoxy } from '../models/bot.js';
import { foxyReply } from '../models/foxyChat.js';
import { detectLanguageCode } from '../models/langDetect.js';
import { getUserLanguages } from '../models/users.js';

// Auto-detect the writing language (constrained to the user's languages), else
// fall back to whatever the client selected.
function resolveLang(userId, body, selectedCode) {
  const codes = getUserLanguages(userId).map((l) => l.code);
  return detectLanguageCode(body, codes) || selectedCode || null;
}

const router = Router();

// When @foxy is mentioned, generate a reply with the local model and post it as
// the bot. Fire-and-forget so the user's own message returns instantly; the
// reply shows up on the next poll.
function triggerFoxy(groupId, body) {
  foxyReply(body)
    .then((reply) => { try { postGroupMessage({ groupId, senderId: getBotUserId(), body: reply }); } catch { /* ignore */ } })
    .catch(() => { /* model unavailable */ });
}

// GET /api/groups -> my groups
router.get('/', requireAuth, (req, res) => res.json({ groups: listMyGroups(req.user.id) }));

// POST /api/groups { name, open? } -> create a group (creator becomes owner + member)
router.post('/', requireAuth, (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json({ group: createGroup(req.user.id, name.slice(0, 80), !!req.body?.open) });
});

// GET /api/groups/open -> discoverable open groups you haven't joined
router.get('/open', requireAuth, (req, res) => res.json({ groups: listOpenGroups(req.user.id) }));

// POST /api/groups/join { code } -> join via invite code
router.post('/join', requireAuth, (req, res) => {
  const code = (req.body?.code || '').trim();
  const group = code && joinByCode(req.user.id, code);
  if (!group) return res.status(404).json({ error: 'invalid invite link' });
  res.json({ group });
});

// POST /api/groups/:id/join -> join an OPEN group (no invite needed)
router.post('/:id(\\d+)/join', requireAuth, (req, res) => {
  const group = joinOpenGroup(req.user.id, Number(req.params.id));
  if (!group) return res.status(404).json({ error: 'group not found or not open' });
  res.json({ group });
});

// GET /api/groups/:id -> group + members (members only)
router.get('/:id(\\d+)', requireAuth, (req, res) => {
  const group = getGroup(Number(req.params.id), req.user.id);
  if (!group) return res.status(404).json({ error: 'group not found' });
  if (!group.is_member) return res.status(403).json({ error: 'join the group first' });
  res.json({ group });
});

// POST /api/groups/:id/leave
router.post('/:id(\\d+)/leave', requireAuth, (req, res) => {
  res.json({ ok: leaveGroup(req.user.id, Number(req.params.id)) });
});

// GET /api/groups/:id/messages?since= -> messages (members only)
router.get('/:id(\\d+)/messages', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return res.status(403).json({ error: 'not a member' });
  res.json({ messages: groupMessages(id, Number(req.query.since) || 0) });
});

// POST /api/groups/:id/messages { body, bodyLanguageCode? } -> post a message
router.post('/:id(\\d+)/messages', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return res.status(403).json({ error: 'not a member' });
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'empty message' });
  const clean = body.slice(0, 2000);
  const langCode = resolveLang(req.user.id, clean, req.body?.bodyLanguageCode);
  const lang = langCode ? getLanguageByCode(langCode) : null;
  const message = postGroupMessage({ groupId: id, senderId: req.user.id, body: clean, bodyLangId: lang?.id || null });
  if (mentionsFoxy(clean)) triggerFoxy(id, clean);
  res.status(201).json({ message });
});

export default router;
