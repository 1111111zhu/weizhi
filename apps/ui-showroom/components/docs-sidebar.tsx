"use client";

import { usePathname } from "next/navigation";

import { DocsSidebarContent } from "@/components/docs-sidebar-content";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import type { source } from "@/lib/source";

export const DocsSidebar = ({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & { tree: typeof source.pageTree }) => {
  const pathname = usePathname();

  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] flex-col overscroll-none bg-transparent text-sidebar-foreground [--sidebar-menu-width:--spacing(48)] lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="mx-auto no-scrollbar w-(--sidebar-menu-width) overflow-x-hidden px-2">
        <DocsSidebarContent tree={tree} pathname={pathname} />
      </SidebarContent>
    </Sidebar>
  );
};
