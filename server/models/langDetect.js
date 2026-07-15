// Offline language detection (franc) — guesses which language a message is
// written in, so we can auto-tag it instead of relying on a manual selector
// nobody updates per message. Short text is unreliable, so we CONSTRAIN to the
// user's own languages and only return a guess when it's confident; otherwise
// null and the caller keeps the selector value.
import { francAll } from 'franc';
import db from '../db/index.js';

const isoOfCode = db.prepare('SELECT iso639_3 FROM languages WHERE code = ?');
const byIso3 = db.prepare('SELECT code FROM languages WHERE iso639_3 = ? ORDER BY id LIMIT 1');

// candidateCodes: the user's language codes (native + learning). Detection is
// far more reliable as an N-way choice among these than an open 400-way guess.
export function detectLanguageCode(text, candidateCodes = null) {
  const t = String(text || '').trim();
  if (t.split(/\s+/).filter(Boolean).length < 4) return null; // too short to trust
  const scores = Object.fromEntries(francAll(t)); // iso639-3 -> 0..1

  if (candidateCodes && candidateCodes.length) {
    const ranked = candidateCodes
      .map((code) => ({ code, iso3: isoOfCode.get(code)?.iso639_3 }))
      .filter((x) => x.iso3)
      .map((x) => ({ code: x.code, s: scores[x.iso3] || 0 }))
      .sort((a, b) => b.s - a.s);
    if (!ranked.length) return null;
    const [top, second] = ranked;
    // Confident = strong absolute score and a clear margin over the runner-up.
    if (top.s >= 0.5 && (!second || top.s - second.s >= 0.12)) return top.code;
    return null;
  }

  // Unconstrained fallback (rarely used).
  const best = francAll(t)[0];
  if (!best || best[0] === 'und' || best[1] < 0.6) return null;
  return byIso3.get(best[0])?.code || null;
}
