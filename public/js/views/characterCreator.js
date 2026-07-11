// Character creation screen (ported from STRANDED): a live preview with
// left/right cycle controls for each sprite layer. Saves the chosen layer
// indices to the user's profile.

import { api } from '../api.js';
import { el, openModal } from '../dom.js';
import { drawCharacter } from '../avatar.js';
import { AVATAR_STYLES, CHOICES } from '../avatarStyles.js';

export function openCharacterCreator(currentAvatar, onSaved) {
  // Working copy of the layer indices.
  const indices = {};
  for (const { key } of CHOICES) indices[key] = currentAvatar?.[key] ?? 0;

  const preview = el('canvas', { class: 'char-preview', width: 112, height: 168 });
  const repaint = () => drawCharacter(preview, indices);

  const cycle = (key, delta) => {
    const n = AVATAR_STYLES[key].length;
    indices[key] = ((indices[key] + delta) % n + n) % n;
    repaint();
  };

  const rows = CHOICES.map(({ key, label }) =>
    el('div', { class: 'char-row' }, [
      el('button', { class: 'char-arrow', type: 'button', onclick: () => cycle(key, -1) }, '‹'),
      el('span', { class: 'char-label' }, label),
      el('button', { class: 'char-arrow', type: 'button', onclick: () => cycle(key, 1) }, '›'),
    ])
  );

  const randomize = () => {
    for (const { key } of CHOICES) indices[key] = Math.floor(Math.random() * AVATAR_STYLES[key].length);
    repaint();
  };

  const err = el('div', { class: 'error' });
  const save = el('button', { class: 'btn', type: 'button' }, 'Save character');
  save.addEventListener('click', async () => {
    err.textContent = '';
    save.disabled = true;
    try {
      const { profile } = await api.updateProfile({ avatar: indices });
      close();
      onSaved?.(profile);
    } catch (ex) {
      err.textContent = ex.message;
      save.disabled = false;
    }
  });

  const content = el('div', { class: 'char-creator' }, [
    el('h2', {}, 'Create your character'),
    el('div', { class: 'char-body' }, [
      el('div', { class: 'char-preview-wrap' }, preview),
      el('div', { class: 'char-controls' }, [
        ...rows,
        el('button', { class: 'btn small secondary', type: 'button', onclick: randomize, style: 'margin-top:0.5rem' }, '🎲 Randomize'),
      ]),
    ]),
    err,
    el('div', { class: 'row', style: 'margin-top:1rem; justify-content:flex-end' }, [save]),
  ]);

  const close = openModal(content);
  repaint();
}
