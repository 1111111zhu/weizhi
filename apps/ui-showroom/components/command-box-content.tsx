"use client";

import { motion } from "motion/react";
import { useRef } from "react";

import { CopyButton } from "@/components/copy-button";
import { getIconForPackageManager } from "@/components/icons";
import { RegistryAddButton } from "@/components/registry-add-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextFlip } from "@/components/ui/text-flip";
import { SITE } from "@/constants/site";
import type { PackageManager } from "@/hooks/use-package-manager";
import { usePackageManager } from "@/hooks/use-package-manager";
import { cn, registryItemUrl } from "@/lib/utils";
import registry from "@/registry.json";

const PM_COMMANDS = {
  bun: "bunx --bun",
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn",
};

const REGISTRY_ITEM_NAMES = registry.items
  .map((item) => item.name)
  .toSorted((a, b) =>
    a.localeCompare(b, "en", {
      sensitivity: "base",
    })
  );

const CommandBoxTabList = ({
  packageManager,
}: {
  packageManager: PackageManager;
}) => (
  <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1">
    <TabsList className="rounded-none bg-transparent p-0 [&_svg]:me-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {getIconForPackageManager(packageManager)}
      {Object.entries(PM_COMMANDS).map(([key]) => (
        <TabsTrigger
          key={key}
          className="h-7 border border-transparent pt-0.5 data-[state=active]:border-input data-[state=active]:shadow-none"
          sound="tabSwitch"
          value={key}
        >
          {key}
        </TabsTrigger>
      ))}
    </TabsList>
  </div>
);

const CommandBoxPreview = ({
  onIndexChange,
}: {
  onIndexChange: (index: number) => void;
}) => (
  <pre className="-translate-y-px px-4 py-3.5">
    <code
      data-language="bash"
      className="block text-left font-mono text-sm text-muted-foreground max-sm:leading-6"
    >
      {Object.entries(PM_COMMANDS).map(([key, command]) => (
        <TabsContent key={key} value={key} asChild>
          <span className="block sm:inline-block">
            <span className="select-none">$ </span>
            {command} shadcn add{" "}
            <span className="select-none sm:hidden" aria-hidden="true">
              \
            </span>
          </span>
        </TabsContent>
      ))}
      <span>{SITE.REGISTRY_ITEMS}/</span>
      <TextFlip
        className="text-foreground"
        as={motion.span}
        variants={{
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 12 },
          initial: { opacity: 0, y: -12 },
        }}
        interval={1.5}
        onIndexChange={onIndexChange}
      >
        {REGISTRY_ITEM_NAMES}
      </TextFlip>
      <span>.json</span>
    </code>
  </pre>
);

const CommandBoxTabs = ({
  packageManager,
  onPackageManagerChange,
  onIndexChange,
}: {
  packageManager: PackageManager;
  onPackageManagerChange: (value: string) => void;
  onIndexChange: (index: number) => void;
}) => (
  <Tabs
    className="gap-0"
    onValueChange={onPackageManagerChange}
    value={packageManager}
  >
    <CommandBoxTabList packageManager={packageManager} />
    <CommandBoxPreview onIndexChange={onIndexChange} />
  </Tabs>
);

const CommandBoxLayout = ({ className }: { className?: string }) => {
  const [packageManager, setPackageManager] = usePackageManager();
  const currentItemRef = useRef(REGISTRY_ITEM_NAMES[0]);

  return (
    <div
      className={cn(
        "bg-code text-code-foreground relative overflow-hidden rounded-lg text-sm",
        className
      )}
    >
      <CommandBoxTabs
        packageManager={packageManager}
        onPackageManagerChange={(value) =>
          setPackageManager(value as PackageManager)
        }
        onIndexChange={(index) => {
          currentItemRef.current = REGISTRY_ITEM_NAMES[index];
        }}
      />
      <RegistryAddButton
        registry={SITE.REGISTRY}
        className="absolute top-2 right-10 z-10 h-7 w-7 gap-1.5 border-none px-2 opacity-70 hover:opacity-100 focus-visible:opacity-100 sm:w-auto [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5"
        variant="ghost"
        size="sm"
      />
      <CopyButton
        className="absolute top-2 right-2 z-10 size-7 opacity-70 hover:opacity-100 focus-visible:opacity-100"
        value={() =>
          `${PM_COMMANDS[packageManager]} shadcn@latest add ${registryItemUrl(currentItemRef.current)}`
        }
        event="copy_npm_command"
      />
    </div>
  );
};

export const CommandBoxContent = ({ className }: { className?: string }) => (
  <CommandBoxLayout className={className} />
);
