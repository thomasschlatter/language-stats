// Attach a cover URL to a deck (matched by name) in the local DB. For local
// cover previews — pair with SHOW_DECK_COVERS=1 and an image in server/private-covers/.
//   node server/scripts/set-deck-cover.mjs "Menschen A1.1" /covers/menschen-a1-1.jpg
import db from '../db/index.js';

const [nameLike, coverUrl] = process.argv.slice(2);
if (!nameLike || !coverUrl) {
  console.error('Usage: node server/scripts/set-deck-cover.mjs "<deck name substring>" "/covers/<file>"');
  process.exit(1);
}
const rows = db.prepare("SELECT id, name FROM decks WHERE name LIKE ?").all(`%${nameLike}%`);
if (!rows.length) { console.error('No deck matched:', nameLike); process.exit(1); }
const upd = db.prepare('UPDATE decks SET cover_url = ? WHERE id = ?');
for (const r of rows) { upd.run(coverUrl, r.id); console.log(`set cover on: ${r.name}`); }
console.log(`Done. Run with SHOW_DECK_COVERS=1 to see them.`);
