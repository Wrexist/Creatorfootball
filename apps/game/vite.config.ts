import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@cf/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // Mobile devices load the initial shell first; the match renderer and the
    // heavier management screens are split out so the first paint stays fast.
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split by *why* a module loads, not merely by where it lives.
          // The fictional universe is a large static payload read only when a
          // save is created or a pack inspected, and the engine is stable code
          // a returning player already has cached — neither belongs on the
          // critical path with the shell.
          if (id.includes('packages/engine/src/content/packs')) return 'content';
          if (id.includes('packages/engine/src')) return 'engine';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) {
            return 'vendor';
          }
          if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) {
            return 'motion';
          }
          return undefined;
        },
      },
    },
  },
  server: { host: true, port: 5173 },
});
