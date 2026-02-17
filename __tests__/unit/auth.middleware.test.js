// __tests__/unit/auth.middleware.test.js
const request = require('supertest');
const express = require('express');
const authenticate = require('../../middleware/auth');
const { generateToken } = require('../../utils/jwt'); // ✅ используем вашу утилиту

const app = express();
app.use('/protected', authenticate, (req, res) => res.json({ ok: true }));

describe('authenticate middleware', () => {
  test('should allow request with valid token', async () => {
    const token = generateToken({ id: 1, role: 'curator' }); // ✅ реальный токен
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('should reject request without token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });
});