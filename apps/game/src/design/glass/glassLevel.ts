/**
 * The glass elevation model.
 *
 * Four levels, matching the four surface tokens. The rule that keeps this from
 * turning into mush: **a blurring layer may never contain another blurring
 * layer more than one level deep.** Stacked backdrop-filters are the single
 * most expensive thing a mobile GPU can be asked to do here — two nested blurs
 * on a scrolling list will drop an iPhone to 40fps. So:
 *
 *   level 1  cards inside a scroll view (many on screen at once)
 *   level 2  panels and grouped containers, the app's default material
 *   level 3  floating chrome: headers, tab bar, toasts
 *   level 4  modal surfaces: sheets and dialogs, one at a time, over a backdrop
 *
 * Components at level 1 sitting inside a level-2 panel should pass
 * `blur={false}` — see `GlassCard`'s `nested` prop.
 */
export type GlassLevel = 1 | 2 | 3 | 4;

export const GLASS_CLASS: Record<GlassLevel, string> = {
  1: 'glass-1',
  2: 'glass-2',
  3: 'glass-3',
  4: 'glass-4',
};

/**
 * Non-blurring equivalents with matching contrast. Used when a glass surface
 * would be nested inside another, and as the reduced-transparency fallback for
 * anything we draw in JS rather than in tokens.css.
 */
export const GLASS_FLAT_CLASS: Record<GlassLevel, string> = {
  1: 'bg-surface-1/70 border border-white/[0.07]',
  2: 'bg-surface-2/80 border border-white/10 shadow-glass',
  3: 'bg-surface-3/85 border border-white/[0.14] shadow-lift',
  4: 'bg-surface-4/90 border border-white/[0.18] shadow-lift',
};

export function glassClass(level: GlassLevel, blur = true): string {
  return blur ? GLASS_CLASS[level] : GLASS_FLAT_CLASS[level];
}

/**
 * The surface every *control* sits on. Never blurs.
 *
 * Buttons, icon buttons, inputs, segmented controls and enclosed tabs all live
 * inside something else - a panel, a card, a sheet, the screen header. When
 * they carried a glass level of their own, every one of them became a second
 * blurring layer nested inside the first, and the kit's own headline
 * performance rule was being broken by the kit. Measured on `/home` and
 * `/market` before this change: a maximum blur-stack depth of 2, from a
 * secondary button inside a panel.
 *
 * They give up nothing by not blurring. A 44px control blurs 44px of a surface
 * that has already been blurred, at the cost of a full compositing layer each,
 * and on a market screen there are eighteen of them.
 *
 * These stay translucent - white over whatever is beneath - rather than
 * dropping to an opaque `surface-N` tint, so a control on a club-coloured hero
 * still picks up that club's colour instead of punching a grey hole in it.
 */
export const CONTROL_SURFACE: Record<GlassLevel, string> = {
  1: 'bg-white/[0.05] border border-white/[0.09]',
  2: 'bg-white/[0.08] border border-white/[0.13] shadow-[0_1px_0_0_rgb(255_255_255/0.08)_inset,0_1px_2px_-1px_rgb(0_0_0/0.45)]',
  3: 'bg-white/[0.12] border border-white/[0.17] shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset,0_2px_5px_-2px_rgb(0_0_0/0.5)]',
  4: 'bg-white/[0.16] border border-white/[0.22] shadow-[0_1px_0_0_rgb(255_255_255/0.16)_inset,0_3px_8px_-3px_rgb(0_0_0/0.55)]',
};

/**
 * The control surface a component should actually use.
 *
 * Levels 3 and 4 exist in the record for completeness, but a control never gets
 * them: at 12% and 16% white the surface has lifted far enough that `ink-dim` -
 * the tertiary label a segmented control uses for its unselected options - falls
 * to 4.07:1 and 3.54:1. Clamping at level 2 keeps every control at 4.64:1 or
 * better whatever level a caller asks for, and a control brighter than the panel
 * it sits on is a design smell in any case.
 */
export function controlSurface(level: GlassLevel = 2): string {
  return CONTROL_SURFACE[level > 2 ? 2 : level];
}

/** Radius scale used consistently across the kit. */
export const RADIUS_CLASS = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  pill: 'rounded-pill',
} as const;
export type RadiusToken = keyof typeof RADIUS_CLASS;

/**
 * Focus ring. Two rings — a dark inner and a volt outer — so the indicator
 * survives on a light-ish glass surface as well as on the near-black base.
 * Global `:focus-visible` in tokens.css covers plain elements; components that
 * suppress the outline (because the ring must follow a custom radius) use this.
 */
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base';

/** Every interactive element in the kit meets the 44pt iOS minimum. */
export const TOUCH_TARGET = 'min-h-11 min-w-11';
