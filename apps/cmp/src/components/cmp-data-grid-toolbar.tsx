"use client";

import {
  DataGridColumnVisibility,
  MotionButton,
  ProjectWingDataGridToolbar,
} from "@project-wing/ui";
import type { ProjectWingDataGridToolbarProps } from "@project-wing/ui";
import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { useCmpI18n } from "@/i18n/client";

type CmpDataGridTable<TData> = NonNullable<
  ProjectWingDataGridToolbarProps<TData>["table"]
>;

export const CMP_DATA_GRID_TOOLBAR_ACTION_CLASS =
  "h-8 cursor-pointer gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[0.8rem]! font-semibold!";

export function CmpDataGridToolbar<TData>({
  draftToggle,
  leadingActions,
  recordCount: providedRecordCount,
  table,
  title,
  trailingActions,
}: {
  draftToggle?: ReactNode;
  leadingActions?: ReactNode;
  recordCount?: number;
  table?: CmpDataGridTable<TData>;
  title: string;
  trailingActions?: ReactNode;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  return (
    <ProjectWingDataGridToolbar
      locale={locale}
      actions={
        <>
          {leadingActions}
          {draftToggle}
          {table ? (
            <DataGridColumnVisibility
              locale={locale}
              label={copy.dataGridColumns}
              showChevron={false}
              table={table}
              trigger={
                <MotionButton
                  aria-label={copy.dataGridColumns}
                  className={CMP_DATA_GRID_TOOLBAR_ACTION_CLASS}
                  size="sm"
                  variant="secondary"
                >
                  <Settings2 aria-hidden="true" className="size-3.5" />
                  <span>{copy.dataGridColumns}</span>
                </MotionButton>
              }
            />
          ) : null}
          {trailingActions}
        </>
      }
      recordCount={providedRecordCount}
      selectionSummary={copy.dataGridSelectionSummary}
      table={table}
      title={title}
    />
  );
}
