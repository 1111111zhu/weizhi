"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

const INITIAL_DIMENSION = { width: 160, height: 160 } as const;

export function ChartContainer({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"div"> & {
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
  label: React.ReactNode;
}) {
  const chartId = `chart-${React.useId().replaceAll(":", "")}`;

  return (
    <div
      aria-label={typeof label === "string" ? label : undefined}
      data-chart={chartId}
      data-slot="chart"
      className={cn(
        "flex justify-center text-xs [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden",
        className
      )}
      {...props}
    >
      <RechartsPrimitive.ResponsiveContainer
        initialDimension={INITIAL_DIMENSION}
      >
        {children}
      </RechartsPrimitive.ResponsiveContainer>
    </div>
  );
}
