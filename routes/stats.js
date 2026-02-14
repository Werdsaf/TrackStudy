const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

router.get('/group/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;

  try {
    const totalRes = await pool.query('SELECT COUNT(*) FROM students WHERE group_id = $1', [groupId]);
    const total = parseInt(totalRes.rows[0].count);

    const statsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'П') AS present,
        COUNT(*) FILTER (WHERE status = 'Б') AS sick,
        COUNT(*) FILTER (WHERE status = 'НП') AS unexcused,
        COUNT(*) FILTER (WHERE status = 'УП') AS excused,
        COUNT(*) FILTER (WHERE status = 'Н') AS not_marked
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.group_id = $1
    `, [groupId]);

    const s = statsRes.rows[0];
    res.json({
      total_students: total,
      present: parseInt(s.present) || 0,
      sick: parseInt(s.sick) || 0,
      unexcused: parseInt(s.unexcused) || 0,
      excused: parseInt(s.excused) || 0,
      not_marked: parseInt(s.not_marked) || 0,
      absent: (parseInt(s.sick) || 0) + (parseInt(s.unexcused) || 0)
    });
  } catch (err) {
    console.error('[STATS]', err);
    res.status(500).json({ error: 'Не удалось получить статистику' });
  }
});

module.exports = router;