// Draws a user's character (layered pixel-art sprite) onto a canvas, and
// provides a reusable avatar element with a letter fallback.

import { AVATAR_STYLES, FRAME, DRAW_ORDER } from './avatarStyles.js';
import { el } from './dom.js';

const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `/${src}`;
    }));
  }
  return imgCache.get(src);
}

// Draw the idle-down character frame, compositing the selected layers.
export async function drawCharacter(canvas, indices) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fit the 32x48 frame by height, centered horizontally.
  const scale = canvas.height / FRAME.h;
  const dw = FRAME.w * scale;
  const dh = FRAME.h * scale;
  const dx = (canvas.width - dw) / 2;
  const dy = (canvas.height - dh) / 2;

  for (const layer of DRAW_ORDER) {
    const idx = indices?.[layer] ?? 0;
    const src = AVATAR_STYLES[layer]?.[idx];
    if (!src) continue;
    try {
      const img = await loadImg(src);
      ctx.drawImage(img, FRAME.x, FRAME.y, FRAME.w, FRAME.h, dx, dy, dw, dh);
    } catch {
      /* skip missing layer */
    }
  }
}

// A canvas element showing the character.
export function characterCanvas(indices, size = 48) {
  const c = el('canvas', { class: 'char-avatar', width: size, height: size });
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  drawCharacter(c, indices || {});
  return c;
}

// Avatar for a user: their character if they made one, else letter initials.
export function avatarFor(avatar, username, size = 48, imageUrl = null) {
  // A personal photo takes precedence over the pixel-art character.
  if (imageUrl) {
    const img = el('img', { src: imageUrl, alt: username || '', class: 'avatar avatar-photo' });
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    return img;
  }
  if (avatar && typeof avatar === 'object') return characterCanvas(avatar, size);
  const d = el('div', { class: 'avatar' }, (username || '?').slice(0, 2).toUpperCase());
  d.style.width = `${size}px`;
  d.style.height = `${size}px`;
  return d;
}
