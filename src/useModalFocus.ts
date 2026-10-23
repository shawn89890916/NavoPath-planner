import { useLayoutEffect, type RefObject } from "react";

const activeModals: HTMLElement[] = [];

/** Keep keyboard focus in the top modal and return it when that modal closes. */
export function useModalFocus(open: boolean, ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const modal = ref.current;
    if (!open || !modal) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(modal.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"))
      .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] || modal).focus({ preventScroll: true });
    activeModals.push(modal);
    if (!modal.contains(document.activeElement)) focusFirst();
    const onFocus = (event: FocusEvent) => {
      if (activeModals.at(-1) === modal && !modal.contains(event.target as Node)) focusFirst();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || activeModals.at(-1) !== modal) return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (!first || !modal.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first || document.activeElement === modal : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last || modal : first || modal).focus({ preventScroll: true });
      }
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey, true);
    return () => {
      const wasTop = activeModals.at(-1) === modal;
      activeModals.splice(activeModals.indexOf(modal), 1);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey, true);
      if (wasTop && previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
