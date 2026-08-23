import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SILVERWARE_LABELS, SILVERWARE_VARIANTS, Silverware, silverwareVariantFor,
  type SilverwareVariant,
} from './silverware';

/**
 * The silverware is the payoff art: it renders in the one overlay the product
 * asks the player to stop and look at. Two failure modes are invisible in
 * review and fatal in play, so both are pinned here.
 *
 * 1. A gradient id collision. React `useId` values are not SVG-safe, and a
 *    hand-rolled id would repeat across a cabinet grid — every trophy would
 *    then inherit whichever instance mounted last, or lose its fill entirely.
 * 2. Variants drifting into each other. Five trophies that differ only in
 *    proportion teach the player nothing about what was won.
 */

const markup = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(createElement(Silverware, props));

const idsIn = (svg: string): string[] =>
  [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);

const refsIn = (svg: string): string[] =>
  [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);

describe('Silverware rendering', () => {
  it.each(SILVERWARE_VARIANTS)('renders a complete svg for %s', (variant) => {
    const svg = markup({ variant, size: 96 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 100 132"');
    expect(svg).toContain('</svg>');
    // A NaN in a path attribute silently drops the shape in every browser.
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });

  it.each(SILVERWARE_VARIANTS)('keeps every url(#…) reference resolvable for %s', (variant) => {
    const svg = markup({ variant });
    const defined = new Set(idsIn(svg));
    expect(defined.size).toBeGreaterThan(0);
    for (const ref of refsIn(svg)) expect(defined.has(ref)).toBe(true);
  });

  it('scales width from height on the 100 × 132 box', () => {
    const svg = markup({ size: 132 });
    expect(svg).toContain('height="132"');
    expect(svg).toContain('width="100"');
  });

  it('drops the detail pass at glyph sizes and keeps the silhouette', () => {
    const small = markup({ variant: 'league', size: 20 });
    const large = markup({ variant: 'league', size: 96 });
    expect(small.length).toBeLessThan(large.length);
    // Still a trophy: gradient-filled body and a plinth, just no engraving.
    expect(refsIn(small).length).toBeGreaterThan(0);
    expect(small).not.toContain('#c8ff2e');
    expect(large).toContain('#c8ff2e');
  });

  it('honours an explicit detail override in both directions', () => {
    expect(markup({ size: 20, detail: true })).toContain('#c8ff2e');
    expect(markup({ size: 96, detail: false })).not.toContain('#c8ff2e');
  });

  it('is decorative without a label and an image with one', () => {
    expect(markup({})).toContain('aria-hidden="true"');
    const labelled = markup({ label: SILVERWARE_LABELS.cup, variant: 'cup' });
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain(`aria-label="${SILVERWARE_LABELS.cup}"`);
    expect(labelled).not.toContain('aria-hidden');
  });

  it('falls back to the champion cup for an unknown variant', () => {
    const bogus = markup({ variant: 'nonsense' as SilverwareVariant });
    const league = markup({ variant: 'league' });
    expect(stripIds(bogus)).toBe(stripIds(league));
  });
});

const stripIds = (svg: string): string => svg.replace(/cf-silver-[a-zA-Z0-9_-]+/g, 'id');

describe('Silverware ids', () => {
  it('gives every instance in a tree its own gradient ids', () => {
    const svg = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        ...SILVERWARE_VARIANTS.map((variant, i) =>
          createElement(Silverware, { key: i, variant, size: 96 }),
        ),
      ),
    );
    const ids = idsIn(svg);
    expect(ids.length).toBe(SILVERWARE_VARIANTS.length * 4);
    expect(new Set(ids).size).toBe(ids.length);
    // And each reference still points at an id that exists.
    const defined = new Set(ids);
    for (const ref of refsIn(svg)) expect(defined.has(ref)).toBe(true);
  });

  it('only emits SVG-safe fragment identifiers', () => {
    for (const id of idsIn(markup({ size: 96 }))) {
      expect(id).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    }
  });
});

describe('Silverware variety', () => {
  const geometry = (variant: SilverwareVariant): string =>
    [...markup({ variant, size: 96 }).matchAll(/\sd="([^"]+)"/g)]
      .map((m) => m[1])
      .join('|');

  it('draws a visibly different piece for every variant', () => {
    const seen = new Map<string, SilverwareVariant>();
    for (const variant of SILVERWARE_VARIANTS) {
      const shape = geometry(variant);
      expect(shape.length).toBeGreaterThan(60);
      const clash = seen.get(shape);
      expect(clash, `${variant} draws the same shapes as ${clash}`).toBeUndefined();
      seen.set(shape, variant);
    }
  });

  it('renders identical markup for the same variant', () => {
    expect(stripIds(markup({ variant: 'cup', size: 64 })))
      .toBe(stripIds(markup({ variant: 'cup', size: 64 })));
  });
});

describe('silverwareVariantFor', () => {
  it.each([
    ['The Creator League', 'league'],
    ['Creator League', 'league'],
    ['The Creator Cup', 'cup'],
    ['Knockout Cup', 'cup'],
    ['Super Cup', 'superCup'],
    ['Community Shield', 'superCup'],
    ['Playoff Final', 'superCup'],
    ['Golden Boot', 'boot'],
    ['Top scorer', 'boot'],
    ['Dynasty Award', 'legacy'],
    ['Hall of Fame', 'legacy'],
  ] as const)('maps %s to %s', (name, variant) => {
    expect(silverwareVariantFor(name)).toBe(variant);
  });

  it('never throws and always lands on a real variant', () => {
    for (const name of ['', ' ', null, undefined, '🙂', 'a'.repeat(500), '../../etc/passwd']) {
      const variant = silverwareVariantFor(name);
      expect(SILVERWARE_VARIANTS).toContain(variant);
    }
  });

  it('labels every variant', () => {
    for (const variant of SILVERWARE_VARIANTS) {
      expect(SILVERWARE_LABELS[variant]).toBeTruthy();
    }
  });
});
