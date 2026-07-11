// /api/users — public profiles (and, added in Feature 2, follow + community).
import { Router } from 'express';
import { getUserByUsername, profile } from '../models/users.js';

const router = Router();

// GET /api/users/:username  -> public profile
router.get('/:username', (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ profile: profile(user) });
});

export default router;
