// src/lib/altreadings.js
// Hand-curated extra accepted readings, keyed by the exact surface text found in a sentence.
// Add to this list as you notice words where more than one reading is legitimately correct.
// (The canonical reading comes from the tokenizer; entries equal to it are ignored.)
// Kept deliberately small: automatically accepting every other reading of a word would
// let wrong answers through (e.g. 今日 as こんにち).
export const ALT_READINGS = {
  '日本': ['にほん', 'にっぽん'],
  '明日': ['あした', 'あす'],
  '何': ['なに', 'なん'],
  '私': ['わたし', 'わたくし'],
};

// The tokenizer's dictionary (ipadic) reads some words in a less common way. For these, the preferred
// reading replaces the tokenizer's as the canonical answer (shown when the user misses); the
// tokenizer's reading is still accepted if it appears in ALT_READINGS above.
export const PREFERRED_READING = {
  '日本': 'にほん',
};