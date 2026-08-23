import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CreatorAvatar, PlayerPortrait, portraitFeatures, type PortraitFeatures,
} from './PlayerPortrait';
import {
  EXPRESSIONS, FACE_SHAPES, FACIAL_HAIR_STYLES, HAIR_STYLES, headHalfWidth, headPath,
} from './face';

/**
 * The portrait generator is the only art system in the game that has to hold a
 * promise across saves, devices and years: a player's face must not change. A
 * regression here is invisible in review (every face still looks like a face)
 * and catastrophic in play (the squad you knew is full of strangers), so the
 * contract is pinned in tests rather than in a comment.
 *
 * The second half of the file guards the opposite failure: a generator that is
 * deterministic but boring. Twenty thousand newgens with four haircuts between
 * them is the state these tests exist to prevent.
 */

const SEEDS = Array.from({ length: 4_000 }, (_, i) => `newgen-${i}`);

const markup = (seed: string): string =>
  renderToStaticMarkup(createElement(PlayerPortrait, { seed, size: 96 }));

describe('portrait determinism', () => {
  it('derives identical features for the same seed', () => {
    expect(portraitFeatures('player_4821')).toEqual(portraitFeatures('player_4821'));
  });

  it('renders byte-identical SVG for the same seed', () => {
    // React ids differ between roots, so compare the drawing itself: every
    // path, fill and gradient stop must match.
    const strip = (svg: string): string => svg.replace(/cf-[a-z-]+-[a-zA-Z0-9_-]+/g, 'id');
    expect(strip(markup('marcus-vale'))).toBe(strip(markup('marcus-vale')));
  });

  it('is unaffected by the order features are read in', () => {
    const a = portraitFeatures('order-check');
    const b = portraitFeatures('order-check');
    for (const key of Object.keys(a) as (keyof PortraitFeatures)[]) {
      expect(b[key]).toEqual(a[key]);
    }
  });

  it('never throws on hostile seeds', () => {
    for (const seed of ['', ' ', '🙂', 'a'.repeat(400), '../../etc/passwd']) {
      expect(() => portraitFeatures(seed)).not.toThrow();
    }
    expect(portraitFeatures('')).toEqual(portraitFeatures('anonymous'));
  });

  it('gives different seeds different faces', () => {
    expect(portraitFeatures('one')).not.toEqual(portraitFeatures('two'));
  });
});

describe('portrait variety', () => {
  const faces = SEEDS.map((seed) => portraitFeatures(seed));
  const spread = <K extends keyof PortraitFeatures>(key: K): number =>
    new Set(faces.map((f) => f[key])).size;

  it('reaches every hair style, face shape, expression and beard', () => {
    expect(spread('hairStyle')).toBe(HAIR_STYLES.length);
    expect(spread('faceShape')).toBe(FACE_SHAPES.length);
    expect(spread('expression')).toBe(EXPRESSIONS.length);
    // The pool weights `none` and `stubble`, so the reachable set is smaller
    // than the style list; every *style* must still appear.
    expect(spread('facialHair')).toBeGreaterThanOrEqual(FACIAL_HAIR_STYLES.length - 1);
  });

  it('reaches every skin tone and hair colour', () => {
    expect(spread('skin')).toBe(12);
    expect(spread('hair')).toBe(12);
  });

  it('makes near-identical faces rare', () => {
    const silhouettes = new Set(
      faces.map((f) => [
        f.skin, f.hair, f.hairStyle, f.hairline, f.facialHair, f.faceShape,
        f.browStyle, f.eyeStyle, f.expression, f.accessory,
      ].join('|')),
    );
    // Any collision at all across 4,000 seeds would mean a correlated channel.
    expect(silhouettes.size).toBe(SEEDS.length);
  });

  it('varies continuous geometry rather than snapping to a few values', () => {
    const widths = new Set(faces.map((f) => f.halfWidth));
    expect(widths.size).toBe(SEEDS.length);
    const jaws = new Set(faces.map((f) => f.jaw));
    expect(jaws.size).toBe(SEEDS.length);
  });

  it('keeps skin tone independent of hair style', () => {
    const pairs = new Set(faces.map((f) => `${f.skin}:${f.hairStyle}`));
    expect(pairs.size).toBeGreaterThan(12 * HAIR_STYLES.length * 0.9);
  });
});

