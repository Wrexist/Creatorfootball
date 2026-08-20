/**
 * The type scale.
 *
 * Before this file the product had four visual moves - huge heading, medium
 * heading, small uppercase label, body - built out of **25 distinct pixel
 * sizes**. Too many sizes and too few roles at the same time, which is exactly
 * why every screen looked like the same screen and nothing lined up between
 * them.
 *
 * The replacement is a *closed* scale: nine sizes, fifteen named roles, and no
 * arbitrary values anywhere. The sizes live in tokens.css as `--text-*`; a role
 * may only reference one of them.
 *
 *     44  giant / score    the number a screen is built around
 *     40  display          once per screen at most
 *     32  hero             the large screen title
 *     24  title            a card or sheet heading
 *     17  section / stat   group heading; a figure in a row
 *     15  body             prose. Never smaller.
 *     13  caption          secondary prose
 *     12  label            small UI label
 *     11  micro            the floor
 *
 * Three rules run through it.
 *
 * **The floor is real.** 11px, enforced: `FitText` will not shrink past it and
 * nothing in the kit sets a smaller size. The product previously had 35 uses
 * below its own stated floor, including every tab-bar label.
 *
 * **Uppercase is rationed.** Uppercasing a string makes it roughly 30% wider
 * for no extra information, and that width was the source of most of the
 * product's clipped labels. Uppercase survives in exactly two roles - `micro`
 * and `eyebrow` - both short, fixed strings written by us, never content.
 *
 * **Numbers are broadcast graphics.** `stat`, `giant`, `score` and `live` are
 * tabular, lining, tightly tracked and heavy. A score should look like it came
 * off a gantry: figures aligned, tracking pulled in so the pair reads as one
 * object, enough weight to survive a club-colour wash.
 *
 * And one thing the roles deliberately do *not* do: reach for volt. The accent
 * marks what is live, active, winning or actionable. A label that never changes
 * is none of those, so `eyebrow` - the role that used to paint every static
 * overline lime - is `ink-muted`. Pass `tone="volt"` on the one that is
 * genuinely live.
 */

export type TypeRole =
  /** Once per screen at most: a scoreline takeover, a trophy, an onboarding beat. */
  | 'display'
  /** The large screen title that scrolls away into the header. */
  | 'hero'
  /** A card or sheet heading. */
  | 'title'
  /** The heading above a group of content. Sentence case, not shouted. */
  | 'section'
  /** Default reading size. Prose never goes below this. */
  | 'body'
  /** Body with emphasis - a name in a row, a value in a cell. */
  | 'bodyStrong'
  /** Secondary prose: a city, a date, a bio line. */
  | 'caption'
  /** The workhorse small label. Sentence case. Replaces most old uppercase. */
  | 'label'
  /** The floor. Genuinely tiny, genuinely uppercase. Column heads and legends. */
  | 'micro'
  /** The kicker above a hero title. Uppercase earns it here; volt does not. */
  | 'eyebrow'
  /** A figure inside a row or cell. */
  | 'stat'
  /** The number a stat block is built around. */
  | 'giant'
  /** A scoreline. */
  | 'score'
  /** A live clock or minute marker. */
  | 'live'
  /** Match commentary and quoted speech. */
  | 'commentary';

/**
 * Tailwind class strings rather than CSS classes, so `cn()` can still resolve a
 * caller's override. Sizes are the `--text-*` theme tokens, which Tailwind
 * exposes as `text-<step>` utilities - there is no arbitrary value here, and
 * that is the point.
 */
export const TYPE_CLASS: Record<TypeRole, string> = {
  display: 'font-display text-display font-extrabold leading-[0.94] tracking-[-0.045em] text-ink',
  hero: 'font-display text-hero font-bold leading-[1.04] tracking-[-0.035em] text-ink',
  title: 'font-display text-title font-bold leading-[1.1] tracking-[-0.03em] text-ink',
  section: 'font-display text-section font-bold leading-[1.2] tracking-[-0.01em] text-ink',
  body: 'text-body font-normal leading-[1.45] text-ink',
  bodyStrong: 'text-body font-semibold leading-[1.3] tracking-[-0.005em] text-ink',
  caption: 'text-caption font-normal leading-[1.4] text-ink-muted',
  label: 'text-label font-semibold leading-[1.3] tracking-[0.005em] text-ink-muted',
  micro: 'text-micro font-bold uppercase leading-[1.2] tracking-[0.12em] text-ink-dim',
  eyebrow: 'text-micro font-bold uppercase leading-[1.2] tracking-[0.2em] text-ink-muted',
  stat: 'num-broadcast text-stat font-bold leading-none tracking-[-0.025em] text-ink',
  giant: 'num-broadcast text-giant font-extrabold leading-[0.86] tracking-[-0.05em] text-ink',
  score: 'num-broadcast text-score font-extrabold leading-[0.86] tracking-[-0.06em] text-ink',
  live: 'num-live text-live leading-none text-ink',
  commentary: 'type-commentary text-body text-ink-muted',
};

/**
 * Roles whose glyphs are numerals. Used by primitives that need to know whether
 * to reserve tabular width.
 */
export const NUMERIC_ROLES: ReadonlySet<TypeRole> = new Set<TypeRole>([
  'stat', 'giant', 'score', 'live',
]);

/**
 * The nine steps, in px, at the default root size. `FitText` measures in px, so
 * it needs the numeric value; everything else should use the token.
 *
 * These are the *only* nine numbers. A tenth is a bug.
 */
export const TYPE_STEPS = [11, 12, 13, 15, 17, 24, 32, 40, 44] as const;

/** The smallest size any text in the product may render at. */
export const TYPE_FLOOR = 11;

/** Default size in px for each role, so `FitText` can start from the scale. */
export const TYPE_SIZE: Record<TypeRole, number> = {
  display: 40,
  hero: 32,
  title: 24,
  section: 17,
  body: 15,
  bodyStrong: 15,
  caption: 13,
  label: 12,
  micro: 11,
  eyebrow: 11,
  stat: 17,
  giant: 44,
  score: 40,
  live: 13,
  commentary: 15,
};

/**
 * Snap an arbitrary px size onto the nearest rung at or below it, never below
 * the floor. This is the guardrail that keeps a fitted size on the scale
 * instead of inventing a 14.5px rung nobody chose.
 */
export function snapToScale(size: number): number {
  let best: number = TYPE_FLOOR;
  for (const step of TYPE_STEPS) {
    if (step <= size && step > best) best = step;
  }
  return Math.max(TYPE_FLOOR, best);
}
