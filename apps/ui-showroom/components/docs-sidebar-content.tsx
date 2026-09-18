"use client";

import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/constants/routes";
import { EXCLUDED_SECTIONS, isComponentsFolder } from "@/lib/docs";
import { getAllPagesFromFolder, getPagesFromFolder } from "@/lib/page-tree";
import type { source } from "@/lib/source";

const TOP_LEVEL_SECTIONS = [
  { href: ROUTES.DOCS, name: "Introduction" },
  { href: ROUTES.DOCS_INSTALLATION, name: "Installation" },
  { href: ROUTES.DOCS_COMPONENTS, name: "Components" },
  { href: ROUTES.LLMS, name: "llms.txt" },
];

const MENU_BUTTON_CLS =
  "relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48";

const SidebarPageGroup = ({
  label,
  pages,
  pathname,
}: {
  label: React.ReactNode;
  pages: { url: string; name: React.ReactNode }[];
  pathname: string;
}) => {
  if (pages.length === 0) {
    return null;
  }
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-medium text-muted-foreground">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {pages.map((page) => (
            <SidebarMenuItem key={page.url}>
              <SidebarMenuButton
                asChild
                className={MENU_BUTTON_CLS}
                isActive={page.url === pathname}
              >
                <Link href={page.url}>
                  <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                  {page.name}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

const DocsSidebarTopLevel = ({ pathname }: { pathname: string }) => (
  <SidebarGroup className="pt-6">
    <SidebarGroupLabel className="font-medium text-muted-foreground">
      Sections
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {TOP_LEVEL_SECTIONS.map(({ name, href }) => (
          <SidebarMenuItem key={name}>
            <SidebarMenuButton
              asChild
              className={MENU_BUTTON_CLS}
              isActive={
                href === ROUTES.DOCS
                  ? pathname === href
                  : pathname.startsWith(href)
              }
            >
              <Link href={href}>
                <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                {name}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

const DocsSidebarTree = ({
  tree,
  pathname,
}: {
  tree: typeof source.pageTree;
  pathname: string;
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
        <SidebarPageGroup
          key={item.$id}
          label={item.name}
          pages={pages}
          pathname={pathname}
        />
      );
    })}
  </>
);

export const DocsSidebarContent = ({
  tree,
  pathname,
}: {
  tree: typeof source.pageTree;
  pathname: string;
}) => (
  <>
    <div className="h-9" />
    <div className="absolute top-8 z-10 h-8 w-(--sidebar-menu-width) shrink-0 bg-linear-to-b from-background via-background/80 to-background/50 blur-xs" />
    <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-linear-to-b from-transparent via-border to-transparent lg:flex" />
    <DocsSidebarTopLevel pathname={pathname} />
    <DocsSidebarTree tree={tree} pathname={pathname} />
    <div className="sticky -bottom-1 z-10 h-16 shrink-0 bg-linear-to-t from-background via-background/80 to-background/50 blur-xs" />
  </>
);
