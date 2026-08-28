/**
 * Text micro-helpers shared across features.
 *
 * Small enough to have been rewritten inline in half a dozen files, which is
 * exactly why they live here once: three copies of "1st/2nd/3rd" drift.
 */

/** English singular/plural by count — `3 ${plural(n, 'game', 'games')} played`. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/**
 * Engine copy ("minor injury", "hamstring strain") is written lower case for
 * use mid-sentence. Screens that open a sentence with it need this.
 */
export const sentenceCase = (text: string): string =>
  (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * An engine constant as English: `HIGH_PRESS_TRIGGER` becomes "high press
 * trigger", `fan_unrest` becomes "fan unrest".
 *
 * Four slightly different versions of this were written inline across the
 * match, club, squad and social screens, which is how the same value came out
 * as "high press trigger" in one place and "High press" in another. Compose it
 * with `sentenceCase` where a capital is wanted; on its own it is the lower
 * case form that drops into the middle of a sentence.
 *
 * It is a *fallback*, not a translation. A constant a player sees often
 * deserves written copy in a lookup table — this is what stops the ones nobody
 * has got to yet from arriving on screen still shouting in upper case.
 */
export const humanise = (value: string): string =>
  value.replace(/[_-]+/g, ' ').trim().toLowerCase();

const ORDINAL_WORDS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
] as const;

/**
 * A position as it is *said*: "Win this and you go third." Word form reads as
 * copy where `ordinal`'s digits read as a table; beyond the twelfth the words
 * stop earning their space and the numeral stands in.
 */
export function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? `${n}th`;
}
