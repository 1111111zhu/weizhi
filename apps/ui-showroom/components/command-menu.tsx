"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { useCallback } from "react";

import { useCommandMenuController } from "@/components/command-menu-controller";
import { CommandMenuDialog } from "@/components/command-menu-dialog";
import type { Button } from "@/components/ui/button";
import { useIsMac } from "@/hooks/use-is-mac";
import { usePackageManager } from "@/hooks/use-package-manager";

const handleFilter = (
  value: string,
  search: string,
  keywords?: string[]
): number => {
  const extendedValue = `${value} ${keywords?.join(" ") || ""}`;
  return extendedValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
};

export const CommandMenu = ({
  blocks,
  navItems,
  tree,
  ...props
}: React.ComponentProps<typeof Button> & {
  blocks?: { name: string; description: string; categories: string[] }[];
  navItems: { href: string; label: string }[];
  tree: PageTreeRoot;
}) => {
  const isMac = useIsMac();
  const [packageManager] = usePackageManager();
  const controller = useCommandMenuController({ tree, packageManager });
  const handleCommandFilter = useCallback(
    (value: string, search: string, keywords?: string[]) =>
      handleFilter(value, search, keywords),
    []
  );

  return (
    <CommandMenuDialog
      blocks={blocks}
      navItems={navItems}
      treeGroups={controller.treeGroups}
      isMac={isMac}
      open={controller.open}
      showGoToPage={controller.showGoToPage}
      copyPayload={controller.copyPayload}
      buttonProps={props}
      onOpenChange={controller.handleOpenChange}
      onOpenClick={controller.handleOpenClick}
      onNavigate={controller.handleNavigate}
      onDocPageHighlight={controller.handleDocPageHighlight}
      onBlockHighlight={controller.handleBlockHighlight}
      onNavHighlight={controller.handleNavHighlight}
      onFilter={handleCommandFilter}
    />
  );
};
