"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const useSurfaceLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type SurfaceTransitionVariant = "fade" | "content" | "page";

export type SurfaceTransitionOptions = {
  /** Run the transition after the first mount as well as on identity changes. */
  initial?: boolean;
  /** Content surfaces use a slower opacity-only transition on identity changes. */
  variant?: SurfaceTransitionVariant;
  /** Animate the route content below its fixed top bar instead of the whole shell. */
  target?: "self" | "route-content";
};

// Animate the existing surface without remounting forms or document viewers.
export function useSurfaceTransition<T extends HTMLElement>(
  identity: string,
  options: SurfaceTransitionOptions = {}
) {
  const ref = useRef<T>(null);
  const previousIdentity = useRef(identity);
  const initial = options.initial ?? false;
  const variant = options.variant ?? "fade";
  const target = options.target ?? "self";

  useSurfaceLayoutEffect(() => {
    const isInitial = previousIdentity.current === identity;
    if (isInitial && !initial) {
      return;
    }
    previousIdentity.current = identity;
    const element = ref.current;
    if (!element || typeof window.matchMedia !== "function") {
      return;
    }
    const animationTargets =
      target === "route-content"
        ? getRouteContentTargets(element)
        : typeof element.animate === "function"
          ? [element]
          : [];
    if (!animationTargets.length) {
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const computedStyle = getComputedStyle(animationTargets[0]);
    const contentMotion = variant === "content";
    const pageMotion = variant === "page";
    const duration = reducedMotion.matches
      ? 120
      : contentMotion
        ? 500
        : pageMotion
          ? 240
          : Number(computedStyle.getPropertyValue("--motion-normal")) || 160;
    const easing = contentMotion
      ? "cubic-bezier(0.25, 0.1, 0.25, 1)"
      : pageMotion
        ? computedStyle.getPropertyValue("--emp-motion-ease").trim() ||
          computedStyle.getPropertyValue("--motion-ease").trim() ||
          "ease-out"
        : computedStyle.getPropertyValue("--motion-ease").trim() ||
          computedStyle.getPropertyValue("--emp-motion-ease").trim() ||
          "ease-out";
    const keyframes =
      reducedMotion.matches || contentMotion || pageMotion
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0.65 }, { opacity: 1 }];
    const animations = animationTargets.map((targetElement) =>
      targetElement.animate(keyframes, { duration, easing })
    );
    const cancel = () => animations.forEach((animation) => animation.cancel());
    reducedMotion.addEventListener("change", cancel);
    return () => {
      cancel();
      reducedMotion.removeEventListener("change", cancel);
    };
  }, [identity, initial, target, variant]);

  return ref;
}

function getRouteContentTargets(element: HTMLElement) {
  const header = element.querySelector<HTMLElement>(
    '[data-slot="project-wing-top-bar"], :scope > header'
  );
  if (!header?.parentElement) {
    return typeof element.animate === "function" ? [element] : [];
  }
  const siblings = [...header.parentElement.children];
  const headerIndex = siblings.indexOf(header);
  return siblings
    .slice(headerIndex + 1)
    .filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && typeof child.animate === "function"
    );
}
