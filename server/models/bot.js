// The one bot/system user: "Foxy". Owns official decks, group-chat welcome
// messages, @foxy replies, and is the DM target for the help assistant. Never
// logs in (unusable password).
import db from '../db/index.js';

export const BOT_NAME = 'Foxy';
const BOT_EMAIL = 'official@groupifier.com';
const BOT_BIO = 'Friendly language fox 🦊 — DM me for help, or say @foxy in a group chat.';

// A little fox face, inlined as a data-URI so no asset is needed.
const FOX_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
  + "<circle cx='32' cy='32' r='32' fill='#e8833a'/>"
  + "<polygon points='11,7 27,22 6,24' fill='#c9662a'/><polygon points='53,7 37,22 58,24' fill='#c9662a'/>"
  + "<path d='M15 24 Q32 13 49 24 Q47 47 32 55 Q17 47 15 24 Z' fill='#f4a259'/>"
  + "<path d='M23 43 Q32 51 41 43 Q32 49 23 43 Z' fill='#fff'/>"
  + "<circle cx='32' cy='45' r='2.6' fill='#222'/><circle cx='24' cy='31' r='2.8' fill='#222'/><circle cx='40' cy='31' r='2.8' fill='#222'/></svg>";
const FOX_AVATAR = `data:image/svg+xml;base64,${Buffer.from(FOX_SVG).toString('base64')}`;

let cachedId = null;

export function getBotUserId() {
  if (cachedId) return cachedId;
  const u = db.prepare('SELECT id, username FROM users WHERE email = ?').get(BOT_EMAIL);
  if (u) {
    // Ensure the account is presented as Foxy with a fox avatar.
    if (u.username !== BOT_NAME) { try { db.prepare('UPDATE users SET username = ? WHERE id = ?').run(BOT_NAME, u.id); } catch { /* name taken */ } }
    db.prepare('UPDATE users SET avatar_image = ?, bio = ? WHERE id = ?').run(FOX_AVATAR, BOT_BIO, u.id);
    cachedId = u.id;
    return cachedId;
  }
  const info = db.prepare('INSERT INTO users (email, username, password_hash, bio, avatar_image) VALUES (?, ?, ?, ?, ?)')
    .run(BOT_EMAIL, BOT_NAME, '!', BOT_BIO, FOX_AVATAR);
  cachedId = info.lastInsertRowid;
  return cachedId;
}

export const mentionsFoxy = (text) => /(^|\s)@foxy\b/i.test(String(text || ''));
export const isBotName = (name) => /^(foxy|groupifier)$/i.test(String(name || ''));
