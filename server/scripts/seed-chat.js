// Populate the public per-language chat rooms with starter messages on an
// already-seeded database. Idempotent — skips rooms that already have messages.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/seed-chat.js
//
import { seedChatRooms } from '../db/chat-seed.js';

const rooms = seedChatRooms();
console.log(`Seeded starter chatter into ${rooms} empty room(s).`);
