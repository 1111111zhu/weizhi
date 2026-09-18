"use client";

import { ArrowRight, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/registry/new-york/button";

export function ButtonDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 p-6">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">
        <Trash2 className="size-4" /> Destructive
      </Button>
      <Button size="sm">
        <Sparkles className="size-3.5" /> Small
      </Button>
      <Button size="lg">
        Large <ArrowRight className="size-4" />
      </Button>
      <Button tooltip="Helpful tooltip on hover">With Tooltip</Button>
    </div>
  );
}
