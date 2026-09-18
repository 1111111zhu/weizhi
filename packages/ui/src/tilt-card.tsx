"use client";

import {
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { useHoverCapable } from "./hooks/use-hover-capable";
import { SPRING_MOUSE, SPRING_SHADOW } from "./lib/ease";
import { cn } from "./utils";

export interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glare?: boolean;
  max?: number;
}

type TiltValues = {
  glareOpacity: MotionValue<number>;
  glareX: MotionValue<number>;
  glareY: MotionValue<number>;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  shadowStrength: MotionValue<number>;
  shadowX: MotionValue<number>;
  shadowY: MotionValue<number>;
};

export function TiltCard({
  children,
  className,
  glare = true,
  max = 12,
}: TiltCardProps) {
  const reduceMotion = useReducedMotion();
  const canHover = useHoverCapable();
  const { cardRef, glareRef } = useComplementaryTilt(
    max,
    !reduceMotion && canHover
  );

  return (
    <div className={cn("pw-tilt-card", className)} ref={cardRef}>
      {children}
      {glare && !reduceMotion && canHover ? (
        <div aria-hidden="true" className="pw-tilt-card-glare" ref={glareRef} />
      ) : null}
    </div>
  );
}

function useComplementaryTilt(max: number, enabled: boolean) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);
  const shadowX = useMotionValue(0);
  const shadowY = useMotionValue(0);
  const shadowStrength = useMotionValue(0);
  const springRotateX = useSpring(rotateX, SPRING_MOUSE);
  const springRotateY = useSpring(rotateY, SPRING_MOUSE);
  const springGlareX = useSpring(glareX, SPRING_SHADOW);
  const springGlareY = useSpring(glareY, SPRING_SHADOW);
  const springGlareOpacity = useSpring(glareOpacity, SPRING_SHADOW);
  const springShadowX = useSpring(shadowX, SPRING_SHADOW);
  const springShadowY = useSpring(shadowY, SPRING_SHADOW);
  const springShadowStrength = useSpring(shadowStrength, SPRING_SHADOW);
  const transform = useMotionTemplate`perspective(1000px) rotateX(${springRotateX}deg) rotateY(${springRotateY}deg)`;
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${springGlareX}% ${springGlareY}%, var(--foreground), transparent 50%)`;

  useMotionValueEvent(transform, "change", (value) => {
    cardRef.current?.style.setProperty("transform", value);
  });
  useMotionValueEvent(glareBackground, "change", (value) => {
    glareRef.current?.style.setProperty("background", value);
  });
  useMotionValueEvent(springGlareOpacity, "change", (value) => {
    glareRef.current?.style.setProperty("opacity", String(value));
  });
  useMotionValueEvent(springShadowX, "change", (value) => {
    cardRef.current?.style.setProperty("--pw-tilt-shadow-x", `${value}px`);
  });
  useMotionValueEvent(springShadowY, "change", (value) => {
    cardRef.current?.style.setProperty("--pw-tilt-shadow-y", `${value}px`);
  });
  useMotionValueEvent(springShadowStrength, "change", (value) => {
    const strength = Math.max(0, Math.min(18, value));
    cardRef.current?.style.setProperty(
      "--pw-tilt-shadow-strength",
      `${strength}%`
    );
  });

  useEffect(() => {
    const values = {
      glareOpacity,
      glareX,
      glareY,
      rotateX,
      rotateY,
      shadowStrength,
      shadowX,
      shadowY,
    };
    const reset = () => resetTilt(values);
    if (!enabled) {
      reset();
      return;
    }
    const handleMove = (event: globalThis.MouseEvent) => {
      const card = cardRef.current;
      if (!card) {
        return;
      }
      updateTilt(event, card, max, values);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("blur", reset);
    };
  }, [
    enabled,
    glareOpacity,
    glareX,
    glareY,
    max,
    rotateX,
    rotateY,
    shadowStrength,
    shadowX,
    shadowY,
  ]);

  return { cardRef, glareRef };
}

function updateTilt(
  event: globalThis.MouseEvent,
  card: HTMLDivElement,
  max: number,
  values: TiltValues
) {
  const bounds = card.getBoundingClientRect();
  const offsetX = outsideAxis(
    event.clientX,
    bounds.left,
    bounds.right,
    window.innerWidth
  );
  const offsetY = outsideAxis(
    event.clientY,
    bounds.top,
    bounds.bottom,
    window.innerHeight
  );
  values.rotateX.set(-offsetY * max);
  values.rotateY.set(offsetX * max);
  const outside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;
  if (outside) {
    values.glareX.set(((event.clientX - bounds.left) / bounds.width) * 100);
    values.glareY.set(((event.clientY - bounds.top) / bounds.height) * 100);
    values.glareOpacity.set(0.15);
    values.shadowStrength.set(18);
    const nextShadowX = offsetX * 36;
    const nextShadowY = offsetY * 36;
    values.shadowX.set(nextShadowX);
    values.shadowY.set(nextShadowY);
  } else {
    values.glareOpacity.set(0);
    values.shadowStrength.set(0);
    values.shadowX.set(0);
    values.shadowY.set(0);
  }
}

function outsideAxis(
  pointer: number,
  start: number,
  end: number,
  viewportSize: number
) {
  if (pointer < start) {
    return (pointer - start) / Math.max(start, 1);
  }
  if (pointer > end) {
    return (pointer - end) / Math.max(viewportSize - end, 1);
  }
  return 0;
}

function resetTilt(values: TiltValues) {
  values.rotateX.set(0);
  values.rotateY.set(0);
  values.glareOpacity.set(0);
  values.shadowStrength.set(0);
  values.shadowX.set(0);
  values.shadowY.set(0);
}
