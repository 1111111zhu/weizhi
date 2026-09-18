export interface MetricItem {
  label: string;
  value: number | string;
}

export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="border-b p-4 last:border-b-0 sm:border-r xl:border-b-0 xl:last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
          key={item.label}
        >
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
