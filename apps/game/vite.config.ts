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
          // The engine ships as ONE chunk on purpose.
          //
          // Splitting the content packs out of it looked like an easy win —
          // it is a large static payload only read when a save is created —
          // but the engine's modules and its content data reference each other
          // at module scope, and Rollup cannot order two chunks that form a
          // cycle. The result was a build that succeeded, a test suite that
          // passed (it runs the source in Node, never the bundle), and a
          // production page that died on load with a temporal-dead-zone error.
          // A browser smoke test now guards this; do not re-split without one.
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
