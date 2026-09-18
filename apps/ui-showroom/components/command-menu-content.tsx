"use client";

import {
  ArrowRightIcon,
  CircleDashedIcon,
  SquareDashedIcon,
} from "lucide-react";
import { useRef } from "react";

import type { Button } from "@/components/ui/button";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

export type CommandBlock = {
  name: string;
  description: string;
  categories: string[];
};

export type TreeGroup = {
  label: string;
  pages: { url: string; name: string }[];
};

type DocUrlKind =
  | { kind: "theme"; slug: string }
  | { kind: "component"; slug: string }
  | { kind: "template"; slug: string }
  | { kind: "page" };

const GROUP_HEADING_CLS =
  "!p-0 [&_[cmdk-group-heading]]:scroll-mt-16 [&_[cmdk-group-heading]]:!p-3 [&_[cmdk-group-heading]]:!pb-1";

const parseDocPageUrl = (url: string): DocUrlKind => {
  const parts = url.split("/").filter(Boolean);
  const themesIdx = parts.indexOf("themes");
  if (themesIdx !== -1 && parts[themesIdx + 1]) {
    return { kind: "theme", slug: parts[themesIdx + 1] };
  }
  const componentsIdx = parts.indexOf("components");
  if (componentsIdx !== -1 && parts[componentsIdx + 1]) {
    return { kind: "component", slug: parts.at(-1) ?? "" };
  }
  const templatesIdx = parts.indexOf("templates");
  if (templatesIdx !== -1 && parts[templatesIdx + 1]) {
    return { kind: "template", slug: parts.at(-1) ?? "" };
  }
  return { kind: "page" };
};

const buildDocPageKeywords = (
  parsed: DocUrlKind,
  url: string,
  breadcrumb: string[]
): string[] => {
  const urlKeywords = url
    .split("/")
    .filter(Boolean)
    .flatMap((segment) =>
      segment.includes("-") ? [segment, ...segment.split("-")] : [segment]
    );
  return [
    ...(parsed.kind === "page" ? [] : [parsed.kind]),
    ...breadcrumb.filter(Boolean).flatMap((s) => [s, s.toLowerCase()]),
    ...urlKeywords,
  ];
};

const DocPageLeadingIcon = ({ parsed }: { parsed: DocUrlKind }) => {
  if (parsed.kind === "component") {
    return <CircleDashedIcon />;
  }
  if (parsed.kind === "template") {
    return <SquareDashedIcon />;
  }
  return <ArrowRightIcon />;
};

const CommandMenuItem = ({
  children,
  className,
  onHighlight,
  ...props
}: React.ComponentProps<typeof CommandItem> & {
  onHighlight?: () => void;
  "data-selected"?: string;
  "aria-selected"?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useMutationObserver(ref, (mutations) => {
    if (
      mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          mutation.attributeName === "aria-selected"
      ) &&
      ref.current?.getAttribute("aria-selected") === "true"
    ) {
      onHighlight?.();
    }
  });
  return (
    <CommandItem
      ref={ref}
      className={cn(
        "data-[selected=true]:border-input data-[selected=true]:bg-input/50 h-9 rounded-md border border-transparent px-3! font-medium",
        className
      )}
      {...props}
    >
      {children}
    </CommandItem>
  );
};

const DocPageItem = ({
  title,
  url,
  breadcrumb,
  onHighlight,
  onNavigate,
}: {
  title: string;
  url: string;
  breadcrumb: string[];
  onHighlight: (item: { url: string; name?: string }) => void;
  onNavigate: (url: string) => void;
}) => {
  const parsed = parseDocPageUrl(url);
  return (
    <CommandMenuItem
      key={url}
      keywords={buildDocPageKeywords(parsed, url, breadcrumb)}
      value={[...breadcrumb, title].filter(Boolean).join(" ")}
      onHighlight={() => onHighlight({ name: title, url })}
      onSelect={() => onNavigate(url)}
    >
      <DocPageLeadingIcon parsed={parsed} />
      {title}
    </CommandMenuItem>
  );
};

const NavigationItems = ({
  navItems,
  onHighlight,
  onNavigate,
}: Pick<CommandMenuDialogProps, "navItems" | "onNavigate"> & {
  onHighlight: () => void;
}) => (
  <CommandGroup heading="Pages" className={GROUP_HEADING_CLS}>
    {navItems.map((item) => (
      <CommandMenuItem
        key={item.href}
        value={`Navigation ${item.label}`}
        keywords={["nav", "navigation", item.label.toLowerCase()]}
        onHighlight={onHighlight}
        onSelect={() => onNavigate(item.href)}
      >
        <ArrowRightIcon />
        {item.label}
      </CommandMenuItem>
    ))}
  </CommandGroup>
);

const TreeItems = ({
  treeGroups,
  onHighlight,
  onNavigate,
}: Pick<CommandMenuDialogProps, "treeGroups" | "onNavigate"> & {
  onHighlight: (item: { url: string; name?: string }) => void;
}) => (
  <>
    {treeGroups.map((group) => (
      <CommandGroup
        key={group.label}
        className={GROUP_HEADING_CLS}
        heading={group.label}
      >
        {group.pages.map((page) => (
          <DocPageItem
            key={page.url}
            title={page.name}
            url={page.url}
            breadcrumb={[group.label]}
            onHighlight={onHighlight}
            onNavigate={onNavigate}
          />
        ))}
      </CommandGroup>
    ))}
  </>
);

const BlockItems = ({
  blocks,
  onHighlight,
  onNavigate,
}: Pick<CommandMenuDialogProps, "blocks" | "onNavigate"> & {
  onHighlight: (block: CommandBlock) => void;
}) =>
  blocks?.length ? (
    <CommandGroup
      heading="Blocks"
      className="p-0! **:[[cmdk-group-heading]]:p-3!"
    >
      {blocks.map((block) => (
        <CommandMenuItem
          key={block.name}
          value={block.name}
          onHighlight={() => onHighlight(block)}
          keywords={[
            "block",
            block.name,
            block.description,
            ...block.categories,
          ]}
          onSelect={() =>
            onNavigate(`/blocks/${block.categories[0]}#${block.name}`)
          }
        >
          <SquareDashedIcon />
          {block.description}
          <span className="ml-auto font-mono text-xs font-normal text-muted-foreground tabular-nums">
            {block.name}
          </span>
        </CommandMenuItem>
      ))}
    </CommandGroup>
  ) : null;

export type CommandMenuDialogProps = {
  blocks?: CommandBlock[];
  navItems: { href: string; label: string }[];
  treeGroups: TreeGroup[];
  isMac: boolean;
  open: boolean;
  showGoToPage: boolean;
  copyPayload: string;
  buttonProps: React.ComponentProps<typeof Button>;
  onOpenChange: (open: boolean) => void;
  onOpenClick: () => void;
  onNavigate: (url: string) => void;
  onDocPageHighlight: (item: { url: string; name?: string }) => void;
  onBlockHighlight: (block: CommandBlock) => void;
  onNavHighlight: () => void;
  onFilter: (value: string, search: string, keywords?: string[]) => number;
};

export { NavigationItems, TreeItems, BlockItems };
