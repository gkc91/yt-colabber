import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Pure-TS unit tests only (no React Native runtime). Screens are verified in the running app.
// The `@/` alias matches tsconfig so pure modules can be imported the same way everywhere.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
