// src/routes/progress.js  - data for the progress components
import { Router } from 'express';
import pool from '../db/index.js';
import { HttpError, asyncHandler, num, parseId } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { MAX_LEVEL } from '../lib/srs.js';

const router = Router();
router.use(requireAuth);

const HAS_SENTENCE = 'EXISTS (SELECT 1 FROM sentence_words x WHERE x.word_id = w.id)';

async function assertSetVisible(setId, userId) {
  const [[set]] = await pool.query('SELECT id, name FROM sets WHERE id = ? AND (owner_id IS NULL OR owner_id = ?)', [
    setId,
    userId,
  ]);
  if (!set) throw new HttpError(404, 'Set not found');
  return set;
}

// Per-set summary: how many words, how many introduced, and a count per level.
router.get(
  '/sets',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT s.id, s.name, s.kind,
              EXISTS (SELECT 1 FROM user_active_sets u WHERE u.user_id = ? AND u.set_id = s.id) AS active,
              COUNT(sw.word_id) AS total,
              COUNT(p.word_id) AS introduced,
              COALESCE(SUM(p.level = 0), 0) AS l0, COALESCE(SUM(p.level = 1), 0) AS l1,
              COALESCE(SUM(p.level = 2), 0) AS l2, COALESCE(SUM(p.level = 3), 0) AS l3,
              COALESCE(SUM(p.level = 4), 0) AS l4
       FROM sets s
       JOIN set_words sw ON sw.set_id = s.id
       LEFT JOIN user_word_progress p ON p.word_id = sw.word_id AND p.user_id = ?
       WHERE (s.owner_id IS NULL OR s.owner_id = ?)
         AND EXISTS (SELECT 1 FROM sentence_words x WHERE x.word_id = sw.word_id)
       GROUP BY s.id, s.name, s.kind
       ORDER BY s.kind, s.id`,
      [req.userId, req.userId, req.userId]
    );
    res.json({
      sets: rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        active: Boolean(r.active),
        total: num(r.total),
        introduced: num(r.introduced),
        unseen: num(r.total) - num(r.introduced),
        levels: [num(r.l0), num(r.l1), num(r.l2), num(r.l3), num(r.l4)], // index = level (0 dark red .. 4 dark green)
      })),
    });
  })
);

// Words in one set with this user's level for each. ?level=0-4|unseen  ?page=1  ?pageSize=50
router.get(
  '/sets/:setId/words',
  asyncHandler(async (req, res) => {
    const setId = parseId(req.params.setId, 'set id');
    const set = await assertSetVisible(setId, req.userId);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

    let filter = '';
    const { level } = req.query;
    if (level === 'unseen') filter = 'AND p.word_id IS NULL';
    else if (level !== undefined) {
      const l = Number(level);
      if (!Number.isInteger(l) || l < 0 || l > MAX_LEVEL) throw new HttpError(400, 'level must be 0-4 or "unseen"');
      filter = `AND p.level = ${l}`; // validated integer
    }

    const from = `FROM set_words sw
                  JOIN words w ON w.id = sw.word_id
                  LEFT JOIN user_word_progress p ON p.word_id = w.id AND p.user_id = ?
                  WHERE sw.set_id = ? AND ${HAS_SENTENCE} ${filter}`;
    const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c ${from}`, [req.userId, setId]);
    const [rows] = await pool.query(
      `SELECT w.id, w.written, w.reading, w.glosses, w.jlpt, p.level, p.times_seen, p.times_correct
       ${from} ORDER BY w.id LIMIT ? OFFSET ?`,
      [req.userId, setId, pageSize, (page - 1) * pageSize]
    );

    res.json({
      set,
      page,
      pageSize,
      total: num(c),
      words: rows.map((r) => ({
        id: r.id,
        written: r.written,
        reading: r.reading,
        glosses: r.glosses,
        jlpt: r.jlpt,
        level: r.level, // null = never introduced
        timesSeen: num(r.times_seen),
        timesCorrect: num(r.times_correct),
      })),
    });
  })
);

// Per-kanji progress, aggregated from the words containing each kanji. ?setId= limits to one set.
// mastery is 0..1: sum of the user's levels over those words / (4 * number of words).
router.get(
  '/kanji',
  asyncHandler(async (req, res) => {
    let join = '';
    const params = [req.userId];
    if (req.query.setId !== undefined) {
      const setId = parseId(req.query.setId, 'set id');
      await assertSetVisible(setId, req.userId);
      join = 'JOIN set_words sw ON sw.word_id = w.id AND sw.set_id = ?';
      params.push(setId);
    }
    const [rows] = await pool.query(
      `SELECT w.written, p.level
       FROM words w ${join}
       LEFT JOIN user_word_progress p ON p.word_id = w.id AND p.user_id = ?
       WHERE ${HAS_SENTENCE}`,
      join ? [params[1], params[0]] : params
    );

    const HAN = /\p{Script=Han}/u;
    const byKanji = new Map();
    for (const { written, level } of rows) {
      for (const k of new Set([...written].filter((ch) => HAN.test(ch)))) {
        let e = byKanji.get(k);
        if (!e) byKanji.set(k, (e = { kanji: k, total: 0, introduced: 0, levels: [0, 0, 0, 0, 0], levelSum: 0 }));
        e.total++;
        if (level !== null) {
          e.introduced++;
          e.levels[level]++;
          e.levelSum += level;
        }
      }
    }

    const kanji = [...byKanji.values()]
      .map(({ levelSum, ...e }) => ({ ...e, unseen: e.total - e.introduced, mastery: levelSum / (MAX_LEVEL * e.total) }))
      .sort((a, b) => b.total - a.total || a.kanji.localeCompare(b.kanji, 'ja'));
    res.json({ kanji });
  })
);

export default router;