// routes/attendance.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// GET /attendance/group/:groupId
router.get('/group/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { date_from, date_to, lesson_ids, student_ids } = req.query;

  try {
    // Получить занятия
    let lessonsQuery = 'SELECT id FROM lessons WHERE group_id = $1';
    const lessonsParams = [groupId];

    if (date_from) {
      lessonsParams.push(date_from);
      lessonsQuery += ' AND date >= $' + lessonsParams.length;
    }
    if (date_to) {
      lessonsParams.push(date_to);
      lessonsQuery += ' AND date <= $' + lessonsParams.length;
    }
    if (lesson_ids) {
      const ids = lesson_ids.split(',').map(Number);
      lessonsParams.push(ids);
      lessonsQuery += ' AND id = ANY($' + lessonsParams.length + ')';
    }

    const lessonsRes = await pool.query(lessonsQuery, lessonsParams);
    const lessonIds = lessonsRes.rows.map(r => r.id);

    // Получить студентов
    let studentsQuery = 'SELECT id FROM students WHERE group_id = $1';
    const studentsParams = [groupId];

    if (student_ids) {
      const ids = student_ids.split(',').map(Number);
      studentsParams.push(ids);
      studentsQuery += ' AND id = ANY($' + studentsParams.length + ')';
    }

    const studentsRes = await pool.query(studentsQuery, studentsParams);
    const studentIds = studentsRes.rows.map(r => r.id);

    // Получить посещаемость
    let attendance = [];
    if (lessonIds.length > 0 && studentIds.length > 0) {
      const attRes = await pool.query(
        `SELECT student_id, lesson_id, status, note 
         FROM attendance 
         WHERE lesson_id = ANY($1::int[]) AND student_id = ANY($2::int[])`,
        [lessonIds, studentIds]
      );
      attendance = attRes.rows;
    }

    // Собрать результат: [{ student, lessons: [...] }]
    const result = [];
    for (const sid of studentIds) {
      const studentRes = await pool.query(
        'SELECT id, full_name, email, subgroup_id FROM students WHERE id = $1',
        [sid]
      );
      const student = studentRes.rows[0];
      if (!student) continue;

      const studentLessons = [];
      for (const lid of lessonIds) {
        const att = attendance.find(a => a.student_id === sid && a.lesson_id === lid);
        const lessonRes = await pool.query(
          'SELECT id, date, lesson_num, title, subgroup_id FROM lessons WHERE id = $1',
          [lid]
        );
        const lesson = lessonRes.rows[0];
        if (!lesson) continue;

        studentLessons.push({
          lesson_id: lesson.id,
          date: lesson.date,
          lesson_num: lesson.lesson_num,
          title: lesson.title,
          status: att?.status || 'Н',
          note: att?.note || null
        });
      }

      result.push({
        student: student,
        lessons: studentLessons
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[ATTENDANCE GET]', err);
    res.status(500).json({ error: 'Не удалось загрузить посещаемость' });
  }
});

// PUT /attendance/:lessonId/students/:studentId
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

// GET /attendance/export/csv/:groupId
router.get('/export/csv/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { date_from, date_to, subgroup_id } = req.query;

  try {
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
    if (subgroup_id !== undefined) {
      params.push(parseInt(subgroup_id));
      where += ' AND s.subgroup_id = $' + params.length;
    }

    const result = await pool.query(`
      SELECT
        s.full_name,
        s.email,
        s.subgroup_id,
        l.date,
        l.lesson_num,
        l.title,
        COALESCE(a.status, 'Н') AS status,
        a.note
      FROM students s
      JOIN lessons l ON l.group_id = s.group_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id = l.id
      ${where}
      ORDER BY s.full_name, l.date, l.lesson_num
    `, params);

    const headers = ['ФИО', 'Email', 'Подгруппа', 'Дата', '№ занятия', 'Тема', 'Статус', 'Примечание'];
    const rows = result.rows.map(r => [
      `"${r.full_name.replace(/"/g, '""')}"`,
      r.email ? `"${r.email.replace(/"/g, '""')}"` : '""',
      r.subgroup_id ? r.subgroup_id.toString() : '""',
      `"${r.date}"`,
      r.lesson_num,
      `"${r.title.replace(/"/g, '""')}"`,
      r.status,
      r.note ? `"${r.note.replace(/"/g, '""')}"` : '""'
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="посещаемость.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('[ATTENDANCE EXPORT]', err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

module.exports = router;