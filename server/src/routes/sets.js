// src/routes/sets.js  - which sets are in rotation
import { Router } from 'express';
import pool from '../db/index.js';
import { HttpError, asyncHandler, num } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

async function listSets(userId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.description, s.kind,
            (uas.user_id IS NOT NULL) AS active,
            (SELECT COUNT(*) FROM set_words sw
              WHERE sw.set_id = s.id
                AND EXISTS (SELECT 1 FROM sentence_words x WHERE x.word_id = sw.word_id)) AS word_count
     FROM sets s
     LEFT JOIN user_active_sets uas ON uas.set_id = s.id AND uas.user_id = ?
     WHERE s.owner_id IS NULL OR s.owner_id = ?
     ORDER BY s.kind, s.id`,
    [userId, userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    kind: r.kind,
    active: Boolean(r.active),
    wordCount: num(r.word_count),
  }));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ sets: await listSets(req.userId) });
  })
);

router.put(
  '/active',
  asyncHandler(async (req, res) => {
    const { setIds } = req.body ?? {};
    if (!Array.isArray(setIds) || setIds.length > 100 || !setIds.every((id) => Number.isInteger(id) && id > 0))
      throw new HttpError(400, 'setIds must be an array of set ids');
    const unique = [...new Set(setIds)];

    if (unique.length) {
      const [visible] = await pool.query('SELECT id FROM sets WHERE id IN (?) AND (owner_id IS NULL OR owner_id = ?)', [
        unique,
        req.userId,
      ]);
      if (visible.length !== unique.length) throw new HttpError(400, 'One or more sets are not available');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM user_active_sets WHERE user_id = ?', [req.userId]);
      if (unique.length)
        await conn.query('INSERT INTO user_active_sets (user_id, set_id) VALUES ?', [unique.map((id) => [req.userId, id])]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    res.json({ sets: await listSets(req.userId) });
  })
);

export default router;