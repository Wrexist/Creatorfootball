import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import { Entry } from './app/Entry';

/**
 * Entry point. It does three things and nothing else: load the token layer
 * before the first paint, find the root, and mount.
 *
 * Boot sequencing, providers and routing live behind `app/Entry.tsx`, which
 * splits them out of the initial chunk, so this file never needs to change
 * again — including when a native shell mounts the same tree.
 */

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing: index.html must contain <div id="root">');

createRoot(container).render(
  <StrictMode>
    <Entry />
  </StrictMode>,
);
