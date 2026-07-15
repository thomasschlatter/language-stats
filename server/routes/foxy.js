// /api/foxy — the world's Foxy chat bot. Called server-to-server by the world
// (Colyseus) server so replies come from the local model here, not an external API.
import { Router } from 'express';
import { foxyReply, isFoxyReady } from '../models/foxyChat.js';
import { askFoxy } from '../models/assistant.js';
import { SCENARIOS } from '../seed-data/scenarios.js';
import { llmAvailable, llmChat } from '../models/llm.js';
import { getLanguageByCode } from '../models/languages.js';

const router = Router();

// GET /api/foxy/scenarios — list conversation-practice scenarios
router.get('/scenarios', (_req, res) => {
  res.json({ available: llmAvailable(), scenarios: SCENARIOS.map(({ id, emoji, title }) => ({ id, emoji, title })) });
});

// POST /api/foxy/scenario { scenarioId, langCode, history:[{role,content}], message }
// The NPC replies in the learner's target language, staying in character.
router.post('/scenario', async (req, res) => {
  if (!llmAvailable()) return res.status(503).json({ error: 'Conversation practice needs the AI assistant to be configured.' });
  const s = SCENARIOS.find((x) => x.id === req.body?.scenarioId);
  if (!s) return res.status(404).json({ error: 'unknown scenario' });
  const lang = getLanguageByCode(req.body?.langCode);
  const langName = lang?.name || 'the target language';
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
  const message = String(req.body?.message || '').slice(0, 500);
  const system = `You are role-playing as ${s.role}. Situation: ${s.situation} `
    + `Speak ONLY in ${langName}. Keep each reply to 1-2 short, natural sentences suitable for a language learner. `
    + `Stay fully in character; never break character, never mention being an AI, and do not add translations. `
    + `If the learner makes a mistake, just respond naturally.`;
  const messages = history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content);
  messages.push({ role: 'user', content: message || '(Begin the scene with a natural greeting to start the conversation.)' });
  try {
    const reply = await llmChat({ system, messages, maxTokens: 220, temperature: 0.8 });
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/ready', (_req, res) => res.json({ ready: isFoxyReady() }));

// POST /api/foxy/ask { question } — grounded help answer + source links (no user data)
router.post('/ask', async (req, res) => {
  try {
    res.json(await askFoxy(req.body?.question || ''));
  } catch (e) {
    console.warn('Foxy ask failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/reply', async (req, res) => {
  try {
    const reply = await foxyReply(req.body?.message);
    res.json({ reply });
  } catch (e) {
    console.warn('Foxy reply failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
