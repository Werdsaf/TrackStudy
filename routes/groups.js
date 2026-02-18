// routes/groups.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// GET /api/groups — список групп, принадлежащих текущему куратору
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description FROM groups WHERE created_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET GROUPS]', err);
    res.status(500).json({ error: 'Не удалось загрузить группы' });
  }
});

// POST /api/groups — создать группу от имени текущего куратора
router.post('/', authenticate, async (req, res) => {
  const { name, description } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Название группы обязательно' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING id, name, description',
      [name.trim(), description?.trim() || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST GROUP]', err);
    res.status(500).json({ error: 'Не удалось создать группу' });
  }
});

// POST /groups/:groupId/students — добавить студентов в группу (проверка, что группа принадлежит куратору)
router.post('/:groupId/students', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const students = req.body;

  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Тело запроса должно быть массивом студентов' });
  }

  try {
    // Проверяем, принадлежит ли группа текущему куратору
    const groupRes = await pool.query(
      'SELECT id FROM groups WHERE id = $1 AND created_by = $2',
      [groupId, req.user.id]
    );
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: `Группа с ID=${groupId} не найдена или не принадлежит вам` });
    }

    for (const s of students) {
      const fullName = s.full_name?.trim();
      if (!fullName) continue;

      await pool.query(
        'INSERT INTO students (full_name, email, group_id, subgroup_id) VALUES ($1, $2, $3, $4)',
        [
          fullName,
          s.email?.trim() || null,
          parseInt(groupId),
          s.subgroup_id != null ? parseInt(s.subgroup_id) : null
        ]
      );
    }

    res.status(201).json({ message: `Добавлено ${students.length} студентов` });
  } catch (err) {
    console.error('[ADD STUDENTS]', err);
    res.status(500).json({ error: 'Ошибка добавления студентов' });
  }
});

// GET /groups/:groupId/students — получить студентов группы (только если группа принадлежит куратору)
router.get('/:groupId/students', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { subgroup_id } = req.query;

  let query = 'SELECT id, full_name, email, subgroup_id FROM students WHERE group_id = $1';
  const params = [groupId];

  // Проверяем, принадлежит ли группа куратору
  const groupCheck = await pool.query(
    'SELECT id FROM groups WHERE id = $1 AND created_by = $2',
    [groupId, req.user.id]
  );
  if (groupCheck.rows.length === 0) {
    return res.status(404).json({ error: `Группа с ID=${groupId} не найдена или не принадлежит вам` });
  }

  if (subgroup_id !== undefined) {
    params.push(parseInt(subgroup_id));
    query += ' AND subgroup_id = $' + params.length;
  }

  query += ' ORDER BY subgroup_id NULLS LAST, full_name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET STUDENTS]', err);
    res.status(500).json({ error: 'Не удалось загрузить студентов' });
  }
});

module.exports = router;