// src/scripts/loadWords.js  ->  node src/scripts/loadWords.js [path/to/words.json]
// Loads words.json into `words` and creates the system sets (one per JLPT level + "other").
import fs from 'node:fs/promises';
import pool from '../db/index.js';

const file = process.argv[2] || 'src/data/words.json';
const words = JSON.parse(await fs.readFile(file, 'utf8'));

const valid = words.filter(
  (w) => w.written && w.reading && w.written.length <= 64 && w.reading.length <= 64 && Array.isArray(w.glosses)
);
console.log(`${valid.length}/${words.length} words valid`);

const BATCH = 1000;
for (let i = 0; i < valid.length; i += BATCH) {
  const rows = valid.slice(i, i + BATCH).map((w) => [w.written, w.reading, JSON.stringify(w.glosses), w.jlpt ?? null]);
  await pool.query(
    'INSERT INTO words (written, reading, glosses, jlpt) VALUES ? AS new ' +
      'ON DUPLICATE KEY UPDATE glosses = new.glosses, jlpt = new.jlpt',
    [rows]
  );
}

// kanjiAPI's jlpt field uses the old 4-level scale (4 = easiest). Created easiest-first so the
// first system set (lowest id) can serve as the default for new users.
const SETS = [
  { jlpt: 4, name: 'JLPT 4 (easiest)', description: 'Common words whose hardest kanji is JLPT 4 (old 4-level scale, roughly N5)' },
  { jlpt: 3, name: 'JLPT 3', description: 'Common words whose hardest kanji is JLPT 3 (old scale, roughly N4)' },
  { jlpt: 2, name: 'JLPT 2', description: 'Common words whose hardest kanji is JLPT 2 (old scale, roughly N3-N2)' },
  { jlpt: 1, name: 'JLPT 1 (hardest)', description: 'Common words whose hardest kanji is JLPT 1 (old scale, roughly N1)' },
  { jlpt: null, name: 'Other jōyō kanji', description: 'Common words using jōyō kanji that have no JLPT level' },
];

for (const s of SETS) {
  let [[set]] = await pool.query("SELECT id FROM sets WHERE kind = 'system' AND name = ?", [s.name]);
  if (!set) {
    const [res] = await pool.query("INSERT INTO sets (name, description, kind) VALUES (?, ?, 'system')", [s.name, s.description]);
    set = { id: res.insertId };
  }
  const [res] = await pool.query(
    `INSERT IGNORE INTO set_words (set_id, word_id) SELECT ?, id FROM words WHERE ${s.jlpt === null ? 'jlpt IS NULL' : 'jlpt = ?'}`,
    s.jlpt === null ? [set.id] : [set.id, s.jlpt]
  );
  console.log(`${s.name}: +${res.affectedRows} words`);
}

await pool.end();