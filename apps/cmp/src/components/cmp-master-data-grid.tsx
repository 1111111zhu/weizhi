"use client";

import {
  ProjectWingMasterDataGrid,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";

import { useCmpI18n } from "@/i18n/client";

import { CmpMobileGrid } from "./cmp-mobile-grid";
import type { CmpMobileGridProfile } from "./cmp-mobile-grid";

export {
  ProjectWingMasterDataGridColumnHeader as CmpMasterDataGridColumnHeader,
  projectWingSelectedValuesFilter as cmpSelectedValuesFilter,
} from "@project-wing/ui";

export function CmpMasterDataGrid<TData extends object>({
  mobile,
  ...props
}: ProjectWingMasterDataGridProps<TData> & {
  mobile?: CmpMobileGridProfile<TData>;
}) {
  const phone = useCompactViewport(767.98);
  const copy = useCmpI18n().dictionary.workspace;
  return (
    <ProjectWingMasterDataGrid
      {...props}
      columnVisibilityCompact
      columnVisibilityLabel={copy.dataGridColumns}
      selectionSummary={copy.dataGridSelectionSummary}
      {...(phone && mobile
        ? {
            showToolbar: false,
            content: (
              <CmpMobileGrid
                profile={mobile}
                title={props.title}
                onOpen={props.onRowClick}
                selection={props.showRowSelection ?? false}
                showToolbar={props.showToolbar !== false}
                actions={
                  <>
                    {props.primaryAction}
                    {props.actions ?? props.leadingActions}
                    {props.persistentActions}
                    {props.titleAdornment}
                    {props.trailingActions}
                  </>
                }
              />
            ),
            paginationPageSizeOptions: undefined,
          }
        : {})}
    />
  );
}
