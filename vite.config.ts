import { defineConfig } from 'vitest/config';

/* Relative base so the built site works from any path, such as a GitHub Pages project page. */
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