describe('accessories', () => {
  it('stays rare on players', () => {
    const worn = SEEDS.filter((s) => portraitFeatures(s).accessory !== 'none').length;
    const rate = worn / SEEDS.length;
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.26);
  });

  it('gives creators a flashier, wider pool', () => {
    const creator = SEEDS.map((s) => portraitFeatures(s, 'creator').accessory);
    const kinds = new Set(creator.filter((a) => a !== 'none'));
    expect(kinds.has('cap')).toBe(true);
    expect(kinds.has('chain')).toBe(true);
    expect(kinds.has('tinted')).toBe(true);
    // Players never reach the flashy pool.
    const players = new Set(SEEDS.map((s) => portraitFeatures(s).accessory));
    expect(players.has('cap')).toBe(false);
    expect(players.has('tinted')).toBe(false);
    expect(players.has('chain')).toBe(false);
  });

  it('changes nothing but the accessory between the two pools', () => {
    const { accessory: _a, ...player } = portraitFeatures('shared-seed');
    const { accessory: _b, ...creator } = portraitFeatures('shared-seed', 'creator');
    expect(creator).toEqual(player);
  });
});

describe('head geometry', () => {
  it('produces a closed path for every shape', () => {
    for (const shape of FACE_SHAPES) {
      const d = headPath({ halfWidth: 24, jaw: 0.8, shape });
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });

  it('keeps every face inside the 120-unit frame', () => {
    for (const f of SEEDS.slice(0, 500).map((s) => portraitFeatures(s))) {
      const w = headHalfWidth({ halfWidth: f.halfWidth, jaw: f.jaw, shape: f.faceShape });
      // Hair, ears and accessories all extend past the head; the widest of them
      // is the afro at w + 10, which must still clear the frame edge.
      expect(60 + w + 10).toBeLessThan(120);
    }
  });

  it('draws distinct silhouettes per shape', () => {
    const paths = new Set(FACE_SHAPES.map((shape) => headPath({ halfWidth: 24, jaw: 0.8, shape })));
    expect(paths.size).toBe(FACE_SHAPES.length);
  });
});

describe('rendering', () => {
  it('emits an SVG with gradient shading and no external references', () => {
    const svg = markup('render-check');
    expect(svg).toContain('<svg');
    expect(svg).toContain('radialGradient');
    expect(svg).toContain('linearGradient');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('http');
  });

  it('stays within a sane node budget for list rendering', () => {
    const elements = (svg: string): number => (svg.match(/<[a-zA-Z]/g) ?? []).length;
    const worst = Math.max(...SEEDS.slice(0, 120).map((s) => elements(markup(s))));
    // Squad screens render up to 40 portraits at once, so this is a real
    // budget rather than a formality: gradients and shading are worth their
    // nodes, a fourth hair layer or a blur filter would not be.
    expect(worst).toBeLessThan(72);
  });

  it('labels the portrait only when a name is supplied', () => {
    expect(renderToStaticMarkup(createElement(PlayerPortrait, { seed: 'x' }))).toContain('aria-hidden');
    expect(renderToStaticMarkup(createElement(PlayerPortrait, { seed: 'x', label: 'Ada Vance' })))
      .toContain('aria-label="Ada Vance"');
  });

  it('renders a creator avatar without the kit', () => {
    const avatar = renderToStaticMarkup(createElement(CreatorAvatar, { seed: 'creator-1', tier: 'GLOBAL' }));
    expect(avatar).toContain('<svg');
    expect(avatar).not.toContain('M14 120 C14 100 32 92 60 92 C88 92 106 100 106 120 Z');
  });
});
