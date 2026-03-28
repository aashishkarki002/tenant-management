/**
 * Jest configuration for tenant-management-backend
 * Supports ESM modules and MongoDB Memory Server for integration tests
 */
export default {
  testEnvironment: 'node',
  
  // ESM support - minimal config since package.json has "type": "module"
  transform: {},
  
  // Global setup and teardown for MongoDB Memory Server
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  
  // Test patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],
  
  // Coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/test/**',
    '!src/seeds/**',
    '!src/migrations/**',
  ],
  
  // Timeouts
  testTimeout: 30000, // 30 seconds for integration tests
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
};
