import { useEffect, useRef } from 'react';

/**
 * Overlay behaviours shared by GlassSheet, GlassModal and Confirm.
 *
 * These live together because they must be applied together: an overlay that
 * traps focus but does not lock scrolling lets the page behind scroll under the
 * finger on iOS; one that locks scroll but does not restore focus strands the
 * keyboard user at the top of the document.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Count of open overlays, so nested overlays do not fight over body styles. */
let scrollLocks = 0;
let restoreBodyPaddingRight = '';

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (scrollLocks === 0) {
      // Compensating for the scrollbar prevents the desktop layout shifting by
      // ~15px every time a sheet opens. On mobile the gutter is 0 and this is a
      // no-op.
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      restoreBodyPaddingRight = body.style.paddingRight;
      if (gutter > 0) body.style.paddingRight = `${gutter}px`;
      body.style.overflow = 'hidden';
      // iOS Safari still rubber-bands a locked body; `touch-action` stops the
      // background from panning under the sheet.
      body.style.touchAction = 'none';
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        body.style.overflow = '';
        body.style.touchAction = '';
        body.style.paddingRight = restoreBodyPaddingRight;
      }
    };
  }, [active]);
}

/**
 * Traps Tab within the container while open and returns focus to whatever had
 * it when the overlay closes. Focus is moved to the first focusable child, or
 * to the container itself when there is none, so a screen reader lands inside
 * the dialog rather than continuing to read the page behind it.
 */
export function useFocusTrap(active: boolean, ref: React.RefObject<HTMLElement | null>): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusFirst = (): void => {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus({ preventScroll: true });
    };
    // Wait a frame: the entry animation may still be positioning the element,
    // and focusing mid-transform makes iOS scroll the viewport.
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused.current?.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

/** Escape closes the topmost overlay only — hence the capture-phase stop. */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}
