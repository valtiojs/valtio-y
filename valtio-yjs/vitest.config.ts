import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      provider: 'playwright',
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
    include: [
      'src/**/*.test.ts', // Co-located unit tests
      'tests/integration/**/*.spec.{ts,tsx}', // Integration tests (TS and TSX)
      'tests/e2e/**/*.spec.{ts,tsx}', // End-to-end tests (TS and TSX)
      'tests/investigation/**/*.spec.ts', // Investigation/analysis tests
    ],
    setupFiles: ['./tests/helpers/vitest-setup.ts'],
  },
});
