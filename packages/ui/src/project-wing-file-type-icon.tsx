import { getFileTypeIconAsUrl } from "@fluentui/react-file-type-icons";
import { File as FileIcon, FileCheck2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { cn } from "./utils";

type ProjectWingFileTypeIconProps = {
  fileName: string;
  size?: "sm" | "default";
  className?: string;
  iconClassName?: string;
  "data-icon"?: "inline-start" | "inline-end";
};

export function ProjectWingFileTypeIcon({
  fileName,
  size = "default",
  className,
  iconClassName,
  "data-icon": dataIcon,
}: ProjectWingFileTypeIconProps) {
  const isBrowser = useSyncExternalStore(
    subscribeToBrowser,
    browserSnapshot,
    serverSnapshot
  );
  const isSmartForm = getFileExtension(fileName) === "sf";
  const iconUrl = isBrowser
    ? getProjectWingFileTypeIconUrl(fileName, size)
    : null;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const sizeClass = size === "sm" ? "size-4" : "size-8";
  const pixels = size === "sm" ? 16 : 32;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        sizeClass,
        className
      )}
      data-icon={dataIcon}
    >
      {isSmartForm ? (
        <FileCheck2
          aria-hidden="true"
          data-testid="smart-form-file-icon"
          className={cn(sizeClass, "text-primary/80", iconClassName)}
        />
      ) : iconUrl && iconUrl !== failedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Shared UI also renders in Electron, where Next Image is unavailable.
        <img
          alt=""
          className={cn(sizeClass, "object-contain", iconClassName)}
          draggable={false}
          height={pixels}
          src={iconUrl}
          width={pixels}
          onError={() => setFailedUrl(iconUrl)}
        />
      ) : isBrowser ? (
        <FileIcon
          aria-hidden="true"
          className={cn(sizeClass, "text-muted-foreground", iconClassName)}
        />
      ) : null}
    </span>
  );
}

export function getProjectWingFileTypeIconUrl(
  fileName: string,
  size: "sm" | "default" = "default"
) {
  if (getFileExtension(fileName) === "sf") {
    return null;
  }
  return getFileTypeIconAsUrl({
    extension: getFileExtension(fileName),
    imageFileType: "svg",
    size: size === "sm" ? 16 : 32,
  });
}

function getFileExtension(fileName: string) {
  return fileName.includes(".")
    ? fileName.split(".").at(-1)?.toLowerCase()
    : undefined;
}

function subscribeToBrowser() {
  return () => null;
}

function browserSnapshot() {
  return true;
}

function serverSnapshot() {
  return false;
}
