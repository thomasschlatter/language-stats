// /api/reports — users flag content for moderation. Stored for later review.
import { Router } from 'express';
import { addReport } from '../models/moderation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const TYPES = ['message', 'dm', 'article', 'user'];

// POST /api/reports  { targetType, targetId, reason? }
router.post('/', requireAuth, (req, res) => {
  const { targetType, targetId, reason } = req.body ?? {};
  if (!TYPES.includes(targetType) || !Number(targetId)) {
    return res.status(400).json({ error: 'valid targetType and targetId are required' });
  }
  addReport({ reporterId: req.user.id, targetType, targetId: Number(targetId), reason: reason?.slice(0, 500) });
  res.status(201).json({ ok: true });
});

export default router;
