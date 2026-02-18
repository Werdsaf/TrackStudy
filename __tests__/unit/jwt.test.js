// __tests__/unit/jwt.test.js
const { generateToken, verifyToken } = require('../../utils/jwt');

describe('JWT utilities', () => {
  test('TC_UNIT_001: Генерация и верификация JWT-токена', () => {
    console.log('[ЭТАП 1] Импорт функций generateToken и verifyToken из utils/jwt.js');
    
    const userId = 1;
    console.log(`[ЭТАП 2] Вызов generateToken(${userId}) для генерации токена...`);
    
    const token = generateToken(userId);
    console.log('[ЭТАП 3] Токен успешно сгенерирован. Длина: ' + token.length + ' символов.');
    
    console.log('[ЭТАП 4] Вызов verifyToken() с полученным токеном...');
    const decoded = verifyToken(token);
    
    console.log('[ЭТАП 5] Результат верификации:', decoded);
    
    // Проверки
    expect(decoded).toBeTruthy();
    expect(decoded.id).toBe(1);

    console.log('[РЕЗУЛЬТАТ] Ожидаемый результат: { id: 1 } → Фактический результат: { id: ' + decoded.id + ' }');
    console.log('✅ TC_UNIT_001: Тест пройден.\n');
  });

  test('TC_UNIT_002: Обработка невалидного токена', () => {
    console.log('[ЭТАП 1] Импорт функций generateToken и verifyToken из utils/jwt.js');
    
    const invalidToken = 'invalid_token_string';
    console.log(`[ЭТАП 2] Передача невалидного токена: "${invalidToken}" в verifyToken()...`);
    
    const decoded = verifyToken(invalidToken);
    
    console.log('[ЭТАП 3] Результат верификации:', decoded);
    
    expect(decoded).toBeNull();

    console.log('[РЕЗУЛЬТАТ] Ожидаемый результат: null → Фактический результат: ' + decoded);
    console.log('✅ TC_UNIT_002: Тест пройден.\n');
  });
});