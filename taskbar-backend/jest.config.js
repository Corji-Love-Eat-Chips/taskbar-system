/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
}
