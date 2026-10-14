import { defineConfig } from 'vite';

// itch.io serves HTML games from a subfolder, so every asset path must be relative.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Three.js alone is about 500 kB, so the default warning is noise.
    chunkSizeWarningLimit: 800,
  },
});
