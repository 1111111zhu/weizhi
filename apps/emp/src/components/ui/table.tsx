"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  children,
  className,
  label,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & {
  label?: React.ReactNode;
  containerClassName?: string;
}) {
  const labelId = React.useId();

  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        data-slot="table"
        aria-labelledby={label ? labelId : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      >
        {label ? (
          <caption id={labelId} hidden>
            {label}
          </caption>
        ) : null}
        {children}
      </table>
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentPropsWithoutRef<"tr">
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    data-slot="table-row"
    className={cn(
      "border-b transition-[background-color,box-shadow,color] duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-muted/50 hover:shadow-[inset_3px_0_0_color-mix(in_srgb,var(--primary)_32%,transparent)] has-aria-expanded:bg-muted/50 data-[state=selected]:bg-[var(--brand-tint)] data-[state=selected]:shadow-[inset_3px_0_0_color-mix(in_srgb,var(--primary)_62%,transparent)] data-[state=selected]:hover:bg-[var(--brand-tint)]",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

function TableHead({
  className,
  columnWidth,
  style,
  ...props
}: React.ComponentProps<"th"> & {
  columnWidth?: React.CSSProperties["width"];
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      style={{
        ...style,
        ...(columnWidth === undefined
          ? {}
          : { minWidth: columnWidth, width: columnWidth }),
      }}
      {...props}
    />
  );
}

function TableColumn({
  columnWidth,
  style,
  ...props
}: React.ComponentProps<"col"> & {
  columnWidth?: React.CSSProperties["width"];
}) {
  return (
    <col
      style={{
        ...style,
        ...(columnWidth === undefined ? {} : { width: columnWidth }),
      }}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableColumn,
  TableRow,
  TableCell,
  TableCaption,
};
