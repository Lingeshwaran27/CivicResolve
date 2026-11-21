import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Never touch real AI providers or Firestore from tests.
    env: {
      NODE_ENV: 'test',
      GEMINI_API_KEY: '',
      OPENROUTER_API_KEY: '',
      FIRESTORE_ENABLED: 'false',
      SEED_DEMO_DATA: 'false',
      ADMIN_PASSWORD: 'test-admin-password',
      JWT_SECRET: 'test-jwt-secret-that-is-long-enough-123456',
    },
  },
});
