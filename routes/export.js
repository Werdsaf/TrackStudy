// routes/export.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');
const ExcelJS = require('exceljs');

router.get('/export/xlsx/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { date_from, date_to, subgroup_id } = req.query;

  try {
    // 1. Получить студентов
    let studentsQuery = 'SELECT id, full_name, email, subgroup_id FROM students WHERE group_id = $1';
    const studentsParams = [groupId];
    if (subgroup_id !== undefined) {
      studentsParams.push(parseInt(subgroup_id));
      studentsQuery += ' AND subgroup_id = $' + studentsParams.length;
    }
    const studentsRes = await pool.query(studentsQuery, studentsParams);
    const students = studentsRes.rows;

    // 2. Получить занятия
    let lessonsQuery = 'SELECT id, date, lesson_num, title, subgroup_id FROM lessons WHERE group_id = $1';
    const lessonsParams = [groupId];
    if (date_from) {
      lessonsParams.push(date_from);
      lessonsQuery += ' AND date >= $' + lessonsParams.length;
    }
    if (date_to) {
      lessonsParams.push(date_to);
      lessonsQuery += ' AND date <= $' + lessonsParams.length;
    }
    if (subgroup_id !== undefined) {
      lessonsParams.push(parseInt(subgroup_id));
      lessonsQuery += ' AND subgroup_id = $' + lessonsParams.length;
    }
    const lessonsRes = await pool.query(lessonsQuery, lessonsParams);
    const lessons = lessonsRes.rows;

    // 3. Получить посещаемость
    const studentIds = students.map(s => s.id);
    const lessonIds = lessons.map(l => l.id);
    let attendance = [];
    if (studentIds.length > 0 && lessonIds.length > 0) {
      const attRes = await pool.query(
        `SELECT student_id, lesson_id, status, note 
         FROM attendance 
         WHERE student_id = ANY($1::int[]) AND lesson_id = ANY($2::int[])`,
        [studentIds, lessonIds]
      );
      attendance = attRes.rows;
    }

    // 4. Создать Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Посещаемость ${groupId}`);

    // Заголовки
    const headers = [
      { key: 'student', name: 'Студент', width: 10 },
      { key: 'up', name: 'УП', width: 10 },
      { key: 'np', name: 'НП', width: 10 },
      { key: 'b', name: 'Б', width: 10 },
      { key: 'total', name: 'Всего', width: 10 },
      ...lessons.map(l => {
        const d = new Date(l.date);
        const formattedDate = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        const titleShort = l.title.length > 12 ? l.title.substring(0, 12) + '...' : l.title;
        const sub = l.subgroup_id != null ? ` [${l.subgroup_id}]` : '';
        return {
          key: `lesson_${l.id}`,
          name: `${formattedDate} №${l.lesson_num} ${titleShort}${sub}`,
          width: 15 
        };
      })
    ];

    // Устанавливаем колонки с wrapText и компактным шрифтом
    worksheet.columns = headers.map(h => ({
      header: h.name,
      key: h.key,
      width: h.width,
      style: {
        font: { size: 9 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8f9fa' } }
      }
    }));

    // Данные
    students.forEach(student => {
      let up = 0, np = 0, b = 0;
      const row = {
        student: `${student.full_name}${student.subgroup_id != null ? ` (${student.subgroup_id})` : ''}`,
        up: 0,
        np: 0,
        b: 0,
        total: 0
      };

      // Считаем статусы и заполняем занятия
      for (const lesson of lessons) {
        const att = attendance.find(a => a.student_id === student.id && a.lesson_id === lesson.id);
        const status = att?.status || 'Н';

        if (status === 'УП') up++;
        else if (status === 'НП') np++;
        else if (status === 'Б') b++;

        row[`lesson_${lesson.id}`] = status;
      }

      row.up = up;
      row.np = np;
      row.b = b;
      row.total = up + np + b;

      worksheet.addRow(row);
    });

    // Отправить
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = encodeURIComponent(`посещаемость_группа_${groupId}.xlsx`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[EXPORT XLSX]', err);
    res.status(500).json({ error: 'Ошибка экспорта в Excel' });
  }
});

module.exports = router;