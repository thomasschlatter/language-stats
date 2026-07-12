// Shared "report content" modal.
import { api } from './api.js';
import { store } from './store.js';
import { el, openModal } from './dom.js';

export function openReport(targetType, targetId) {
  if (!store.user) return;
  const err = el('div', { class: 'error' });
  const reason = el('input', { type: 'text', placeholder: 'reason (optional)' });
  const close = openModal(el('div', {}, [
    el('h2', {}, 'Report content'),
    el('p', { class: 'muted' }, 'Flag this for moderators to review.'),
    reason,
    err,
    el('div', { class: 'row', style: 'justify-content:flex-end; margin-top:1rem' }, [
      el('button', { class: 'btn small secondary', type: 'button', onclick: () => close() }, 'Cancel'),
      el('button', {
        class: 'btn small', type: 'button',
        onclick: async () => {
          try { await api.report({ targetType, targetId, reason: reason.value }); close(); }
          catch (ex) { err.textContent = ex.message; }
        },
      }, 'Report'),
    ]),
  ]));
}
