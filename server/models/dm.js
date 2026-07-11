// Direct-message queries (threads, conversations, send) + corrections.
import db from '../db/index.js';

const MSG_COLS = `m.id, m.body, m.created_at,
                  su.username AS sender, ru.username AS recipient,
                  bl.code AS body_lang`;

const MSG_FROM = `FROM dm_messages m
                  JOIN users su ON su.id = m.sender_id
                  JOIN users ru ON ru.id = m.recipient_id
                  LEFT JOIN languages bl ON bl.id = m.body_lang_id`;

export function sendDM({ senderId, recipientId, bodyLangId, body }) {
  const info = db
    .prepare('INSERT INTO dm_messages (sender_id, recipient_id, body, body_lang_id) VALUES (?, ?, ?, ?)')
    .run(senderId, recipientId, body, bodyLangId ?? null);
  return db.prepare(`SELECT ${MSG_COLS} ${MSG_FROM} WHERE m.id = ?`).get(info.lastInsertRowid);
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
    .all({ a: userA, b: userB, since });
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
    const last = db.prepare(`SELECT ${MSG_COLS} ${MSG_FROM} WHERE m.id = ?`).get(p.last_id);
    const partner = db.prepare('SELECT username FROM users WHERE id = ?').get(p.partner_id);
    return { partner: partner?.username, last };
  });
}

// --- corrections ---
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
