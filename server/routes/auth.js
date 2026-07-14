// /api/auth — sign up, sign in, sign out, current user, LINE Login.
import { Router } from 'express';
import crypto from 'node:crypto';
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByLineId,
  createLineUser,
  linkLineId,
  getUserLanguages,
  verifyPassword,
  changePassword,
  deleteUser,
  publicUser,
  findOrCreateByEmail,
} from '../models/users.js';
import { issueToken, clearToken, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { sendMail, mailConfigured } from '../lib/mail.js';
import db from '../db/index.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Passwordless "magic link" login --------------------------------------
// GET /api/auth/methods — lets the client show only the login options that work.
router.get('/methods', (_req, res) => {
  res.json({ magicLink: mailConfigured() || !isProd(), line: !!process.env.LINE_CHANNEL_ID });
});

function appOrigin(req) {
  return process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
}

// POST /api/auth/magic/request { email } — email a one-time login link.
router.post('/magic/request', rateLimit({ max: 6 }), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'a valid email is required' });
  }
  if (!mailConfigured() && isProd()) return res.status(503).json({ error: 'email login is not set up yet' });

  // Throttle per-email: at most one live link every 60s.
  const recent = db.prepare(
    "SELECT 1 FROM login_tokens WHERE email = ? AND used = 0 AND created_at > datetime('now', '-60 seconds') LIMIT 1"
  ).get(email);
  if (recent) return res.json({ ok: true }); // pretend success (don't leak / don't spam)

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare(
    "INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, datetime('now', '+20 minutes'))"
  ).run(tokenHash, email);

  const link = `${appOrigin(req)}/api/auth/magic/verify?token=${token}`;
  const text = `Sign in to Groupifier by opening this link (valid for 20 minutes):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `<p>Sign in to <b>Groupifier</b> by clicking the button below (valid for 20 minutes):</p>`
    + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#33ac96;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Sign in to Groupifier</a></p>`
    + `<p style="color:#888;font-size:13px">Or paste this link: <br>${link}</p>`
    + `<p style="color:#888;font-size:13px">If you didn't request this, you can ignore this email.</p>`;
  let result;
  try {
    result = await sendMail({ to: email, subject: 'Your Groupifier sign-in link', text, html });
  } catch (e) {
    console.error('magic-link email failed:', e?.message);
    return res.status(502).json({ error: 'could not send the email — please try again' });
  }
  const out = { ok: true };
  // In dev/test (no SMTP), surface the link directly so the flow is testable.
  if (result?.dev && !isProd()) out.devLink = link;
  res.json(out);
});

// GET /api/auth/magic/verify?token=... — consume the link and sign the user in.
router.get('/magic/verify', (req, res) => {
  const token = String(req.query.token || '');
  const fail = (msg) => res.status(400).send(msg);
  if (!token) return fail('Invalid or missing login link.');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare('SELECT * FROM login_tokens WHERE token_hash = ?').get(tokenHash);
  if (!row || row.used) return fail('This login link has already been used. Please request a new one.');
  if (new Date(row.expires_at + 'Z').getTime() < Date.now()) {
    return fail('This login link has expired. Please request a new one.');
  }
  db.prepare('UPDATE login_tokens SET used = 1 WHERE token_hash = ?').run(tokenHash);
  // One-time cleanup of old tokens.
  db.prepare("DELETE FROM login_tokens WHERE expires_at < datetime('now', '-1 day')").run();

  const { user, isNew } = findOrCreateByEmail(row.email);
  issueToken(res, user);
  res.redirect(isNew ? '/?welcome=1#/' : '/#/');
});

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
// ?retry=1 disables LINE's auto-login (opening the LINE app), which commonly
// fails on iOS (private browsing, in-app browsers, some OS versions). Per LINE's
// guidance we first try auto-login, then fall back to the web form on failure.
router.get('/line', (req, res) => {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) return res.status(503).send('LINE login is not configured.');
  const retry = req.query.retry === '1';
  const state = crypto.randomBytes(16).toString('hex');
  const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: isProd(), maxAge: 10 * 60 * 1000 };
  res.cookie('line_oauth_state', state, cookieOpts);
  // Remember whether we've already fallen back, so we don't loop forever.
  res.cookie('line_retry', retry ? '1' : '0', cookieOpts);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: lineRedirectUri(req),
    state,
    scope: 'profile openid',
  });
  if (retry) params.set('disable_auto_login', 'true');
  res.redirect(`${LINE_AUTH_URL}?${params.toString()}`);
});

// GET /api/auth/line/callback — LINE redirects back here with a code.
router.get('/line/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/#/?login=cancelled');
  // A missing code or state mismatch is how LINE signals an auto-login failure
  // (iOS). Retry once with auto-login disabled before giving up, per LINE docs.
  if (!code || !state || state !== req.cookies?.line_oauth_state) {
    const alreadyRetried = req.cookies?.line_retry === '1';
    res.clearCookie('line_oauth_state');
    if (!alreadyRetried) return res.redirect('/api/auth/line?retry=1');
    res.clearCookie('line_retry');
    return res.status(400).send('Could not complete LINE login. Please open this site in Safari or Chrome and try again.');
  }
  res.clearCookie('line_oauth_state');
  res.clearCookie('line_retry');
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
    let isNew = false;
    // If the (verified) LINE email matches an existing account, link them.
    if (!user && email) {
      const existing = getUserByEmail(email);
      if (existing && !existing.line_user_id) user = linkLineId(existing.id, prof.userId);
    }
    if (!user) {
      user = createLineUser({ lineId: prof.userId, displayName: prof.displayName, email });
      isNew = true;
    }
    issueToken(res, user);
    // New accounts land on a first-run language setup (see app.js).
    res.redirect(isNew ? '/?welcome=1#/' : '/#/');
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
  const learnLangs = getUserLanguages(req.user.id).filter((l) => l.role === 'learning');
  const learning = learnLangs.map((l) => l.code);
  const levels = Object.fromEntries(learnLangs.map((l) => [l.code, l.level || 'a1']));
  res.json({ user: { ...publicUser(user), avatar, avatar_image: user.avatar_image || null, level: user.level || 'a1', learning, levels } });
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
