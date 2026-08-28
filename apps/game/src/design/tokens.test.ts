import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { snapToScale, TYPE_CLASS, TYPE_FLOOR, TYPE_SIZE, TYPE_STEPS } from './typography/type';

const DESIGN_DIR = fileURLToPath(new URL('.', import.meta.url));
const TOKENS = readFileSync(join(DESIGN_DIR, 'tokens.css'), 'utf8');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/**
 * Guards the failure mode that has now happened twice: a class is added to the
 * glass utility layer and quietly left out of one of the two blocks that make
 * it degrade. `.chrome-surface` shipped that way and stayed blurred and
 * translucent for every user who had asked for reduced transparency.
 */
describe('glass fallbacks', () => {
  /** Surface classes whose whole job is to be translucent and blurred. */
  const SURFACE_CLASSES = /\.(glass-[1-4]|chrome-surface|chrome-float)\b/g;

  /**
   * There is more than one of each fallback block - the kit grew a second pair
   * when the material was rebuilt - so the assertion is on the *union* of every
   * block of that kind, not on the first one found.
   */
  const allBlocks = (marker: RegExp): string => {
    const parts: string[] = [];
    for (const match of TOKENS.matchAll(marker)) {
      const from = match.index ?? 0;
      // Blocks are brace-balanced; walk to the matching close.
      let depth = 0;
      let i = TOKENS.indexOf('{', from);
      const start = i;
      for (; i < TOKENS.length; i += 1) {
        if (TOKENS[i] === '{') depth += 1;
        else if (TOKENS[i] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      parts.push(TOKENS.slice(start, i + 1));
    }
    expect(parts.length, `no block matched ${String(marker)}`).toBeGreaterThan(0);
    return parts.join('\n');
  };

  const declared = new Set(
    [...TOKENS.matchAll(SURFACE_CLASSES)].map((m) => m[1] as string),
  );

  it('declares every surface class it is supposed to', () => {
    expect([...declared].sort()).toEqual([
      'chrome-float', 'chrome-surface', 'glass-1', 'glass-2', 'glass-3', 'glass-4',
    ]);
  });

  /**
   * Only the *last* layer of a `background` shorthand may be a colour.
   *
   * A colour in any earlier layer makes the whole declaration invalid — and an
   * invalid shorthand does not fall back to the previous rule in the cascade,
   * it resolves to the initial value. The panel does not merely lose its tint;
   * it loses its background entirely and becomes fully transparent.
   *
   * Which is exactly what happened when the modal surface was given its ground:
   * the film was left as a bare `var(--glass-4-bg)` in front of it, two colours
   * in one shorthand, and every sheet, modal and toast in the product silently
   * lost its background. Nothing failed, nothing logged, and it looks entirely
   * reasonable in a diff. The fix is to write a colour layer as a gradient of
   * itself when it is not last, and this is the check that says so.
   */
  it('never puts a colour anywhere but last in a background shorthand', () => {
    const IMAGE = /^(?:-webkit-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(|^url\(|^image-set\(|^none$/;
    // Comments come out of the whole file first, before declarations are even
    // found. This file explains itself between background layers, and that
    // prose contains both commas and semicolons — a semicolon inside a comment
    // ends the "declaration" early and leaves the comment itself looking like a
    // layer, which is how this check first reported the line that fixed it.
    const css = TOKENS.replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const [, value] of css.matchAll(/background:\s*([^;]+);/g)) {
      if (value === undefined) continue;
      // Split on commas that are not inside parentheses: gradients contain them.
      const layers: string[] = [];
      let depth = 0;
      let current = '';
      for (const ch of value) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        if (ch === ',' && depth === 0) { layers.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      layers.push(current.trim());
      if (layers.length < 2) continue;

      layers.slice(0, -1).forEach((layer, index) => {
        const stripped = layer.trim();
        if (stripped.length === 0) return;
        expect(
          IMAGE.test(stripped),
          `layer ${index + 1} of "${value.replace(/\s+/g, ' ').slice(0, 90)}" is a colour, `
          + 'which is only legal in the final layer — wrap it as '
          + 'linear-gradient(c, c) or move it to the end',
        ).toBe(true);
      });
    }
  });

  /**
   * Level 4 is the modal level: `GlassSheet` and `GlassModal` and nothing else.
   * Unlike every other surface it sits over content it cannot know anything
   * about, so a white film and a blur are not enough on their own — over a
   * league table the section menu was legible straight through.
   *
   * The trap this guards is the file's own shape: `.glass-4` is declared twice
   * in the same layer, and the later declaration wins. Grounding only the first
   * one changes nothing at all and looks completely correct in the diff.
   */
  it('gives every declaration of the modal surface a ground of its own', () => {
    const declarations = [...TOKENS.matchAll(/\.glass-4\s*\{[^}]*\}/g)].map((m) => m[0]);
    // The reduced-transparency and reduced-effects variants swap the whole
    // background for an opaque colour, which is a stronger guarantee.
    const translucent = declarations.filter((d) => d.includes('backdrop-filter: blur') || d.includes('backdrop-filter: var'));
    expect(translucent.length, 'no translucent .glass-4 declaration found').toBeGreaterThan(0);
    for (const declaration of translucent) {
      expect(declaration, 'a translucent .glass-4 declaration has no ground under its film')
        .toContain('--glass-4-ground');
    }
  });

  it('degrades every surface class under prefers-reduced-transparency', () => {
    const block = allBlocks(/@media \(prefers-reduced-transparency: reduce\)/g);
    for (const cls of declared) {
      expect(block, `${cls} missing from the reduced-transparency block`).toContain(`.${cls}`);
    }
  });

  it('degrades every surface class under the in-app reduce-effects setting', () => {
    // The reduce-effects rules are flat selector lists rather than one block,
    // so the whole tail of the file after the first of them is the haystack.
    const block = TOKENS.slice(TOKENS.indexOf("[data-reduced-effects='true']"));
    for (const cls of declared) {
      expect(block, `${cls} missing from the reduced-effects block`).toContain(`.${cls}`);
    }
  });

  /**
   * The kit's headline performance rule is that a blurring layer never contains
   * another. Controls are the way it gets broken: a button, an icon button, an
   * input, a segmented control and an enclosed tab set all live *inside*
   * something, so a glass level of their own is automatically a nested blur.
   * Measured before this was fixed: depth 2 on /home and /market.
   */
  it('keeps blurring surfaces out of every control', () => {
    const CONTROLS = [
      'GlassButton.tsx', 'GlassIcon.tsx', 'GlassInput.tsx',
      'GlassSegmented.tsx', 'GlassTabs.tsx', 'GlassPill.tsx', 'GlassToggle.tsx',
    ];
    for (const file of CONTROLS) {
      const source = readFileSync(join(DESIGN_DIR, 'glass', file), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      expect(code, `${file} carries a blurring surface`).not.toMatch(/glass-[1-4]\b/);
      expect(code, `${file} calls glassClass`).not.toMatch(/glassClass\(/);
    }
  });

  it('never animates or transitions backdrop-filter', () => {
    expect(TOKENS).not.toMatch(/transition[^;]*backdrop-filter/);
    expect(TOKENS).not.toMatch(/@keyframes[^}]*backdrop-filter/);
  });
});

/**
 * The scale is closed. It stops being closed the moment somebody writes
 * `text-[14px]` at a call site, which is how the product ended up with 25
 * distinct sizes and a 12px rung that existed nowhere in the system.
 */
describe('the type scale is closed', () => {
  const files = tsxFiles(DESIGN_DIR);

  it('has a file to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('contains no arbitrary font sizes anywhere in the kit', () => {
    const offenders = files.flatMap((file) => {
      const matches = readFileSync(file, 'utf8').match(/text-\[\d+(\.\d+)?px\]/g) ?? [];
      return matches.map((m) => `${file.slice(DESIGN_DIR.length)}: ${m}`);
    });
    expect(offenders).toEqual([]);
  });

  it('defines a CSS token for every step', () => {
    for (const name of [
      'takeover', 'giant', 'display', 'hero', 'title', 'section', 'body', 'caption', 'label', 'micro',
    ]) {
      expect(TOKENS, `--text-${name} is missing`).toContain(`--text-${name}:`);
    }
  });

  it('sizes every role from a step of the scale', () => {
    for (const [role, size] of Object.entries(TYPE_SIZE)) {
      expect(TYPE_STEPS, `role "${role}" is off the scale at ${size}px`).toContain(size);
    }
  });

  it('never sets a role below the floor', () => {
    for (const size of Object.values(TYPE_SIZE)) {
      expect(size).toBeGreaterThanOrEqual(TYPE_FLOOR);
    }
  });

  it('snaps arbitrary sizes down onto a rung, never below the floor', () => {
    expect(snapToScale(14)).toBe(13);
    expect(snapToScale(16.9)).toBe(15);
    expect(snapToScale(50)).toBe(44);
    expect(snapToScale(9)).toBe(TYPE_FLOOR);
    expect(snapToScale(0)).toBe(TYPE_FLOOR);
  });
});

/**
 * The accent marks what is live, active, winning or actionable. A type role is
 * none of those - it is a size and a weight - so no role may hard-code volt.
 * `eyebrow` used to, which is how every static overline in the product ended up
 * lime and four screens ended up over the 3% volt pixel budget.
 */
describe('the accent is not spent on static type', () => {
  it('keeps volt out of every type role', () => {
    for (const [role, classes] of Object.entries(TYPE_CLASS)) {
      expect(classes, `role "${role}" hard-codes the accent`).not.toContain('volt');
    }
  });

  it('keeps the lime halo off the primary button', () => {
    // The halo was an inline, non-token glow on every primary button in the
    // product and the strongest "gaming dashboard" signal in the build. The
    // flat volt fill is already unmistakable; the glow belongs to `.volt-glow`
    // and to hero moments.
    const button = readFileSync(join(DESIGN_DIR, 'glass', 'GlassButton.tsx'), 'utf8');
    const shadows = button.match(/shadow-\[[^\]]*\]/g) ?? [];
    for (const shadow of shadows) {
      expect(shadow, 'primary button carries a lime glow').not.toMatch(/200_255_46/);
    }
    // The utility itself, not the word in a comment explaining why it is absent.
    expect(button).not.toMatch(/['`\s]volt-glow['`\s]/);
  });
});

/**
 * Names are identity. Body copy may clamp; a club, player or creator name may
 * never be cut, so no component in the kit may put `truncate` on one.
 */
describe('names are never truncated', () => {
  it('uses no truncation in the domain components', () => {
    const offenders = tsxFiles(join(DESIGN_DIR, 'domain'))
      .filter((f) => /className=(?:"|\{cn\()[^"}]*\btruncate\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(DESIGN_DIR.length));
    expect(offenders).toEqual([]);
  });
});
