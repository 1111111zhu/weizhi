"use client";

import { EllipsisIcon, LinkIcon } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import type { ShareIconHandle } from "@/components/animated-icons/share";
import { ShareIcon } from "@/components/animated-icons/share";
import { XIcon, LinkedInIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type DocsShareMenuItemsProps = {
  title: string;
  absoluteUrl: string;
  urlEncoded: string;
};

const DocsShareMenuItems = ({
  title,
  absoluteUrl,
  urlEncoded,
}: DocsShareMenuItemsProps) => (
  <>
    <DropdownMenuItem asChild sound="click">
      <a
        href={`https://x.com/intent/tweet?url=${urlEncoded}`}
        target="_blank"
        rel="noopener"
      >
        <XIcon />
        Share on X
      </a>
    </DropdownMenuItem>
    <DropdownMenuItem asChild sound="click">
      <a
        href={`https://www.linkedin.com/sharing/share-offsite?url=${urlEncoded}`}
        target="_blank"
        rel="noopener"
      >
        <LinkedInIcon />
        Share on LinkedIn
      </a>
    </DropdownMenuItem>
    {typeof navigator !== "undefined" && "share" in navigator && (
      <DropdownMenuItem
        sound="click"
        onClick={(e) => {
          e.preventDefault();
          navigator.share({ title, url: absoluteUrl });
        }}
      >
        <EllipsisIcon />
        Other app
      </DropdownMenuItem>
    )}
  </>
);

const DocsShareMenuCopyItem = ({
  absoluteUrl,
  copyToClipboard,
}: {
  absoluteUrl: string;
  copyToClipboard: (value: string) => Promise<boolean>;
}) => (
  <DropdownMenuItem
    sound="copy"
    onClick={() => {
      copyToClipboard(absoluteUrl);
      toast.success("Link copied");
    }}
  >
    <LinkIcon />
    Copy link
  </DropdownMenuItem>
);

const DocsShareMenuDropdown = ({
  title,
  absoluteUrl,
  urlEncoded,
  copyToClipboard,
  shareIconRef,
  handleMouseEnter,
  handleMouseLeave,
}: DocsShareMenuItemsProps & {
  copyToClipboard: (value: string) => Promise<boolean>;
  shareIconRef: React.RefObject<ShareIconHandle | null>;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
}) => (
  <DropdownMenu sounds>
    <DropdownMenuTrigger asChild>
      <Button
        className="hidden size-7 border-none active:scale-none sm:flex"
        variant="secondary"
        size="icon-sm"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <ShareIcon ref={shareIconRef} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      className="w-fit"
      alignOffset={-6}
      collisionPadding={8}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <DocsShareMenuCopyItem
        absoluteUrl={absoluteUrl}
        copyToClipboard={copyToClipboard}
      />
      <DocsShareMenuItems
        title={title}
        absoluteUrl={absoluteUrl}
        urlEncoded={urlEncoded}
      />
    </DropdownMenuContent>
  </DropdownMenu>
);

export const DocsShareMenuContent = ({
  title,
  url,
}: {
  title: string;
  url: string;
}) => {
  const shareIconRef = useRef<ShareIconHandle>(null);
  const { copyToClipboard } = useCopyToClipboard();
  const absoluteUrl = url.startsWith("http")
    ? url
    : typeof window === "undefined"
      ? url
      : new URL(url, window.location.origin).toString();
  const urlEncoded = encodeURIComponent(absoluteUrl);
  const handleMouseEnter = useCallback(
    () => shareIconRef.current?.startAnimation(),
    []
  );
  const handleMouseLeave = useCallback(
    () => shareIconRef.current?.stopAnimation(),
    []
  );

  return (
    <DocsShareMenuDropdown
      title={title}
      absoluteUrl={absoluteUrl}
      urlEncoded={urlEncoded}
      copyToClipboard={copyToClipboard}
      shareIconRef={shareIconRef}
      handleMouseEnter={handleMouseEnter}
      handleMouseLeave={handleMouseLeave}
    />
  );
};
