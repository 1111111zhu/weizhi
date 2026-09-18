"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The percent variant is copied from beUI's official Loader component.
 * Source: https://beui.dev/components/motion/loader
 */
export type LoaderProps = {
  size?: number;
  speed?: number;
  label?: string;
  className?: string;
};

export function Loader({
  size = 40,
  speed = 1,
  label = "Loading",
  className,
}: LoaderProps) {
  return (
    <output
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center text-foreground",
        className
      )}
    >
      <Percent size={size} speed={speed} />
      <span className="sr-only">{label}</span>
    </output>
  );
}

function Percent({ size, speed }: { size: number; speed: number }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const duration = speed * 1000;
    const start = { elapsed: 0 };
    const tickMs = 40;
    const id = window.setInterval(() => {
      start.elapsed += tickMs;
      const next = Math.min(100, Math.round((start.elapsed / duration) * 100));
      setPercent(next);
      if (next >= 100) {
        start.elapsed = 0;
      }
    }, tickMs);

    return () => window.clearInterval(id);
  }, [speed]);

  return (
    <span
      className="flex min-w-max flex-col items-center"
      style={{ gap: size * 0.14, width: size * 1.4 }}
    >
      <span
        className="font-mono font-medium whitespace-nowrap tabular-nums"
        style={{ fontSize: size * 0.42, lineHeight: 1 }}
      >
        {percent}%
      </span>
      <span
        className="w-full overflow-hidden rounded-full bg-current/15"
        style={{ height: Math.max(3, size * 0.1) }}
      >
        <span
          className="block h-full rounded-full bg-current"
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  );
}
