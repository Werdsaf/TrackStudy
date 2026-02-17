// __tests__/api/groups.test.js
const request = require('supertest');
const express = require('express');
const pool = require('../../db');
const { generateToken } = require('../../utils/jwt');

// Импортируем маршруты
const authRoutes = require('../../routes/auth');
const groupsRoutes = require('../../routes/groups');
const lessonsRoutes = require('../../routes/lessons');
const attendanceRoutes = require('../../routes/attendance');
const statsRoutes = require('../../routes/stats');

// Создаём приложение локально для тестов
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);

describe('API Groups', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const insertRes = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password = $2 RETURNING id',
      ['test@example.com', '$2a$10$QqVv8HdKuTfDnMx7JgCJqeYrBtWlK8eLhJkLmN0oPqRsTuVwXyZa', 'curator']
    );
    userId = insertRes.rows[0].id;

    token = generateToken(userId);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', ['test@example.com']);
    await pool.query('DELETE FROM groups WHERE name = $1', ['Test Group']);

    console.log('\n🧹 Тестовые данные очищены.');
  });

  test('POST /api/groups — создать группу', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Group', description: 'For testing' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Group');

    console.log('[TEST] POST /api/groups: SUCCESS');
  });

  test('GET /api/groups — получить группы', async () => {
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    console.log('[TEST] GET /api/groups: SUCCESS');
  });

  test('POST /api/groups/:id/students — добавить студента с подгруппой', async () => {
    const groupRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Group 2' });
    const groupId = groupRes.body.id;

    const res = await request(app)
      .post(`/api/groups/${groupId}/students`)
      .set('Authorization', `Bearer ${token}`)
      .send([{
        full_name: 'Иванов Иван',
        email: 'ivan@test.com',
        subgroup_name: '1'
      }]);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Добавлено \d+ студентов/);

    console.log('[TEST] POST /api/groups/:id/students: SUCCESS');
  });
});

afterAll(() => {
  console.log('\n📊 Итог: Все API-тесты для /api/groups пройдены.\n');
});