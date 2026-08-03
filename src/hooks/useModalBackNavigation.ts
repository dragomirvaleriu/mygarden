import { useEffect, useRef } from 'react';

/**
 * Gives a detail view (plant modal, article reader) genuine back-button
 * support instead of behaving like a dead-end overlay:
 *  - Pushes a history entry the moment it opens, so the phone's hardware
 *    back button / edge-swipe gesture closes the view instead of leaving
 *    the whole app (or the page underneath).
 *  - Remembers the list's scroll position and restores it once the view
 *    closes, so returning from an article/plant lands back where the user
 *    left off, not at the top of the list.
 *
 * Usage: call `requestClose()` from every close affordance in the view
 * (back button, X, backdrop click, "add to garden" success, ...) instead
 * of calling your own onClose directly. Routing every close path through
 * the same history.back() call keeps a single history entry per open
 * view — skipping this would leave a dangling entry that turns the next,
 * unrelated back-press into a silent no-op.
 */
export function useModalBackNavigation(isOpen: boolean, onClose: () => void) {
  const scrollYRef = useRef(0);
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    scrollYRef.current = window.scrollY;
    window.history.pushState({ __modal: true }, '');
    pushedRef.current = true;

    const handlePopState = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    // Closed through some path other than the back button/gesture (e.g. a
    // button inside the view) — pop the history entry we pushed so it
    // doesn't linger as a dangling "back" the user never asked for.
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    const y = scrollYRef.current;
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [isOpen]);

  const requestClose = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      onCloseRef.current();
    }
  };

  return { requestClose };
}
