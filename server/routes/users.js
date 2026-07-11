// /api/users — public profiles + follow.
import { Router } from 'express';
import { getUserByUsername, profile } from '../models/users.js';
import { toggleFollow, isFollowing, followerCount, followingCount } from '../models/follows.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/users/:username  -> public profile (+ follow info for the viewer)
router.get('/:username', (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'user not found' });
  const p = profile(user);
  p.followers = followerCount(user.id);
  p.following_count = followingCount(user.id);
  if (req.user) p.following = isFollowing(req.user.id, user.id);
  res.json({ profile: p });
});

// POST /api/users/:username/follow  -> toggle follow
router.post('/:username/follow', requireAuth, (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'user not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'cannot follow yourself' });
  const result = toggleFollow(req.user.id, user.id);
  res.json({ ...result, followers: followerCount(user.id) });
});

export default router;
