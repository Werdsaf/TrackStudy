// routes/attendance.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// GET /attendance/group/:groupId — получить посещаемость для своей группы
router.get('/group/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { date_from, date_to, lesson_ids, student_ids } = req.query;

  // Проверяем, принадлежит ли группа куратору
  const groupCheck = await pool.query(
    'SELECT id FROM groups WHERE id = $1 AND created_by = $2',
    [groupId, req.user.id]
  );
  if (groupCheck.rows.length === 0) {
    return res.status(403).json({ error: 'Группа не принадлежит вам' });
  }

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

    // Собрать результат
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

// PUT /attendance/:lessonId/students/:studentId — обновить статус (проверка принадлежности)
router.put('/:lessonId/students/:studentId', authenticate, async (req, res) => {
  const { lessonId, studentId } = req.params;
  const { status, note } = req.body;

  if (!['П', 'Б', 'НП', 'УП', 'Н'].includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  try {
    // Проверяем, принадлежит ли занятие и студент куратору
    const check = await pool.query(`
      SELECT 1 FROM lessons l
      JOIN students s ON l.group_id = s.group_id
      WHERE l.id = $1 AND s.id = $2 AND l.group_id IN (
        SELECT id FROM groups WHERE created_by = $3
      )
    `, [lessonId, studentId, req.user.id]);

    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Занятие или студент не принадлежат вам' });
    }

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

module.exports = router;