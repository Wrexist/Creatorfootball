import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroScene, heroBokeh, heroRain, rimAt, type HeroSceneVariant } from './scenes';

/**
 * The scene is the only art in the product that sits *behind* live text, so its
 * failure modes are different from the portraits': not "the wrong face" but
 * "the copy stopped being readable", "the stands reshuffle on every render",
 * and "the second instance on the page stole the first one's gradients".
 * All three are invisible in a code review and obvious in the hand.
 */

const DESIGN_DIR = fileURLToPath(new URL('..', import.meta.url));
// Normalised to LF. The assertions below match on a bare newline, and a
// Windows checkout (core.autocrlf=true) hands back CRLF, which silently
// turns every indexOf into -1 and every slice into 'the rest of the file'.
const TOKENS = readFileSync(join(DESIGN_DIR, 'tokens.css'), 'utf8')
  .replace(/\r\n/g, '\n');

const VARIANTS: HeroSceneVariant[] = ['title', 'triumph', 'consolation'];

const render = (props: Parameters<typeof HeroScene>[0] = {}): string =>
  renderToStaticMarkup(createElement(HeroScene, props));

describe('HeroScene renders', () => {
  for (const variant of VARIANTS) {
    it(`draws the ${variant} scene`, () => {
      const html = render({ variant });
      expect(html).toContain('<svg');
      expect(html).toContain(`data-variant="${variant}"`);
      // Behind glass, never in front of it: no hit testing, no screen reader.
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('pointer-events-none');
      // The crowd, the bowl, the scrim.
      expect((html.match(/<circle/g) ?? []).length).toBeGreaterThan(40);
      expect(html).toContain('<path');
    });
  }

  it('defaults to the title scene', () => {
    expect(render()).toContain('data-variant="title"');
  });

  it('gives each variant its own light temperature', () => {
    const [title, triumph, consolation] = VARIANTS.map((variant) => render({ variant }));
    expect(triumph).toContain('255, 215, 106'); // gold floodlights
    expect(title).toContain('214, 232, 255'); // cold floodlights
    expect(triumph).not.toBe(title);
    expect(consolation).not.toBe(title);
  });

  it('puts rays on a win and rain on a defeat, and neither on a draw', () => {
    // `<line ` with the space: `<linearGradient` is not a rain streak.
    const lines = (html: string): number => (html.match(/<line /g) ?? []).length;
    const polygons = (html: string): number => (html.match(/<polygon/g) ?? []).length;

    // Two accent/touchline strokes are in every scene; the streaks are extra.
    expect(lines(render({ variant: 'consolation' }))).toBeGreaterThan(lines(render({ variant: 'title' })));
    expect(lines(render({ variant: 'title' }))).toBe(2);
    expect(polygons(render({ variant: 'triumph' }))).toBeGreaterThan(polygons(render({ variant: 'title' })));
  });
});

describe('the crowd is seeded, not random', () => {
  it('returns an identical scatter for the same seed', () => {
    const tints = ['#a', '#b', '#c'] as const;
    expect(heroBokeh('match-1', tints)).toEqual(heroBokeh('match-1', tints));
    expect(heroRain('match-1')).toEqual(heroRain('match-1'));
  });

  it('returns a different scatter for a different seed', () => {
    const tints = ['#a', '#b', '#c'] as const;
    expect(heroBokeh('match-1', tints)).not.toEqual(heroBokeh('match-2', tints));
  });

  it('renders byte-identical markup for the same seed', () => {
    // Ids differ between roots by design, so compare the drawing itself.
    const strip = (svg: string): string => svg.replace(/scene-[a-zA-Z0-9_-]+/g, 'id');
    expect(strip(render({ seed: 'fixture-9' }))).toBe(strip(render({ seed: 'fixture-9' })));
    expect(strip(render({ seed: 'fixture-9' }))).not.toBe(strip(render({ seed: 'fixture-8' })));
  });

  it('stays inside the node budget however it is called', () => {
    const tints = ['#a', '#b', '#c'] as const;
    expect(heroBokeh('s', tints).length).toBeLessThanOrEqual(80);
    expect(heroBokeh('s', tints, 5_000).length).toBe(80);
    expect(heroBokeh('s', tints, -12)).toEqual([]);
    expect(heroRain('s', 5_000).length).toBeLessThanOrEqual(40);
  });

  it('keeps every dot inside the stand, under the rim and above the grass', () => {
    for (const dot of heroBokeh('crowd', ['#a', '#b', '#c'])) {
      expect(dot.y).toBeGreaterThanOrEqual(rimAt(dot.x));
      expect(dot.y).toBeLessThanOrEqual(500);
      expect(dot.opacity).toBeGreaterThan(0);
      expect(dot.opacity).toBeLessThanOrEqual(0.55);
    }
  });

  it('never throws on a hostile seed', () => {
    for (const seed of ['', ' ', '🙂', 'a'.repeat(400), '../../etc/passwd']) {
      expect(() => render({ seed })).not.toThrow();
    }
  });
});

describe('two scenes on one page do not collide', () => {
  /** Every `url(#…)` in the markup must point at an id defined in the markup. */
  const references = (html: string): string[] =>
    [...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] as string);
  const definitions = (html: string): string[] =>
    [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1] as string);

  it('gives every gradient a unique id', () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(HeroScene, { variant: 'triumph', key: 'a' }),
        createElement(HeroScene, { variant: 'consolation', key: 'b' }),
      ),
    );
    const ids = definitions(html);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every gradient reference it makes', () => {
    const html = render({ variant: 'triumph' });
    const defined = new Set(definitions(html));
    for (const ref of references(html)) expect(defined).toContain(ref);
    // React's raw ids are not valid SVG fragment identifiers; useSvgId strips
    // them, and this is what proves the stripping is still happening.
    for (const id of defined) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});

describe('the scene degrades', () => {
  it('paints a solid fill under the drawing to fall back to', () => {
    for (const variant of VARIANTS) {
      const html = render({ variant });
      expect(html).toMatch(/background-color:\s*#[0-9a-f]{6}/i);
      expect(html).toContain('hero-scene-art');
    }
  });

  it('removes the drawing under reduced transparency and reduced effects', () => {
    const reducedTransparency = TOKENS.slice(
      TOKENS.indexOf('@media (prefers-reduced-transparency: reduce) {\n  .hero-scene-art'),
    );
    expect(reducedTransparency.startsWith('@media')).toBe(true);
    expect(TOKENS).toContain("[data-reduced-effects='true'] .hero-scene-art { display: none; }");
  });

  it('animates opacity and nothing else, and only on the floodlights', () => {
    const keyframes = TOKENS.slice(TOKENS.indexOf('@keyframes cf-floodlight'));
    const body = keyframes.slice(0, keyframes.indexOf('}\n\n'));
    expect(body).toContain('opacity');
    expect(body).not.toMatch(/transform|filter|width|height|background/);
    // Motion lives on one group, so the global reduced-motion rule flattens
    // the whole scene by flattening one animation.
    expect((render({ variant: 'title' }).match(/hero-scene-flood/g) ?? []).length).toBe(1);
  });
});
