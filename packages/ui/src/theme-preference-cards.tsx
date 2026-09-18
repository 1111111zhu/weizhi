"use client";

import { Check } from "lucide-react";
import { useId } from "react";

export type ThemePreference = "system" | "light" | "dark";

export function ThemePreferenceCards({
  value,
  onValueChange,
  label,
  labels,
  disabled = false,
}: {
  value: ThemePreference;
  onValueChange: (value: ThemePreference) => void;
  label: string;
  labels: Record<ThemePreference, string>;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset
      aria-label={label}
      disabled={disabled}
      className="m-0 grid min-w-0 grid-cols-3 gap-3 border-0 p-0 sm:gap-4"
    >
      {(["system", "light", "dark"] as const).map((theme) => (
        <label
          key={theme}
          className="group relative min-w-0 cursor-pointer has-disabled:cursor-default has-disabled:opacity-50"
        >
          <input
            className="peer sr-only"
            type="radio"
            name={name}
            value={theme}
            checked={value === theme}
            onChange={() => onValueChange(theme)}
          />
          <span className="border-border bg-muted group-hover:border-muted-foreground/50 peer-checked:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background relative block overflow-hidden rounded-xl border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2">
            <ThemeThumbnail theme={theme} />
            {value === theme ? (
              <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-5 items-center justify-center rounded-full"
              >
                <Check className="size-3.5" />
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground peer-checked:text-foreground mt-2 block text-center text-sm peer-checked:font-medium">
            {labels[theme]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function ThemeThumbnail({ theme }: { theme: ThemePreference }) {
  const clipId = useId();
  const scene = (dark: boolean) => (
    <>
      <rect
        width="240"
        height="150"
        className={dark ? "fill-neutral-800" : "fill-neutral-100"}
      />
      <rect
        x="19"
        y="24"
        width="54"
        height="7"
        rx="3.5"
        className={dark ? "fill-neutral-600" : "fill-neutral-300"}
      />
      <rect
        x="88"
        y="25"
        width="126"
        height="6"
        rx="3"
        className={dark ? "fill-neutral-500" : "fill-neutral-300"}
      />
      <rect
        x="16"
        y="44"
        width="208"
        height="122"
        rx="9"
        className={dark ? "fill-neutral-700" : "fill-white"}
      />
      <rect
        x="16"
        y="44"
        width="51"
        height="122"
        rx="9"
        className={dark ? "fill-neutral-900" : "fill-neutral-200"}
      />
      <rect
        x="24"
        y="57"
        width="34"
        height="6"
        rx="3"
        className={dark ? "fill-neutral-600" : "fill-neutral-400"}
      />
      <rect
        x="24"
        y="75"
        width="26"
        height="5"
        rx="2.5"
        className={dark ? "fill-neutral-700" : "fill-neutral-300"}
      />
      <rect
        x="24"
        y="91"
        width="30"
        height="5"
        rx="2.5"
        className={dark ? "fill-neutral-700" : "fill-neutral-300"}
      />
      {[59, 92, 125].map((y) => (
        <g key={y}>
          <rect
            x="80"
            y={y}
            width="60"
            height="7"
            rx="3.5"
            className={dark ? "fill-neutral-400" : "fill-neutral-300"}
          />
          <rect
            x="80"
            y={y + 13}
            width="118"
            height="4"
            rx="2"
            className={dark ? "fill-neutral-600" : "fill-neutral-100"}
          />
        </g>
      ))}
    </>
  );
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 150"
      className="block w-full"
    >
      {theme === "system" ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="120" width="120" height="150" />
            </clipPath>
          </defs>
          {scene(false)}
          <g clipPath={`url(#${clipId})`}>{scene(true)}</g>
        </>
      ) : (
        scene(theme === "dark")
      )}
    </svg>
  );
}
