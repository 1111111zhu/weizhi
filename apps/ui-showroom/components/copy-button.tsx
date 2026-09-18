"use client";

import { useCallback } from "react";

import { CopyButtonContent } from "@/components/copy-button-content";
import type { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { Event } from "@/lib/events";
import { trackEvent } from "@/lib/events";

export {
  motionIconProps,
  motionIconVariants,
} from "@/components/copy-button-motion";

export interface CopyButtonProps extends Omit<
  React.ComponentProps<typeof Button>,
  "value"
> {
  value: string | (() => Promise<string> | string);
  src?: string;
  event?: Event["name"];
  showTooltip?: boolean;
}

export const CopyButton = ({
  value,
  className,
  variant = "ghost",
  event,
  children,
  showTooltip = true,
  ...props
}: CopyButtonProps) => {
  const getValue = useCallback(() => {
    if (typeof value === "function") {
      return value();
    }

    return value;
  }, [value]);

  const { copyToClipboard, isCopied } = useCopyToClipboard({
    timeout: 1000,
  });

  const handleCopy = useCallback(async () => {
    const text = await getValue();
    const hasCopied = await copyToClipboard(text);

    if (hasCopied && event) {
      trackEvent({
        name: event,
        properties: {
          code: text,
        },
      });
    }
  }, [copyToClipboard, event, getValue]);

  return (
    <CopyButtonContent
      className={className}
      variant={variant}
      isCopied={isCopied}
      showTooltip={showTooltip}
      onCopy={handleCopy}
      buttonProps={props}
    >
      {children}
    </CopyButtonContent>
  );
};
