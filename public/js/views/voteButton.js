// Reusable upvote button for a card. Shows the count and the user's vote state;
// clicking toggles the vote (requires sign-in). Used on both the card grid and
// the article page.

import { api } from '../api.js';
import { store } from '../store.js';
import { el } from '../dom.js';

export function voteButton(article) {
  const count = el('span', { class: 'vote-count' }, String(article.votes || 0));
  const btn = el(
    'button',
    {
      class: `vote-btn${article.voted ? ' voted' : ''}`,
      title: store.user ? 'Upvote this card' : 'Sign in to upvote',
      onclick: async (e) => {
        // On the card grid the button sits inside a link — don't navigate.
        e.preventDefault();
        e.stopPropagation();
        if (!store.user) return;
        btn.disabled = true;
        try {
          const { voted, votes } = await api.voteArticle(article.id);
          article.voted = voted;
          article.votes = votes;
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
