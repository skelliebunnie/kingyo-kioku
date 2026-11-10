// src/scripts/addSentences.js  ->  node src/scripts/addSentences.js [path/to/file.json]
//
// Adds hand-written example sentences. Safe to re-run: a sentence that's already there is reused,
// and `importtatoeba.js --reset` never deletes these.
//
// The file (default src/data/manual-sentences.json) is a JSON array like:
//
//   [
//     {
//       "ja": "昨日、寿司を食べた",           // the sentence
//       "en": "I ate sushi yesterday.",       // translation (optional but nice to have)
//       "word": "食べる",                     // the word, written as in the `words` table
//       "wordReading": "たべる",               // only needed if the same spelling has several readings
//       "target": "食べた",                   // the word exactly as it appears in the sentence
//       "reading": "たべた",                  // hiragana reading of `target`
//       "alternates": ["..."]                 // other accepted readings (optional)
//     }
//   ]
//
// `src/data/needs-sentences.tsv` (written by importtatoeba.js) lists the words that need some.
import fs from 'node:fs/promises';
import pool from '../db/index.js';
import { normalizeGuess } from '../lib/kana.js';

const KANA_ONLY = /^[\u3041-\u3096ー]+$/;
const file = process.argv[2] || 'src/data/manual-sentences.json';
const entries = JSON.parse(await fs.readFile(file, 'utf8'));
if (!Array.isArray(entries)) throw new Error(`${file} must contain a JSON array`);

let added = 0;
let already = 0;
const problems = [];

for (const [i, e] of entries.entries()) {
  const label = `#${i + 1} (${e.word ?? '?'})`;
  try {
    if (typeof e.ja !== 'string' || !e.ja.trim()) throw new Error('"ja" is required');
    if (typeof e.word !== 'string' || !e.word) throw new Error('"word" is required');
    const target = e.target ?? e.word;
    const start = e.ja.indexOf(target);
    if (start === -1) throw new Error(`"${target}" doesn't appear in the sentence`);
    if (typeof e.reading !== 'string' || !KANA_ONLY.test(e.reading)) throw new Error('"reading" must be hiragana');
    const alternates = (e.alternates ?? []).map((a) => {
      if (typeof a !== 'string' || !KANA_ONLY.test(a)) throw new Error('"alternates" must be hiragana');
      return a;
    });

    const [words] = await pool.query('SELECT id, reading FROM words WHERE written = ?', [e.word]);
    if (!words.length) throw new Error(`no word "${e.word}" in the words table`);
    let word = words[0];
    if (words.length > 1) {
      if (!e.wordReading) throw new Error(`"${e.word}" has several readings (${words.map((w) => w.reading).join(', ')}); add "wordReading"`);
      word = words.find((w) => w.reading === e.wordReading);
      if (!word) throw new Error(`"${e.word}" has no reading "${e.wordReading}"`);
    }

    // Reuse the sentence if it's already there (a sentence can carry several words).
    const [[existing]] = await pool.query("SELECT id FROM sentences WHERE source = 'manual' AND ja = ? LIMIT 1", [e.ja]);
    let sentenceId = existing?.id;
    if (!sentenceId) {
      const [res] = await pool.query("INSERT INTO sentences (tatoeba_id, source, ja, en) VALUES (NULL, 'manual', ?, ?)", [
        e.ja,
        e.en ?? null,
      ]);
      sentenceId = res.insertId;
    } else if (e.en) {
      await pool.query('UPDATE sentences SET en = ? WHERE id = ?', [e.en, sentenceId]);
    }

    const [[hit]] = existing
      ? await pool.query('SELECT 1 AS x FROM sentence_words WHERE sentence_id = ? AND start_idx = ?', [sentenceId, start])
      : [[undefined]];
    await pool.query(
      `INSERT INTO sentence_words (sentence_id, word_id, start_idx, end_idx, surface, surface_reading)
       VALUES (?, ?, ?, ?, ?, ?) AS new
       ON DUPLICATE KEY UPDATE word_id = new.word_id, end_idx = new.end_idx, surface = new.surface, surface_reading = new.surface_reading`,
      [sentenceId, word.id, start, start + target.length, target, e.reading]
    );
    for (const alt of alternates) {
      if (normalizeGuess(alt) === normalizeGuess(e.reading)) continue;
      await pool.query(
        'INSERT IGNORE INTO sentence_word_alt_readings (sentence_word_id, reading) SELECT id, ? FROM sentence_words WHERE sentence_id = ? AND start_idx = ?',
        [alt, sentenceId, start]
      );
    }
    if (hit) already++;
    else added++;
  } catch (err) {
    problems.push(`${label}: ${err.message}`);
  }
}

console.log(`${added} added or updated, ${already} already present`);
if (problems.length) {
  console.error(`${problems.length} problem(s), not added:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
await pool.end();