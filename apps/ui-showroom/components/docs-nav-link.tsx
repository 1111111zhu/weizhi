"use client";

import { useCallback, useRef } from "react";

import type { ArrowLeftIconHandle } from "@/components/animated-icons/arrow-left";
import type { ArrowRightIconHandle } from "@/components/animated-icons/arrow-right";
import { DocsNavLinkContent } from "@/components/docs-nav-link-content";
import type { Button } from "@/components/ui/button";

export const DocsNavLink = ({
  href,
  children,
  className,
  tooltip,
  transitionTypes,
  size = "icon",
  ...props
}: React.ComponentProps<typeof Button> & {
  href: string;
  children: React.ReactNode;
  className?: string;
  tooltip?: { title: string; icon: React.ReactNode };
  transitionTypes?: string[];
}) => {
  const iconRef = useRef<ArrowLeftIconHandle | ArrowRightIconHandle>(null);

  const handleMouseEnter = useCallback(() => {
    iconRef.current?.startAnimation();
  }, []);

  const handleMouseLeave = useCallback(() => {
    iconRef.current?.stopAnimation();
  }, []);

  return (
    <DocsNavLinkContent
      href={href}
      className={className}
      tooltip={tooltip}
      transitionTypes={transitionTypes}
      size={size}
      iconRef={iconRef}
      handleMouseEnter={handleMouseEnter}
      handleMouseLeave={handleMouseLeave}
      props={props}
    >
      {children}
    </DocsNavLinkContent>
  );
};
