"use client";

import Link from "next/link";

import type { ArrowLeftIconHandle } from "@/components/animated-icons/arrow-left";
import { ArrowLeftIcon } from "@/components/animated-icons/arrow-left";
import type { ArrowRightIconHandle } from "@/components/animated-icons/arrow-right";
import { ArrowRightIcon } from "@/components/animated-icons/arrow-right";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DocsNavLinkButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  transitionTypes?: string[];
  size: React.ComponentProps<typeof Button>["size"];
  iconRef: React.RefObject<ArrowLeftIconHandle | ArrowRightIconHandle | null>;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  props: React.ComponentProps<typeof Button>;
};

const DocsNavLinkButton = ({
  href,
  children,
  className,
  transitionTypes,
  size,
  iconRef,
  handleMouseEnter,
  handleMouseLeave,
  props,
}: DocsNavLinkButtonProps) => (
  <Button
    variant="secondary"
    size={size}
    className={cn("shadow-none", className)}
    asChild
    sound="click"
    onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave}
    {...props}
  >
    <Link href={href} transitionTypes={transitionTypes}>
      {transitionTypes?.includes("nav-back") && <ArrowLeftIcon ref={iconRef} />}
      {children}
      {transitionTypes?.includes("nav-forward") && (
        <ArrowRightIcon ref={iconRef} />
      )}
    </Link>
  </Button>
);

export const DocsNavLinkContent = ({
  tooltip,
  ...props
}: DocsNavLinkButtonProps & {
  tooltip?: { title: string; icon: React.ReactNode };
}) => {
  const link = <DocsNavLinkButton {...props} />;

  if (!tooltip) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent className="pr-2 pl-3">
        <div className="flex items-center gap-3">
          {tooltip.title}
          {tooltip.icon && <Kbd>{tooltip.icon}</Kbd>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
