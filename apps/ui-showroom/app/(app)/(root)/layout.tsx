import { CatalogNavigation } from "@/components/showroom/catalog-navigation";

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container-wrapper flex-1 px-2">
      <div className="container grid min-h-full grid-cols-1 gap-8 py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+2.5rem)] flex flex-col gap-5">
            <div className="flex flex-col gap-1 px-2.5">
              <p className="text-sm font-semibold text-foreground">Catalog</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Code-derived design evidence
              </p>
            </div>
            <CatalogNavigation />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
