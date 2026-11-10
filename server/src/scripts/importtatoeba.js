// src/scripts/importTatoeba.js
//   node src/scripts/importTatoeba.js [dir] [--reset]
//
// Expects these (decompressed) Tatoeba exports in `dir` (default src/data/tatoeba):
//   jpn_sentences.tsv   eng_sentences.tsv   jpn-eng_links.tsv
// from https://downloads.tatoeba.org/exports/per_language/{jpn,eng}/ (files are .tsv.bz2; unpack with 7-Zip).
//
// For every vocabulary word it keeps up to MAX_PER_WORD sentences, preferring a mix of different
// forms of the word (食べた, 食べない, 食べている...) over many near-identical ones, and shorter
// sentences over longer ones within each form. Sentences are tokenized with kuromoji so the
// highlighted span and its reading include conjugation (食べた -> たべた).
//
// Afterwards it writes src/data/needs-sentences.tsv: words that have fewer than 2 sentences, so you
// know where to add some by hand (see addSentences.js). --reset only removes Tatoeba sentences.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import kuromoji from 'kuromoji';
import pool from '../db/index.js';
import { findMatches } from '../lib/matchWords.js';
import { ALT_READINGS, PREFERRED_READING } from '../lib/altReadings.js';
import { normalizeGuess } from '../lib/kana.js';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const dir = args.find((a) => !a.startsWith('--')) || 'src/data/tatoeba';
const MAX_PER_WORD = Number(process.env.MAX_PER_WORD) || 8;
const MIN_LEN = 4;
const MAX_LEN = Number(process.env.MAX_LEN) || 45;
const PER_FORM_CAP = 3; // candidates kept per distinct form of a word while scanning
const PREFERRED_MIN = 2; // we aim for at least this many sentences per word, but don't require it

async function* tsvRows(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line) yield line.replace(/^\uFEFF/, '').split('\t');
  }
}

// 1. vocabulary lookup
const [wordRows] = await pool.query('SELECT id, written, reading FROM words');
const wordsByWritten = new Map();
for (const w of wordRows) {
  if (!wordsByWritten.has(w.written)) wordsByWritten.set(w.written, []);
  wordsByWritten.get(w.written).push({ id: w.id, reading: w.reading });
}
if (!wordRows.length) throw new Error('`words` is empty - run loadWords.js first');
console.log(`${wordRows.length} words loaded`);

// 2. Japanese sentences (filtered)
const jpn = new Map();
for await (const [id, , text] of tsvRows(path.join(dir, 'jpn_sentences.tsv'))) {
  if (text && text.length >= MIN_LEN && text.length <= MAX_LEN && !/[\u{10000}-\u{10FFFF}]/u.test(text)) {
    jpn.set(Number(id), text);
  }
}
console.log(`${jpn.size} candidate Japanese sentences`);

// 3. links -> one English translation id per sentence
const engIdFor = new Map();
for await (const [a, b] of tsvRows(path.join(dir, 'jpn-eng_links.tsv'))) {
  const ja = Number(a), other = Number(b);
  if (jpn.has(ja) && !engIdFor.has(ja)) engIdFor.set(ja, other);
  else if (jpn.has(other) && !engIdFor.has(other)) engIdFor.set(other, ja); // tolerate reversed rows
}
const needEng = new Set(engIdFor.values());

// 4. English texts (only the ones we need)
const eng = new Map();
for await (const [id, , text] of tsvRows(path.join(dir, 'eng_sentences.tsv'))) {
  const n = Number(id);
  if (needEng.has(n)) eng.set(n, text);
}
console.log(`${eng.size} English translations found`);

// 5. tokenize + match
const require = createRequire(import.meta.url);
const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
const tokenizer = await new Promise((resolve, reject) =>
  kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t)))
);

const byWord = new Map(); // wordId -> Map(surface -> [{ jpnId, len, match }])
let processed = 0;
for (const [jpnId, text] of jpn) {
  const engId = engIdFor.get(jpnId);
  if (engId === undefined || !eng.has(engId)) continue;
  for (const match of findMatches(tokenizer.tokenize(text), text, wordsByWritten)) {
    const preferred = PREFERRED_READING[match.surface];
    if (preferred) {
      const row = wordsByWritten.get(match.surface)?.find((c) => c.reading === preferred);
      if (row) Object.assign(match, { wordId: row.id, reading: preferred });
    }
    let forms = byWord.get(match.wordId);
    if (!forms) byWord.set(match.wordId, (forms = new Map()));
    let bucket = forms.get(match.surface);
    if (!bucket) forms.set(match.surface, (bucket = []));
    bucket.push({ jpnId, len: text.length, match });
    if (bucket.length > PER_FORM_CAP) {
      bucket.sort((x, y) => x.len - y.len);
      bucket.length = PER_FORM_CAP;
    }
  }
  if (++processed % 20000 === 0) console.log(`  tokenized ${processed}`);
}

