import { createElement } from "react";
import type { HTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "./utils";

type LayoutElement =
  | "div"
  | "section"
  | "article"
  | "main"
  | "aside"
  | "nav"
  | "fieldset";
export type LayoutProps = HTMLAttributes<HTMLElement> & {
  as?: LayoutElement;
  ref?: Ref<HTMLElement>;
};
export type LayoutGap = "none" | "xs" | "sm" | "md" | "lg";
const gaps: Record<LayoutGap, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};
const alignment = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

function element(
  slot: string,
  classes: string,
  { as = "div", className, ...props }: LayoutProps
) {
  return createElement(as, {
    ...props,
    "data-slot": slot,
    className: cn("min-w-0", classes, className),
  });
}

export type SurfaceProps = LayoutProps & {
  variant?: "plain" | "outlined" | "raised" | "subtle";
  padding?: "none" | "sm" | "md" | "lg";
};
export function Surface({
  variant = "plain",
  padding = "none",
  ...props
}: SurfaceProps) {
  const surfaces = {
    plain: "bg-card text-card-foreground",
    outlined: "rounded-xl border border-border bg-card text-card-foreground",
    raised:
      "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
    subtle: "rounded-xl bg-muted text-foreground",
  };
  const paddings = { none: "p-0", sm: "p-2", md: "p-4", lg: "p-6" };
  return element("surface", cn(surfaces[variant], paddings[padding]), props);
}

export type ContainerProps = LayoutProps & {
  width?: "content" | "wide" | "full";
};
export function Container({ width = "content", ...props }: ContainerProps) {
  const widths = {
    content: "max-w-(--pw-layout-content-width)",
    wide: "max-w-(--pw-layout-wide-width)",
    full: "max-w-none",
  };
  return element("container", cn("mx-auto w-full", widths[width]), props);
}

export type StackProps = LayoutProps & {
  gap?: LayoutGap;
  align?: keyof typeof alignment;
};
export function Stack({ gap = "md", align = "stretch", ...props }: StackProps) {
  return element(
    "stack",
    cn("flex flex-col", gaps[gap], alignment[align]),
    props
  );
}

export type InlineProps = StackProps & {
  wrap?: boolean;
  justify?: "start" | "between" | "end";
};
export function Inline({
  gap = "sm",
  align = "center",
  wrap = true,
  justify = "start",
  ...props
}: InlineProps) {
  const positions = {
    start: "justify-start",
    between: "justify-between",
    end: "justify-end",
  };
  return element(
    "inline",
    cn(
      "flex",
      gaps[gap],
      alignment[align],
      positions[justify],
      wrap && "flex-wrap"
    ),
    props
  );
}

export type GridProps = LayoutProps & {
  columns?: 1 | 2 | 3 | 4;
  gap?: LayoutGap;
  collapse?: "phone" | "never";
};
export function Grid({
  columns = 2,
  gap = "md",
  collapse = "phone",
  ...props
}: GridProps) {
  const responsive = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-4",
  };
  const fixed = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };
  return element(
    "layout-grid",
    cn("grid", gaps[gap], (collapse === "phone" ? responsive : fixed)[columns]),
    props
  );
}

export type SectionHeaderProps = Omit<LayoutProps, "children"> & {
  heading: ReactNode;
  description?: string;
  actions?: ReactNode;
  level?: 2 | 3 | 4;
};
export function SectionHeader({
  heading,
  description,
  actions,
  level = 2,
  ...props
}: SectionHeaderProps) {
  return element(
    "section-header",
    "flex flex-wrap items-start justify-between gap-3",
    {
      ...props,
      children: (
        <>
          <div className="min-w-0">
            {createElement(
              `h${level}`,
              { className: "text-base font-semibold text-foreground" },
              heading
            )}
            {description ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <Inline>{actions}</Inline> : null}
        </>
      ),
    }
  );
}

export type CardProps = SurfaceProps & {
  heading?: ReactNode;
  description?: string;
  actions?: ReactNode;
};
export function Card({
  heading,
  description,
  actions,
  children,
  variant = "outlined",
  padding = "md",
  ...props
}: CardProps) {
  return (
    <Surface as="article" {...props} variant={variant} padding={padding}>
      <Stack>
        {heading ? (
          <SectionHeader
            heading={heading}
            description={description}
            actions={actions}
            level={3}
          />
        ) : null}
        {children}
      </Stack>
    </Surface>
  );
}

export type DescriptionListProps = HTMLAttributes<HTMLDListElement> & {
  items: readonly { id: string; label: ReactNode; value: ReactNode }[];
  columns?: 1 | 2;
  emptyValue?: ReactNode;
  ref?: Ref<HTMLDListElement>;
};
export function DescriptionList({
  items,
  columns = 1,
  emptyValue = "—",
  className,
  ...props
}: DescriptionListProps) {
  return (
    <dl
      {...props}
      data-slot="description-list"
      className={cn(
        "grid min-w-0 gap-4",
        columns === 2 && "md:grid-cols-2",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          <dt className="text-muted-foreground text-sm">{item.label}</dt>
          <dd className="text-foreground mt-1 min-w-0 text-sm break-words">
            {item.value ?? emptyValue}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type ContentLayoutProps = LayoutProps & {
  header?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
};
function ContentLayout({
  header,
  aside,
  footer,
  children,
  ...props
}: ContentLayoutProps) {
  return (
    <Stack as="section" {...props}>
      {header}
      <div
        className={cn(
          "grid min-w-0 gap-6",
          aside &&
            "lg:grid-cols-[minmax(0,1fr)_minmax(var(--pw-layout-aside-min-width),var(--pw-layout-aside-width))]"
        )}
      >
        <div className="min-w-0">{children}</div>
        {aside ? <aside className="min-w-0">{aside}</aside> : null}
      </div>
      {footer}
    </Stack>
  );
}
export function ListPageLayout(props: ContentLayoutProps) {
  return <ContentLayout {...props} />;
}
export function DetailPageLayout(props: ContentLayoutProps) {
  return <ContentLayout {...props} />;
}
/** Composition only: the caller owns its form element, validation and submission. */
export function FormPageLayout(props: ContentLayoutProps) {
  return <ContentLayout {...props} />;
}

export function FilterBar({ children, ...props }: LayoutProps) {
  return (
    <Inline {...props} as="fieldset">
      {children}
    </Inline>
  );
}
