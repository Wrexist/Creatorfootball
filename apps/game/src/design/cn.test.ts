import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cn } from './cn';
import { TYPE_CLASS } from './typography/type';
import { TYPE_STEP_NAMES } from './typography/steps';

const TOKENS = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/**
 * This guards a bug that shipped, was invisible, and flattened the typographic
 * hierarchy of the entire product.
 *
 * The type scale uses named theme tokens (`text-hero`) rather than arbitrary
 * values (`text-[32px]`). tailwind-merge's built-in `font-size` group only
 * matches t-shirt sizes and arbitrary lengths, so every one of our named sizes
 * fell through to its **text colour** group - which meant that in
 * `cn('text-hero ... text-ink')` the merger saw two colours in one group, kept
 * `text-ink`, and silently dropped the size. Every heading rendered at the
 * inherited 16px with the correct CSS sitting unused in the bundle.
 *
 * Nothing throws when this happens. These tests are the only thing that notices.
 */
describe('cn keeps the type scale intact', () => {
  it('treats a named size and a colour as different groups', () => {
    const out = cn('font-display text-hero font-bold text-ink');
    expect(out).toContain('text-hero');
    expect(out).toContain('text-ink');
  });

  it('keeps the size for every rung of the scale', () => {
    for (const name of TYPE_STEP_NAMES) {
      const out = cn(`text-${name}`, 'text-ink-muted');
      expect(out, `text-${name} was dropped`).toContain(`text-${name}`);
      expect(out, `text-ink-muted was dropped next to text-${name}`).toContain('text-ink-muted');
    }
  });

  it('keeps every type role intact when a caller recolours it', () => {
    for (const [role, classes] of Object.entries(TYPE_CLASS)) {
      const size = TYPE_STEP_NAMES.find((n) => classes.includes(`text-${n} `) || classes.endsWith(`text-${n}`));
      if (!size) continue;
      const out = cn(classes, 'text-volt');
      expect(out, `role "${role}" lost its size`).toContain(`text-${size}`);
      expect(out, `role "${role}" lost the override`).toContain('text-volt');
    }
  });

  it('still lets one size override another', () => {
    expect(cn('text-hero', 'text-caption')).toBe('text-caption');
    expect(cn('text-title', 'text-[19px]')).toBe('text-[19px]');
  });

  it('still merges everything else the way it always did', () => {
    expect(cn('p-4', 'p-0')).toBe('p-0');
    expect(cn('rounded-lg', 'rounded-none')).toBe('rounded-none');
    expect(cn('text-ink', 'text-danger')).toBe('text-danger');
    const hidden = false as boolean;
    expect(cn('flex', hidden && 'hidden', ['gap-2'])).toBe('flex gap-2');
  });

  it('lists exactly the rungs tokens.css defines', () => {
    const declared = [...TOKENS.matchAll(/--text-([a-z]+):/g)].map((m) => m[1] as string);
    for (const name of declared) {
      expect(TYPE_STEP_NAMES, `--text-${name} is missing from TYPE_STEP_NAMES`).toContain(name);
    }
    for (const name of TYPE_STEP_NAMES) {
      expect(declared, `TYPE_STEP_NAMES has "${name}" but tokens.css does not define it`).toContain(name);
    }
  });
});
