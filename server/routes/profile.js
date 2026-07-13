// /api/profile (own) and /api/users/:username (public profiles).
import { Router } from 'express';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getUserById,
  updateProfile,
  setUserLanguages,
  setAvatar,
  setAvatarImage,
  profile,
} from '../models/users.js';
import { getLanguageByCode } from '../models/languages.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = join(process.env.DATA_DIR || join(__dirname, '..', '..', 'data'), 'uploads', 'avatars');
const IMG_EXTS = ['png', 'jpg', 'webp'];

const router = Router();

// Resolve an array of language codes to ids (unknown codes ignored).
function idsFromCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return codes.map((c) => getLanguageByCode(c)?.id).filter(Boolean);
}

// POST /api/profile/avatar-image { dataUrl } — set a personal photo avatar.
router.post('/avatar-image', requireAuth, (req, res) => {
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''));
  if (!m) return res.status(400).json({ error: 'expected a PNG, JPEG or WebP image' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > 4 * 1024 * 1024) {
    return res.status(413).json({ error: 'image must be under 4MB' });
  }
  mkdirSync(AVATAR_DIR, { recursive: true });
  for (const e of IMG_EXTS) { try { unlinkSync(join(AVATAR_DIR, `${req.user.id}.${e}`)); } catch { /* none */ } }
  writeFileSync(join(AVATAR_DIR, `${req.user.id}.${ext}`), buf);
  const path = `/uploads/avatars/${req.user.id}.${ext}?v=${crypto.randomBytes(4).toString('hex')}`;
  setAvatarImage(req.user.id, path);
  res.json({ avatar_image: path });
});

// DELETE /api/profile/avatar-image — revert to the pixel-art character.
router.delete('/avatar-image', requireAuth, (req, res) => {
  for (const e of IMG_EXTS) { try { unlinkSync(join(AVATAR_DIR, `${req.user.id}.${e}`)); } catch { /* none */ } }
  setAvatarImage(req.user.id, null);
  res.json({ ok: true });
});

// GET /api/profile  -> the signed-in user's own profile
router.get('/', requireAuth, (req, res) => {
  res.json({ profile: profile(getUserById(req.user.id)) });
});

// PUT /api/profile { bio?, interests?, origin?, location?, native?, learning?, avatar? }
router.put('/', requireAuth, (req, res) => {
  const { bio, interests, origin, location, native, learning, avatar } = req.body ?? {};
  // Update text fields together, preserving any not included in this request
  // (so an avatar-only or languages-only save doesn't wipe them).
  const textKeys = ['bio', 'interests', 'origin', 'location'];
  if (textKeys.some((k) => req.body?.[k] !== undefined)) {
    const cur = profile(getUserById(req.user.id));
    updateProfile(req.user.id, {
      bio: bio !== undefined ? bio : cur.bio,
      interests: interests !== undefined
        ? (Array.isArray(interests) ? interests.join(', ') : interests)
        : cur.interests.join(', '),
      origin: origin !== undefined ? origin : cur.origin,
      location: location !== undefined ? location : cur.location,
    });
  }
  if (native !== undefined) setUserLanguages(req.user.id, 'native', idsFromCodes(native));
  if (learning !== undefined) setUserLanguages(req.user.id, 'learning', idsFromCodes(learning));
  if (avatar !== undefined) setAvatar(req.user.id, avatar);
  res.json({ profile: profile(getUserById(req.user.id)) });
});

export default router;
