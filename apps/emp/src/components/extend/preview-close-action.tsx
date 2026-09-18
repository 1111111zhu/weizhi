"use client";

import { createContext, useContext } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const PreviewCloseContext = createContext<{
  onClose?: () => void;
  label: string;
}>({ label: "Close preview" });

export function PreviewCloseAction() {
  const { onClose, label } = useContext(PreviewCloseContext);
  return onClose ? (
    <Button
      data-preview-toolbar-close=""
      type="button"
      variant="ghost"
      size="icon"
      className="ml-1 size-8 shrink-0"
      aria-label={label}
      onClick={onClose}
    >
      <X className="size-4" />
    </Button>
  ) : null;
}
