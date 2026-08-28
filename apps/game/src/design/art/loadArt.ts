/**
 * Synchronous access to an optional art plate, for canvas renderers.
 *
 * `ArtLayer` covers the DOM. A canvas render loop cannot await anything and
 * cannot use a hook, so it needs to ask "is this plate ready *right now*" on
 * every frame and get an answer immediately. `artImage` returns the decoded
 * image or `null`, kicks off the load once, and never throws — so the caller's
 * procedural drawing stays the thing that runs until the file is genuinely
 * there, and forever if it never is.
 */

/** Resolved state per URL: an image once decoded, `null` once known-missing. */
const resolved = new Map<string, HTMLImageElement | null>();
/** URLs whose load is in flight, so a 60fps loop starts it exactly once. */
const inFlight = new Set<string>();

/**
 * The decoded image, or `null` while it is loading, missing or unavailable.
 * Safe to call every frame.
 */
export function artImage(src: string): HTMLImageElement | null {
  const known = resolved.get(src);
  if (known !== undefined) return known;

  if (!inFlight.has(src)) {
    inFlight.add(src);
    if (typeof window === 'undefined' || typeof window.Image !== 'function') {
      resolved.set(src, null);
      return null;
    }
    const image = new window.Image();
    image.onload = () => {
      // A decoded-but-zero-sized image is a corrupt file, not a usable plate.
      resolved.set(src, image.naturalWidth > 0 ? image : null);
      inFlight.delete(src);
    };
    image.onerror = () => {
      resolved.set(src, null);
      inFlight.delete(src);
    };
    image.decoding = 'async';
    image.src = src;
  }
  return null;
}

/** Test seam: forget everything, so a suite can re-exercise the load path. */
export function resetArtImages(): void {
  resolved.clear();
  inFlight.clear();
}