// 6. choose up to MAX_PER_WORD per word, round-robin across the different forms of the word:
//    first the shortest sentence of each form, then the second shortest of each, and so on.
function pickVaried(forms, max) {
  const lists = [...forms.values()]
    .map((l) => l.sort((x, y) => x.len - y.len))
    .sort((a, b) => a[0].len - b[0].len);
  const picked = [];
  for (let round = 0; picked.length < max; round++) {
    let added = false;
    for (const l of lists) {
      if (round < l.length && picked.length < max) {
        picked.push(l[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
}

const chosen = new Map(); // jpnId -> matches[]
const perWord = []; // [number of sentences, number of distinct forms] per word
for (const forms of byWord.values()) {
  const picked = pickVaried(forms, MAX_PER_WORD);
  perWord.push([picked.length, new Set(picked.map((p) => p.match.surface)).size]);
  for (const { jpnId, match } of picked) {
    if (!chosen.has(jpnId)) chosen.set(jpnId, []);
    chosen.get(jpnId).push(match);
  }
}
const withTwo = perWord.filter(([n]) => n >= PREFERRED_MIN).length;
const withVariety = perWord.filter(([, f]) => f >= 2).length;
console.log(`${byWord.size}/${wordRows.length} words have sentences; ${chosen.size} sentences selected`);
console.log(`  ${withTwo} words have ${PREFERRED_MIN}+ sentences, ${withVariety} have 2+ different forms`);

// 7. write
if (reset) {
  // cascades to sentence_words + alt readings; hand-entered sentences are kept
  const [res] = await pool.query("DELETE FROM sentences WHERE source = 'tatoeba'");
  console.log(`Cleared ${res.affectedRows} Tatoeba sentences (manual sentences kept)`);
}

const ids = [...chosen.keys()];
const BATCH = 1000;
const sentenceDbId = new Map();
for (let i = 0; i < ids.length; i += BATCH) {
  const slice = ids.slice(i, i + BATCH);
  await pool.query(
    "INSERT INTO sentences (tatoeba_id, source, ja, en) VALUES ? AS new ON DUPLICATE KEY UPDATE ja = new.ja, en = new.en",
    [slice.map((id) => [id, 'tatoeba', jpn.get(id), eng.get(engIdFor.get(id))])]
  );
  const [rows] = await pool.query('SELECT id, tatoeba_id FROM sentences WHERE tatoeba_id IN (?)', [slice]);
  for (const r of rows) sentenceDbId.set(r.tatoeba_id, r.id);
}

const swRows = [];
const altRows = [];
for (const [jpnId, matches] of chosen) {
  const sentenceId = sentenceDbId.get(jpnId);
  for (const m of matches) {
    swRows.push([sentenceId, m.wordId, m.start, m.end, m.surface, m.reading]);
    for (const alt of ALT_READINGS[m.surface] ?? []) {
      if (normalizeGuess(alt) !== normalizeGuess(m.reading)) altRows.push([sentenceId, m.start, alt]);
    }
  }
}
for (let i = 0; i < swRows.length; i += BATCH) {
  await pool.query(
    'INSERT INTO sentence_words (sentence_id, word_id, start_idx, end_idx, surface, surface_reading) VALUES ? AS new ' +
      'ON DUPLICATE KEY UPDATE word_id = new.word_id, end_idx = new.end_idx, surface = new.surface, surface_reading = new.surface_reading',
    [swRows.slice(i, i + BATCH)]
  );
}
for (const [sentenceId, start, alt] of altRows) {
  await pool.query(
    'INSERT IGNORE INTO sentence_word_alt_readings (sentence_word_id, reading) ' +
      'SELECT id, ? FROM sentence_words WHERE sentence_id = ? AND start_idx = ?',
    [alt, sentenceId, start]
  );
}
console.log(`Inserted ${swRows.length} word matches, ${altRows.length} alternate readings`);

// 8. report words that still need sentences (counts include any entered by hand)
const [needy] = await pool.query(
  `SELECT w.written, w.reading, w.jlpt, COUNT(sw.id) AS n
   FROM words w LEFT JOIN sentence_words sw ON sw.word_id = w.id
   GROUP BY w.id, w.written, w.reading, w.jlpt
   HAVING n < ?
   ORDER BY n, w.jlpt DESC, w.written`,
  [PREFERRED_MIN]
);
const lines = ['written\treading\tjlpt\tsentences', ...needy.map((r) => `${r.written}\t${r.reading}\t${r.jlpt ?? ''}\t${r.n}`)];
await fsp.writeFile('src/data/needs-sentences.tsv', lines.join('\n') + '\n');
const none = needy.filter((r) => Number(r.n) === 0).length;
console.log(`${needy.length} words have fewer than ${PREFERRED_MIN} sentences (${none} have none) -> src/data/needs-sentences.tsv`);

await pool.end();