// "Chat with Foxy" help assistant: retrieve relevant app facts from the KB and
// have the local Foxy model answer grounded on them. No user data — public
// facts only. Returns the answer plus the source links from retrieval.
import { KB } from '../seed-data/groupifier-kb.js';
import { foxyAssist } from './foxyChat.js';

function retrieve(question) {
  const words = (String(question || '').toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 2);
  const scored = KB.map((e) => {
    const hay = `${e.keywords} ${e.q} ${e.a}`.toLowerCase();
    let s = 0;
    for (const w of words) if (hay.includes(w)) s += 1;
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  return scored.map((x) => x.e);
}

export async function askFoxy(question) {
  const hits = retrieve(question);
  const context = hits.length
    ? hits.map((h) => h.a).join(' ')
    : 'Groupifier is a language-learning app with flashcard decks, community tips, a shared dictionary of word senses, group chats, and a multiplayer world.';
  const answer = await foxyAssist(question, context);
  return { answer, sources: hits.filter((h) => h.link).map((h) => ({ title: h.q, link: h.link })) };
}
