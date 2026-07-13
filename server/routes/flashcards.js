// /api/flashcards — decks, import, study (SRS), and the familiarity map.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import {
  createDeck, getDeck, listDecks, deleteDeck,
  addCards, dueCards, reviewCard, familiarityMap, listCards,
} from '../models/flashcards.js';
import { topWords, totalCount } from '../models/frequency.js';
import { unpredictableGenderNouns } from '../models/analysis.js';
import { aiTranslate } from '../models/aiTranslate.js';
import { parseApkg } from '../lib/anki.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Parse pasted CSV / TSV (also Anki's plain-text export). front = col 0,
// back = col 1. Auto-detects tab vs comma; strips a wrapping quote pair.
function parseRows(text) {
  const rows = [];
  for (const raw of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const delim = line.includes('\t') ? '\t' : ',';
    const cols = line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    if (cols[0]) rows.push({ front: cols[0], back: cols[1] || '' });
  }
  return rows;
}

// GET /api/flashcards/decks
router.get('/decks', requireAuth, (req, res) => {
  res.json({ decks: listDecks(req.user.id) });
});

// POST /api/flashcards/decks  { languageCode, name }
router.post('/decks', requireAuth, (req, res) => {
  const { languageCode, name } = req.body ?? {};
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json({ deck: createDeck({ userId: req.user.id, languageId: language.id, name, source: 'manual' }) });
});

// DELETE /api/flashcards/decks/:id
router.delete('/decks/:id(\\d+)', requireAuth, (req, res) => {
  const ok = deleteDeck(Number(req.params.id), req.user.id);
  if (!ok) return res.status(404).json({ error: 'deck not found' });
  res.json({ ok: true });
});

// POST /api/flashcards/decks/:id/cards  { front, back? }  -> add one card
router.post('/decks/:id(\\d+)/cards', requireAuth, (req, res) => {
  const deck = getDeck(Number(req.params.id), req.user.id);
  if (!deck) return res.status(404).json({ error: 'deck not found' });
  const { front, back } = req.body ?? {};
  if (!front || !front.trim()) return res.status(400).json({ error: 'front is required' });
  const added = addCards({
    deckId: deck.id, userId: req.user.id, languageId: deck.language_id,
    rows: [{ front, back }],
  });
  res.status(201).json({ added, deck });
});

// POST /api/flashcards/import  { languageCode, name, text, source? }
router.post('/import', requireAuth, (req, res) => {
  const { languageCode, name, text, source } = req.body ?? {};
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const rows = parseRows(text);
  if (!rows.length) return res.status(400).json({ error: 'no rows found — expected front,back per line' });

  const deck = createDeck({
    userId: req.user.id,
    languageId: language.id,
    name: name?.trim() || 'Imported deck',
    source: source || 'csv',
  });
  const added = addCards({ deckId: deck.id, userId: req.user.id, languageId: language.id, rows });
  res.status(201).json({ deck, added });
});

// POST /api/flashcards/generate  { languageCode, backLanguageCode, count, name }
// Builds a deck from the most frequent words, auto-translating each with the
// local OPUS-MT model (no external API). First use downloads the model.
router.post('/generate', requireAuth, async (req, res) => {
  const { languageCode, backLanguageCode, count, name } = req.body ?? {};
  const language = getLanguageByCode(languageCode);
  const back = getLanguageByCode(backLanguageCode);
  if (!language || !back) return res.status(404).json({ error: 'unknown language' });
  if (!totalCount(language.id)) return res.status(400).json({ error: 'no frequency data for this language' });

  const n = Math.min(Math.max(Number(count) || 30, 1), 100);
  const words = topWords(language.id, n);

  const rows = [];
  for (const w of words) {
    let translation = '';
    if (language.lang !== back.lang) {
      try {
        const r = await aiTranslate({ fromBase: language.lang, toBase: back.lang, text: w.word });
        translation = r.translation;
      } catch { translation = ''; }
    } else {
      translation = w.word;
    }
    rows.push({ front: w.word, back: translation });
  }

  const deck = createDeck({
    userId: req.user.id, languageId: language.id,
    name: name?.trim() || `Top ${n} ${language.name} words`, source: 'ai',
  });
  const added = addCards({ deckId: deck.id, userId: req.user.id, languageId: language.id, rows });
  res.status(201).json({ deck, added });
});

