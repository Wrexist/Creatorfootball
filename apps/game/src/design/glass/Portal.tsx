import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Overlays render into `document.body` rather than in place, because the app
 * shell uses `overflow: hidden` and stacking contexts on every screen — a sheet
 * rendered inline would be clipped by its own scroll container.
 */
export function Portal({ children }: { children: ReactNode }): ReactNode {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
