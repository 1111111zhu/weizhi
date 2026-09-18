"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { cn } from "../lib/utils";

const AVATAR_COLOR_CLASSES = [
  "bg-[var(--brand-tint)] text-primary",
  "bg-[var(--brand-tint)] text-success",
  "bg-destructive/10 text-destructive",
  "bg-[color-mix(in_srgb,var(--color-sky-500)_16%,var(--card))] text-[var(--color-sky-600)] dark:text-[var(--color-sky-300)]",
  "bg-[color-mix(in_srgb,var(--color-violet-500)_16%,var(--card))] text-[var(--color-violet-600)] dark:text-[var(--color-violet-300)]",
  "bg-[color-mix(in_srgb,var(--color-amber-500)_16%,var(--card))] text-[var(--color-amber-600)] dark:text-[var(--color-amber-300)]",
  "bg-[color-mix(in_srgb,var(--color-teal-500)_16%,var(--card))] text-[var(--color-teal-600)] dark:text-[var(--color-teal-300)]",
  "bg-[color-mix(in_srgb,var(--color-yellow-500)_16%,var(--card))] text-[var(--color-yellow-600)] dark:text-[var(--color-yellow-300)]",
];

export function HeaderAvatar({
  className,
  name,
  label,
}: {
  className?: string;
  name: string;
  label: string;
}) {
  const initials = getAvatarInitials(name);
  const avatarRoleProps = { role: "img" as const };

  return (
    <Avatar
      {...avatarRoleProps}
      label={label}
      className={cn(
        "size-8 shadow-sm",
        getAvatarColorClassName(name),
        className
      )}
      size="default"
    >
      <AvatarFallback className="bg-transparent text-[0.75rem] leading-none font-bold text-inherit">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function getAvatarInitials(name: string) {
  const words = getAvatarWords(name);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return [...words[0]].slice(0, 2).join("").toUpperCase();
  }

  return [words[0], words[words.length - 1]]
    .map((word) => [...word][0])
    .join("")
    .toUpperCase();
}

export function getAvatarColorClassName(name: string) {
  return AVATAR_COLOR_CLASSES[
    getStableNameHash(name) % AVATAR_COLOR_CLASSES.length
  ];
}

function getAvatarWords(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return [];
  }

  const atIndex = trimmed.indexOf("@");
  const displayName = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;

  return displayName.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function getStableNameHash(name: string) {
  let hash = 0;

  for (const character of name.trim().toLowerCase()) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return hash;
}
