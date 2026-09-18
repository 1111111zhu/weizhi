"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CodeCollapsibleNavTrigger = ({
  isOpened,
  className,
}: {
  isOpened: boolean;
  className?: string;
}) => (
  <CollapsibleTrigger asChild>
    <div
      className={cn(
        "absolute top-1.5 right-9 z-10 flex items-center",
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-md px-2 text-muted-foreground"
      >
        {isOpened ? "Collapse" : "Expand"}
      </Button>
      <Separator orientation="vertical" className="mx-1.5 h-4!" />
    </div>
  </CollapsibleTrigger>
);

const CodeCollapsibleExpandTrigger = () => (
  <div className="absolute inset-x-0 -bottom-2 flex h-20 items-center justify-center rounded-b-lg bg-linear-to-b from-code/70 to-code group-data-[state=open]/collapsible:hidden">
    <CollapsibleTrigger asChild>
      <Button variant="outline" size="sm">
        Expand
      </Button>
    </CollapsibleTrigger>
  </div>
);

export const CodeCollapsibleWrapper = ({
  className,
  children,
  navTriggerClassName,
  ...props
}: React.ComponentProps<typeof Collapsible> & {
  navTriggerClassName?: string;
}) => {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <Collapsible
      sounds
      open={isOpened}
      onOpenChange={setIsOpened}
      className={cn("group/collapsible relative md:-mx-1", className)}
      {...props}
    >
      <CodeCollapsibleNavTrigger
        isOpened={isOpened}
        className={navTriggerClassName}
      />
      <CollapsibleContent
        forceMount
        className="relative mt-6 overflow-hidden data-[state=closed]:max-h-64 data-[state=closed]:[content-visibility:auto] [&>figure]:mt-0 [&>figure]:md:mx-0!"
      >
        {children}
      </CollapsibleContent>

      <CodeCollapsibleExpandTrigger />
    </Collapsible>
  );
};
