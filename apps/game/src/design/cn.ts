import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { TYPE_STEP_NAMES } from './typography/steps';

/**
 * The one class-name helper.
 *
 * `clsx` handles conditionals; `tailwind-merge` resolves the conflicts that
 * arise when a caller overrides a primitive's defaults (`<GlassCard
 * className="p-0" />` must actually win over the built-in `p-4`). Without the
 * merge step every primitive would need an escape hatch for every property.
 *
 * ## Why this is `extendTailwindMerge` and not the plain `twMerge`
 *
 * The type scale is expressed as named theme tokens - `text-hero`,
 * `text-section`, `text-body` - rather than arbitrary values like
 * `text-[32px]`. tailwind-merge cannot know that: its built-in `font-size`
 * group only recognises t-shirt sizes (`text-sm`, `text-2xl`) and arbitrary
 * lengths, so anything else matching `text-*` falls through to its **text
 * colour** group.
 *
 * That is a silent, product-wide failure. `cn(TYPE_CLASS.hero, ...)` expands to
 * `'font-display text-hero ... text-ink'`; the merger decides `text-hero` and
 * `text-ink` are two colours in the same group, keeps the last one, and drops
 * the size. Every heading in the product then renders at the inherited 16px
 * while the CSS for `.text-hero` sits in the bundle, correct and unused.
 * Nothing throws, nothing warns, and it is invisible in the class string a
 * component passes down - it only shows up in `getComputedStyle`.
 *
 * Declaring the scale under `font-size` fixes it, and `cn.test.ts` fails the
 * build if a rung is ever added to the scale without being added here.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Every rung of the closed type scale, plus the aliases the numeric
      // roles use. Sourced from one array so the two cannot drift apart.
      'font-size': [{ text: [...TYPE_STEP_NAMES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
