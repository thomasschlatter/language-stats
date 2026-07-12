// Unit tests for the spaced-repetition scheduler (pure, no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, maturity, MATURE_DAYS } from '../server/lib/srs.js';

test('new card: good -> 1 day, easy -> 4 days', () => {
  assert.equal(schedule({ reps: 0, interval: 0 }, 3).interval, 1);
  assert.equal(schedule({ reps: 0, interval: 0 }, 4).interval, 4);
});

test('again resets interval and counts a lapse', () => {
  const r = schedule({ reps: 5, interval: 30, lapses: 1, ease: 2.5 }, 1);
  assert.equal(r.interval, 0);
  assert.equal(r.lapses, 2);
  assert.ok(r.ease < 2.5);
});

test('interval grows across successive good reviews', () => {
  let card = { reps: 0, interval: 0, ease: 2.5 };
  const intervals = [];
  for (let i = 0; i < 4; i++) {
    const r = schedule(card, 3);
    intervals.push(r.interval);
    card = r;
  }
  // 1, 6, then multiplied by ease -> strictly increasing after the first
  assert.deepEqual(intervals.slice(0, 2), [1, 6]);
  assert.ok(intervals[2] > intervals[1] && intervals[3] > intervals[2]);
});

test('ease is floored at 1.3', () => {
  let card = { reps: 3, interval: 10, ease: 1.35 };
  card = schedule(card, 1); // -0.2
  assert.ok(card.ease >= 1.3);
});

test('maturity is 0 for new, 1 at MATURE_DAYS', () => {
  assert.equal(maturity(0), 0);
  assert.equal(maturity(MATURE_DAYS), 1);
  assert.ok(maturity(MATURE_DAYS / 2) > 0.4 && maturity(MATURE_DAYS / 2) < 0.6);
});
