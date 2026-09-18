"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { ComponentPropsWithoutRef } from "react";

export const EmpHomeSearchShell = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>((props, ref) => {
  const element = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => {
    const node = element.current;
    if (!node) {
      throw new Error("EmpHomeSearchShell ref is not available");
    }
    return node;
  }, []);
  useLayoutEffect(() => {
    const search = element.current;
    search?.style.removeProperty("visibility");
    search?.style.removeProperty("opacity");
    search?.style.removeProperty("clip-path");
    if (
      !search ||
      typeof search.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const animation = search.animate(
      [
        { clipPath: "inset(0 50% round 999px)", opacity: 0 },
        { clipPath: "inset(0 0% round 999px)", opacity: 1 },
      ],
      {
        duration: 300,
        easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        fill: "both",
      }
    );
    animation.pause();
    // Cached routes reactivate before their restored layout is painted.
    let idle: number | undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === "function") {
          idle = window.requestIdleCallback(() => animation.play(), {
            timeout: 500,
          });
        } else {
          animation.play();
        }
      });
    });
    void animation.finished.then(
      () => animation.cancel(),
      () => {}
    );
    return () => {
      cancelAnimationFrame(frame);
      if (idle !== undefined) {
        window.cancelIdleCallback(idle);
      }
      animation.cancel();
    };
  }, []);
  return <div ref={element} {...props} />;
});

EmpHomeSearchShell.displayName = "EmpHomeSearchShell";
