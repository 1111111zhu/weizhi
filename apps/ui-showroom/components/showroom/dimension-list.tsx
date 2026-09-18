import { Badge } from "@/components/ui/badge";

export interface DimensionListItem {
  detail?: string;
  label: string;
  publicCount?: number;
  value: number;
}

export function DimensionList({
  items,
  title,
}: {
  items: DimensionListItem[];
  title: string;
}) {
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-3 border-t">
        {items.map((item) => (
          <div
            className="flex items-start justify-between gap-3 border-b py-3"
            key={item.label}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {item.label}
              </p>
              {item.detail ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.detail}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {item.publicCount ? (
                <Badge variant="outline">{item.publicCount} public</Badge>
              ) : null}
              <Badge variant="secondary">{item.value}</Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
