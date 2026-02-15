// routes/lessons.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// POST /api/lessons — создать занятие
router.post('/', authenticate, async (req, res) => {
  const { date, lesson_num, title, group_id, subgroup_name } = req.body;

  if (!date || !lesson_num || !title || !group_id) {
    return res.status(400).json({ error: 'Дата, номер, название и ID группы обязательны' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO lessons (date, lesson_num, title, group_id, subgroup_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [date, lesson_num, title, group_id, subgroup_name?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[LESSONS POST]', err);
    res.status(500).json({ error: 'Не удалось создать занятие' });
  }
});

// GET /api/lessons — получить занятия (с фильтрацией)
router.get('/', authenticate, async (req, res) => {
  const { id, group_id, date_from, date_to, subgroup_name } = req.query;

  if (id) {
    // Если передан ID — получить одно занятие
    try {
      const result = await pool.query('SELECT * FROM lessons WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Занятие не найдено' });
      }
      return res.json(result.rows);
    } catch (err) {
      console.error('[GET LESSON BY ID]', err);
      return res.status(500).json({ error: 'Ошибка получения занятия' });
    }
  }

  // Иначе — получить список занятий
  let where = 'WHERE l.group_id = $1';
  const params = [group_id];

  if (date_from) {
    params.push(date_from);
    where += ' AND l.date >= $' + params.length;
  }
  if (date_to) {
    params.push(date_to);
    where += ' AND l.date <= $' + params.length;
  }
  if (subgroup_name) {
    params.push(subgroup_name);
    where += ' AND l.subgroup_name = $' + params.length;
  }

  try {
    const result = await pool.query(`
      SELECT l.id, l.date, l.lesson_num, l.title, l.subgroup_name, g.name as group_name
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