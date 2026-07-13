// /api/articles — the clickable "cards" under a language, official or user-made.
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { listArticles, getArticle, findArticleBySlug, createArticle } from '../models/articles.js';
import { toggleVote, userVoted, votedIds } from '../models/votes.js';
import { aiTranslateBatch } from '../models/aiTranslate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'card';
}

// GET /api/articles?lang=de-DE&native=en-US
// `native` may be a locale (en-US) or base language (en); cards are filtered to
// the learner's native language so an English speaker and a Spanish speaker
// learning German see different cards.
router.get('/', (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const nativeBase = req.query.native ? String(req.query.native).split('-')[0] : null;
  const articles = listArticles(language.id, nativeBase);
  // Mark which cards the signed-in user has already upvoted.
  if (req.user) {
    const voted = votedIds(req.user.id, articles.map((a) => a.id));
    for (const a of articles) a.voted = voted.has(a.id);
  }
  res.json({ articles });
});

// GET /api/articles/:id
router.get('/:id(\\d+)', (req, res) => {
  const article = getArticle(Number(req.params.id));
  if (!article) return res.status(404).json({ error: 'article not found' });
  if (req.user) article.voted = userVoted(article.id, req.user.id);
  res.json({ article });
});

// POST /api/articles/:id/vote  -> toggle the current user's upvote
router.post('/:id(\\d+)/vote', requireAuth, (req, res) => {
  const article = getArticle(Number(req.params.id));
  if (!article) return res.status(404).json({ error: 'article not found' });
  res.json(toggleVote(article.id, req.user.id));
});

// POST /api/articles  { languageCode, title, summary?, body, bodyLanguageCode? }
router.post('/', requireAuth, (req, res) => {
  const { languageCode, title, summary, body, bodyLanguageCode } = req.body ?? {};
  if (!languageCode || !title || !body) {
    return res.status(400).json({ error: 'languageCode, title and body are required' });
  }
  const language = getLanguageByCode(languageCode);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  const bodyLang = bodyLanguageCode ? getLanguageByCode(bodyLanguageCode) : null;

  // Make a unique slug within this language.
  let slug = slugify(title);
  let n = 2;
  while (findArticleBySlug(language.id, slug)) slug = `${slugify(title)}-${n++}`;

  const article = createArticle({
    languageId: language.id,
    bodyLangId: bodyLang?.id,
    slug,
    title,
    summary,
    body,
    authorId: req.user.id,
    isOfficial: false, // user-created cards are never official
  });
  res.status(201).json({ article });
});

// POST /api/articles/:id/translate  { targetLanguageCode }
// Translate an article's prose into another language with the on-device AI model
// and save it as a new card. Markup is preserved: headings/list/widget markers
// and {{locale|…}} example tokens are kept; only the human text is translated.
router.post('/:id(\\d+)/translate', requireAuth, async (req, res) => {
  const src = getArticle(Number(req.params.id));
  if (!src) return res.status(404).json({ error: 'article not found' });
  const target = getLanguageByCode(req.body?.targetLanguageCode);
  if (!target) return res.status(404).json({ error: 'unknown target language' });

  const fromBase = (src.body_lang || 'en').split('-')[0];
  const toBase = target.lang;
  if (fromBase === toBase) return res.status(400).json({ error: 'the card is already written in that language' });

  // Collect translatable segments; protect {{…}} tokens behind placeholders.
  const jobs = [];
  const protect = (text) => {
    const tokens = [];
    const masked = text.replace(/\{\{[^}]*\}\}/g, (tok) => { tokens.push(tok); return ` TK${tokens.length - 1}TK `; });
    return { idx: (jobs.push(masked) - 1), tokens };
  };
  const restore = (translated, tokens) =>
    String(translated).replace(/TK\s*(\d+)\s*TK/g, (_, i) => tokens[Number(i)] ?? '');

  const titleJob = protect(src.title);
  const summaryJob = src.summary ? protect(src.summary) : null;

  const plan = []; // { literal } | { prefix, job }
  for (const line of String(src.body).replace(/\r\n/g, '\n').split('\n')) {
    if (line.trim() === '' || /^\[[a-z-]+\]$/.test(line.trim())) { plan.push({ literal: line }); continue; }
    const m = line.match(/^(\s*(?:#+\s+|[-*]\s+|\d+[.)]\s+))?(.*)$/);
    const prefix = m[1] || '';
    const rest = m[2] || '';
    if (!rest.trim()) { plan.push({ literal: line }); continue; }
    plan.push({ prefix, job: protect(rest) });
  }

  let translations;
  try {
    translations = await aiTranslateBatch({ fromBase, toBase, texts: jobs });
  } catch {
    return res.status(502).json({ error: `no on-device model for ${fromBase} → ${toBase}` });
  }

  const done = (job) => restore(translations[job.idx], job.tokens);
  const title = done(titleJob);
  const summary = summaryJob ? done(summaryJob) : undefined;
  const body = plan.map((p) => (p.literal !== undefined ? p.literal : p.prefix + done(p.job))).join('\n');

  let slug = `${src.slug}-${toBase}`;
  let n = 2;
  while (findArticleBySlug(src.language_id, slug)) slug = `${src.slug}-${toBase}-${n++}`;

  const article = createArticle({
    languageId: src.language_id,
    bodyLangId: target.id,
    slug,
    title,
    summary,
    body,
    authorId: src.is_official ? null : req.user.id,
    isOfficial: !!src.is_official,
  });
  res.status(201).json({ article });
});

export default router;
