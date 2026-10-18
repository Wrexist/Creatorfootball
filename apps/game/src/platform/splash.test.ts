import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ hide: vi.fn(), native: true }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: mocks.hide } }));

/** A fresh module per test: the splash is shown exactly once per app launch. */
async function freshSplash(): Promise<{ hideNativeSplash: () => Promise<void> }> {
  vi.resetModules();
  return import('./splash');
}

afterEach(() => {
  mocks.hide.mockReset();
  mocks.native = true;
  vi.restoreAllMocks();
});

describe('hideNativeSplash', () => {
  it('hides the launch image once, however many callers ask', async () => {
    mocks.hide.mockResolvedValue(undefined);
    const { hideNativeSplash } = await freshSplash();
    await Promise.all([hideNativeSplash(), hideNativeSplash(), hideNativeSplash()]);
    await hideNativeSplash();
    expect(mocks.hide).toHaveBeenCalledTimes(1);
  });

  it('never rejects, and leaves a failed hide free to be tried again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.hide.mockRejectedValueOnce(new Error('plugin missing')).mockResolvedValue(undefined);
    const { hideNativeSplash } = await freshSplash();
    await expect(hideNativeSplash()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    await hideNativeSplash();
    await hideNativeSplash();
    expect(mocks.hide).toHaveBeenCalledTimes(2);
  });

  it('does nothing in a plain browser', async () => {
    mocks.native = false;
    const { hideNativeSplash } = await freshSplash();
    await hideNativeSplash();
    expect(mocks.hide).not.toHaveBeenCalled();
  });
});
