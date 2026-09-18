"use client";
import { useCompactViewport } from "@project-wing/ui";
import type { ReactNode } from "react";

import mobileStyles from "./cmp-mobile.module.css";

export type CmpDocumentPreviewField = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  wide?: boolean;
};

export type CmpDocumentPreviewSection = {
  id: string;
  title: ReactNode;
  fields: CmpDocumentPreviewField[];
  tables?: {
    id: string;
    title: ReactNode;
    columns: ReactNode[];
    rows: ReactNode[][];
    footer?: ReactNode[];
  }[];
  status?: ReactNode;
  action?: ReactNode;
};

/**
 * Shared read-only document sections used by record previews and form review.
 * Consumers control the header metadata while this keeps field order and layout
 * identical across both surfaces.
 */
export function CmpDocumentPreviewSections({
  sections,
  layout = "document",
}: {
  sections: CmpDocumentPreviewSection[];
  layout?: "document" | "form";
}) {
  if (layout === "form") {
    return (
      <div className="cmp-form-review-sections">
        {sections.map((section, sectionIndex) => (
          <section
            key={section.id}
            className="cmp-form-review-section"
            aria-labelledby={`form-review-section-${section.id}`}
          >
            <header className="cmp-form-review-section-heading">
              <div className="cmp-form-review-section-title">
                <span className="cmp-form-review-section-number">
                  {String(sectionIndex + 1).padStart(2, "0")}
                </span>
                <h2 id={`form-review-section-${section.id}`}>
                  {section.title}
                </h2>
              </div>
              <div className="cmp-form-review-section-actions">
                {section.status}
                {section.action}
              </div>
            </header>
            <dl className="cmp-client-form-grid cmp-form-review-fields">
              {section.fields.map((field) => (
                <div
                  key={field.id}
                  className={`cmp-form-review-field${
                    field.wide ? " cmp-form-review-field-wide" : ""
                  }`}
                >
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
            {section.tables?.map((table) => (
              <PreviewTable key={table.id} table={table} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="cmp-document-sections px-5 sm:px-8">
      {sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          className={sectionIndex ? "border-t border-border py-7" : "py-7"}
          aria-labelledby={`document-section-${section.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="text-xs font-semibold text-primary">
                {String(sectionIndex + 1).padStart(2, "0")}
              </span>
              <h2
                id={`document-section-${section.id}`}
                className="text-base font-semibold sm:text-lg"
              >
                {section.title}
              </h2>
              {section.status}
            </div>
            {section.action}
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => (
              <div
                key={field.id}
                className={
                  field.wide ? "min-w-0 sm:col-span-2 lg:col-span-3" : "min-w-0"
                }
              >
                <dt className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          {section.tables?.map((table) => (
            <PreviewTable key={table.id} table={table} />
          ))}
        </section>
      ))}
    </div>
  );
}

function PreviewTable({
  table,
}: {
  table: NonNullable<CmpDocumentPreviewSection["tables"]>[number];
}) {
  const phone = useCompactViewport(767.98);
  if (phone) {
    return (
      <section className={mobileStyles.record}>
        <h3>{table.title}</h3>
        {table.rows.map((row, index) => (
          <dl
            className={`${mobileStyles.metrics} ${mobileStyles.record}`}
            key={index}
          >
            {row.map((cell, column) => (
              <div key={column}>
                <dt>{table.columns[column]}</dt>
                <dd>{cell}</dd>
              </div>
            ))}
          </dl>
        ))}
        {table.footer && (
          <dl className={mobileStyles.metrics}>
            {table.footer.map((cell, index) => (
              <div key={index}>
                <dt>{table.columns[index]}</dt>
                <dd>{cell}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  }
  return (
    <div className="cmp-fee-planning-table-wrap mt-5">
      <h3 className="text-sm font-semibold">{table.title}</h3>
      <table className="cmp-fee-planning-table">
        <thead>
          <tr>
            {table.columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.footer ? (
          <tfoot>
            <tr>
              {table.footer.map((cell, index) => (
                <th key={index}>{cell}</th>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
