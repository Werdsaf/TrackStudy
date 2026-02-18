// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// Импорты
const pool = require('./db');
const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const lessonsRoutes = require('./routes/lessons');
const attendanceRoutes = require('./routes/attendance');
const statsRoutes = require('./routes/stats');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

//API-роуты
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/attendance', exportRoutes);

// Статика
app.use(express.static(path.join(__dirname, 'public')));

// Fallback: если ничего не совпало — отдаем index.html (для SPA, но у вас не SPA — можно убрать, если нужно)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler (опционально, но полезно)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
  console.log(`📱 Доступен по IP: http://${getLocalIP()}:${PORT}`);
});

// Вспомогательная функция для получения локального IP
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.internal || iface.family !== 'IPv4') continue;
      if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}