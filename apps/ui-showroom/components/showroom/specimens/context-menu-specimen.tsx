"use client";

import {
  CopyIcon,
  MoreHorizontalIcon,
  PinIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { SpecimenSection } from "./specimen-section";

function ContextMenuActions({
  onPinnedChange,
  pinned,
}: {
  onPinnedChange: (checked: boolean) => void;
  pinned: boolean;
}) {
  return (
    <ContextMenuContent className="w-56">
      <ContextMenuGroup>
        <ContextMenuItem>
          <CopyIcon /> Copy project link
          <ContextMenuShortcut>⌘L</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuCheckboxItem
          checked={pinned}
          onCheckedChange={onPinnedChange}
        >
          <PinIcon /> Pin project
        </ContextMenuCheckboxItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <MoreHorizontalIcon /> More actions
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-44">
          <ContextMenuItem>Duplicate</ContextMenuItem>
          <ContextMenuItem disabled>Move to archive</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">
        <Trash2Icon /> Delete project
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

export function ContextMenuSpecimen() {
  const [pinned, setPinned] = useState(false);

  return (
    <SpecimenSection
      description="A real right-click menu using the showroom wrapper, including checkbox state, shortcut hints, submenu, disabled, and destructive items."
      id="context-menu-specimen"
      source={{
        scope: "showroom",
        library: "@/components/ui/context-menu",
        detail: "Base UI wrapper",
      }}
      state={pinned ? "Pinned" : "Not pinned"}
      title="ContextMenu"
    >
      <ContextMenu>
        <ContextMenuTrigger className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Right-click this project row
        </ContextMenuTrigger>
        <ContextMenuActions onPinnedChange={setPinned} pinned={pinned} />
      </ContextMenu>
    </SpecimenSection>
  );
}
