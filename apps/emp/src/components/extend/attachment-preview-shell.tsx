"use client";

import type {
  AttachmentPreviewCapabilities,
  AttachmentPreviewFamily,
} from "@/lib/attachment-preview";
import { cn } from "@/lib/utils";

export function AttachmentPreviewShell({
  capabilities,
  children,
  family,
  isDark,
}: {
  capabilities: AttachmentPreviewCapabilities;
  children: React.ReactNode;
  family: AttachmentPreviewFamily;
  isDark: boolean;
}) {
  return (
    <div
      data-preview-family={family}
      data-preview-zoom={capabilities.zoom || undefined}
      className={cn(
        "extend-viewer-surface dark:extend-viewer-surface-dark h-full min-h-0 [container-type:inline-size]",
        isDark && "extend-viewer-surface-dark"
      )}
    >
      <div className="h-full min-h-0 p-[clamp(4px,1.5cqw,18px)]">
        <div className="h-full min-h-0 overflow-hidden rounded-md border bg-background shadow-xs">
          {children}
        </div>
      </div>
    </div>
  );
}
