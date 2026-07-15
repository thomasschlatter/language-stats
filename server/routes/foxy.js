// /api/foxy — the world's Foxy chat bot. Called server-to-server by the world
// (Colyseus) server so replies come from the local model here, not an external API.
import { Router } from 'express';
import { foxyReply, isFoxyReady } from '../models/foxyChat.js';
import { askFoxy } from '../models/assistant.js';

const router = Router();

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
