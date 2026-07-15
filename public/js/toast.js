// Lightweight toast notifications for transient feedback (errors, confirmations).
import { el } from './dom.js';

let container = null;

export function toast(message, type = 'error') {
  if (!message) return;
  if (!container) {
    container = el('div', { class: 'toast-container' });
    document.body.appendChild(container);
  }
  const t = el('div', { class: `toast toast-${type}` }, String(message));
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3800);
}
