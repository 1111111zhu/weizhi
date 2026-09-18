import type { ComponentProps } from "react";

const MICROSOFT_PERSONA_COLOR_COUNT = 20;
const MICROSOFT_PERSONA_DEFAULT_COLOR_INDEX = 1;
const MICROSOFT_PERSONA_HASH_WIDTH = 8;

export function ProjectWingTopBarAvatar({
  label,
  name,
  size = "md",
  className,
  ...props
}: {
  label: string;
  name: string;
  size?: "xs" | "compact" | "sm" | "md";
  className?: string;
} & Omit<ComponentProps<"span">, "aria-label" | "children" | "className">) {
  const tone = getProjectWingTopBarAvatarTone(name);
  const classes = [
    "project-wing-top-bar-avatar",
    `project-wing-top-bar-avatar--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      {...props}
      aria-label={label}
      className={classes}
      data-avatar-tone={tone}
      role="img"
    >
      {getAvatarInitials(name)}
    </span>
  );
}

/**
 * Mirrors Microsoft Fluent UI's PersonaInitialsColor name-hash algorithm.
 */
export function getProjectWingTopBarAvatarTone(name: string) {
  if (!name) {
    return MICROSOFT_PERSONA_DEFAULT_COLOR_INDEX;
  }

  let hashCode = 0;
  for (let index = name.length - 1; index >= 0; index -= 1) {
    const characterCode = name.codePointAt(index) ?? 0;
    const shift = index % MICROSOFT_PERSONA_HASH_WIDTH;
    hashCode ^=
      (characterCode << shift) +
      (characterCode >> (MICROSOFT_PERSONA_HASH_WIDTH - shift));
  }

  return hashCode % MICROSOFT_PERSONA_COLOR_COUNT;
}

function getAvatarInitials(name: string) {
  const words = getAvatarWords(name);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return [...words[0]].slice(0, 2).join("").toUpperCase();
  }
  return `${[...(words[0] ?? "")][0]}${[...(words.at(-1) ?? "")][0]}`.toUpperCase();
}

function getAvatarWords(name: string) {
  const trimmed = name.trim();
  const atIndex = trimmed.indexOf("@");
  const displayName = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  return displayName.match(/[\p{L}\p{N}]+/gu) ?? [];
}
