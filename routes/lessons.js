// routes/lessons.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// POST /lessons — создать занятие (проверка, что группа принадлежит куратору)
router.post('/', authenticate, async (req, res) => {
  const { date, lesson_num, title, group_id, subgroup_id } = req.body;

  if (!date || !lesson_num || !title || !group_id) {
    return res.status(400).json({ error: 'Дата, номер, название и ID группы обязательны' });
  }

  try {
    // Проверяем, принадлежит ли группа куратору
    const groupCheck = await pool.query(
      'SELECT id FROM groups WHERE id = $1 AND created_by = $2',
      [group_id, req.user.id]
    );
    if (groupCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Группа не принадлежит вам' });
    }

    const result = await pool.query(
      'INSERT INTO lessons (date, lesson_num, title, group_id, subgroup_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        date,
        lesson_num,
        title,
        group_id,
        subgroup_id != null ? parseInt(subgroup_id) : null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[LESSONS POST]', err);
    res.status(500).json({ error: 'Не удалось создать занятие' });
  }
});

// GET /lessons — получить занятия (только для своих групп)
router.get('/', authenticate, async (req, res) => {
  const { id, group_id, date_from, date_to, subgroup_id } = req.query;

  if (id) {
    const result = await pool.query(
      'SELECT * FROM lessons WHERE id = $1 AND EXISTS(SELECT 1 FROM groups WHERE id = lessons.group_id AND created_by = $2)',
      [id, req.user.id]
    );
    return res.json(result.rows);
  }

  let where = 'WHERE g.created_by = $1';
  const params = [req.user.id];

  if (group_id) {
    params.push(group_id);
    where += ' AND l.group_id = $' + params.length;
  }
  if (date_from) {
    params.push(date_from);
    where += ' AND l.date >= $' + params.length;
  }
  if (date_to) {
    params.push(date_to);
    where += ' AND l.date <= $' + params.length;
  }
  if (subgroup_id !== undefined) {
    params.push(parseInt(subgroup_id));
    where += ' AND l.subgroup_id = $' + params.length;
  }

  try {
    const result = await pool.query(`
      SELECT l.id, l.date, l.lesson_num, l.title, l.subgroup_id, g.name as group_name
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      ${where}
      ORDER BY l.date, l.lesson_num
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('[LESSONS GET]', err);
    res.status(500).json({ error: 'Не удалось загрузить занятия' });
  }
});

module.exports = router;