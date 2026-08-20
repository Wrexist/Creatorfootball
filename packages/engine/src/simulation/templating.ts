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

/**
 * How much a recently used template's weight is multiplied by, in the fallback
 * case where *every* candidate is recent and something still has to be said.
 */
export const REPEAT_PENALTY = 0.04;

/**
 * Weight multiplier for a template that has not been seen at all inside the
 * retained history. A large pool is worth nothing if selection keeps landing on
 * the same eight lines, so an unused line outbids a cold one six to one.
 */
export const UNUSED_PREFERENCE = 6;

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
 * What the feed has already said, and how recently.
 *
 * `blocked` is a hard rule and `seen` is a soft one. Splitting them is the
 * whole fix for a feed that reads as generated: a soft weight penalty on its
 * own still lets a five-line pool repeat a line three times in a fortnight,
 * because a 0.04 multiplier on the only candidate is still the only candidate.
 */
export interface TemplateRecency {
  /** Used inside the hard window. Never selectable while any alternative exists. */
  readonly blocked: ReadonlySet<string>;
  /** Used anywhere in retained history. De-weighted against never-used lines. */
  readonly seen: ReadonlySet<string>;
}

export const emptyRecency = (): TemplateRecency => ({ blocked: new Set(), seen: new Set() });

/**
 * Weighted pick that will not repeat itself.
 *
 * Three tiers, in order: never-used lines, then cold lines, then — only when
 * the pool holds nothing else — a recently used line at a heavy penalty, so a
 * one-template pool still says something rather than going silent.
 * Returns null for an empty pool so callers fall back rather than throw.
 */
export function pickTemplate<T extends Weighted>(
  rng: Rng,
  candidates: readonly T[],
  recent: TemplateRecency | ReadonlySet<string>,
): T | null {
  if (candidates.length === 0) return null;
  const recency: TemplateRecency = recent instanceof Set
    ? { blocked: recent, seen: recent }
    : recent as TemplateRecency;

  const allowed = candidates.filter((t) => !recency.blocked.has(t.id));
  const pool = allowed.length > 0 ? allowed : candidates;
  const exhausted = allowed.length === 0;
  return rng.weighted(pool, (t) => {
    const base = t.weight > 0 ? t.weight : 1;
    if (exhausted) return base * REPEAT_PENALTY;
    return recency.seen.has(t.id) ? base : base * UNUSED_PREFERENCE;
  });
}

/** Band a -1..1 sentiment so content can key on it as a string. */
export const sentimentBand = (s: number): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =>
  (s > 0.15 ? 'POSITIVE' : s < -0.15 ? 'NEGATIVE' : 'NEUTRAL');

/** Deterministic small integer from a string — used for avatar/image seeds. */
export const seedFrom = (...parts: readonly (string | number)[]): string =>
  parts.map((p) => String(p)).join('-').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 48);

/**
 * Trigger aliases.
 *
 * The cascade speaks in *semantic* triggers — a 6-0 derby win is a
 * `DERBY_WIN`, not just a `MATCH_WON` — because that is what lets a template
 * pack write a line that fits the moment. Content packs may key on the plain
 * domain event type instead, which is a perfectly reasonable thing for an
 * author to do. This table lets both work: a hook draws on templates for its
 * specific trigger *and* on the broader event-type pool, with the specific
 * lines weighted up so they win whenever they exist.
 */
export const TRIGGER_FALLBACKS: Readonly<Record<string, string>> = {
  MARQUEE_SIGNING: 'PLAYER_SIGNED',
  SIGNING: 'PLAYER_SIGNED',
  DEBUT_WATCH: 'PLAYER_SIGNED',
  WIN: 'MATCH_WON',
  STATEMENT_WIN: 'MATCH_WON',
  DERBY_WIN: 'MATCH_WON',
  DEFEAT: 'MATCH_LOST',
  SHOCK_DEFEAT: 'MATCH_LOST',
  DERBY_DEFEAT: 'MATCH_LOST',
  DEFEAT_FALLOUT: 'MATCH_LOST',
  GOAL: 'GOAL_SCORED',
  SPECIAL_GOAL: 'GOAL_SCORED',
  WONDERKID: 'PLAYER_BREAKOUT',
  BREAKOUT_INTEREST: 'PLAYER_BREAKOUT',
  INJURY_BLOW: 'PLAYER_INJURED',
  FAN_UNREST: 'FAN_SENTIMENT_CHANGED',
  FAN_BUZZ: 'FAN_SENTIMENT_CHANGED',
  RIVALRY_HEAT: 'RIVALRY_INTENSIFIED',
  TRANSFER_HIJACK: 'TRANSFER_HIJACKED',
  SUSPENSION_AFTERMATH: 'RED_CARD',
  RECORD_REACTION: 'RECORD_BROKEN',
  TROPHY_AFTERGLOW: 'TROPHY_WON',
  PLAYER_UNHAPPY: 'PLAYER_MORALE_CHANGED',
  PLAYER_LIFTED: 'PLAYER_MORALE_CHANGED',
};

/** How much a template keyed to the exact moment outweighs a generic one. */
export const SPECIFIC_TRIGGER_BONUS = 2;

/**
 * Candidate templates for a trigger: its own, weighted up, plus the broader
 * event-type pool underneath.
 */
export function templatesForTrigger<T extends Weighted>(
  lookup: (key: string) => readonly T[] | undefined,
  trigger: string,
  suffix = '',
): T[] {
  const specific = (lookup(`${trigger}${suffix}`) ?? []).map(
    (t) => ({ ...t, weight: Math.max(1, t.weight) * SPECIFIC_TRIGGER_BONUS }),
  );
  const fallbackTrigger = TRIGGER_FALLBACKS[trigger];
  const fallback = fallbackTrigger ? lookup(`${fallbackTrigger}${suffix}`) ?? [] : [];
  return [...specific, ...fallback];
}

/**
 * Blend a content pack's templates with the built-in fallbacks.
 *
 * Packs and fallbacks are written by different hands and their `weight` columns
 * are not on the same scale (the base pack uses 1-5, the fallbacks 10). Naively
 * concatenating them would let an arbitrary scale choice decide whose voice the
 * game speaks in. So the fallbacks are re-scaled onto the pack's own scale and
 * then held down by `factor`, which is the deliberate editorial decision:
 * authored content leads, built-ins fill the gaps and cover triggers the pack
 * has no line for.
 */
export function blendTemplates<T extends Weighted>(
  pack: readonly T[],
  fallbacks: readonly T[],
  factor: number,
): T[] {
  if (pack.length === 0) return fallbacks.slice();
  const average = (xs: readonly T[]): number =>
    (xs.length ? xs.reduce((sum, t) => sum + Math.max(0, t.weight), 0) / xs.length : 1) || 1;
  const scale = (average(pack) / average(fallbacks)) * factor;
  return [...pack, ...fallbacks.map((t) => ({ ...t, weight: Math.max(0.01, t.weight * scale) }))];
}
