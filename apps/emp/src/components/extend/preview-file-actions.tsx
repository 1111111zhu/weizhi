"use client";

import { Copy01Icon, Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconButton } from "@project-wing/ui";
import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type PreviewFileActionsProps = {
  copyText?: string | null;
  disabled?: boolean;
  fileName: string;
  source: Blob;
};

const IMAGE_FILE_NAME_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

function isImagePreview(blob: Blob, fileName: string) {
  return (
    blob.type.startsWith("image/") || IMAGE_FILE_NAME_PATTERN.test(fileName)
  );
}

function loadImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.addEventListener(
      "load",
      () => {
        URL.revokeObjectURL(url);
        resolve(image);
      },
      { once: true }
    );
    image.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to decode image for clipboard"));
      },
      { once: true }
    );
    image.src = url;
  });
}

async function toPngClipboardBlob(blob: Blob, fileName: string) {
  if (blob.type === "image/png") {
    return blob;
  }
  if (/\.png$/i.test(fileName)) {
    return new Blob([blob], { type: "image/png" });
  }

  const image = await loadImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }
  context.drawImage(image, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (png) =>
        png ? resolve(png) : reject(new Error("Unable to encode image")),
      "image/png"
    );
  });
}

export async function copyPreviewBlobToClipboard(
  blob: Blob,
  fileName: string,
  copyText?: string | null
) {
  const { clipboard } = navigator;
  if (!clipboard) {
    throw new Error("Clipboard API is unavailable");
  }

  if (copyText !== null && copyText !== undefined) {
    await clipboard.writeText(copyText);
    return;
  }

  if (!clipboard.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard write is unavailable");
  }

  const imagePreview = isImagePreview(blob, fileName);
  const clipboardBlob = imagePreview
    ? await toPngClipboardBlob(blob, fileName)
    : blob;
  const mimeType = imagePreview
    ? "image/png"
    : clipboardBlob.type || "application/octet-stream";
  await clipboard.write([new ClipboardItem({ [mimeType]: clipboardBlob })]);
}

function downloadPreviewBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PreviewFileActions({
  copyText,
  disabled = false,
  fileName,
  source,
}: PreviewFileActionsProps) {
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "error">(
    "idle"
  );
  const handleCopy = React.useCallback(async () => {
    setCopyState("idle");
    try {
      await copyPreviewBlobToClipboard(source, fileName, copyText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }, [copyText, fileName, source]);
  const copyLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "error"
        ? "Copy failed"
        : "Copy to clipboard";

  return (
    <TooltipProvider>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                type="button"
                variant="quiet"
                size="xs"
                icon={<HugeiconsIcon icon={Copy01Icon} className="size-4" />}
                label={copyLabel}
                disabled={disabled}
                onClick={() => handleCopy()}
              />
            }
          />
          <TooltipContent>{copyLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                type="button"
                variant="quiet"
                size="xs"
                icon={
                  <HugeiconsIcon icon={Download01Icon} className="size-4" />
                }
                label="Download file"
                onClick={() => downloadPreviewBlob(source, fileName)}
              />
            }
          />
          <TooltipContent>Download file</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
