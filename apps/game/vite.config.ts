import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Subpaths first: `@cf/engine/content/packs/base/index` is how the content
      // loader reaches the pack without going through the engine's barrel.
      '@cf/engine/': fileURLToPath(new URL('../../packages/engine/src/', import.meta.url)),
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
          // The content packs are their own chunk; the rest of the engine is one.
          //
          // This split failed once: the engine's modules and the pack data
          // referenced each other at module scope, Rollup cannot order two
          // chunks that form a cycle, and the production page died on load
          // with a temporal-dead-zone error while every unit test passed. The
          // cycle is gone now — no engine module imports a pack; the engine's
          // barrel does not re-export one; content reaches the engine through
          // a `ContentRegistry` handed to it — and the pack is fetched by one
          // dynamic import in `state/content.ts`. So the content chunk depends
          // on the engine chunk and never the other way round. The browser
          // smoke test still guards it; keep it that way.
          if (id.includes('packages/engine/src/content/packs/')) return 'content';
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
