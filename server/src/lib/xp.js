// server/lib/xp.js
// All XP tuning lives here. The DB only stores lifetime xp and a cached level.

const BASE_XP = 100;     // XP needed to go from level 1 to level 2
const EXPONENT = 1.6;    // curve steepness: try 1.4 for gentler, 1.6 for steeper; default 1.5
const MAX_LEVEL = 100;   // set to Infinity for no cap

// XP for a CORRECT answer. Less-known words are worth more.
// levelBefore: 0 (dark red) .. 4 (dark green)
export function xpForCorrect({ levelBefore, isFirstSighting }) {
  if (isFirstSighting) return 60;
  return 50 - 10 * levelBefore; // 50, 40, 30, 20, 10
}

// XP required to advance from `level` to `level + 1`.
export function xpToNext(level) {
  return Math.round(BASE_XP * Math.pow(level, EXPONENT));
}

// Derive level from lifetime XP (so the curve can be retuned and levels recomputed).
export function levelFromXp(totalXp) {
  let level = 1;
  let remaining = totalXp;
  while (level < MAX_LEVEL && remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpForNext: level < MAX_LEVEL ? xpToNext(level) : null };
}