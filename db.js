// db.js
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DB_HOST) {
  throw new Error('❌ .env не загружен: DB_HOST отсутствует');
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Проверка подключения при старте
pool.on('error', (err) => {
  console.error('⚠️ Подключение к БД разорвано:', err);
});

module.exports = pool;