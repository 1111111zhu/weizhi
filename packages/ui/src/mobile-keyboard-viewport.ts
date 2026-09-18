import { useEffect } from "react";
import type { RefObject } from "react";

/** Size only the active mobile shell; preserve browser pinch zoom and other pages. */
export function useMobileKeyboardViewport(
  ref: RefObject<HTMLElement | null>,
  enabled = true
) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) {
      return;
    }
    let cleanup: (() => void) | undefined;
    const attach = () => {
      const element = ref.current;
      if (!element) {
        return false;
      }
      cleanup = trackMobileKeyboardViewport(element, viewport);
      return true;
    };
    if (attach()) {
      return cleanup;
    }
    // Portals can commit after this effect. Observe only until the ref exists,
    // then disconnect; do not poll or keep a whole-document observer alive.
    const observer = new MutationObserver(() => {
      if (attach()) {
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [ref, enabled]);
}

function trackMobileKeyboardViewport(
  element: HTMLElement,
  viewport: VisualViewport
) {
  const content = element.querySelector<HTMLElement>(".pw-mobile-content");
  let frame = 0;
  let focused = false;
  let initialHeight = window.innerHeight;
  let followBottom = false;
  const clear = () => {
    element.style.removeProperty("--pw-mobile-viewport-height");
    element.style.removeProperty("--pw-mobile-viewport-offset");
    element.style.removeProperty("--pw-mobile-keyboard-inset");
    delete element.dataset.keyboardOpen;
  };
  const nearBottom = () =>
    Boolean(
      content &&
      content.scrollHeight - content.clientHeight - content.scrollTop < 32
    );
  const update = () => {
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && element.contains(active);
    const editing =
      active instanceof HTMLElement &&
      inside &&
      active.matches(
        'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="submit"]), [contenteditable="true"]'
      );
    const keyboardStillOpen = initialHeight - viewport.height > 100;
    if (editing && !focused && !keyboardStillOpen) {
      initialHeight = Math.max(
        window.innerHeight,
        viewport.height + viewport.offsetTop
      );
      followBottom = nearBottom();
    }
    focused = editing;
    if (
      (!editing && !(inside && keyboardStillOpen)) ||
      Math.abs(viewport.scale - 1) > 0.02 ||
      viewport.height <= 0
    ) {
      clear();
      return;
    }
    element.style.setProperty(
      "--pw-mobile-viewport-height",
      `${viewport.height}px`
    );
    element.style.setProperty(
      "--pw-mobile-viewport-offset",
      `${viewport.offsetTop}px`
    );
    const keyboardOpen = initialHeight - viewport.height > 100;
    element.style.setProperty(
      "--pw-mobile-keyboard-inset",
      `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`
    );
    element.dataset.keyboardOpen = String(keyboardOpen);
    if (keyboardOpen && followBottom && content) {
      content.scrollTop = content.scrollHeight;
    }
  };
  const schedule = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(update);
  };
  const rememberScroll = () => {
    followBottom = nearBottom();
  };
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  window.addEventListener("resize", schedule);
  content?.addEventListener("scroll", rememberScroll, { passive: true });
  schedule();
  return () => {
    window.cancelAnimationFrame(frame);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    content?.removeEventListener("scroll", rememberScroll);
    clear();
  };
}
