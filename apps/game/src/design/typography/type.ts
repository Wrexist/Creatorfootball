/**
 * The type scale.
 *
 * Before this file the product had four moves: huge heading, medium heading,
 * small uppercase label, body. Everything got built out of those, so every
 * screen looked like the same screen. Eleven roles replace them, each with a
 * job it is the only one allowed to do.
 *
 * Two rules run through the whole scale.
 *
 * **Uppercase is rationed.** Uppercasing a string makes it roughly 30% wider
 * for no extra information, and that width is where most of the product's
 * clipped labels came from ("TO THE SIDE A..."). Uppercase now survives in
 * exactly two roles - `micro` and `eyebrow` - both of which are short, fixed
 * strings written by us, never content. Everything that used to be a small
 * uppercase label is now `label`: sentence case, same size, same weight,
 * legible at a glance and a third narrower.
 *
 * **Numbers are broadcast graphics.** `stat`, `giant`, `score` and `live` are
 * tabular, lining, tightly tracked and heavy. A score should look like it came
 * off a gantry, not out of a spreadsheet: figures aligned, tracking pulled in
 * so the pair reads as one object, and enough weight that it survives being
 * laid over a club colour.
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
  /** Default reading size. */
  | 'body'
  /** Body with emphasis - a name in a row, a value in a cell. */
  | 'bodyStrong'
  /** Secondary line: a city, a date, a handle. */
  | 'caption'
  /** The workhorse small label. Sentence case. Replaces most old uppercase. */
  | 'label'
  /** Genuinely tiny, genuinely uppercase. Column heads and legends only. */
  | 'micro'
  /** The volt kicker above a hero title. Uppercase earns it here. */
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
 * caller's override (a screen passing `text-[13px]` must win). The two custom
 * utilities used here - `num-broadcast` and `type-commentary` - live in
 * tokens.css because they set font-feature-settings, which Tailwind cannot.
 */
export const TYPE_CLASS: Record<TypeRole, string> = {
  display: 'font-display text-[40px] font-extrabold leading-[0.94] tracking-[-0.045em] text-ink',
  hero: 'font-display text-[32px] font-bold leading-[1.04] tracking-[-0.035em] text-ink',
  title: 'font-display text-[24px] font-bold leading-[1.1] tracking-[-0.03em] text-ink',
  section: 'font-display text-[15px] font-bold leading-[1.2] tracking-[-0.005em] text-ink',
  body: 'text-[15px] font-normal leading-[1.45] text-ink',
  bodyStrong: 'text-[15px] font-semibold leading-[1.3] tracking-[-0.005em] text-ink',
  caption: 'text-[13px] font-normal leading-[1.4] text-ink-muted',
  label: 'text-[12px] font-semibold leading-[1.3] tracking-[0.005em] text-ink-muted',
  micro: 'text-[10px] font-bold uppercase leading-[1.2] tracking-[0.14em] text-ink-dim',
  eyebrow: 'text-[11px] font-bold uppercase leading-[1.2] tracking-[0.22em] text-volt',
  stat: 'num-broadcast text-[17px] font-bold leading-none tracking-[-0.025em] text-ink',
  giant: 'num-broadcast text-[44px] font-extrabold leading-[0.86] tracking-[-0.05em] text-ink',
  score: 'num-broadcast text-[40px] font-extrabold leading-[0.86] tracking-[-0.06em] text-ink',
  live: 'num-live text-[13px] leading-none text-ink',
  commentary: 'type-commentary text-ink-muted',
};

/**
 * Roles whose glyphs are numerals. Used by primitives that need to know whether
 * to reserve tabular width.
 */
export const NUMERIC_ROLES: ReadonlySet<TypeRole> = new Set<TypeRole>([
  'stat', 'giant', 'score', 'live',
]);

/** Default font size in px for each role, so `FitText` can start from the scale. */
export const TYPE_SIZE: Record<TypeRole, number> = {
  display: 40,
  hero: 32,
  title: 24,
  section: 15,
  body: 15,
  bodyStrong: 15,
  caption: 13,
  label: 12,
  micro: 10,
  eyebrow: 11,
  stat: 17,
  giant: 44,
  score: 40,
  live: 13,
  commentary: 14,
};
