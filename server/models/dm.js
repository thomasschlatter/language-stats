// Direct-message queries (threads, conversations, send) + corrections.
import db from '../db/index.js';

const MSG_COLS = `m.id, m.body, m.created_at,
                  su.username AS sender, su.avatar AS sender_avatar, su.avatar_image AS sender_avatar_image,
                  ru.username AS recipient,
                  bl.code AS body_lang`;

function parseAvatar(row) {
  if (row && row.sender_avatar) {
    try { row.sender_avatar = JSON.parse(row.sender_avatar); } catch { row.sender_avatar = null; }
  }
  return row;
}

const MSG_FROM = `FROM dm_messages m
                  JOIN users su ON su.id = m.sender_id
                  JOIN users ru ON ru.id = m.recipient_id
                  LEFT JOIN languages bl ON bl.id = m.body_lang_id`;

export function sendDM({ senderId, recipientId, bodyLangId, body }) {
  const info = db
    .prepare('INSERT INTO dm_messages (sender_id, recipient_id, body, body_lang_id) VALUES (?, ?, ?, ?)')
    .run(senderId, recipientId, body, bodyLangId ?? null);
  return parseAvatar(db.prepare(`SELECT ${MSG_COLS} ${MSG_FROM} WHERE m.id = ?`).get(info.lastInsertRowid));
}

// Messages between two users, oldest first (or newer than `since` for polling).
export function thread(userA, userB, since = 0) {
  const rows = db
    .prepare(
      `SELECT ${MSG_COLS} ${MSG_FROM}
       WHERE ((m.sender_id = @a AND m.recipient_id = @b)
           OR (m.sender_id = @b AND m.recipient_id = @a))
         AND m.id > @since
       ORDER BY m.id ASC
       LIMIT 200`
    )
    .all({ a: userA, b: userB, since })
    .map(parseAvatar);
  attachCorrections(rows);
  return rows;
}

// Distinct conversation partners with the last message.
export function conversations(userId) {
  const partners = db
    .prepare(
      `SELECT CASE WHEN sender_id = @me THEN recipient_id ELSE sender_id END AS partner_id,
              MAX(id) AS last_id
       FROM dm_messages
       WHERE sender_id = @me OR recipient_id = @me
       GROUP BY partner_id
       ORDER BY last_id DESC`
    )
    .all({ me: userId });

  return partners.map((p) => {
    const last = parseAvatar(db.prepare(`SELECT ${MSG_COLS} ${MSG_FROM} WHERE m.id = ?`).get(p.last_id));
    const partner = db.prepare('SELECT username, avatar, avatar_image FROM users WHERE id = ?').get(p.partner_id);
    let partnerAvatar = null;
    try { partnerAvatar = partner?.avatar ? JSON.parse(partner.avatar) : null; } catch { partnerAvatar = null; }
    return { partner: partner?.username, partner_avatar: partnerAvatar, partner_avatar_image: partner?.avatar_image || null, last };
  });
}

// --- corrections ---
// Count DMs sent TO this user that they haven't seen (id past their read mark).
export function unreadDmCount(userId) {
  return db.prepare(
    `SELECT COUNT(*) AS n FROM dm_messages
     WHERE recipient_id = ? AND id > (SELECT dm_last_read_id FROM users WHERE id = ?)`
  ).get(userId, userId).n;
}

// Mark all received DMs as read (moves the read mark to the latest one).
export function markDmsRead(userId) {
  const row = db.prepare('SELECT MAX(id) AS m FROM dm_messages WHERE recipient_id = ?').get(userId);
  db.prepare('UPDATE users SET dm_last_read_id = ? WHERE id = ?').run(row.m || 0, userId);
}

export function getMessage(id) {
  return db.prepare(`SELECT ${MSG_COLS}, m.sender_id, m.recipient_id ${MSG_FROM} WHERE m.id = ?`).get(id);
}

export function addCorrection({ messageId, correctorId, correctedText, note }) {
  const info = db
    .prepare('INSERT INTO dm_corrections (message_id, corrector_id, corrected_text, note) VALUES (?, ?, ?, ?)')
    .run(messageId, correctorId, correctedText, note ?? null);
  return db
    .prepare(
      `SELECT c.id, c.corrected_text, c.note, c.created_at, u.username AS corrector
       FROM dm_corrections c JOIN users u ON u.id = c.corrector_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid);
}

function attachCorrections(messages) {
  for (const m of messages) {
    m.corrections = db
      .prepare(
        `SELECT c.id, c.corrected_text, c.note, c.created_at, u.username AS corrector
         FROM dm_corrections c JOIN users u ON u.id = c.corrector_id
         WHERE c.message_id = ? ORDER BY c.id`
      )
      .all(m.id);
  }
}
