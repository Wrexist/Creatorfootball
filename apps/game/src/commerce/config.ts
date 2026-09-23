export type PurchasePlatform = 'android' | 'ios';
export type PublicKeyKind = 'missing' | 'store' | 'test' | 'invalid';

/** Shared by the native adapter and Vite: errors must never echo a credential. */
export function publicKeyKind(platform: PurchasePlatform, key: string | undefined): PublicKeyKind {
  if (!key) return 'missing';
  if (/^test_[A-Za-z0-9_]+$/.test(key)) return 'test';
  const prefix = platform === 'ios' ? 'appl_' : 'goog_';
  return key.startsWith(prefix) && /^[A-Za-z0-9_]+$/.test(key.slice(prefix.length)) ? 'store' : 'invalid';
}

export function validatePurchaseBuild(env: Record<string, string | undefined>): void {
  const releasePlatform = env.CF_PURCHASE_RELEASE_PLATFORM;
  if (releasePlatform && releasePlatform !== 'android' && releasePlatform !== 'ios') {
    throw new Error('CF_PURCHASE_RELEASE_PLATFORM must be android or ios.');
  }
  for (const platform of ['android', 'ios'] as const) {
    const name = `VITE_REVENUECAT_${platform.toUpperCase()}_KEY`;
    const kind = publicKeyKind(platform, env[name]);
    if (kind === 'invalid') {
      throw new Error(`${name} must contain that platform's public RevenueCat SDK key. Secret keys, wrong-platform keys and malformed values cannot be bundled.`);
    }
    if (releasePlatform === platform && kind !== 'store') {
      throw new Error(`${name} must contain a live public SDK key for a store release. Missing keys and Test Store keys are only allowed in qualification builds.`);
    }
  }
}
