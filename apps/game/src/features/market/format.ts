/**
 * Time in this game is measured in matchweeks, never in days.
 *
 * Every label here therefore counts cycles. A screen that said "3 days ago"
 * would be inventing a clock the simulation does not have.
 */
export function relativeCycle(now: number, then: number): string {
  const delta = Math.max(0, now - then);
  if (delta === 0) return 'this week';
  if (delta === 1) return 'last week';
  return `${delta} weeks ago`;
}

export function cyclesLeft(now: number, deadline: number): string {
  const delta = deadline - now;
  if (delta <= 0) return 'deadline passed';
  if (delta === 1) return '1 week left';
  return `${delta} weeks left`;
}

/** Money as a plain integer with grouping — used inside sentences, not headlines. */
export const plainMoney = (value: number): string => Math.round(value).toLocaleString('en-GB');
