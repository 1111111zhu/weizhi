"use client";

import type { CmpClient } from "@project-wing/shared";
import type { DataGridColumnHeaderProps } from "@project-wing/ui";

import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridColumnHeaderFilter } from "@/components/reui/data-grid/data-grid-column-header-filter";
import type { CmpDictionary } from "@/i18n/client";

export type WorkspaceCopy = CmpDictionary["workspace"];

export { projectWingSelectedValuesFilter as selectedValuesFilter } from "@project-wing/ui";

export function CmpClientColumnHeader<TValue>({
  column,
  copy,
  title,
}: {
  column: DataGridColumnHeaderProps<CmpClient, TValue>["column"];
  copy: WorkspaceCopy;
  title: string;
}) {
  return (
    <DataGridColumnHeader
      column={column}
      filter={
        <DataGridColumnHeaderFilter
          column={column}
          copy={{
            clear: copy.clearFilters,
            empty: copy.filterNoResults,
            filter: copy.filter,
            search: copy.filterSearch,
          }}
          title={title}
        />
      }
      title={title}
    />
  );
}
