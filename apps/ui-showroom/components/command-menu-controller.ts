/* eslint-disable react/use-memo, react/memo-dependencies, react-hooks/exhaustive-deps -- navigation handlers are stable around the Fumadocs command-menu contract. */

"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@/constants/routes";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useFeedback } from "@/hooks/use-feedback";
import { EXCLUDED_SECTIONS, isComponentsFolder } from "@/lib/docs";
import { trackEvent } from "@/lib/events";
import { getAllPagesFromFolder, getPagesFromFolder } from "@/lib/page-tree";
import { registryItemUrl } from "@/lib/utils";

import type { CommandBlock, TreeGroup } from "./command-menu-content";

const buildTreeGroups = (tree: PageTreeRoot): TreeGroup[] => {
  const groups: TreeGroup[] = [];
  for (const item of tree.children) {
    if (item.type !== "folder" || EXCLUDED_SECTIONS.has(item.$id ?? "")) {
      continue;
    }
    const pages = (
      isComponentsFolder(item)
        ? getAllPagesFromFolder(item).filter(
            (page) => page.url !== ROUTES.DOCS_COMPONENTS
          )
        : getPagesFromFolder(item)
    ).map((page) => ({
      name: typeof page.name === "string" ? page.name : String(page.name),
      url: page.url,
    }));
    if (pages.length) {
      groups.push({
        label: typeof item.name === "string" ? item.name : String(item.name),
        pages,
      });
    }
  }
  return groups;
};

const createDocPageHighlightHandler =
  ({
    packageManager,
    setShowGoToPage,
    setCopyPayload,
  }: {
    packageManager: string;
    setShowGoToPage: (value: boolean) => void;
    setCopyPayload: (value: string) => void;
  }) =>
  ({ url }: { url: string }) => {
    setShowGoToPage(true);
    const parts = url.split("/").filter(Boolean);
    const kind = parts.includes("themes")
      ? "theme"
      : parts.includes("components")
        ? "component"
        : parts.includes("templates")
          ? "template"
          : "page";
    const slug = parts.at(-1) ?? "";
    if (kind === "theme") {
      setCopyPayload(
        `${packageManager} dlx shadcn@latest add ${registryItemUrl(`theme-${slug}`)}`
      );
    } else if (kind === "component" || kind === "template") {
      setCopyPayload(
        `${packageManager} dlx shadcn@latest add ${registryItemUrl(slug)}`
      );
    } else {
      setCopyPayload("");
    }
  };

const isEditingTarget = (target: EventTarget | null) =>
  (target instanceof HTMLElement && target.isContentEditable) ||
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

const isToggleShortcut = (event: KeyboardEvent) =>
  (event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/";

const isCopyShortcut = (event: KeyboardEvent, copyPayload: string) =>
  event.key === "c" &&
  (event.metaKey || event.ctrlKey) &&
  copyPayload.includes("shadcn@latest");

const toggleCommandMenu = (
  setOpen: (updater: (value: boolean) => boolean) => void,
  event?: KeyboardEvent
) => {
  setOpen((value) => {
    if (!value && event) {
      trackEvent({
        name: "open_command_menu",
        properties: {
          key: event.key === "/" ? "/" : event.metaKey ? "cmd+k" : "ctrl+k",
          method: "keyboard",
        },
      });
    }
    return !value;
  });
};

const useCommandMenuState = () => {
  const [open, setOpen] = useState(false);
  const [showGoToPage, setShowGoToPage] = useState(false);
  const [copyPayload, setCopyPayload] = useState("");
  return {
    copyPayload,
    open,
    setCopyPayload,
    setOpen,
    setShowGoToPage,
    showGoToPage,
  };
};

const useCommandMenuKeyboard = ({
  copyPayload,
  copyFeedback,
  copyToClipboard,
  onClose,
  onToggle,
}: {
  copyPayload: string;
  copyFeedback: () => void;
  copyToClipboard: (value: string) => void;
  onClose: () => void;
  onToggle: (event: KeyboardEvent) => void;
}) => {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target) && isToggleShortcut(event)) {
        return;
      }
      if (isToggleShortcut(event)) {
        event.preventDefault();
        onToggle(event);
      }
      if (isCopyShortcut(event, copyPayload)) {
        onClose();
        copyFeedback();
        copyToClipboard(copyPayload);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [copyPayload, copyFeedback, copyToClipboard, onClose, onToggle]);
};

const useCommandMenuNavigation = ({
  packageManager,
  router,
  setCopyPayload,
  setOpen,
  setShowGoToPage,
}: {
  packageManager: string;
  router: ReturnType<typeof useRouter>;
  setCopyPayload: (value: string) => void;
  setOpen: (value: boolean) => void;
  setShowGoToPage: (value: boolean) => void;
}) => {
  const handleDocPageHighlight = useCallback(
    createDocPageHighlightHandler({
      packageManager,
      setShowGoToPage,
      setCopyPayload,
    }),
    [packageManager]
  );
  const handleBlockHighlight = useCallback(
    (block: CommandBlock) => {
      setShowGoToPage(true);
      setCopyPayload(`${packageManager} dlx shadcn@latest add ${block.name}`);
    },
    [packageManager]
  );
  const handleNavigate = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router]
  );
  const handleNavHighlight = useCallback(() => {
    setShowGoToPage(true);
    setCopyPayload("");
  }, []);
  return {
    handleBlockHighlight,
    handleDocPageHighlight,
    handleNavHighlight,
    handleNavigate,
  };
};

export const useCommandMenuController = ({
  tree,
  packageManager,
}: {
  tree: PageTreeRoot;
  packageManager: string;
}) => {
  const router = useRouter();
  const menuState = useCommandMenuState();
  const copyFeedback = useFeedback({ sound: "copy" });
  const copy = useCopyToClipboard({
    onCopy: () =>
      menuState.copyPayload &&
      trackEvent({
        name: "copy_npm_command",
        properties: { command: menuState.copyPayload, pm: packageManager },
      }),
  });
  const treeGroups = useMemo(() => buildTreeGroups(tree), [tree]);
  const navigation = useCommandMenuNavigation({
    packageManager,
    router,
    setCopyPayload: menuState.setCopyPayload,
    setOpen: menuState.setOpen,
    setShowGoToPage: menuState.setShowGoToPage,
  });
  const handleToggle = useCallback(
    (event?: KeyboardEvent) => toggleCommandMenu(menuState.setOpen, event),
    []
  );
  useCommandMenuKeyboard({
    copyPayload: menuState.copyPayload,
    copyFeedback,
    copyToClipboard: copy.copyToClipboard,
    onClose: () => menuState.setOpen(false),
    onToggle: handleToggle,
  });
  return {
    copyPayload: menuState.copyPayload,
    copyToClipboard: copy.copyToClipboard,
    isCopied: copy.isCopied,
    ...navigation,
    handleOpenChange: menuState.setOpen,
    handleOpenClick: () => menuState.setOpen(true),
    handleToggle,
    open: menuState.open,
    showGoToPage: menuState.showGoToPage,
    treeGroups,
  };
};
