import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2FixedSheetRow,
  SmartFormV2LocalizedRichText,
  SmartFormV2Response,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import type { ReactNode } from "react";
import { useId } from "react";

import {
  mobileSheetFieldSpan,
  projectMobileSheetColumns,
} from "./smart-form-v2-mobile-sheet";
import {
  isSmartFormV2FieldRequired,
  SmartFormV2RequiredIndicator,
} from "./smart-form-v2-required-indicator";

import styles from "./smart-form-v2-mobile-records.module.css";

/** Mobile projection only: the caller owns answers, validation and review targets. */
export function SmartFormV2MobileRecords<
  Row extends { source: SmartFormV2FixedSheetRow },
>({
  sheet,
  rows,
  definition,
  response,
  requiredLabel,
  optionalLabel,
  renderHeading,
  renderText,
  renderValue,
  isVisible,
}: {
  sheet: SmartFormV2SheetNode;
  rows: readonly Row[];
  definition: SmartFormV2CompiledDefinition;
  response?: SmartFormV2Response;
  requiredLabel: string;
  optionalLabel: string;
  renderHeading: (row: Row) => ReactNode;
  renderText: (text: SmartFormV2LocalizedRichText) => ReactNode;
  renderValue: (
    row: Row,
    column: SmartFormV2SheetLeafColumn,
    labelId: string
  ) => ReactNode;
  isVisible: (row: Row, column: SmartFormV2SheetLeafColumn) => boolean;
}) {
  const labelPrefix = useId();
  const columns = projectMobileSheetColumns(sheet.columns).filter(
    ({ column }) => column.cell.kind !== "rowLabel"
  );
  return (
    <div className={styles.records} data-smart-form-mobile-records>
      {rows.map((row) => (
        <article
          key={row.source.id}
          className={styles.record}
          data-smart-form-node-id={sheet.id}
          data-smart-form-row-id={row.source.id}
          data-row-role={row.source.role ?? "data"}
        >
          <div className={styles.heading}>{renderHeading(row)}</div>
          {row.source.role === "group" ? null : (
            <dl className={styles.fields}>
              {columns
                .filter(
                  ({ column }) =>
                    row.source.cells?.[column.id]?.kind !== "empty" &&
                    isVisible(row, column)
                )
                .map(({ column, ancestors }) => {
                  const labelId = `${labelPrefix}-${row.source.id}-${column.id}`;
                  const override = row.source.cells?.[column.id];
                  const field =
                    column.cell.kind === "field" && override?.kind !== "content"
                      ? column.cell.field
                      : undefined;
                  const behavior =
                    field && override?.kind === "field"
                      ? { ...field, ...override }
                      : field;
                  return (
                    <div
                      key={column.id}
                      className={styles.field}
                      data-field-span={mobileSheetFieldSpan(row.source, column)}
                      data-smart-form-column-id={column.id}
                    >
                      <dt id={labelId} className={styles.label}>
                        {ancestors.map((ancestor) => (
                          <span key={ancestor.id} className={styles.headerPath}>
                            {renderText(ancestor.header)}
                            <span aria-hidden> / </span>
                          </span>
                        ))}
                        {renderText(column.header)}
                        {behavior ? (
                          <SmartFormV2RequiredIndicator
                            required={isSmartFormV2FieldRequired(
                              behavior,
                              definition,
                              response
                            )}
                            requiredLabel={requiredLabel}
                            optionalLabel={optionalLabel}
                          />
                        ) : null}
                      </dt>
                      <dd className={styles.value}>
                        {renderValue(row, column, labelId)}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          )}
        </article>
      ))}
    </div>
  );
}
