import type { Ref } from "react";

export type ProgressProps = {
  label: string;
  value?: number | null;
  max?: number;
  ref?: Ref<HTMLProgressElement>;
};
export function Progress({ label, value, max = 100, ref }: ProgressProps) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const amount =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(limit, Math.max(0, value))
      : undefined;
  return (
    <progress
      ref={ref}
      aria-label={label}
      max={limit}
      value={amount}
      data-slot="progress"
      className="accent-primary [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary h-2 w-full overflow-hidden rounded-full"
    />
  );
}
