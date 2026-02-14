const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

router.put('/:lessonId/students/:studentId', authenticate, async (req, res) => {
  const { lessonId, studentId } = req.params;
  const { status, note } = req.body;

  if (!['П', 'Б', 'НП', 'УП', 'Н'].includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO attendance (student_id, lesson_id, status, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, lesson_id)
       DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = NOW()
       RETURNING *`,
      [studentId, lessonId, status, note || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ATTENDANCE PUT]', err);
    res.status(500).json({ error: 'Не удалось обновить посещаемость' });
  }
});

router.get('/group/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { date_from, date_to } = req.query;

  let where = 'WHERE s.group_id = $1';
  const params = [groupId];

  if (date_from) {
    params.push(date_from);
    where += ' AND l.date >= $' + params.length;
  }
  if (date_to) {
    params.push(date_to);
    where += ' AND l.date <= $' + params.length;
  }

  try {
    const result = await pool.query(`
      SELECT
        s.id AS student_id,
        s.full_name,
        s.email,
        l.id AS lesson_id,
        l.date,
        l.lesson_num,
        l.title,
        COALESCE(a.status, 'Н') AS status,
        a.note
      FROM students s
      CROSS JOIN lessons l
      LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = l.id
      WHERE l.group_id = $1
        ${date_from || date_to ? `AND l.date BETWEEN $2 AND $3` : ''}
      ORDER BY s.full_name, l.date, l.lesson_num
    `, params);

    // Группируем по студенту
    const map = {};
    for (const row of result.rows) {
      if (!map[row.student_id]) {
        map[row.student_id] = {
          student: { id: row.student_id, full_name: row.full_name, email: row.email },
          lessons: []
        };
      }
      map[row.student_id].lessons.push({
        lesson_id: row.lesson_id,
        date: row.date,
        lesson_num: row.lesson_num,
        title: row.title,
        status: row.status,
        note: row.note
      });
    }

    res.json(Object.values(map));
  } catch (err) {
    console.error('[ATTENDANCE GET]', err);
    res.status(500).json({ error: 'Не удалось загрузить посещаемость' });
  }
});

// Экспорт в CSV
router.get('/export/csv/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { date_from, date_to } = req.query;

  let where = 'WHERE s.group_id = $1';
  const params = [groupId];

  if (date_from) {
    params.push(date_from);
    where += ' AND l.date >= $' + params.length;
  }
  if (date_to) {
    params.push(date_to);
    where += ' AND l.date <= $' + params.length;
  }

  try {
    const result = await pool.query(`
      SELECT
        s.full_name,
        s.email,
        l.date,
        l.lesson_num,
        l.title,
        COALEScesso(a.status, 'Н') AS status,
        a.note
      FROM students s
      CROSS JOIN lessons l
      LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = l.id
      WHERE l.group_id = $1
        ${date_from || date_to ? `AND l.date BETWEEN $2 AND $3` : ''}
      ORDER BY s.full_name, l.date, l.lesson_num
    `, params);

    const headers = ['ФИО', 'Email', 'Дата', '№ занятия', 'Тема', 'Статус', 'Примечание'];
    const rows = result.rows.map(r => [
      `"${r.full_name.replace(/"/g, '""')}"`,
      r.email ? `"${r.email.replace(/"/g, '""')}"` : '""',
      `"${r.date}"`,
      r.lesson_num,
      `"${r.title.replace(/"/g, '""')}"`,
      r.status,
      r.note ? `"${r.note.replace(/"/g, '""')}"` : '""'
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="посещаемость.csv"');
    res.send('\uFEFF' + csv); // BOM для корректного отображения кириллицы в Excel
  } catch (err) {
    console.error('[ATTENDANCE EXPORT]', err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

module.exports = router;