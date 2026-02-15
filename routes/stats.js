// routes/stats.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// GET /api/stats/group/:groupId
router.get('/group/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { subgroup_name } = req.query; // добавляем поддержку фильтра по подгруппе

  try {
    // Подсчитываем общее число студентов (с фильтром по подгруппе)
    let totalQuery = 'SELECT COUNT(*) FROM students WHERE group_id = $1';
    const totalParams = [groupId];

    if (subgroup_name) {
      totalParams.push(subgroup_name);
      totalQuery += ' AND subgroup_name = $' + totalParams.length;
    }

    const totalRes = await pool.query(totalQuery, totalParams);
    const total = parseInt(totalRes.rows[0].count);

    // Подсчитываем статистику посещаемости (с фильтром по подгруппе)
    let statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'П') AS present,
        COUNT(*) FILTER (WHERE status = 'Б') AS sick,
        COUNT(*) FILTER (WHERE status = 'НП') AS unexcused,
        COUNT(*) FILTER (WHERE status = 'УП') AS excused,
        COUNT(*) FILTER (WHERE status = 'Н') AS not_marked
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN students s ON a.student_id = s.id
      WHERE l.group_id = $1 AND s.group_id = $1
    `;
    const statsParams = [groupId];

    if (subgroup_name) {
      statsParams.push(subgroup_name);
      statsQuery += ' AND s.subgroup_name = $' + statsParams.length;
    }

    const statsRes = await pool.query(statsQuery, statsParams);
    const row = statsRes.rows[0];

    res.json({
      total_students: total,
      present: parseInt(row.present) || 0,
      sick: parseInt(row.sick) || 0,
      unexcused: parseInt(row.unexcused) || 0,
      excused: parseInt(row.excused) || 0,
      not_marked: parseInt(row.not_marked) || 0,
      absent: (parseInt(row.sick) || 0) + (parseInt(row.unexcused) || 0)
    });
  } catch (err) {
    console.error('[STATS]', err);
    res.status(500).json({ error: 'Не удалось получить статистику' });
  }
});

module.exports = router;