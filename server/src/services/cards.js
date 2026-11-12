// src/services/cards.js
// Card selection and answer handling.
//
// Scheduling is by number of cards seen: users.cards_seen counts every review, and each
// user_word_progress row stores due_at_count (the cards_seen value at which it is due).
import pool from '../db/index.js';
import { HttpError, num } from '../lib/http.js';
import { normalizeGuess } from '../lib/kana.js';
import { INTRO_EVERY, MAX_LEARNING, PREFERRED_SENTENCES, nextLevel, intervalFor } from '../lib/srs.js';
import { xpForCorrect, levelFromXp } from '../lib/xp.js';

// Progress rows for words that are in one of the user's active sets and still have a sentence.
const ACTIVE_PROGRESS = `
  FROM user_word_progress p
  WHERE p.user_id = ?
    AND EXISTS (
      SELECT 1 FROM set_words sw
      JOIN user_active_sets uas ON uas.set_id = sw.set_id AND uas.user_id = p.user_id
      WHERE sw.word_id = p.word_id)
    AND EXISTS (SELECT 1 FROM sentence_words x WHERE x.word_id = p.word_id)`;

async function introduceWord(userId, n) {
  const [[word]] = await pool.query(
    `SELECT w.id FROM words w
     WHERE EXISTS (
             SELECT 1 FROM set_words sw
             JOIN user_active_sets uas ON uas.set_id = sw.set_id AND uas.user_id = ?
             WHERE sw.word_id = w.id)
       AND EXISTS (SELECT 1 FROM sentence_words x WHERE x.word_id = w.id)
       AND NOT EXISTS (SELECT 1 FROM user_word_progress p WHERE p.user_id = ? AND p.word_id = w.id)
     ORDER BY (w.jlpt IS NULL), w.jlpt DESC,
              ((SELECT COUNT(*) FROM sentence_words y WHERE y.word_id = w.id) < ?), -- prefer words with 2+ sentences
              RAND()
     LIMIT 1`,
    [userId, userId, PREFERRED_SENTENCES]
  );
  if (!word) return null;
  await pool.query(
    'INSERT IGNORE INTO user_word_progress (user_id, word_id, level, due_at_count) VALUES (?, ?, 0, ?)',
    [userId, word.id, n]
  );
  await pool.query('UPDATE users SET last_intro_count = ? WHERE id = ?', [n, userId]);
  return { word_id: word.id, level: 0, times_seen: 0, last_sentence_id: null };
}

async function buildCard(userId, row) {
  // Rotate through the word's sentences: never-answered ones first, then the one this user answered
  // longest ago (never the one just shown), so people see different examples instead of memorizing one.
  const [[sw]] = await pool.query(
    `SELECT sw.sentence_id, sw.start_idx, sw.end_idx, s.ja, s.en
     FROM sentence_words sw
     JOIN sentences s ON s.id = sw.sentence_id
     LEFT JOIN (
       SELECT sentence_id, MAX(id) AS last_id
       FROM reviews WHERE user_id = ? AND word_id = ? GROUP BY sentence_id
     ) r ON r.sentence_id = sw.sentence_id
     WHERE sw.word_id = ?
     ORDER BY (sw.sentence_id = ?) ASC, COALESCE(r.last_id, 0) ASC, RAND()
     LIMIT 1`,
    [userId, row.word_id, row.word_id, row.last_sentence_id ?? 0]
  );
  if (!sw) return null;
  await pool.query('UPDATE user_word_progress SET last_sentence_id = ? WHERE user_id = ? AND word_id = ?', [
    sw.sentence_id,
    userId,
    row.word_id,
  ]);
  return {
    wordId: row.word_id,
    sentenceId: sw.sentence_id,
    level: row.level,
    isNew: row.times_seen === 0,
    sentence: {
      before: sw.ja.slice(0, sw.start_idx),
      target: sw.ja.slice(sw.start_idx, sw.end_idx),
      after: sw.ja.slice(sw.end_idx),
    },
    // Sent with the card so the client can show it if the user has asked to (null if there isn't one).
    translation: sw.en ?? null,
  };
}

// Endless mode: nothing is due, so show whichever known word is closest to being due.
async function weakest(userId, n, excludeJustSeen) {
  const [[row]] = await pool.query(
    `SELECT p.word_id, p.level, p.times_seen, p.last_sentence_id ${ACTIVE_PROGRESS}
     ${excludeJustSeen ? 'AND (p.last_seen_count IS NULL OR p.last_seen_count <> ?)' : ''}
     ORDER BY p.due_at_count ASC, p.level ASC
     LIMIT 1`,
    excludeJustSeen ? [userId, n] : [userId]
  );
  return row;
}

