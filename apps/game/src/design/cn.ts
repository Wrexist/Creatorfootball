import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The one class-name helper.
 *
 * `clsx` handles conditionals; `tailwind-merge` resolves the conflicts that
 * arise when a caller overrides a primitive's defaults (`<GlassCard
 * className="p-0" />` must actually win over the built-in `p-4`). Without the
 * merge step every primitive would need an escape hatch for every property.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
