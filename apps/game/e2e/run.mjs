/**
 * Preview-server harness for the browser smoke test.
 *
 * Replaces the previous `vite preview & sleep 4 && …` one-liner, which only
 * worked in POSIX shells: a background job and `sleep` do not exist on the
 * Windows command line, so the suite could not run locally there. Polling the
 * port until the server answers is also more honest than a fixed nap.
 *
 * Starts `vite preview`, waits for it to respond, runs e2e/smoke.mjs against
 * it, forwards its exit code, then tears the server down.
 */
import { spawn } from 'node:child_process';

const BASE = 'http://127.0.0.1:4173';
const READY_TIMEOUT_MS = 30_000;

const preview = spawn('npx vite preview --port 4173 --strictPort', {
  shell: true,
  stdio: 'ignore',
});

function killPreview() {
  if (!preview.pid) return;
  // With shell:true the direct child is a shell wrapper; on Windows killing it
  // alone would orphan the real server, so take the whole tree down.
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    preview.kill('SIGTERM');
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Not up yet; keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

try {
  if (!(await waitForServer(BASE, READY_TIMEOUT_MS))) {
    console.error(`[X] preview server never answered at ${BASE} within ${READY_TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }
  const smoke = spawn(`node e2e/smoke.mjs ${BASE}`, { shell: true, stdio: 'inherit' });
  const code = await new Promise((resolve) => smoke.on('exit', (c) => resolve(c ?? 1)));
  process.exit(code);
} finally {
  killPreview();
}
