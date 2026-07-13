// Reusable upvote button for a card. Shows the count and the user's vote state;
// clicking toggles the vote (requires sign-in). Used on both the card grid and
// the article page.

import { api } from '../api.js';
import { store } from '../store.js';
import { el } from '../dom.js';

export function voteButton(item, voteFn = api.voteArticle) {
  const count = el('span', { class: 'vote-count' }, String(item.votes || 0));
  const btn = el(
    'button',
    {
      class: `vote-btn${item.voted ? ' voted' : ''}`,
      title: store.user ? 'Upvote' : 'Sign in to upvote',
      onclick: async (e) => {
        // On the card grid the button sits inside a link — don't navigate.
        e.preventDefault();
        e.stopPropagation();
        if (!store.user) return;
        btn.disabled = true;
        try {
          const { voted, votes } = await voteFn(item.id);
          item.voted = voted;
          item.votes = votes;
          btn.classList.toggle('voted', voted);
          count.textContent = String(votes);
        } catch {
          /* ignore */
        } finally {
          btn.disabled = false;
        }
      },
    },
    [el('span', { class: 'vote-arrow' }, '▲'), count]
  );
  return btn;
}
