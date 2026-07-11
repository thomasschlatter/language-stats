// /api/profile (own) and /api/users/:username (public profiles).
import { Router } from 'express';
import {
  getUserById,
  updateProfile,
  setUserLanguages,
  setAvatar,
  profile,
} from '../models/users.js';
import { getLanguageByCode } from '../models/languages.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Resolve an array of language codes to ids (unknown codes ignored).
function idsFromCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return codes.map((c) => getLanguageByCode(c)?.id).filter(Boolean);
}

// GET /api/profile  -> the signed-in user's own profile
router.get('/', requireAuth, (req, res) => {
  res.json({ profile: profile(getUserById(req.user.id)) });
});

// PUT /api/profile  { bio?, interests?, native?: [codes], learning?: [codes], avatar? }
router.put('/', requireAuth, (req, res) => {
  const { bio, interests, native, learning, avatar } = req.body ?? {};
  // Only touch bio/interests when provided, so an avatar-only save keeps them.
  if (bio !== undefined || interests !== undefined) {
    const current = profile(getUserById(req.user.id));
    updateProfile(req.user.id, {
      bio: bio !== undefined ? bio : current.bio,
      interests: interests !== undefined
        ? (Array.isArray(interests) ? interests.join(', ') : interests)
        : current.interests.join(', '),
    });
  }
  if (native !== undefined) setUserLanguages(req.user.id, 'native', idsFromCodes(native));
  if (learning !== undefined) setUserLanguages(req.user.id, 'learning', idsFromCodes(learning));
  if (avatar !== undefined) setAvatar(req.user.id, avatar);
  res.json({ profile: profile(getUserById(req.user.id)) });
});

export default router;
