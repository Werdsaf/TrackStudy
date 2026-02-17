// __tests__/unit/jwt.test.js
const { generateToken, verifyToken } = require('../../utils/jwt');

describe('JWT utilities', () => {
  test('should generate and verify token correctly', () => {
    const userId = 1; 
    const token = generateToken(userId); 
    const decoded = verifyToken(token);

    expect(decoded).toBeTruthy();
    expect(decoded.id).toBe(1); 
  });

  test('should return null for invalid token', () => {
    const decoded = verifyToken('invalid_token');
    expect(decoded).toBeNull();
  });
});