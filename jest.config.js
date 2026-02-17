// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.js']
};