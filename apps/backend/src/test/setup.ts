import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.RESEND_API_KEY = 'test_key';
process.env.ANTHROPIC_API_KEY = 'test_key';

// Global test setup
beforeAll(() => {
  // Setup before all tests
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
});

