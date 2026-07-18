// User-created Level Creator maps. Each map belongs to a user and stores the exported
// map JSON (Tiled tile layers + the `entities` array). Used by the editor for autosave,
// and later loaded by the world to open the map as a playable room.
import db from '../db/index.js';

export function listMaps(userId) {
  // includes `thumb` (small data-URL preview) so the picker can show it without loading full `data`
  return db
    .prepare('SELECT id, name, thumb, updated_at, created_at FROM maps WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId);
}

export function getMap(id, userId) {
  const row = db
    .prepare('SELECT id, name, data, updated_at, created_at FROM maps WHERE id = ? AND user_id = ?')
    .get(id, userId);
  if (!row) return null;
  return { ...row, data: safeParse(row.data) };
}

export function createMap(userId, name, data, thumb) {
  const info = db
    .prepare('INSERT INTO maps (user_id, name, data, thumb) VALUES (?, ?, ?, ?)')
    .run(userId, (name || 'Untitled map').slice(0, 120), JSON.stringify(data ?? {}), thumb ?? null);
  return getMap(info.lastInsertRowid, userId);
}

// Partial save: update name and/or data and/or thumb (autosave sends data + thumb).
// Returns null if the map doesn't exist or isn't the caller's.
export function saveMap(id, userId, { name, data, thumb } = {}) {
  if (!db.prepare('SELECT 1 FROM maps WHERE id = ? AND user_id = ?').get(id, userId)) return null;
  const sets = [], vals = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(String(name).slice(0, 120)); }
  if (data !== undefined) { sets.push('data = ?'); vals.push(JSON.stringify(data)); }
  if (thumb !== undefined) { sets.push('thumb = ?'); vals.push(thumb); }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE maps SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals, id, userId);
  }
  return getMap(id, userId);
}

export function deleteMap(id, userId) {
  return db.prepare('DELETE FROM maps WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
