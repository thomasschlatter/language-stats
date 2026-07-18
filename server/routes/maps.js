// /api/maps — a user's Level Creator maps: list, load, create, autosave, rename, delete.
// All routes require a signed-in user; every query is scoped to req.user.id so users
// only ever see and touch their own maps.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listMaps, getMap, createMap, saveMap, deleteMap } from '../models/maps.js';

const router = Router();
router.use(requireAuth);

// list (metadata only — no heavy `data` blobs)
router.get('/', (req, res) => res.json(listMaps(req.user.id)));

// create a new (usually empty) map
router.post('/', (req, res) => {
  const map = createMap(req.user.id, req.body?.name, req.body?.data, req.body?.thumb);
  res.status(201).json(map);
});

// load one map in full (includes `data`)
router.get('/:id', (req, res) => {
  const map = getMap(Number(req.params.id), req.user.id);
  if (!map) return res.status(404).json({ error: 'not found' });
  res.json(map);
});

// autosave / rename — partial: send { data } and/or { name }
router.put('/:id', (req, res) => {
  const map = saveMap(Number(req.params.id), req.user.id, req.body || {});
  if (!map) return res.status(404).json({ error: 'not found' });
  res.json(map);
});

router.delete('/:id', (req, res) => {
  if (!deleteMap(Number(req.params.id), req.user.id)) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

export default router;
