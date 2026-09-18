"use client";

import { CopyButton } from "@/components/copy-button";
import { getIconForPackageManager } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PackageManager } from "@/hooks/use-package-manager";
import type { Event } from "@/lib/events";
import { cn } from "@/lib/utils";

type CommandTabs = Record<PackageManager, string | undefined>;

const CommandTabsHeader = ({
  commandTabs,
  packageManager,
}: {
  commandTabs: CommandTabs;
  packageManager: PackageManager;
}) => (
  <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1">
    <TabsList className="rounded-none bg-transparent p-0 [&_svg]:me-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {getIconForPackageManager(packageManager)}
      {Object.entries(commandTabs).map(([key]) => (
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

const CommandTabsContent = ({ commandTabs }: { commandTabs: CommandTabs }) => (
  <div className="no-scrollbar overflow-x-auto">
    {Object.entries(commandTabs).map(([key, value]) => (
      <TabsContent key={key} className="mt-0 px-4 py-3.5" value={key}>
        <pre>
          <code
            data-slot="code-block"
            data-language="bash"
            className="font-mono text-sm/none"
          >
            <span className="select-none">$ </span>
            {value}
          </code>
        </pre>
      </TabsContent>
    ))}
  </div>
);

export const CodeBlockCommandLayout = ({
  commandTabs,
  packageManager,
  onPackageManagerChange,
  copyValue,
  copyEvent,
  className,
}: {
  commandTabs: CommandTabs;
  packageManager: PackageManager;
  onPackageManagerChange: (value: string) => void;
  copyValue: string;
  copyEvent: Event["name"];
  className?: string;
}) => (
  <div
    className={cn(
      "bg-code text-code-foreground relative overflow-hidden rounded-lg text-sm",
      className
    )}
  >
    <Tabs
      className="gap-0"
      onValueChange={onPackageManagerChange}
      value={packageManager}
    >
      <CommandTabsHeader
        commandTabs={commandTabs}
        packageManager={packageManager}
      />
      <CommandTabsContent commandTabs={commandTabs} />
    </Tabs>
    <CopyButton
      className="absolute top-2 right-2 z-10 size-7 opacity-70 hover:opacity-100 focus-visible:opacity-100"
      value={copyValue}
      event={copyEvent}
    />
  </div>
);
