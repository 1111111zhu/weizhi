import Link from "next/link";

const colorRoles = [
  { className: "bg-background", label: "Canvas", token: "--background" },
  { className: "bg-card", label: "Surface", token: "--card" },
  { className: "bg-primary", label: "Action", token: "--primary" },
  { className: "bg-secondary", label: "Secondary", token: "--secondary" },
  { className: "bg-muted", label: "Muted", token: "--muted" },
  { className: "bg-destructive", label: "Danger", token: "--destructive" },
] as const;

function SemanticColorSamples() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Semantic color
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Showroom chrome uses semantic roles. The specimen document loads the
          selected implementation&apos;s own token layer.
        </p>
        <Link
          className="mt-2 inline-block text-sm underline underline-offset-4"
          href="/specimens/Color"
        >
          Inspect ProjectWing light/dark color pairs and status labels →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
        {colorRoles.map((role) => (
          <div className="bg-background p-3" key={role.token}>
            <div className={`h-20 rounded-md border ${role.className}`} />
            <p className="mt-3 text-sm font-medium text-foreground">
              {role.label}
            </p>
            <code className="text-xs text-muted-foreground">{role.token}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShapeSamples() {
  const radiusSamples = [
    ["Small", "rounded-sm"],
    ["Medium", "rounded-md"],
    ["Large", "rounded-lg"],
  ] as const;

  return (
    <div className="flex flex-col gap-5 rounded-lg border p-5">
      <div>
        <p className="text-3xl font-semibold tracking-tight">Aa</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Clear hierarchy, compact leading, no ornamental type.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {radiusSamples.map(([label, radius]) => (
          <div className="text-center" key={label}>
            <div className={`h-12 border bg-muted ${radius}`} />
            <p className="mt-2 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-2 w-10 rounded-full bg-primary" />
        <span className="h-2 w-16 rounded-full bg-muted" />
        <span className="h-2 w-24 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function TypeAndShapeSamples() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Type and shape
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Geist for documentation, system-aware product typography inside
          specimens.
        </p>
      </div>
      <ShapeSamples />
    </section>
  );
}

export function FoundationSamples() {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <SemanticColorSamples />
      <TypeAndShapeSamples />
    </div>
  );
}
