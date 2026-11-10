// src/lib/levels.js
// The five familiarity levels, from never seen (0) to very well known (4).
// Colors live in styles/levels.css as --level-0 ... --level-4.

export const LEVEL_NAMES = ["New", "Learning", "Familiar", "Known", "Well Known"];

export const levelName = (level) => LEVEL_NAMES[level] ?? "";

// Value for a style prop, e.g. style={{ background: levelColor(2) }}
export const levelColor = (level) => `var(--level-${level})`;
