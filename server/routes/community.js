// /api/community — browse / match language partners.
import { Router } from 'express';
import { listCommunity, getUserLanguages } from '../models/users.js';
import { getLanguageByCode } from '../models/languages.js';
import { followingSet } from '../models/follows.js';

const router = Router();

// GET /api/community?speaks=de-DE&learning=en-US&q=&match=1
// With match=1 (and a signed-in user), auto-fills: partners who are native in
// a language you're learning (and, sorted first, learning one you speak).
router.get('/', (req, res) => {
  let speaksId = getLanguageByCode(req.query.speaks)?.id || null;
  let learningId = getLanguageByCode(req.query.learning)?.id || null;

  if (req.query.match && req.user && !speaksId && !learningId) {
    const langs = getUserLanguages(req.user.id);
    const myLearning = langs.find((l) => l.role === 'learning');
    const myNative = langs.find((l) => l.role === 'native');
    if (myLearning) speaksId = getLanguageByCode(myLearning.code)?.id;
    if (myNative) learningId = getLanguageByCode(myNative.code)?.id;
  }

  const limit = 24;
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const people = listCommunity({
    excludeUserId: req.user?.id,
    speaksId,
    learningId,
    q: req.query.q ? String(req.query.q) : null,
    limit,
    offset,
  });

  if (req.user) {
    const set = followingSet(req.user.id, people.map((p) => p.id));
    for (const p of people) p.following = set.has(p.id);
  }
  res.json({ people, offset, hasMore: people.length === limit });
});

export default router;
