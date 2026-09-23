import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Only Vite's PWA plugin provides this virtual module; tests use a stub.
      'virtual:pwa-register/react': fileURLToPath(new URL('./tests/pwaStub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Component tests need a DOM; core tests stay in Node to prove src/core has no DOM dependency.
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/index.ts', 'src/core/**/*.test.ts', 'src/core/types.ts'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
        'src/core/verify/**': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        'src/core/rules/**': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        'src/core/interview/**': {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
      },
    },
  },
});
