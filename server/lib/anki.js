// Parse an Anki .apkg (a zip containing a SQLite "collection") into cards.
// Handles the classic collection.anki2 / .anki21 formats; the newest
// zstd-compressed .anki21b is not supported (we tell the user to re-export).
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Anki joins a note's fields with the ASCII unit-separator (0x1f).
const FIELD_SEP = String.fromCharCode(0x1f);
const stripHtml = (s) =>
  String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export function parseApkg(buffer) {
  const zip = new AdmZip(buffer);
  const names = zip.getEntries().map((e) => e.entryName);
  const dbName = ['collection.anki2', 'collection.anki21'].find((n) => names.includes(n));
  if (!dbName) {
    if (names.includes('collection.anki21b')) {
      throw new Error('This .apkg uses the newest (compressed) Anki format. In Anki, tick "Support older Anki versions" when exporting, or use "Notes in Plain Text".');
    }
    throw new Error('No Anki collection found in this file.');
  }

  const data = zip.getEntry(dbName).getData();
  const dir = mkdtempSync(join(tmpdir(), 'anki-'));
  const path = join(dir, 'col.sqlite');
  writeFileSync(path, data);
  try {
    const db = new Database(path, { readonly: true });
    const rows = db.prepare('SELECT flds FROM notes').all();
    db.close();
    const cards = [];
    for (const r of rows) {
      const fields = String(r.flds).split(FIELD_SEP);
      const front = stripHtml(fields[0] || '');
      const back = stripHtml(fields[1] || '');
      if (front) cards.push({ front, back });
    }
    return cards;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
