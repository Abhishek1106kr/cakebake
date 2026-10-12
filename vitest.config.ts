import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Slots like "18:00–20:00" are read in the machine's local time, and the tests' expected times are
// written in IST. Pin the bakery's timezone so they pass on UTC machines (CI runners, Codespaces).
// Set before the workers start, so they inherit it.
process.env.TZ = 'Asia/Kolkata';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'engine/**/*.test.ts'],
  },
});
