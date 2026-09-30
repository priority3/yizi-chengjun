import { defineConfig } from 'vite';

export default defineConfig({
  // Reason: relative asset URLs so the built game works when hosted under any sub-path.
  base: './',
});
