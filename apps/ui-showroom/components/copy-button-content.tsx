"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { motionIconProps } from "@/components/copy-button-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CopyButtonContentProps = {
  className?: React.ComponentProps<typeof Button>["className"];
  variant: React.ComponentProps<typeof Button>["variant"];
  children?: React.ReactNode;
  isCopied: boolean;
  showTooltip: boolean;
  onCopy: () => void;
  buttonProps: Omit<
    React.ComponentProps<typeof Button>,
    "className" | "variant"
  > & { src?: string };
};

const CopyButtonTooltip = ({
  copyButton,
  isCopied,
}: {
  copyButton: React.ReactNode;
  isCopied: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{copyButton}</TooltipTrigger>
    <TooltipContent>{isCopied ? "Copied" : "Copy to Clipboard"}</TooltipContent>
  </Tooltip>
);

const CopyButtonView = ({
  className,
  variant,
  children,
  isCopied,
  showTooltip,
  onCopy,
  buttonProps,
}: CopyButtonContentProps) => {
  const copyButton = (
    <Button
      data-slot="copy-button"
      size={children ? "sm" : "icon"}
      variant={variant}
      className={cn(
        children
          ? ""
          : "bg-code absolute top-3 right-2 z-10 size-7 hover:opacity-100 focus-visible:opacity-100",
        className
      )}
      sound="copy"
      onClick={onCopy}
      {...buttonProps}
    >
      <span className="sr-only">Copy</span>
      <AnimatePresence mode="popLayout" initial={false}>
        {isCopied ? (
          <motion.span key="done" {...motionIconProps}>
            <CheckIcon strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span key="idle" {...motionIconProps}>
            <CopyIcon />
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </Button>
  );

  if (!showTooltip) {
    return copyButton;
  }

  return <CopyButtonTooltip copyButton={copyButton} isCopied={isCopied} />;
};

export const CopyButtonContent = (props: CopyButtonContentProps) => (
  <CopyButtonView {...props} />
);
