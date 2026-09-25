/** One launch offer at most every 72 hours, after a successful store refresh. */
export function launchOfferDue(lastShown: number, now: number, member: boolean, available: boolean): boolean {
  return available && !member && Number.isFinite(lastShown) && lastShown >= 0 && (lastShown === 0 || now - lastShown >= 72 * 60 * 60 * 1000);
}
