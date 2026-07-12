// Authentication middleware + token helpers.
//
// Auth is stateless: on login we issue a signed JWT and store it in an
// httpOnly cookie. Each request reads the cookie, verifies the token, and
// attaches `req.user`. No server-side session store needed for the barebone.

import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'dev-insecure-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const TOKEN_TTL = process.env.TOKEN_TTL || '7d';
const COOKIE_NAME = 'ls_token';

// Fail fast in production if the secret wasn't set — otherwise tokens are forgeable.
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong value in production.');
}

export function issueToken(res, user) {
  const token = jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearToken(res) {
  res.clearCookie(COOKIE_NAME);
}

// Populate req.user if a valid token is present. Never rejects — it just
// leaves req.user undefined for anonymous visitors.
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.uid, username: payload.username };
    } catch {
      // invalid/expired token -> treat as anonymous
    }
  }
  next();
}

// Guard for routes that require a signed-in user.
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
