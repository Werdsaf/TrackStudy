const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверяем, есть ли уже куратор
    const countRes = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(countRes.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Куратор уже существует. Регистрация запрещена.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashed, 'curator']
    );

    const token = generateToken(userRes.rows[0].id);
    res.json({ token, user: { id: userRes.rows[0].id, email: userRes.rows[0].email, role: 'curator' } });
  } catch (err) {
    console.error('[AUTH REGISTER]', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[AUTH LOGIN]', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

module.exports = router;