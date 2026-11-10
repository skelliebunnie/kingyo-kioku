// src/lib/kana.js

// Katakana -> hiragana (U+30A1..U+30F6 shift down by 0x60). Leaves ー and everything else alone.
export function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// Normalize a typed guess or a stored reading so they can be compared:
// NFKC (half-width katakana, full-width latin), drop whitespace, katakana -> hiragana.
export function normalizeGuess(str) {
  return toHiragana(String(str).normalize('NFKC').replace(/\s+/g, ''));
}