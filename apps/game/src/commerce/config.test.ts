import { describe, expect, it } from 'vitest';
import { publicKeyKind, validatePurchaseBuild } from './config';

describe('public purchase configuration', () => {
  it('allows disconnected qualification builds and platform-specific public SDK keys', () => {
    expect(() => validatePurchaseBuild({})).not.toThrow();
    expect(() => validatePurchaseBuild({ VITE_REVENUECAT_ANDROID_KEY: 'goog_example', VITE_REVENUECAT_IOS_KEY: 'appl_example' })).not.toThrow();
    expect(publicKeyKind('android', 'test_example')).toBe('test');
    expect(publicKeyKind('ios', 'test_example')).toBe('test');
  });
  it.each(['sk_never_bundle_this', 'appl_wrong_platform', 'goog_', 'goog_bad value', ' goog_example'])('rejects invalid Android configuration without printing credentials (%#)', key => {
    let message = '';
    try { validatePurchaseBuild({ VITE_REVENUECAT_ANDROID_KEY: key }); } catch (error) { message = String(error); }
    expect(message).toContain('VITE_REVENUECAT_ANDROID_KEY');
    expect(message).not.toContain(key);
    expect(publicKeyKind('android', key)).toBe('invalid');
  });
  it('rejects a Google key on iOS and accepts each matching release key', () => {
    expect(() => validatePurchaseBuild({ VITE_REVENUECAT_IOS_KEY: 'goog_example' })).toThrow('public RevenueCat');
    for (const platform of ['android', 'ios'] as const) {
      expect(() => validatePurchaseBuild({ CF_PURCHASE_RELEASE_PLATFORM: platform, [`VITE_REVENUECAT_${platform.toUpperCase()}_KEY`]: platform === 'ios' ? 'appl_example' : 'goog_example' })).not.toThrow();
    }
  });
  it.each(['', 'test_example'])('prevents an explicit store release with a missing or Test Store key', key => {
    expect(() => validatePurchaseBuild({ CF_PURCHASE_RELEASE_PLATFORM: 'android', VITE_REVENUECAT_ANDROID_KEY: key })).toThrow('live public SDK key');
  });
  it('rejects misspelled release targets', () => {
    expect(() => validatePurchaseBuild({ CF_PURCHASE_RELEASE_PLATFORM: 'andriod' })).toThrow('android or ios');
  });
});