export async function getNextCard(userId) {
  const [[user]] = await pool.query('SELECT cards_seen, last_intro_count FROM users WHERE id = ?', [userId]);
  if (!user) throw new HttpError(401, 'User not found');
  const n = num(user.cards_seen);
  const sinceIntro = n - num(user.last_intro_count);

  // Due now (unanswered new words first, then most overdue), not the card we just showed.
  const [[due]] = await pool.query(
    `SELECT p.word_id, p.level, p.times_seen, p.last_sentence_id ${ACTIVE_PROGRESS}
       AND p.due_at_count <= ? AND (p.last_seen_count IS NULL OR p.last_seen_count <> ?)
     ORDER BY (p.times_seen = 0) DESC, p.due_at_count ASC
     LIMIT 1`,
    [userId, n, n]
  );

  let row = null;
  if (due && due.times_seen === 0) {
    row = due; // a newly introduced word that hasn't been answered yet
  } else {
    // Pace new words: at most one per INTRO_EVERY cards, and not while too many are still being learned.
    let wantIntro = sinceIntro >= INTRO_EVERY;
    if (wantIntro) {
      const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c ${ACTIVE_PROGRESS} AND p.level <= 1`, [userId]);
      wantIntro = num(c) < MAX_LEARNING;
    }
    if (wantIntro) row = await introduceWord(userId, n);
    row = row ?? due ?? (await weakest(userId, n, true));
    // Nothing else to show (e.g. a brand-new user): bring in a new word, else repeat the last card.
    row = row ?? (await introduceWord(userId, n)) ?? (await weakest(userId, n, false));
  }
  return row ? buildCard(userId, row) : null;
}

export async function submitAnswer(userId, { wordId, sentenceId, guess }) {
  const conn = await pool.getConnection();
  let result;
  try {
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT cards_seen, xp, level FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!user) throw new HttpError(401, 'User not found');

    const [[prog]] = await conn.query(
      'SELECT level, times_seen, due_at_count FROM user_word_progress WHERE user_id = ? AND word_id = ? FOR UPDATE',
      [userId, wordId]
    );
    if (!prog) throw new HttpError(404, 'That word has not been introduced to this user');

    const [[sw]] = await conn.query(
      `SELECT sw.id, sw.surface, sw.surface_reading, s.en, w.written, w.reading, w.glosses
       FROM sentence_words sw
       JOIN sentences s ON s.id = sw.sentence_id
       JOIN words w ON w.id = sw.word_id
       WHERE sw.word_id = ? AND sw.sentence_id = ? LIMIT 1`,
      [wordId, sentenceId]
    );
    if (!sw) throw new HttpError(404, 'Unknown word/sentence pair');

    const [alts] = await conn.query('SELECT reading FROM sentence_word_alt_readings WHERE sentence_word_id = ?', [sw.id]);
    const accepted = new Set([sw.surface_reading, ...alts.map((a) => a.reading)].map(normalizeGuess));
    const correct = accepted.has(normalizeGuess(guess));

    const levelBefore = prog.level;
    const wasDue = num(prog.due_at_count) <= num(user.cards_seen);
    const levelAfter = nextLevel(levelBefore, correct, wasDue);
    const cardsSeen = num(user.cards_seen) + 1;
    const dueAt = cardsSeen + intervalFor(levelAfter);
    const xpAwarded = correct ? xpForCorrect({ levelBefore, isFirstSighting: prog.times_seen === 0 }) : 0;
    const xp = num(user.xp) + xpAwarded;
    const userLevel = levelFromXp(xp);

    await conn.query(
      `UPDATE user_word_progress
         SET level = ?, due_at_count = ?, last_seen_count = ?, times_seen = times_seen + 1,
             times_correct = times_correct + ?, last_sentence_id = ?
       WHERE user_id = ? AND word_id = ?`,
      [levelAfter, dueAt, cardsSeen, correct ? 1 : 0, sentenceId, userId, wordId]
    );
    await conn.query('UPDATE users SET cards_seen = ?, xp = ?, level = ? WHERE id = ?', [
      cardsSeen,
      xp,
      userLevel.level,
      userId,
    ]);
    const [review] = await conn.query(
      `INSERT INTO reviews (user_id, word_id, sentence_id, card_number, guess, correct, level_before, level_after, xp_awarded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, wordId, sentenceId, cardsSeen, String(guess).slice(0, 128), correct ? 1 : 0, levelBefore, levelAfter, xpAwarded]
    );
    await conn.commit();

    result = {
      result: {
        reviewId: review.insertId,
        correct,
        surface: sw.surface,
        expectedReading: sw.surface_reading,
        alternateReadings: alts.map((a) => a.reading),
        translation: sw.en,
        word: { written: sw.written, reading: sw.reading, glosses: sw.glosses },
        levelBefore,
        levelAfter,
        xpAwarded,
      },
      user: {
        xp,
        level: userLevel.level,
        xpIntoLevel: userLevel.xpIntoLevel,
        xpForNext: userLevel.xpForNext,
        leveledUp: userLevel.level > user.level,
        cardsSeen,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  result.next = await getNextCard(userId);
  return result;
}

// The user's latest answers, newest first, in the same shape the client builds for a live answer.
export async function getRecentReviews(userId, limit = 10) {
  const [rows] = await pool.query(
    `SELECT r.id, r.word_id, r.sentence_id, r.guess, r.correct, r.level_before, r.level_after, r.xp_awarded,
            sw.surface, sw.surface_reading, sw.start_idx, sw.end_idx,
            s.ja, s.en, w.written, w.reading, w.glosses,
            (SELECT JSON_ARRAYAGG(a.reading) FROM sentence_word_alt_readings a WHERE a.sentence_word_id = sw.id) AS alternates
     FROM reviews r
     JOIN sentence_words sw ON sw.word_id = r.word_id AND sw.sentence_id = r.sentence_id
     JOIN sentences s ON s.id = r.sentence_id
     JOIN words w ON w.id = r.word_id
     WHERE r.user_id = ?
     ORDER BY r.id DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    wordId: r.word_id,
    sentenceId: r.sentence_id,
    surface: r.surface, // the word exactly as it appeared in the sentence
    correct: Boolean(r.correct),
    guess: r.guess,
    reading: r.surface_reading,
    level: r.level_after, // how well known it is now
    levelBefore: r.level_before,
    xpAwarded: r.xp_awarded,
    alternateReadings: r.alternates ?? [],
    sentence: {
      before: r.ja.slice(0, r.start_idx),
      target: r.ja.slice(r.start_idx, r.end_idx),
      after: r.ja.slice(r.end_idx),
    },
    translation: r.en,
    word: { written: r.written, reading: r.reading, glosses: r.glosses },
  }));
}