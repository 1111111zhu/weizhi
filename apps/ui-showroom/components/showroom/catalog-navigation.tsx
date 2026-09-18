"use client";

import {
  BlocksIcon,
  ComponentIcon,
  GaugeIcon,
  PaletteIcon,
  ScaleIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface CatalogItem {
  href: string;
  icon: typeof GaugeIcon;
  label: string;
  note?: string;
}

const catalogItems: CatalogItem[] = [
  { href: ROUTES.HOME, icon: GaugeIcon, label: "Overview" },
  { href: ROUTES.FOUNDATIONS, icon: PaletteIcon, label: "Foundations" },
  { href: ROUTES.COMPONENTS, icon: ComponentIcon, label: "Components" },
  {
    href: `${ROUTES.SPECIMENS}/GuidedForm`,
    icon: ComponentIcon,
    label: "Guided forms",
    note: "Proposed",
  },
  { href: ROUTES.REVIEW, icon: ScaleIcon, label: "Review" },
  { href: ROUTES.BLOCKS, icon: BlocksIcon, label: "Blocks", note: "In review" },
];

function isCurrentRoute(pathname: string, href: string) {
  return href === ROUTES.HOME
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function CatalogNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Showroom catalog" className="flex flex-col gap-1">
      {catalogItems.map((item) => {
        const active = isCurrentRoute(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-muted text-foreground"
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
            {item.note ? (
              <Badge className="ml-auto" variant="outline">
                {item.note}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
