// /api/frequency — word-frequency coverage (the % of conversation buttons).
import { Router } from 'express';
import { getLanguageByCode } from '../models/languages.js';
import { coverage, totalCount } from '../models/frequency.js';
import { coverageAnalysis } from '../models/analysis.js';

const router = Router();

function parseThreshold(v) {
  const t = Number(v);
  return Number.isFinite(t) && t > 0 && t <= 1 ? t : 0.5;
}

// GET /api/frequency/coverage?lang=de-DE&t=0.5
// Returns how many top words (and which) make up fraction `t` of all tokens.
router.get('/coverage', (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });

  if (!totalCount(language.id)) {
    return res.status(404).json({ error: 'no frequency data for this language' });
  }
  res.json(coverage(language.id, parseThreshold(req.query.t)));
});

// GET /api/frequency/analysis?lang=de-DE&t=0.9
// POS breakdown of the coverage set + noun-gender-by-ending analysis.
router.get('/analysis', (req, res) => {
  const language = getLanguageByCode(req.query.lang);
  if (!language) return res.status(404).json({ error: 'unknown language' });
  if (!totalCount(language.id)) {
    return res.status(404).json({ error: 'no frequency data for this language' });
  }
  const result = coverageAnalysis(language.id, parseThreshold(req.query.t));
  res.json(result);
});

export default router;
