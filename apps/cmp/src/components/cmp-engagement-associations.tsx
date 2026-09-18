"use client";

import type {
  CmpEngagement,
  TmsEngagementDirectoryItem,
} from "@project-wing/shared";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { Badge, Button, ButtonGroup, Input } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Search, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../api/client";
import type { CmpDictionary } from "../i18n/client";
import { CmpMasterDataGrid } from "./cmp-master-data-grid";
import { CmpTmsSummary } from "./cmp-tms-summary";

type EngagementAssociationsCopy =
  CmpDictionary["workspace"]["engagementAssociations"];
type LinkedEmpProject = TmsEngagementDirectoryItem & { projectId: string };
type EmpProjectColumn =
  ProjectWingMasterDataGridProps<LinkedEmpProject>["columns"][number];

export function CmpEngagementAssociations({
  copy,
  engagement,
}: {
  copy: EngagementAssociationsCopy;
  engagement: CmpEngagement;
}) {
  const queryClient = useQueryClient();
  const [empSearchOpen, setEmpSearchOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [submittedEmpSearch, setSubmittedEmpSearch] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const currentRelation = useQuery({
    queryKey: ["cmp-association-directory", engagement.engagementCode],
    queryFn: () => api.cmpAssociationDirectory(engagement.engagementCode),
  });
  const linkedEmpProjects =
    currentRelation.data?.engagements.filter(
      (item): item is LinkedEmpProject =>
        item.id === engagement.id && Boolean(item.projectId)
    ) ?? [];
  const empCandidates = useQuery({
    queryKey: ["cmp-association-directory", submittedEmpSearch],
    queryFn: () => api.cmpAssociationDirectory(submittedEmpSearch),
    enabled: Boolean(submittedEmpSearch),
  });
  const tmsSummary = useQuery({
    queryKey: ["cmp-tms-summary", engagement.id],
    queryFn: () => api.cmpTmsEngagementSummary(engagement.id),
  });
  const refreshAssociations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["cmp-association-directory"],
      }),
      queryClient.invalidateQueries({ queryKey: ["cmp-tms-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["cmp-engagements"] }),
    ]);
  };
  const linkEmp = useMutation({
    mutationFn: (candidate: TmsEngagementDirectoryItem) => {
      if (!candidate.projectId) {
        throw new Error("A project is required");
      }
      return api.linkEmpProject(candidate.projectId, {
        cmpClientId: engagement.clientId,
        cmpEngagementId: engagement.id,
      });
    },
    onSuccess: async () => {
      setActionMessage(copy.empLinkSuccess);
      setSubmittedEmpSearch("");
      setEmpSearch("");
      setEmpSearchOpen(false);
      await refreshAssociations();
    },
    onError: () => setActionMessage(copy.empLinkError),
  });
  const unlinkEmp = useMutation({
    mutationFn: (targetProjectId: string) =>
      api.unlinkEmpProject(targetProjectId),
    onSuccess: async () => {
      setActionMessage(copy.empUnlinkSuccess);
      await refreshAssociations();
    },
    onError: () => setActionMessage(copy.empUnlinkError),
  });
  const actionPending = linkEmp.isPending || unlinkEmp.isPending;
  const visibleEmpCandidates =
    empCandidates.data?.engagements.filter(
      (item): item is LinkedEmpProject =>
        item.source === "UNLINKED_PROJECT" && Boolean(item.projectId)
    ) ?? [];

  return (
    <div className="cmp-association-stack cmp-field-span-2">
      <div className="cmp-association-heading">
        <strong>{copy.title}</strong>
        <Badge variant="outline">{engagement.engagementCode}</Badge>
      </div>

      <section className="cmp-association-section">
        <div className="cmp-association-section-heading">
          <div>
            <strong>{copy.empProjects}</strong>
            <span>{copy.empRelation}</span>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant={empSearchOpen ? "secondary" : "outline"}
            accessibleName={copy.empAdd}
            tooltip={copy.empAdd}
            aria-expanded={empSearchOpen}
            onClick={() => setEmpSearchOpen((current) => !current)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>

        {currentRelation.isLoading ? (
          <p className="cmp-form-empty-note">{copy.empLoading}</p>
        ) : currentRelation.isError ? (
          <p className="cmp-form-empty-note">{copy.empLoadError}</p>
        ) : (
          <EmpProjectsTable
            copy={copy}
            projects={linkedEmpProjects}
            emptyMessage={copy.empNoLinks}
            actionLabel={copy.empUnlink}
            actionVariant="danger"
            actionIcon={<Unlink aria-hidden="true" />}
            actionPending={actionPending}
            onAction={(project) => unlinkEmp.mutate(project.projectId)}
            testId="cmp-linked-emp-projects"
          />
        )}

        {empSearchOpen ? (
          <div className="cmp-association-picker">
            <strong>{copy.empAddPanelTitle}</strong>
            <SearchBar
              ariaLabel={copy.empSearchLabel}
              buttonLabel={copy.empSearchButton}
              placeholder={copy.empSearchPlaceholder}
              value={empSearch}
              onChange={setEmpSearch}
              onSearch={() => setSubmittedEmpSearch(empSearch.trim())}
            />
            {submittedEmpSearch && !empCandidates.isFetching ? (
              <EmpProjectsTable
                copy={copy}
                projects={visibleEmpCandidates}
                emptyMessage={copy.empNoResults}
                actionLabel={copy.empLink}
                actionVariant="primary"
                actionIcon={<Link2 aria-hidden="true" />}
                actionPending={actionPending}
                onAction={(project) => linkEmp.mutate(project)}
                testId="cmp-available-emp-projects"
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="cmp-association-section">
        <div className="cmp-association-section-heading">
          <div>
            <strong>{copy.tmsContribution}</strong>
            <span>{copy.tmsReadOnlyRelation}</span>
          </div>
          <Badge variant="outline">{copy.readOnly}</Badge>
        </div>
        {tmsSummary.isLoading ? (
          <p className="cmp-form-empty-note">{copy.tmsSummaryLoading}</p>
        ) : tmsSummary.isError || !tmsSummary.data ? (
          <p className="cmp-form-empty-note">{copy.tmsSummaryError}</p>
        ) : (
          <CmpTmsSummary summary={tmsSummary.data} />
        )}
      </section>

      {actionMessage ? (
        <output className="cmp-association-message">{actionMessage}</output>
      ) : null}
    </div>
  );
}

function SearchBar({
  ariaLabel,
  buttonLabel,
  placeholder,
  value,
  onChange,
  onSearch,
}: {
  ariaLabel: string;
  buttonLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="cmp-association-search">
      <Input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSearch();
          }
        }}
      />
      <ButtonGroup>
        <Button type="button" variant="outline" onClick={onSearch}>
          <Search aria-hidden="true" />
          {buttonLabel}
        </Button>
      </ButtonGroup>
    </div>
  );
}

function EmpProjectsTable({
  copy,
  projects,
  emptyMessage,
  actionLabel,
  actionVariant,
  actionIcon,
  actionPending,
  onAction,
  testId,
}: {
  copy: EngagementAssociationsCopy;
  projects: LinkedEmpProject[];
  emptyMessage: string;
  actionLabel: string;
  actionVariant: "danger" | "primary";
  actionIcon: ReactNode;
  actionPending: boolean;
  onAction: (project: LinkedEmpProject) => void;
  testId: string;
}) {
  const columns = useMemo<EmpProjectColumn[]>(
    () => [
      {
        id: "projectCode",
        accessorFn: (project) => project.projectCode ?? project.engagementCode,
        header: copy.empColumnCode,
        cell: ({ row }) => (
          <strong className="block truncate font-mono text-xs font-medium text-foreground">
            {row.original.projectCode ?? row.original.engagementCode}
          </strong>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        meta: { autoSize: true, headerTitle: copy.empColumnCode },
        size: 190,
      },
      {
        id: "projectName",
        accessorFn: (project) => project.projectName ?? copy.empProjectFallback,
        header: copy.empColumnName,
        cell: ({ row }) => (
          <span className="block truncate text-foreground">
            {row.original.projectName ?? copy.empProjectFallback}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        meta: { autoSize: true, headerTitle: copy.empColumnName },
        size: 360,
      },
      {
        id: "action",
        header: copy.empColumnAction,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              type="button"
              size="xs"
              variant={actionVariant}
              accessibleName={`${actionLabel}: ${
                row.original.projectCode ?? row.original.engagementCode
              }`}
              disabled={actionPending}
              onClick={() => onAction(row.original)}
            >
              {actionIcon}
              {actionLabel}
            </Button>
          </div>
        ),
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { autoSize: true, headerTitle: copy.empColumnAction },
        size: 140,
      },
    ],
    [actionIcon, actionLabel, actionPending, actionVariant, copy, onAction]
  );

  return (
    <CmpMasterDataGrid
      mobile={{ titleColumn: "projectCode", summaryColumns: ["projectName"] }}
      columns={columns}
      data={projects}
      emptyMessage={emptyMessage}
      getRowId={(project) => project.projectId}
      initialSorting={[]}
      showRecordCount={false}
      showRowSelection={false}
      showToolbar={false}
      tableLabel={copy.empProjects}
      tableLayout={{ headerSticky: false, columnsVisibility: false }}
      testId={testId}
      title={copy.empProjects}
    />
  );
}
