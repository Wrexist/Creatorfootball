/**
 * The names of every rung of the type scale, as they appear in a class name.
 *
 * This lives in its own module with **no imports** for one reason: `cn.ts`
 * needs it to teach tailwind-merge which `text-*` classes are font sizes rather
 * than colours, and `cn.ts` is imported by every component in the kit. Putting
 * it in `type.ts` alongside the roles would be tidier to read and would create
 * a cycle the first time `type.ts` needed anything from the kit.
 *
 * Adding a rung to `tokens.css` means adding its name here. `cn.test.ts`
 * asserts that the two agree, because the failure mode when they do not is
 * silent: the size is dropped at merge time and every heading in the product
 * quietly falls back to the inherited 16px.
 */
export const TYPE_STEP_NAMES = [
  // the ten sizes
  'takeover',
  'giant',
  'display',
  'hero',
  'title',
  'section',
  'body',
  'caption',
  'label',
  'micro',
  // aliases, so a numeric role can name its own step
  'score',
  'stat',
  'live',
  'commentary',
] as const;

export type TypeStepName = (typeof TYPE_STEP_NAMES)[number];
