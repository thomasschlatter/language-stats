// Language Stats — server entry point.
//
// Responsibilities:
//   1. Expose a JSON REST API under /api/*
//   2. Serve the static frontend from /public
//
// The API and the frontend are decoupled: the frontend only talks to the
// server through the /api endpoints (see public/js/api.js), so the frontend
// could be replaced or hosted separately without touching the backend.

import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import './db/index.js'; // initialise DB + schema on boot
import { listLanguages } from './models/languages.js';
import { attachUser } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import languageRoutes from './routes/languages.js';
import wordRoutes from './routes/words.js';
import tipRoutes from './routes/tips.js';
import articleRoutes from './routes/articles.js';
import frequencyRoutes from './routes/frequency.js';
import messageRoutes from './routes/messages.js';
import progressRoutes from './routes/progress.js';
import profileRoutes from './routes/profile.js';
import userRoutes from './routes/users.js';
import communityRoutes from './routes/community.js';
import dmRoutes from './routes/dm.js';
import translateRoutes from './routes/translate.js';
import flashcardRoutes from './routes/flashcards.js';
import reportRoutes from './routes/reports.js';
import foxyRoutes from './routes/foxy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

// Security headers. CSP is disabled because the frontend uses inline scripts
// (enabling it would need nonces); COEP is off so the same-origin World iframe
// and its WebRTC keep working. Everything else (HSTS, nosniff, frameguard,
// referrer-policy, …) applies.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// .apkg uploads (base64) need a bigger limit than the default — apply it only
// to that path, before the small global JSON parser.
app.use('/api/flashcards/import-apkg', express.json({ limit: '30mb' }));
app.use('/api/profile/avatar-image', express.json({ limit: '5mb' })); // base64 photo
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(attachUser); // makes req.user available to every route

// --- API -------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/words', wordRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/frequency', frequencyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/foxy', foxyRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
// The multiplayer World is deployed separately from this app. Local development
// uses its conventional Vite port; production must explicitly provide its URL.
app.get('/api/world', (_req, res) => {
  const url = process.env.WORLD_URL || (process.env.NODE_ENV === 'production' ? null : 'http://localhost:5173');
  res.json({ url });
});

// Unknown API routes -> JSON 404 (so the SPA fallback below never masks them)
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// --- Uploads (user avatar photos) ------------------------------------------
// Served from the persistent data dir so they survive redeploys.
const uploadsDir = join(process.env.DATA_DIR || join(__dirname, '..', 'data'), 'uploads');
app.use('/uploads', express.static(uploadsDir, { maxAge: '1h' }));
// A missing upload should 404, not fall through to the SPA HTML.
app.use('/uploads', (_req, res) => res.status(404).end());

// Deck cover images. Served ONLY when SHOW_DECK_COVERS=1 (off by default), from a
// gitignored folder that is never committed — so licensed/publisher covers can be
// previewed locally without ever being published to prod or the public repo.
if (process.env.SHOW_DECK_COVERS === '1') {
  const coversDir = join(__dirname, 'private-covers');
  app.use('/covers', express.static(coversDir, { maxAge: '1h' }));
  app.use('/covers', (_req, res) => res.status(404).end());
}

// --- Frontend --------------------------------------------------------------
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback: any non-API route serves index.html.
app.get('*', (_req, res) => res.sendFile(join(publicDir, 'index.html')));

// --- Error handler ---------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

// On a fresh deploy the database is empty — seed it once before serving. The
// seed is idempotent, so this is a no-op on subsequent boots.
if (listLanguages().length === 0) {
  console.log('Empty database detected — seeding…');
  await import('./db/seed.js');
}

// Load any word-frequency lists not yet in the DB (idempotent) — so existing
// production databases pick up newly-added languages on the next restart.
try {
  const { ensureAllFrequencies } = await import('./db/loadFrequencies.js');
  ensureAllFrequencies();
} catch (e) {
  console.warn('Frequency ensure failed:', e.message);
}

// Load official starter decks (frequency words + dictionary glosses) not yet in
// the DB (idempotent) — same rationale as the frequency lists above.
try {
  const { ensureOfficialDecks } = await import('./db/loadOfficialDecks.js');
  ensureOfficialDecks();
} catch (e) {
  console.warn('Official decks ensure failed:', e.message);
}

app.listen(PORT, () => {
  console.log(`Language Stats running at http://localhost:${PORT}`);
});
