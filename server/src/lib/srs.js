// src/lib/srs.js
// Card-count based scheduling. All tuning lives here.

export const MAX_LEVEL = 4;            // levels 0..4 = dark red .. dark green

// Cards (reviews of ANY word) until a word is due again, by the level it has AFTER the answer.
export const INTERVALS = [3, 8, 20, 50, 120];

export const INTRO_EVERY = 5;          // introduce a new word at most once per this many cards...
export const PREFERRED_SENTENCES = 2;  // new words with at least this many example sentences are introduced first
export const MAX_LEARNING = 8;         // ...and not while this many words sit at level 0-1

// Correct: up one level, but only if the card was actually due (an early repeat from "endless mode"
// doesn't promote). Wrong: fall back to level 1 (level 0 stays 0).
export function nextLevel(level, correct, wasDue = true) {
  if (!correct) return Math.min(level, 1);
  return wasDue ? Math.min(level + 1, MAX_LEVEL) : level;
}

// Interval in cards, with +/-20% jitter so words don't come back in a fixed order.
export function intervalFor(level) {
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.max(1, Math.round(INTERVALS[level] * jitter));
}