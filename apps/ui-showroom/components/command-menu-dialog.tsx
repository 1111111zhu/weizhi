"use client";

import { CornerDownLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

import { BlockItems, NavigationItems, TreeItems } from "./command-menu-content";
import type { CommandMenuDialogProps } from "./command-menu-content";

const CommandMenuFooter = ({
  isMac,
  showGoToPage,
  copyPayload,
}: Pick<CommandMenuDialogProps, "isMac" | "showGoToPage" | "copyPayload">) => (
  <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 overflow-hidden rounded-b-xl border-t border-t-neutral-100 bg-neutral-50 px-4 text-xs font-medium text-muted-foreground dark:border-t-neutral-700 dark:bg-neutral-800">
    <div className="flex shrink-0 items-center gap-2">
      <Kbd className="shrink-0">
        <CornerDownLeftIcon />
      </Kbd>
      {showGoToPage ? (
        <span className="min-w-0 truncate">Go to Page</span>
      ) : null}
    </div>
    {copyPayload ? (
      <>
        <Separator orientation="vertical" className="h-4!" />
        <div className="flex min-w-0 items-center gap-1">
          <Kbd className="shrink-0">{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd className="shrink-0">C</Kbd>
          <span className="min-w-0 truncate">{copyPayload}</span>
        </div>
      </>
    ) : null}
  </div>
);

const CommandMenuTrigger = ({
  isMac,
  buttonProps,
  onOpenClick,
}: Pick<CommandMenuDialogProps, "isMac" | "buttonProps" | "onOpenClick">) => (
  <DialogTrigger asChild nativeButton>
    <Button
      variant="secondary"
      className="relative h-8 w-full justify-start bg-surface pl-2.5 font-normal text-surface-foreground/60 shadow-none sm:pr-12 md:w-40 lg:w-56 xl:w-64 dark:bg-card"
      onClick={onOpenClick}
      {...buttonProps}
    >
      <span className="hidden lg:inline-flex">Search documentation...</span>
      <span className="inline-flex lg:hidden">Search...</span>
      <div className="absolute top-1.5 right-1.5 hidden gap-1 sm:flex">
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd className="aspect-square">K</Kbd>
      </div>
    </Button>
  </DialogTrigger>
);

const CommandMenuResults = ({
  blocks,
  navItems,
  treeGroups,
  onNavigate,
  onDocPageHighlight,
  onBlockHighlight,
  onNavHighlight,
  onFilter,
}: Pick<
  CommandMenuDialogProps,
  | "blocks"
  | "navItems"
  | "treeGroups"
  | "onNavigate"
  | "onDocPageHighlight"
  | "onBlockHighlight"
  | "onNavHighlight"
  | "onFilter"
>) => (
  <Command
    className="rounded-none bg-transparent **:data-[slot=command-input]:h-9! **:data-[slot=command-input]:py-0 **:data-[slot=command-input-wrapper]:mb-0 **:data-[slot=command-input-wrapper]:h-9! **:data-[slot=command-input-wrapper]:rounded-md **:data-[slot=command-input-wrapper]:border **:data-[slot=command-input-wrapper]:border-input **:data-[slot=command-input-wrapper]:bg-input/50"
    filter={onFilter}
  >
    <CommandInput placeholder="Search documentation..." />
    <CommandList className="no-scrollbar min-h-80 scroll-pt-2 scroll-pb-1.5">
      <CommandEmpty className="py-12 text-center text-sm text-muted-foreground">
        No results found.
      </CommandEmpty>
      {navItems.length ? (
        <NavigationItems
          navItems={navItems}
          onHighlight={onNavHighlight}
          onNavigate={onNavigate}
        />
      ) : null}
      <TreeItems
        treeGroups={treeGroups}
        onHighlight={onDocPageHighlight}
        onNavigate={onNavigate}
      />
      <BlockItems
        blocks={blocks}
        onHighlight={onBlockHighlight}
        onNavigate={onNavigate}
      />
    </CommandList>
  </Command>
);

const CommandMenuBody = ({
  blocks,
  navItems,
  treeGroups,
  isMac,
  showGoToPage,
  copyPayload,
  onNavigate,
  onDocPageHighlight,
  onBlockHighlight,
  onNavHighlight,
  onFilter,
}: Omit<
  CommandMenuDialogProps,
  "open" | "onOpenChange" | "onOpenClick" | "buttonProps"
>) => (
  <DialogContent
    showCloseButton={false}
    className="rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl ring-4 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800"
  >
    <DialogHeader className="sr-only">
      <DialogTitle>Search documentation...</DialogTitle>
      <DialogDescription>Search for a command to run...</DialogDescription>
    </DialogHeader>
    <CommandMenuResults
      blocks={blocks}
      navItems={navItems}
      treeGroups={treeGroups}
      onNavigate={onNavigate}
      onDocPageHighlight={onDocPageHighlight}
      onBlockHighlight={onBlockHighlight}
      onNavHighlight={onNavHighlight}
      onFilter={onFilter}
    />
    <CommandMenuFooter
      isMac={isMac}
      showGoToPage={showGoToPage}
      copyPayload={copyPayload}
    />
  </DialogContent>
);

const CommandMenuDialog = ({
  open,
  onOpenChange,
  ...props
}: CommandMenuDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange} sounds>
    <CommandMenuTrigger {...props} />
    <CommandMenuBody {...props} />
  </Dialog>
);

export { CommandMenuDialog };
