const { verifyToken } = require('../utils/jwt');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(403).json({ error: 'Неверный токен' });

  req.user = decoded;
  next();
};

module.exports = authenticate;