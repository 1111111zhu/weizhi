"use client";

import { Badge } from "@/registry/new-york/badge";

export function BadgeDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-6">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  );
}
