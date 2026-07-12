// A small SM-2-style spaced-repetition scheduler.
//
// Ratings: 1 = again, 2 = hard, 3 = good, 4 = easy.
// Returns the card's next state. A card is "mature" once its interval reaches
// MATURE_DAYS, which is what the studied-mode word colouring uses.

export const MATURE_DAYS = 21;

export function schedule(card, rating) {
  let ease = card.ease ?? 2.5;
  let interval = card.interval ?? 0;
  let reps = card.reps ?? 0;
  let lapses = card.lapses ?? 0;

  if (rating === 1) {
    // Again — reset to relearning, due again today.
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0;
    reps = 0;
  } else {
    if (rating === 2) ease = Math.max(1.3, ease - 0.15);
    if (rating === 4) ease += 0.15;

    if (reps === 0) interval = rating === 4 ? 4 : 1;
    else if (reps === 1) interval = 6;
    else {
      const mult = ease * (rating === 2 ? 0.8 : 1) * (rating === 4 ? 1.3 : 1);
      interval = Math.max(1, Math.round(interval * mult));
    }
    reps += 1;
  }

  return {
    ease,
    interval,
    reps,
    lapses,
    dueInDays: interval, // 0 => due again now
    state: interval >= MATURE_DAYS ? 'review' : (reps === 0 ? 'new' : 'learning'),
  };
}

// 0 (new / never grown) -> 1 (mature). Drives the red→green studied colour.
export function maturity(intervalDays) {
  return Math.min(Math.max(intervalDays, 0) / MATURE_DAYS, 1);
}
