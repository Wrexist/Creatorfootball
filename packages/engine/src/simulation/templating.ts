import type { Rng } from '../core/rng';
import type { HookFacts, TokenMap } from './ports';

/**
 * Template selection and rendering shared by the media and social engines.
 *
 * Two rules drive the design. First, a template whose tokens we cannot fill is
 * never rendered — a feed showing "{player} was sensational" is worse than one
 * line fewer. Second, selection is anti-repetitive: recently used templates are
 * heavily de-weighted rather than banned, so a small pack still works but a
 * large one never repeats itself two cycles running.
 */

/** How much a recently used template's weight is multiplied by. */
export const REPEAT_PENALTY = 0.04;

const TOKEN_RE = /\{([a-zA-Z0-9_]+)\}/g;

/** Returns the rendered string, or null when the template needs a token we lack. */
export function renderTemplate(text: string, tokens: TokenMap): string | null {
  let missing = false;
  const out = text.replace(TOKEN_RE, (_match, key: string) => {
    const value = tokens[key];
    if (value === undefined || value === null || value === '') { missing = true; return ''; }
    return String(value);
  });
  if (missing) return null;
  return out.replace(/\s{2,}/g, ' ').trim();
}

export const templateResolvable = (text: string, tokens: TokenMap): boolean =>
  renderTemplate(text, tokens) !== null;

type ConditionValue = string | number | boolean;

const compare = (fact: ConditionValue | undefined, op: string, want: ConditionValue): boolean => {
  if (fact === undefined) return false;
  switch (op) {
    case 'gte': return Number(fact) >= Number(want);
    case 'lte': return Number(fact) <= Number(want);
    case 'gt': return Number(fact) > Number(want);
    case 'lt': return Number(fact) < Number(want);
    case 'not': return String(fact) !== String(want);
    case 'in': return String(want).split('|').includes(String(fact));
    default: return false;
  }
};

/**
 * Condition grammar: `field` (equality), or `field_gte` / `field_lte` /
 * `field_gt` / `field_lt` / `field_not` / `field_in` (pipe-separated list).
 * An unknown field never matches — a template that keys on facts we do not
 * publish is skipped rather than fired in the wrong context.
 */
export function matchesConditions(
  conditions: Readonly<Record<string, ConditionValue>> | undefined,
  facts: HookFacts,
): boolean {
  if (!conditions) return true;
  for (const [key, want] of Object.entries(conditions)) {
    const idx = key.lastIndexOf('_');
    const suffix = idx > 0 ? key.slice(idx + 1) : '';
    if (['gte', 'lte', 'gt', 'lt', 'not', 'in'].includes(suffix)) {
      if (!compare(facts[key.slice(0, idx)], suffix, want)) return false;
      continue;
    }
    const fact = facts[key];
    if (fact === undefined) return false;
    if (typeof want === 'boolean' ? Boolean(fact) !== want : String(fact) !== String(want)) return false;
  }
  return true;
}

export interface Weighted { readonly id: string; readonly weight: number }

/**
 * Weighted pick that avoids recently used ids. Returns null for an empty pool
 * so callers fall back rather than throw.
 */
export function pickTemplate<T extends Weighted>(
  rng: Rng,
  candidates: readonly T[],
  recentIds: ReadonlySet<string>,
): T | null {
  if (candidates.length === 0) return null;
  return rng.weighted(candidates, (t) => {
    const base = t.weight > 0 ? t.weight : 1;
    return recentIds.has(t.id) ? base * REPEAT_PENALTY : base;
  });
}

/** Band a -1..1 sentiment so content can key on it as a string. */
export const sentimentBand = (s: number): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =>
  (s > 0.15 ? 'POSITIVE' : s < -0.15 ? 'NEGATIVE' : 'NEUTRAL');

/** Deterministic small integer from a string — used for avatar/image seeds. */
export const seedFrom = (...parts: readonly (string | number)[]): string =>
  parts.map((p) => String(p)).join('-').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 48);
