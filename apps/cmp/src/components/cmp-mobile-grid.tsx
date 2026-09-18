"use client";

import {
  Button,
  CollectionState,
  MobileActionSheet,
  ViewSwitcher,
  useDataGrid,
} from "@project-wing/ui";
import { flexRender } from "@tanstack/react-table";
import type { Cell, Row, Table } from "@tanstack/react-table";
import { Check, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { useCmpI18n } from "@/i18n/client";
import { getCmpMobileCopy } from "@/i18n/mobile";

import styles from "./cmp-mobile.module.css";

/** CMP field anatomy only. Filtering, sorting, selection and mutations stay in the original table. */
export type CmpMobileGridProfile<T extends object> = {
  titleColumn: string;
  openLabel?: (record: T) => string;
  actionsColumn?: string;
  summaryColumns?: string[];
  filterColumn?: string;
  onOpen?: (record: T) => void;
  editable?: boolean;
};

export function CmpMobileGrid<T extends object>({
  profile,
  title,
  actions,
  onOpen,
  selection = false,
  showToolbar = true,
}: {
  profile: CmpMobileGridProfile<T>;
  title: string;
  actions?: ReactNode;
  onOpen?: (record: T) => void;
  selection?: boolean;
  showToolbar?: boolean;
}) {
  const { table: untypedTable, props } = useDataGrid();
  const table = untypedTable as Table<T>;
  const { locale } = useCmpI18n();
  const copy = getCmpMobileCopy(locale);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [limit, setLimit] = useState(30);
  const { rows } = table.getRowModel();
  const detail = rows.find((row) => row.id === detailId);
  const status = profile.filterColumn
    ? table.getColumn(profile.filterColumn)
    : undefined;
  const values = status
    ? [...status.getFacetedUniqueValues().keys()]
        .map(String)
        .filter(Boolean)
        .sort()
    : [];
  const selectedValues = status?.getFilterValue();
  const statusValues = Array.isArray(selectedValues)
    ? selectedValues.map(String)
    : [];
  const [sort] = table.getState().sorting;
  const filters = table.getState().columnFilters;
  const otherFilters = filters.filter(
    (filter) => filter.id !== profile.filterColumn
  );
  const labelFor = (row: Row<T>) =>
    String(row.getValue(profile.titleColumn) ?? title);
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanSort());
  const cellLabel = (cell: Cell<T, unknown>) =>
    cell.column.columnDef.meta?.headerTitle ??
    (typeof cell.column.columnDef.header === "string"
      ? cell.column.columnDef.header
      : cell.column.id);
  const renderCell = (cell: Cell<T, unknown>) =>
    flexRender(cell.column.columnDef.cell, cell.getContext());
  const renderDetails = (row: Row<T>) => (
    <dl className={styles.details}>
      {row
        .getAllCells()
        .filter(
          (cell) => !["select", "open", "expand"].includes(cell.column.id)
        )
        .map((cell) => (
          <div key={cell.id}>
            <dt>{cellLabel(cell)}</dt>
            <dd>{renderCell(cell)}</dd>
          </div>
        ))}
    </dl>
  );
  return (
    <section className={styles.grid} data-testid="cmp-mobile-records">
      {showToolbar && (
        <div className={styles.toolbar}>
          <h2>
            {title}{" "}
            <span className={styles.muted}>
              {table.getFilteredRowModel().rows.length}
            </span>
          </h2>
          {status && values.length > 0 && (
            <ViewSwitcher
              label={String(status.columnDef.meta?.headerTitle ?? copy.all)}
              value={
                statusValues.length > 1
                  ? "__current"
                  : (statusValues[0] ?? "__all")
              }
              options={[
                { value: "__all", label: copy.all },
                ...(statusValues.length > 1
                  ? [{ value: "__current", label: statusValues.join(", ") }]
                  : []),
                ...values.map((value) => ({
                  value,
                  label:
                    status.columnDef.meta?.filterValueLabel?.(value) ?? value,
                })),
              ]}
              onValueChange={(value) => {
                if (value !== "__current") {
                  status.setFilterValue(
                    value === "__all" ? undefined : [value]
                  );
                }
              }}
              mobilePresentation="sheet"
            />
          )}
          <Button
            size="icon"
            variant="quiet"
            aria-label={copy.more}
            onClick={() => setActionsOpen(true)}
          >
            <MoreHorizontal />
          </Button>
        </div>
      )}
      {otherFilters.length > 0 && (
        <Button
          variant="secondary"
          onClick={() => table.resetColumnFilters(true)}
        >
          {copy.clear} ({filters.length})
        </Button>
      )}
      {selecting && (
        <div className={styles.selection}>
          {copy.selected} {table.getFilteredSelectedRowModel().rows.length}
          <Button variant="quiet" onClick={() => setSelecting(false)}>
            {copy.done}
          </Button>
        </div>
      )}
      <div className={styles.records}>
        {rows.length ? (
          rows.slice(0, limit).map((row) => (
            <article className={styles.record} key={row.id}>
              {profile.editable ? (
                renderDetails(row)
              ) : (
                <>
                  <div className={styles.identity}>
                    <Button
                      className={styles.titleButton}
                      variant="quiet"
                      aria-label={profile.openLabel?.(row.original)}
                      onClick={() =>
                        (profile.onOpen ?? onOpen)
                          ? (profile.onOpen ?? onOpen)?.(row.original)
                          : setDetailId(row.id)
                      }
                    >
                      {labelFor(row)}
                    </Button>
                    {selecting ? (
                      <Button
                        size="icon"
                        variant={row.getIsSelected() ? "secondary" : "outline"}
                        aria-label={`${copy.select}: ${labelFor(row)}`}
                        aria-pressed={row.getIsSelected()}
                        disabled={!row.getCanSelect()}
                        onClick={() => row.toggleSelected()}
                      >
                        <Check />
                      </Button>
                    ) : profile.actionsColumn ? (
                      row
                        .getAllCells()
                        .filter(
                          (cell) => cell.column.id === profile.actionsColumn
                        )
                        .map((cell) => (
                          <span key={cell.id}>{renderCell(cell)}</span>
                        ))
                    ) : (
                      <Button
                        size="icon"
                        variant="quiet"
                        aria-label={`${copy.details}: ${labelFor(row)}`}
                        onClick={() => setDetailId(row.id)}
                      >
                        <MoreHorizontal />
                      </Button>
                    )}
                  </div>
                  <div className={styles.summary}>
                    {(profile.summaryColumns ?? []).map((id) => {
                      const cell = row
                        .getAllCells()
                        .find((item) => item.column.id === id);
                      return cell ? (
                        <span key={id}>{renderCell(cell)}</span>
                      ) : null;
                    })}
                  </div>
                </>
              )}
            </article>
          ))
        ) : (
          <CollectionState
            locale={locale}
            kind="empty"
            title={
              typeof props.emptyMessage === "string"
                ? props.emptyMessage
                : undefined
            }
          />
        )}
        {limit < rows.length && (
          <Button
            variant="outline"
            onClick={() => setLimit((value) => value + 30)}
          >
            {copy.loadMore}
          </Button>
        )}
      </div>
      <MobileActionSheet
        title={copy.more}
        closeLabel={copy.close}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
      >
        <div className={styles.fields}>
          {actions && <div className={styles.actions}>{actions}</div>}
          {columns.length > 0 && (
            <ViewSwitcher
              label={copy.sort}
              value={sort?.id ?? columns[0].id}
              options={columns.map((column) => ({
                value: column.id,
                label: String(
                  column.columnDef.meta?.headerTitle ??
                    (typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id)
                ),
              }))}
              onValueChange={(id) =>
                table.setSorting([{ id, desc: sort?.desc ?? false }])
              }
              mobilePresentation="sheet"
            />
          )}
          {sort && (
            <Button
              variant="outline"
              onClick={() => table.setSorting([{ ...sort, desc: !sort.desc }])}
            >
              {sort.desc ? copy.descending : copy.ascending}
            </Button>
          )}
          {filters.length > 0 && (
            <Button
              variant="quiet"
              onClick={() => table.resetColumnFilters(true)}
            >
              {copy.clear}
            </Button>
          )}
          {selection && (
            <Button
              variant="outline"
              onClick={() => {
                setSelecting(true);
                setActionsOpen(false);
              }}
            >
              {copy.select}
            </Button>
          )}
          <Button variant="primary" onClick={() => setActionsOpen(false)}>
            {copy.done}
          </Button>
        </div>
      </MobileActionSheet>
      <MobileActionSheet
        title={detail ? labelFor(detail) : copy.details}
        closeLabel={copy.close}
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
          }
        }}
      >
        {detail && renderDetails(detail)}
      </MobileActionSheet>
    </section>
  );
}
