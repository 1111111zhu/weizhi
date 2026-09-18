"use client";

import { useMemo, useState } from "react";

import { RegistryAddButtonView } from "@/components/registry-add-button-content";
import type { RegistryCommands } from "@/components/registry-add-button-content";
import type { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackEvent } from "@/lib/events";

export type RegistryAddButtonProps = {
  registry: { name: string } | string;
} & Omit<React.ComponentProps<typeof Button>, "children"> & {
    children?: React.ReactNode;
  };

export const RegistryAddButton = (props: RegistryAddButtonProps) => {
  const {
    children,
    className,
    registry,
    size = "sm",
    variant = "ghost",
    onClick,
    ...buttonProps
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const registryName = typeof registry === "string" ? registry : registry.name;
  const commands: RegistryCommands = useMemo(
    () => ({
      bun: `bunx --bun shadcn@latest registry add ${registryName}`,
      npm: `npx shadcn@latest registry add ${registryName}`,
      pnpm: `pnpm dlx shadcn@latest registry add ${registryName}`,
      yarn: `yarn shadcn@latest registry add ${registryName}`,
    }),
    [registryName]
  );

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trackEvent({
      name: "click_registry_add_button",
      properties: {
        registry: registryName,
      },
    });
    onClick?.(e);
  };

  return (
    <RegistryAddButtonView
      isMobile={isMobile}
      registryName={registryName}
      commands={commands}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size={size}
      variant={variant}
      className={className}
      onClick={handleTriggerClick}
      {...buttonProps}
    >
      {children}
    </RegistryAddButtonView>
  );
};
