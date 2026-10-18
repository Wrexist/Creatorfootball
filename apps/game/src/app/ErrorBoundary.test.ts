import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ hideNativeSplash: vi.fn(() => Promise.resolve()) }));
vi.mock('@/platform/splash', () => ({ hideNativeSplash: mocks.hideNativeSplash }));
// The boundaries' markup is irrelevant here, and the design barrel is heavy.
vi.mock('@/design', () => ({ ErrorState: () => null, GlassButton: () => null }));

import { AppErrorBoundary } from './ErrorBoundary';
import { StartupBoundary } from './Entry';

afterEach(() => {
  mocks.hideNativeSplash.mockClear();
  vi.restoreAllMocks();
});

/**
 * `launchAutoHide: false` means only the app removes the native launch image.
 * A crash caught by either boundary must remove it too, or the player is left
 * looking at a frozen logo instead of the recovery screen beneath it.
 */
describe('error boundaries and the native splash', () => {
  it('the app boundary hides the splash when it catches a render crash', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new AppErrorBoundary({ children: null }).componentDidCatch(new Error('boom'), { componentStack: '' });
    expect(mocks.hideNativeSplash).toHaveBeenCalledOnce();
  });

  it('the startup boundary hides the splash when the app chunk fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new StartupBoundary({ children: null }).componentDidCatch(new Error('chunk failed'), { componentStack: '' });
    await vi.waitFor(() => expect(mocks.hideNativeSplash).toHaveBeenCalledOnce());
  });
});
