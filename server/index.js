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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Unknown API routes -> JSON 404 (so the SPA fallback below never masks them)
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

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

app.listen(PORT, () => {
  console.log(`Language Stats running at http://localhost:${PORT}`);
});
