"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { LinkProps } from "next/link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ROUTES } from "@/constants/routes";
import { useFeedback } from "@/hooks/use-feedback";
import { EXCLUDED_SECTIONS, isComponentsFolder } from "@/lib/docs";
import { getAllPagesFromFolder, getPagesFromFolder } from "@/lib/page-tree";
import { cn } from "@/lib/utils";

export const MobileLink = ({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: LinkProps & {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  const router = useRouter();
  const playClick = useFeedback({ sound: "click" });
  const handleClick = useCallback(() => {
    playClick();
    router.push(href.toString());
    onOpenChange?.(false);
  }, [router, href, onOpenChange, playClick]);

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn("text-2xl font-medium", className)}
      {...props}
    >
      {children}
    </Link>
  );
};

const MobileNavGroup = ({
  label,
  pages,
  setOpen,
}: {
  label: React.ReactNode;
  pages: { url: string; name: React.ReactNode }[];
  setOpen: (open: boolean) => void;
}) => {
  if (pages.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-col gap-3">
        {pages.map((page) => (
          <MobileLink key={page.url} href={page.url} onOpenChange={setOpen}>
            {page.name}
          </MobileLink>
        ))}
      </div>
    </div>
  );
};

const MobileNavTree = ({
  tree,
  setOpen,
}: {
  tree: PageTreeRoot;
  setOpen: (open: boolean) => void;
}) => (
  <>
    {tree.children.map((item) => {
      if (item.type !== "folder" || EXCLUDED_SECTIONS.has(item.$id ?? "")) {
        return null;
      }

      const pages = isComponentsFolder(item)
        ? getAllPagesFromFolder(item).filter(
            (page) => page.url !== ROUTES.DOCS_COMPONENTS
          )
        : getPagesFromFolder(item);

      return (
        <MobileNavGroup
          key={item.$id}
          label={item.name}
          pages={pages}
          setOpen={setOpen}
        />
      );
    })}
  </>
);

export const MobileNavContent = ({
  items,
  tree,
  setOpen,
}: {
  items: { href: string; label: string }[];
  tree: PageTreeRoot;
  setOpen: (open: boolean) => void;
}) => (
  <div className="flex flex-col gap-12 overflow-auto px-6 py-6">
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-muted-foreground">Menu</div>
      <div className="flex flex-col gap-3">
        <MobileLink href={ROUTES.HOME} onOpenChange={setOpen}>
          Home
        </MobileLink>
        {items.map((item) => (
          <MobileLink key={item.href} href={item.href} onOpenChange={setOpen}>
            {item.label}
          </MobileLink>
        ))}
      </div>
    </div>
    <MobileNavTree tree={tree} setOpen={setOpen} />
  </div>
);