// POST /api/flashcards/gender-deck  { languageCode, t?, name? }
// Builds a deck of the nouns whose gender can't be guessed from the ending,
// straight from the live frequency data (front = noun, back = der/die/das + gloss).
// `t` is the coverage level (0.5 / 0.75 / 0.9 / 0.95 / 1); no size cap.
router.post('/gender-deck', requireAuth, (req, res) => {
  const { languageCode, name } = req.body ?? {};
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const t = (() => { const n = Number(req.body?.t); return Number.isFinite(n) && n > 0 && n <= 1 ? n : 1; })();
  const nouns = unpredictableGenderNouns(language.id, t);
  if (!nouns.length) return res.status(400).json({ error: 'no gender data for this language' });

  const rows = nouns.map((n) => ({
    front: n.word,
    back: `${n.article}${n.meaning ? ` (${n.meaning})` : ''}`.trim(),
  }));
  const deck = createDeck({
    userId: req.user.id, languageId: language.id,
    name: name?.trim() || `${language.name} noun genders (${Math.round(t * 100)}%)`, source: 'gender',
  });
  const added = addCards({ deckId: deck.id, userId: req.user.id, languageId: language.id, rows });
  res.status(201).json({ deck, added });
});

// GET /api/flashcards/decks/:id/export?format=csv|anki  — download a deck.
router.get('/decks/:id(\\d+)/export', requireAuth, (req, res) => {
  const deck = getDeck(Number(req.params.id), req.user.id);
  if (!deck) return res.status(404).json({ error: 'deck not found' });
  const cards = listCards(deck.id, req.user.id);
  const safe = (deck.name || 'deck').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'deck';

  let body, type, ext;
  if (req.query.format === 'csv') {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    body = '﻿' + cards.map((c) => `${esc(c.front)},${esc(c.back)}`).join('\r\n') + '\r\n';
    type = 'text/csv; charset=utf-8';
    ext = 'csv';
  } else {
    // Anki text import: tab-separated front<TAB>back, newlines→<br>.
    const esc = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
    body = '#separator:tab\n#html:true\n' +
      cards.map((c) => `${esc(c.front)}\t${esc(c.back)}`).join('\n') + '\n';
    type = 'text/plain; charset=utf-8';
    ext = 'txt';
  }
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.${ext}"`);
  res.send(body);
});

// POST /api/flashcards/import-apkg  { languageCode, name, data (base64) }
router.post('/import-apkg', requireAuth, (req, res) => {
  const { languageCode, name, data } = req.body ?? {};
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  if (!data) return res.status(400).json({ error: 'file data is required' });

  let rows;
  try {
    rows = parseApkg(Buffer.from(data, 'base64'));
  } catch (err) {
    return res.status(400).json({ error: err.message || 'could not read .apkg' });
  }
  if (!rows.length) return res.status(400).json({ error: 'no cards found in the deck' });

  const deck = createDeck({ userId: req.user.id, languageId: language.id, name: name?.trim() || 'Anki import', source: 'anki' });
  const added = addCards({ deckId: deck.id, userId: req.user.id, languageId: language.id, rows: rows.slice(0, 5000) });
  res.status(201).json({ deck, added });
});

// GET /api/flashcards/study?deck=ID  -> due cards
router.get('/study', requireAuth, (req, res) => {
  const deckId = req.query.deck ? Number(req.query.deck) : null;
  if (deckId && !getDeck(deckId, req.user.id)) return res.status(404).json({ error: 'deck not found' });
  res.json({ cards: dueCards(req.user.id, deckId) });
});

// POST /api/flashcards/review  { cardId, rating }  (rating 1..4)
router.post('/review', requireAuth, (req, res) => {
  const { cardId, rating } = req.body ?? {};
  if (![1, 2, 3, 4].includes(Number(rating))) return res.status(400).json({ error: 'rating must be 1..4' });
  const card = reviewCard(Number(cardId), req.user.id, Number(rating));
  if (!card) return res.status(404).json({ error: 'card not found' });
  res.json({ card });
});

// GET /api/flashcards/familiarity?lang=de-DE  -> { word_lc: maturity 0..1 }
router.get('/familiarity', requireAuth, (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  res.json({ familiarity: familiarityMap(req.user.id, language.id) });
});

export default router;
