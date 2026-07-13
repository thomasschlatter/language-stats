// Integration tests: boot the real server against a throwaway DB and hit the
// HTTP API. No network-dependent endpoints are exercised.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4599;
const base = `http://localhost:${PORT}`;
let server;
let tmp;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'ls-test-'));
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: tmp, NODE_ENV: 'test', JWT_SECRET: 'test-secret', WORLD_URL: 'https://world.example.test' },
    stdio: 'ignore',
  });
  // The empty DB auto-seeds on boot before it listens, so wait generously.
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not start in time');
});

after(() => {
  server?.kill();
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, cookie: res.headers.getSetCookie?.()[0]?.split(';')[0] };
}

test('seed produced languages and frequency data', async () => {
  const { data } = await api('/api/languages');
  const codes = data.languages.map((l) => l.code);
  assert.ok(codes.includes('de-DE') && codes.includes('en-US'));

  const cov = await api('/api/frequency/coverage?lang=de-DE&t=0.5');
  assert.ok(cov.data.wordsNeeded > 0);
});

test('world uses the configured public host', async () => {
  const { status, data } = await api('/api/world');
  assert.equal(status, 200);
  assert.equal(data.url, 'https://world.example.test');
});

test('signup + me, and duplicate email is rejected', async () => {
  const up = await api('/api/auth/signup', { method: 'POST', body: { email: 'a@test.io', username: 'alice', password: 'secret6' } });
  assert.equal(up.status, 201);
  assert.ok(up.cookie);

  const me = await api('/api/auth/me', { cookie: up.cookie });
  assert.equal(me.data.user.username, 'alice');

  const dup = await api('/api/auth/signup', { method: 'POST', body: { email: 'a@test.io', username: 'alice2', password: 'secret6' } });
  assert.equal(dup.status, 409);
});

test('bad username is rejected', async () => {
  const r = await api('/api/auth/signup', { method: 'POST', body: { email: 'b@test.io', username: 'bad name', password: 'secret6' } });
  assert.equal(r.status, 400);
});

test('flashcard import → study → review grows the interval', async () => {
  const up = await api('/api/auth/signup', { method: 'POST', body: { email: 'c@test.io', username: 'carol', password: 'secret6' } });
  const cookie = up.cookie;

  const imp = await api('/api/flashcards/import', { method: 'POST', cookie, body: { languageCode: 'de-DE', name: 'T', text: 'Hallo\thello\nDanke\tthanks' } });
  assert.equal(imp.status, 201);
  assert.equal(imp.data.added, 2);

  const study = await api(`/api/flashcards/study?deck=${imp.data.deck.id}`, { cookie });
  assert.equal(study.data.cards.length, 2);
  const cardId = study.data.cards[0].id;

  const r1 = await api('/api/flashcards/review', { method: 'POST', cookie, body: { cardId, rating: 3 } });
  assert.equal(r1.data.card.interval, 1);
  const r2 = await api('/api/flashcards/review', { method: 'POST', cookie, body: { cardId, rating: 3 } });
  assert.ok(r2.data.card.interval > r1.data.card.interval);
});

test('quiz needs 4+ cards and returns recognition + recall choices', async () => {
  const up = await api('/api/auth/signup', { method: 'POST', body: { email: 'q@test.io', username: 'quinn', password: 'secret6' } });
  const cookie = up.cookie;

  // Too few cards → 400 with a helpful message.
  const small = await api('/api/flashcards/import', { method: 'POST', cookie, body: { languageCode: 'de-DE', name: 'Small', text: 'ja\tyes\nnein\tno' } });
  assert.equal(small.status, 201);
  const tooFew = await api('/api/flashcards/quiz?lang=de-DE&n=4', { cookie });
  assert.equal(tooFew.status, 400);

  // With 5 cards the quiz is playable.
  await api('/api/flashcards/import', { method: 'POST', cookie, body: { languageCode: 'de-DE', name: 'Big', text: 'Hund\tdog\nKatze\tcat\nHaus\thouse\nBaum\ttree\nAuto\tcar' } });
  const quiz = await api('/api/flashcards/quiz?lang=de-DE&n=4', { cookie });
  assert.equal(quiz.status, 200);
  assert.ok(quiz.data.items.length >= 1);
  for (const it of quiz.data.items) {
    assert.ok(Number.isInteger(it.id));
    assert.equal(it.choices.length, 4);
    assert.ok(it.choices.includes(it.answer), 'choices must contain the answer');
    assert.equal(it.frontChoices.length, 4);
    assert.ok(it.frontChoices.includes(it.front), 'frontChoices must contain the word');
  }
});

test('auth required for protected routes', async () => {
  const protectedPaths = [
    '/api/flashcards/decks',
    '/api/messages?lang=de-DE',
    '/api/progress?lang=de-DE',
    '/api/dm',
    '/api/profile',
  ];
  for (const path of protectedPaths) {
    const r = await api(path);
    assert.equal(r.status, 401, `${path} should require authentication`);
  }
});

test('language and community browsing remain public', async () => {
  const publicPaths = [
    '/api/languages',
    '/api/articles?lang=de-DE',
    '/api/tips?lang=de-DE',
    '/api/community',
    '/api/words?lang=de-DE',
  ];
  for (const path of publicPaths) {
    const r = await api(path);
    assert.equal(r.status, 200, `${path} should remain public`);
  }
});
