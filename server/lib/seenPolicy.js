// "Has been seen" policy.
//
// How we decide a user has *seen* a word is an open question that needs
// experimentation, so the policy is a named, versioned thing rather than a
// hard-coded rule. Each increment stores the policy id that counted it
// (user_words.seen_policy), so when we change the policy we can tell which
// counts came from which rule and re-interpret or reset accordingly.
//
// The CLIENT reads CURRENT_SEEN_POLICY and implements the matching trigger;
// the SERVER just records increments and stamps the policy id.

export const SEEN_POLICIES = {
  'viewport-once-v1': {
    id: 'viewport-once-v1',
    description:
      'A word counts as seen once each time it scrolls into the viewport on a page view. Re-seeing it on another page (or after re-render) counts again.',
  },
  'click-v1': {
    id: 'click-v1',
    description: 'A word counts as seen only when the reader clicks it.',
  },
  'render-v1': {
    id: 'render-v1',
    description: 'A word counts as seen every time it is rendered on a page the reader opens (even off-screen).',
  },
};

// The policy currently in effect. Change this to experiment.
export const CURRENT_SEEN_POLICY = 'viewport-once-v1';

export function isValidPolicy(id) {
  return Object.prototype.hasOwnProperty.call(SEEN_POLICIES, id);
}
