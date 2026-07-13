// /api/auth — sign up, sign in, sign out, current user, LINE Login.
import { Router } from 'express';
import crypto from 'node:crypto';
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByLineId,
  createLineUser,
  verifyPassword,
  changePassword,
  deleteUser,
  publicUser,
} from '../models/users.js';
import { issueToken, clearToken, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// ---- LINE Login (OAuth 2.0 / OpenID Connect v2.1, web) --------------------
const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';
const isProd = () => process.env.NODE_ENV === 'production';

function lineRedirectUri(req) {
  return process.env.LINE_REDIRECT_URI
    || `${req.protocol}://${req.get('host')}/api/auth/line/callback`;
}

// GET /api/auth/line — kick off the LINE login flow.
router.get('/line', (req, res) => {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) return res.status(503).send('LINE login is not configured.');
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('line_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: isProd(), maxAge: 10 * 60 * 1000,
  });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: lineRedirectUri(req),
    state,
    scope: 'profile openid',
  });
  res.redirect(`${LINE_AUTH_URL}?${params.toString()}`);
});

// GET /api/auth/line/callback — LINE redirects back here with a code.
router.get('/line/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/#/?login=cancelled');
  if (!code || !state || state !== req.cookies?.line_oauth_state) {
    return res.status(400).send('Invalid login state — please try again.');
  }
  res.clearCookie('line_oauth_state');
  try {
    const tokenResp = await fetch(LINE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: lineRedirectUri(req),
        client_id: process.env.LINE_CHANNEL_ID,
        client_secret: process.env.LINE_CHANNEL_SECRET,
      }),
    });
    const tok = await tokenResp.json();
    if (!tok.access_token) throw new Error(tok.error_description || 'token exchange failed');

    const profResp = await fetch(LINE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const prof = await profResp.json();
    if (!prof.userId) throw new Error('could not fetch LINE profile');

    // Email only comes through the id_token (email scope + approval); optional.
    let email = null;
    if (tok.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64').toString('utf8'));
        email = payload.email || null;
      } catch { /* ignore */ }
    }

    let user = getUserByLineId(prof.userId);
    if (!user) user = createLineUser({ lineId: prof.userId, displayName: prof.displayName, email });
    issueToken(res, user);
    res.redirect('/#/');
  } catch {
    res.redirect('/#/?login=failed');
  }
});

// POST /api/auth/signup
router.post('/signup', rateLimit({ max: 8 }), (req, res) => {
  const { email, username, password } = req.body ?? {};
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username and password are required' });
  }
  if (email.length > 200 || username.length > 30) {
    return res.status(400).json({ error: 'email or username too long' });
  }
  if (!/^[a-zA-Z0-9_.-]{2,30}$/.test(username)) {
    return res.status(400).json({ error: 'username may use letters, numbers, . _ - (2–30 chars)' });
  }
  if (password.length < 6 || password.length > 200) {
    return res.status(400).json({ error: 'password must be 6–200 characters' });
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
router.post('/login', rateLimit({ max: 12 }), (req, res) => {
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
  const user = getUserById(req.user.id);
  const avatar = user.avatar ? JSON.parse(user.avatar) : null;
  res.json({ user: { ...publicUser(user), avatar } });
});

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'new password must be at least 6 characters' });
  }
  const result = changePassword(req.user.id, currentPassword, newPassword);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

// DELETE /api/auth/account  -> permanently delete the signed-in user
router.delete('/account', requireAuth, (req, res) => {
  deleteUser(req.user.id);
  clearToken(res);
  res.json({ ok: true });
});

export default router;
