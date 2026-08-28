import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_ASSETS } from '@/design/art/assets';

/**
 * The splash names its one art plate by literal path, and it has to.
 *
 * `SplashScreen` is the only component in the initial chunk, and a single
 * import from the design system's barrel pulls the whole engine in behind it —
 * which would put the thing this screen is covering in front of the thing
 * covering it. So it cannot import `ART_ASSETS`, and the path is written out
 * by hand instead.
 *
 * A hand-written path is a path that can drift from the registry, and the
 * failure is silent: the plate 404s, the drawn mark stays up, and the splash
 * looks exactly like it did before anyone made the asset. This test is what
 * stops that.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'SplashScreen.tsx'), 'utf8');

describe('the splash art plate', () => {
  it('points at the same file the registry does', () => {
    const match = /const WORDMARK_PLATE = '([^']+)';/.exec(source);
    expect(match, 'SplashScreen.tsx no longer declares WORDMARK_PLATE').not.toBeNull();
    expect(match?.[1]).toBe(ART_ASSETS.wordmark);
  });

  it('never imports the design system barrel', () => {
    // The entire reason the path above is a literal. If this ever passes an
    // import through, the splash starts waiting on the chunk it is covering.
    expect(source).not.toMatch(/from '@\/design/);
  });

  it('treats the plate as optional, not as the thing being drawn', () => {
    // The plate is an override on `BrandMark`, exactly like every other entry
    // in the registry. A missing file has to leave a splash, not a hole.
    expect(source).toContain('onError');
    expect(source).toContain('BrandMark');
  });

  it('composites the plate with screen, which is what makes its ground vanish', () => {
    // The plate ships on black rather than on alpha — see the E3 note in
    // `assets.manifest.mjs`. Drawn normally it is a black rectangle across the
    // middle of the splash.
    expect(source).toContain("mixBlendMode: 'screen'");
  });
});
