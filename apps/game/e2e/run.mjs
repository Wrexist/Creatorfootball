import { preview } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// An OS-allocated port and in-process server prevent stale-server false positives.
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Preview did not bind a TCP port.');
const base = `http://127.0.0.1:${address.port}`;
try {
  for (const script of ['smoke.mjs', 'career.mjs', 'expansion.mjs', 'media-audit.mjs', 'media-matrix.mjs', 'media-states.mjs']) {
    const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), base], { stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
    });
    if (code !== 0) { process.exitCode = code; break; }
  }
} finally {
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
