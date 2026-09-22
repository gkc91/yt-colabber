import { defineConfig } from 'vitest/config';

// Pure-TS unit tests only (no React Native runtime). Screens are verified in the running app.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
