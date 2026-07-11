// /api/auth — sign up, sign in, sign out, current user.
import { Router } from 'express';
import {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  publicUser,
} from '../models/users.js';
import { issueToken, clearToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { email, username, password } = req.body ?? {};
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  try {
    const user = createUser({ email, username, password });
    issueToken(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'email or username already in use' });
    }
    throw err;
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  issueToken(res, user);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(getUserById(req.user.id)) });
});

export default router;
