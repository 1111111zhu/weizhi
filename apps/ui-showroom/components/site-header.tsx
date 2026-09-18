import Image from "next/image";
import Link from "next/link";

import { BrandContextMenu } from "@/components/brand-context-menu";
import { CommandMenu } from "@/components/command-menu";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ModeSwitcher } from "@/components/mode-switcher";
import { SiteSettings } from "@/components/site-settings";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { source } from "@/lib/source";

const navItems = [
  { href: ROUTES.FOUNDATIONS, label: "Foundations" },
  { href: ROUTES.COMPONENTS, label: "Components" },
  { href: ROUTES.REVIEW, label: "Review" },
  { href: ROUTES.BLOCKS, label: "Blocks" },
];

export const SiteHeader = () => (
  <header className="sticky top-0 z-50 w-full bg-background view-transition-site-header">
    <div className="container-wrapper px-6 3xl:fixed:px-0">
      <div className="flex h-(--header-height) items-center gap-2 3xl:fixed:container">
        <MobileNav
          items={navItems}
          tree={source.pageTree}
          className="flex lg:hidden"
        />
        <BrandContextMenu>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden size-8 lg:flex"
            sound="click"
          >
            <Link href={ROUTES.HOME} transitionTypes={["nav-back"]}>
              <Image
                alt=""
                className="size-5 dark:hidden"
                height={20}
                src="/brand/icon-white-green.svg"
                width={20}
              />
              <Image
                alt=""
                className="hidden size-5 dark:block"
                height={20}
                src="/brand/icon-black-green.svg"
                width={20}
              />
              <span className="sr-only">{SITE.NAME}</span>
            </Link>
          </Button>
        </BrandContextMenu>
        <MainNav items={navItems} className="hidden lg:flex" />
        <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
          <div className="hidden w-full flex-1 md:flex md:w-auto md:flex-none">
            <CommandMenu navItems={navItems} tree={source.pageTree} />
          </div>
          <ModeSwitcher />
          <SiteSettings />
        </div>
      </div>
    </div>
  </header>
);
