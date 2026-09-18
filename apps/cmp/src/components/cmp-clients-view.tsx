"use client";

import type {
  CmpClient,
  CmpClientGroup,
  CmpClientGroupStructure,
  CmpClientSubsidiaryNode,
  CmpAcceptanceDraftListItem,
  CreateCmpAcceptanceRequestInput,
  CreateCmpClientGroupInput,
  UpdateCmpClientGroupInput,
} from "@project-wing/shared";
import {
  Button,
  ButtonGroup,
  Input,
  Skeleton,
  projectWingToast as sonnerToast,
} from "@project-wing/ui";
import {
  ArrowLeftRight,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronRight,
  Handshake,
  Minus,
  Network,
  Pencil,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CurrentUser, DirectoryUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import {
  ClientMasterForm,
  EMPTY_CLIENT_MASTER_FORM,
  clientMasterFormFromClient,
  parseClientServiceTypes,
} from "./client-master-form";
import type {
  ClientMasterFormData,
  ClientServiceType,
} from "./client-master-form";
import {
  CmpAsyncActionFeedback,
  useCmpAsyncActionFeedback,
} from "./cmp-async-action-feedback";
import { CmpBooleanIndicator } from "./cmp-boolean-indicator";
import { CmpClientsDataGrid } from "./cmp-clients-data-grid";
import { NativeSelect } from "./ui/native-select";

type ClientsViewMode = "list" | "client-form" | "group-form";

type ClientFilters = {
  groupCode: string;
  clientCode: string;
  companyCode: string;
  companyNumber: string;
  clientName: string;
  companyType: string;
  status: string;
  annualAudit: string;
  review: string;
  specialAudit: string;
  others: string;
};

type GroupStructureRequest = {
  group: CmpClientGroup;
  status: "loading" | "error";
};

const EMPTY_GROUP_FORM = {
  groupCode: "",
  nameZh: "",
  nameEn: "",
  status: "ACTIVE" as CmpClientGroup["status"],
};
const EMPTY_CMP_DRAFTS: CmpAcceptanceDraftListItem[] = [];
const NOOP_DELETE_DRAFT = async (_id: string) => {};
const _EMPTY_FILTERS: ClientFilters = {
  groupCode: "",
  clientCode: "",
  companyCode: "",
  companyNumber: "",
  clientName: "",
  companyType: "",
  status: "",
  annualAudit: "",
  review: "",
  specialAudit: "",
  others: "",
};

export function CmpClientsView({
  clients,
  groups,
  users,
  currentUser,
  isCreatingClient,
  isCreatingGroup,
  isUpdating,
  isSubmittingChange,
  onCreateGroup,
  onSubmitClientChange,
  onUpdateGroup,
  onLoadGroupStructure,
  onCreateClient,
  onEditClient,
  drafts = EMPTY_CMP_DRAFTS,
  onDeleteDraft = NOOP_DELETE_DRAFT,
  searchValue,
  onSearchValueChange: _onSearchValueChange,
}: {
  clients: CmpClient[];
  groups: CmpClientGroup[];
  users?: DirectoryUser[];
  currentUser?: CurrentUser;
  isCreatingClient?: boolean;
  isCreatingGroup?: boolean;
  isUpdating?: boolean;
  isSubmittingChange?: boolean;
  onCreateGroup: (input: CreateCmpClientGroupInput) => Promise<unknown>;
  onSubmitClientChange: (
    input: CreateCmpAcceptanceRequestInput
  ) => Promise<unknown>;
  onUpdateGroup: (
    id: string,
    input: UpdateCmpClientGroupInput
  ) => Promise<unknown>;
  onLoadGroupStructure: (id: string) => Promise<CmpClientGroupStructure>;
  onCreateClient?: () => void;
  onEditClient?: (client: CmpClient) => void;
  drafts?: CmpAcceptanceDraftListItem[];
  onDeleteDraft?: (id: string) => Promise<unknown>;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
}) {
  const { dictionary, localizedPath: _localizedPath } = useCmpI18n();
  const copy = dictionary.workspace;
  const canCreateAcceptance =
    !currentUser || ["MANAGER", "PARTNER"].includes(currentUser.globalRole);
  const canCreateChange =
    !currentUser || ["MANAGER", "PARTNER"].includes(currentUser.globalRole);
  const isPartnerInitiator = currentUser?.globalRole === "PARTNER";
  const canManageGroups =
    !currentUser ||
    ["SUPER_ADMIN", "MANAGER", "PARTNER"].includes(currentUser.globalRole);
  const [internalSearch, setInternalSearch] = useState("");
  void setInternalSearch;
  const search = searchValue ?? internalSearch;
  const [viewMode, setViewMode] = useState<ClientsViewMode>("list");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM);
  const [clientForm, setClientForm] = useState<ClientMasterFormData>(
    EMPTY_CLIENT_MASTER_FORM
  );
  const [isClientFormActionRunning, setIsClientFormActionRunning] =
    useState(false);
  const [groupStructure, setGroupStructure] =
    useState<CmpClientGroupStructure | null>(null);
  const [groupStructureRequest, setGroupStructureRequest] =
    useState<GroupStructureRequest | null>(null);
  const [loadingEditClientId, setLoadingEditClientId] = useState<string | null>(
    null
  );
  const approverOptions = useMemo(
    () =>
      [...(users ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    [users]
  );
  const findDefaultApprover = (roles: DirectoryUser["globalRole"][]) =>
    approverOptions.find((user) => user.globalRole === roles[0]) ??
    approverOptions.find((user) => roles.includes(user.globalRole));
  const defaultRouting = () => ({
    clientManagerMicId: findDefaultApprover(["MANAGER"])?.id ?? "",
    picApproverId: findDefaultApprover(["PARTNER", "PRINCIPAL"])?.id ?? "",
    itApproverId:
      approverOptions.find((user) => user.globalRole === "SUPER_ADMIN")?.id ??
      "",
  });
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((client) => {
      const searchableValues = [
        client.clientCode,
        client.companyCode,
        client.companyNumber,
        client.nameZh,
        client.nameEn,
        client.group?.groupCode,
        client.group?.nameZh,
        client.group?.nameEn,
        client.contactPerson,
        client.email,
        client.telephone,
        client.clientPartnerPic,
        client.clientManagerMic,
        client.placeOfIncorporation,
        client.hsicSectionCode,
        client.industryOtherDescription,
        client.approvalReferenceNumber,
        client.serviceLines,
      ];
      const matchesKeyword =
        !q ||
        searchableValues
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      return matchesKeyword;
    });
  }, [clients, search]);

  const returnToList = () => {
    setIsClientFormActionRunning(false);
    setViewMode("list");
    setEditingClientId(null);
    setEditingGroupId(null);
    setClientForm(EMPTY_CLIENT_MASTER_FORM);
    setGroupForm(EMPTY_GROUP_FORM);
  };

  function openClientEdit(client: CmpClient) {
    if (onEditClient) {
      onEditClient(client);
      return;
    }
    setLoadingEditClientId(client.id);
    setEditingClientId(client.id);
    setClientForm(clientMasterFormFromClient(client, defaultRouting()));
    setViewMode("client-form");
    setLoadingEditClientId(null);
  }

  async function openGroupStructure(group: CmpClientGroup) {
    setGroupStructure(null);
    setGroupStructureRequest({ group, status: "loading" });
    try {
      setGroupStructure(await onLoadGroupStructure(group.id));
      setGroupStructureRequest(null);
    } catch {
      sonnerToast.error("Could not load Group structure", { duration: 5000 });
      setGroupStructureRequest({
        group,
        status: "error",
      });
    }
  }

  return (
    <section className="cmp-clients-workspace">
      <section className="cmp-client-management-panel grid h-full min-h-0 grid-rows-[minmax(0,1fr)]">
        {viewMode === "group-form" ? (
          <GroupModal
            groups={groups}
            groupForm={groupForm}
            editingGroupId={editingGroupId}
            isCreatingGroup={isCreatingGroup}
            isUpdating={isUpdating}
            onChange={setGroupForm}
            onClose={returnToList}
            onSubmit={async () => {
              if (!groupForm.groupCode.trim() || !groupForm.nameZh.trim()) {
                return;
              }
              await (editingGroupId
                ? onUpdateGroup(editingGroupId, groupForm)
                : onCreateGroup(groupForm));
            }}
            onEditGroup={(group) => {
              setEditingGroupId(group.id);
              setGroupForm({
                groupCode: group.groupCode,
                nameZh: group.nameZh ?? "",
                nameEn: group.nameEn ?? "",
                status: group.status,
              });
            }}
            canManage={canManageGroups}
            onViewStructure={(group) => void openGroupStructure(group)}
          />
        ) : null}

        {viewMode === "client-form" ? (
          <div className="cmp-modal-backdrop" role="presentation">
            <dialog
              open
              className="cmp-modal cmp-client-modal cmp-client-form-modal m-0"
              aria-modal="true"
              aria-label={
                editingClientId ? "Edit client" : "New client acceptance"
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  if (
                    isCreatingClient ||
                    isSubmittingChange ||
                    isClientFormActionRunning
                  ) {
                    return;
                  }
                  returnToList();
                }
              }}
            >
              <ClientMasterForm
                initialValue={clientForm}
                groups={groups}
                existingClients={clients}
                excludeClientId={editingClientId}
                users={users}
                mode={editingClientId ? "edit-request" : "acceptance"}
                title={
                  editingClientId
                    ? copy.clientChangeTitle
                    : copy.newClientAcceptance
                }
                isBusy={isCreatingClient || isSubmittingChange}
                submitLabel={
                  editingClientId
                    ? isPartnerInitiator
                      ? "Submit change to MIC"
                      : "Submit change request"
                    : isPartnerInitiator
                      ? "Submit to MIC"
                      : "Submit client acceptance"
                }
                reviewLabel={
                  isPartnerInitiator
                    ? "Review & send to MIC"
                    : "Review & submit"
                }
                canDelegateDraft={canCreateAcceptance}
                draftOwnerLabel={
                  isPartnerInitiator ? copy.requestOwner : undefined
                }
                onCancel={returnToList}
                onSubmit={(result) =>
                  onSubmitClientChange({
                    type: editingClientId ? "CLIENT_CHANGE" : "CLIENT",
                    targetClientId: editingClientId ?? undefined,
                    clientPayload: result.payload,
                    draftAssigneeId: result.draftAssigneeId,
                    micApproverId: result.micApproverId,
                    picApproverId: result.picApproverId,
                    itApproverId: result.itApproverId,
                    submit: result.action === "submit",
                  })
                }
                onSubmitSuccess={(result) => {
                  if (result.action === "submit") {
                    setClientForm(EMPTY_CLIENT_MASTER_FORM);
                    setEditingClientId(null);
                    setViewMode("list");
                  }
                }}
                onBusyChange={setIsClientFormActionRunning}
              />
            </dialog>
          </div>
        ) : null}

        {groupStructureRequest ? (
          <GroupStructureRequestModal
            request={groupStructureRequest}
            onClose={() => setGroupStructureRequest(null)}
            onRetry={() => void openGroupStructure(groupStructureRequest.group)}
          />
        ) : null}
        {groupStructure ? (
          <GroupStructureModal
            structure={groupStructure}
            onClose={() => setGroupStructure(null)}
          />
        ) : null}

        <div className="min-h-0">
          <CmpClientsDataGrid
            clients={filteredClients}
            drafts={drafts}
            loadingEditClientId={loadingEditClientId}
            onEdit={openClientEdit}
            canEdit={canCreateChange}
            canCreateClient={canCreateAcceptance}
            onCreateClient={() => {
              if (onCreateClient) {
                onCreateClient();
                return;
              }
              setIsClientFormActionRunning(false);
              setEditingClientId(null);
              setClientForm({
                ...EMPTY_CLIENT_MASTER_FORM,
                ...defaultRouting(),
              });
              setViewMode("client-form");
            }}
            onDeleteDraft={onDeleteDraft}
          />
        </div>
      </section>
    </section>
  );
}

function GroupModal({
  groups,
  groupForm,
  editingGroupId,
  isCreatingGroup,
  isUpdating,
  onChange,
  onClose,
  onSubmit,
  onEditGroup,
  onViewStructure,
  canManage,
}: {
  groups: CmpClientGroup[];
  groupForm: typeof EMPTY_GROUP_FORM;
  editingGroupId: string | null;
  isCreatingGroup?: boolean;
  isUpdating?: boolean;
  onChange: (form: typeof EMPTY_GROUP_FORM) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onEditGroup: (group: CmpClientGroup) => void;
  onViewStructure: (group: CmpClientGroup) => void;
  canManage: boolean;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const actionFeedback = useCmpAsyncActionFeedback();
  const isBusy = Boolean(
    isCreatingGroup || isUpdating || actionFeedback.isRunning
  );
  return (
    <div className="cmp-modal-backdrop" role="presentation">
      <dialog
        open
        className="cmp-modal cmp-group-modal m-0"
        aria-modal="true"
        aria-label={
          canManage ? (editingGroupId ? "Edit group" : "Add group") : "Groups"
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (isBusy) {
              return;
            }
            onClose();
          }
        }}
      >
        <div className="cmp-group-structure-header">
          <div>
            <p className="cmp-eyebrow">
              {canManage
                ? editingGroupId
                  ? "Edit group"
                  : "New group"
                : "Group directory"}
            </p>
            <h3>Client group details</h3>
          </div>
          <Button
            type="button"
            className="cmp-group-structure-close"
            aria-label="Close Group structure"
            onClick={onClose}
            disabled={isBusy}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        {canManage ? (
          <form
            className="cmp-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!groupForm.groupCode.trim() || !groupForm.nameZh.trim()) {
                return;
              }
              void Promise.resolve(
                actionFeedback.run(
                  {
                    pendingLabel: editingGroupId
                      ? copy.savingGroup
                      : copy.creatingGroup,
                    successLabel: editingGroupId
                      ? copy.groupUpdated
                      : copy.groupCreated,
                  },
                  onSubmit
                )
              )
                .then(onClose)
                .catch(() => {
                  // The page mutation reports the error and leaves this form open.
                });
            }}
          >
            <label htmlFor="cmp-group-code">
              Group code
              <Input
                id="cmp-group-code"
                value={groupForm.groupCode}
                onChange={(event) =>
                  onChange({ ...groupForm, groupCode: event.target.value })
                }
              />
            </label>
            <label htmlFor="cmp-group-name-zh">
              Chinese name
              <Input
                id="cmp-group-name-zh"
                value={groupForm.nameZh}
                onChange={(event) =>
                  onChange({ ...groupForm, nameZh: event.target.value })
                }
              />
            </label>
            <label htmlFor="cmp-group-name-en">
              English name
              <Input
                id="cmp-group-name-en"
                value={groupForm.nameEn}
                onChange={(event) =>
                  onChange({ ...groupForm, nameEn: event.target.value })
                }
              />
            </label>
            <label htmlFor="cmp-group-status">
              Status
              <NativeSelect
                id="cmp-group-status"
                value={groupForm.status}
                onChange={(event) =>
                  onChange({
                    ...groupForm,
                    status: event.target.value as CmpClientGroup["status"],
                  })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </NativeSelect>
            </label>
            <Button
              type="submit"
              className="cmp-primary-button"
              disabled={isBusy}
            >
              {editingGroupId
                ? isBusy
                  ? "Saving..."
                  : "Save group"
                : isBusy
                  ? "Creating..."
                  : "Create group"}
            </Button>
            {editingGroupId ? (
              <Button
                type="button"
                className="cmp-secondary-button"
                onClick={onClose}
                disabled={isBusy}
              >
                Cancel
              </Button>
            ) : null}
          </form>
        ) : null}
        <CmpAsyncActionFeedback feedback={actionFeedback.feedback} />

        {groups.length > 0 ? (
          <div className="cmp-list-stack">
            {groups.map((group) => (
              <article key={group.id} className="cmp-group-row">
                <div className="cmp-group-summary">
                  <strong>{group.groupCode}</strong>
                  <p>{group.nameZh}</p>
                  {group.nameEn ? <span>{group.nameEn}</span> : null}
                  <small>
                    Ultimate Parent:{" "}
                    {group.ultimateParent
                      ? `${group.ultimateParent.clientCode} - ${group.ultimateParent.nameEn || group.ultimateParent.nameZh}`
                      : "Not assigned"}
                  </small>
                </div>
                <div className="cmp-row-actions">
                  <span>{group.clientCount} clients</span>
                  <Button
                    type="button"
                    className="cmp-text-button"
                    onClick={() => onViewStructure(group)}
                  >
                    View structure
                  </Button>
                  {canManage ? (
                    <Button
                      type="button"
                      className="cmp-text-button"
                      onClick={() => onEditGroup(group)}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="cmp-empty">No client groups yet</div>
        )}
      </dialog>
    </div>
  );
}

function GroupStructureRequestModal({
  request,
  onClose,
  onRetry,
}: {
  request: GroupStructureRequest;
  onClose: () => void;
  onRetry: () => void;
}) {
  const dialogRef = useGroupStructureDialogFocus(onClose);

  return (
    <div className="cmp-modal-backdrop" role="presentation">
      <dialog
        open
        className="cmp-modal cmp-group-structure-modal m-0"
        aria-modal="true"
        aria-label="Group structure"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="cmp-group-structure-header">
          <div>
            <p className="cmp-eyebrow">{request.group.groupCode}</p>
            <h3>Group structure</h3>
          </div>
          <Button
            type="button"
            className="cmp-group-structure-close"
            aria-label="Close Group structure"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        {request.status === "loading" ? (
          <div className="cmp-empty">Loading Group structure...</div>
        ) : (
          <div className="cmp-empty">
            <Button
              type="button"
              className="cmp-secondary-button"
              onClick={onRetry}
            >
              Retry
            </Button>
          </div>
        )}
      </dialog>
    </div>
  );
}

function GroupStructureModal({
  structure,
  onClose,
}: {
  structure: CmpClientGroupStructure;
  onClose: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const dialogRef = useGroupStructureDialogFocus(onClose);
  const entityCount = structure.subsidiaryTree.reduce(
    (total, node) => total + countGroupStructureNodes(node),
    0
  );
  const subsidiaryCount = structure.subsidiaryTree.reduce(
    (total, node) => total + countGroupStructureRelationships(node),
    0
  );
  const groupName = structure.group.nameEn || structure.group.nameZh;
  const ultimateParentLabel = structure.ultimateParent
    ? `${structure.ultimateParent.clientCode} - ${structure.ultimateParent.nameEn || structure.ultimateParent.nameZh}`
    : "Not assigned";

  return (
    <div className="cmp-modal-backdrop" role="presentation">
      <dialog
        open
        className="cmp-modal cmp-group-structure-modal m-0"
        aria-modal="true"
        aria-label="Group structure"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="cmp-group-structure-header">
          <div>
            <p className="cmp-eyebrow">{structure.group.groupCode}</p>
            <div className="cmp-group-structure-title-row">
              <h3>{groupName}</h3>
              <span
                className={`cmp-group-status is-${structure.group.status.toLowerCase()}`}
              >
                {structure.group.status}
              </span>
            </div>
            <p className="cmp-group-structure-stats">
              {entityCount} {entityCount === 1 ? "entity" : "entities"} /{" "}
              {subsidiaryCount}{" "}
              {subsidiaryCount === 1 ? "subsidiary" : "subsidiaries"} /{" "}
              {structure.associates.length}{" "}
              {structure.associates.length === 1 ? "associate" : "associates"} /{" "}
              {structure.jointVentures.length}{" "}
              {structure.jointVentures.length === 1
                ? "joint venture"
                : "joint ventures"}
            </p>
          </div>
          <Button
            type="button"
            className="cmp-group-structure-close"
            aria-label="Close Group structure"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="cmp-group-structure-content">
          <section className="cmp-group-ultimate-parent">
            <Building2 aria-hidden="true" />
            <p>Ultimate Parent: {ultimateParentLabel}</p>
          </section>
          {structure.warnings.length > 0 ? (
            <div className="cmp-form-warning">
              {structure.warnings.map((warning) => (
                <p key={`${warning.code}-${warning.clientId ?? "group"}`}>
                  {warning.message}
                </p>
              ))}
            </div>
          ) : null}
          <section className="cmp-group-structure-tree-panel">
            <h4>Subsidiary structure</h4>
            {structure.subsidiaryTree.length > 0 ? (
              <div className="cmp-group-tree">
                {structure.subsidiaryTree.map((node) => (
                  <GroupStructureNode
                    key={node.client.id}
                    node={node}
                    isUltimateParent={
                      structure.ultimateParent?.id === node.client.id
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="cmp-empty">No Group members.</div>
            )}
          </section>
          <aside className="cmp-group-related-entities">
            <GroupRelationshipPanel
              title="Associates"
              type="ASSOCIATE"
              relationships={structure.associates}
            />
            <GroupRelationshipPanel
              title="Joint ventures"
              type="JOINT_VENTURE"
              relationships={structure.jointVentures}
            />
          </aside>
          <section className="cmp-group-history-panel">
            <button
              type="button"
              className="cmp-group-history-trigger"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((isOpen) => !isOpen)}
            >
              {historyOpen ? (
                <ChevronDown aria-hidden="true" />
              ) : (
                <ChevronRight aria-hidden="true" />
              )}
              <span>Relationship history</span>
              <small>
                {structure.relationshipHistory.length} ended{" "}
                {structure.relationshipHistory.length === 1
                  ? "relationship"
                  : "relationships"}
              </small>
            </button>
            {historyOpen ? (
              <div className="cmp-group-history-content">
                <GroupRelationshipTable
                  title="Relationship history"
                  relationships={structure.relationshipHistory}
                  showHistory
                  hideTitle
                />
              </div>
            ) : null}
          </section>
        </div>
      </dialog>
    </div>
  );
}

function useGroupStructureDialogFocus(onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeDialog = dialogRef.current;
      if (!activeDialog) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = [
        ...activeDialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => element.getAttribute("aria-hidden") !== "true");

      if (focusableElements.length === 0) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }

      const [first] = focusableElements;
      const last = focusableElements.at(-1);
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return dialogRef;
}

function GroupStructureNode({
  node,
  isUltimateParent = false,
}: {
  node: CmpClientSubsidiaryNode;
  isUltimateParent?: boolean;
}) {
  return (
    <div className="cmp-group-tree-node">
      <div className="cmp-group-tree-node-row">
        <Building2 aria-hidden="true" />
        <div className="cmp-group-tree-entity">
          <strong>{node.client.clientCode}</strong>
          <span>{node.client.nameEn || node.client.nameZh}</span>
        </div>
        <div className="cmp-group-tree-node-meta">
          {isUltimateParent ? (
            <span className="cmp-group-relationship-badge is-parent">
              Ultimate Parent
            </span>
          ) : null}
          {node.relationship?.ownershipPercentage !== null &&
          node.relationship?.ownershipPercentage !== undefined ? (
            <span className="cmp-group-ownership-badge">
              {node.relationship.ownershipPercentage}%
            </span>
          ) : null}
          {node.relationship?.effectiveFrom ? (
            <small>From {node.relationship.effectiveFrom}</small>
          ) : null}
        </div>
      </div>
      {node.children.length > 0 ? (
        <div className="cmp-group-tree-children">
          {node.children.map((child) => (
            <GroupStructureNode key={child.client.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function countGroupStructureNodes(node: CmpClientSubsidiaryNode): number {
  return (
    1 +
    node.children.reduce(
      (total, child) => total + countGroupStructureNodes(child),
      0
    )
  );
}

function countGroupStructureRelationships(
  node: CmpClientSubsidiaryNode
): number {
  return (
    (node.relationship ? 1 : 0) +
    node.children.reduce(
      (total, child) => total + countGroupStructureRelationships(child),
      0
    )
  );
}

function GroupRelationshipPanel({
  title,
  type,
  relationships,
}: {
  title: string;
  type: "ASSOCIATE" | "JOINT_VENTURE";
  relationships: CmpClientGroupStructure["associates"];
}) {
  const Icon = type === "ASSOCIATE" ? Network : Handshake;
  const DirectionIcon = type === "ASSOCIATE" ? ArrowRight : ArrowLeftRight;
  return (
    <section className="cmp-group-relationship-panel">
      <div className="cmp-group-relationship-panel-heading">
        <Icon aria-hidden="true" />
        <h4>{title}</h4>
        <span
          className={`cmp-group-relationship-badge is-${type.toLowerCase()}`}
        >
          {type === "ASSOCIATE" ? "Associate" : "Joint venture"}
        </span>
      </div>
      {relationships.length > 0 ? (
        <div className="cmp-group-relationship-list">
          {relationships.map((relationship) => (
            <article
              key={relationship.id}
              className="cmp-group-relationship-item"
            >
              <div className="cmp-group-relationship-parties">
                <strong>{relationship.fromClient.clientCode}</strong>
                <DirectionIcon aria-hidden="true" />
                <strong>{relationship.toClient.clientCode}</strong>
              </div>
              <dl>
                <div>
                  <dt>Ownership</dt>
                  <dd>
                    {relationship.ownershipPercentage === null
                      ? "-"
                      : `${relationship.ownershipPercentage}%`}
                  </dd>
                </div>
                <div>
                  <dt>Effective from</dt>
                  <dd>{relationship.effectiveFrom || "-"}</dd>
                </div>
                <div className="cmp-group-relationship-remarks">
                  <dt>Remarks</dt>
                  <dd>{relationship.remarks || "-"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="cmp-group-relationship-empty">No records.</div>
      )}
    </section>
  );
}

function GroupRelationshipTable({
  title,
  relationships,
  showHistory = false,
  hideTitle = false,
}: {
  title: string;
  relationships: CmpClientGroupStructure["associates"];
  showHistory?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <section>
      {hideTitle ? null : <h4>{title}</h4>}
      {relationships.length > 0 ? (
        <div className="cmp-table-shell">
          <table className="cmp-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                {showHistory ? <th>Type</th> : null}
                <th>Ownership</th>
                <th>Effective from</th>
                {showHistory ? <th>Effective to</th> : null}
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((relationship) => (
                <tr key={relationship.id}>
                  <td>{relationship.fromClient.clientCode}</td>
                  <td>{relationship.toClient.clientCode}</td>
                  {showHistory ? <td>{relationship.type}</td> : null}
                  <td>
                    {relationship.ownershipPercentage === null
                      ? "-"
                      : `${relationship.ownershipPercentage}%`}
                  </td>
                  <td>{relationship.effectiveFrom || "-"}</td>
                  {showHistory ? (
                    <td>{relationship.effectiveTo || "-"}</td>
                  ) : null}
                  <td>{relationship.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cmp-empty">No records.</div>
      )}
    </section>
  );
}

export function ClientFilterPanel({
  filters,
  search,
  hasFilters,
  onSearchChange,
  onFilterChange,
  onClear,
}: {
  filters: ClientFilters;
  search: string;
  hasFilters: boolean;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: keyof ClientFilters, value: string) => void;
  onClear: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  return (
    <div className="cmp-client-filter-panel">
      <label>
        {copy.groupCode}
        <Input
          value={filters.groupCode}
          onChange={(event) => onFilterChange("groupCode", event.target.value)}
        />
      </label>
      <label>
        {copy.clientCode}
        <Input
          value={filters.clientCode}
          onChange={(event) => onFilterChange("clientCode", event.target.value)}
        />
      </label>
      <label>
        {copy.companyCode}
        <Input
          value={filters.companyCode}
          onChange={(event) =>
            onFilterChange("companyCode", event.target.value)
          }
        />
      </label>
      <label>
        {copy.companyNumber}
        <Input
          value={filters.companyNumber}
          onChange={(event) =>
            onFilterChange("companyNumber", event.target.value)
          }
        />
      </label>
      <label className="cmp-filter-wide">
        {copy.clientNameShareholderContact}
        <Input
          value={filters.clientName}
          onChange={(event) => onFilterChange("clientName", event.target.value)}
        />
      </label>
      <label>
        {copy.companyType}
        <Input
          value={filters.companyType}
          onChange={(event) =>
            onFilterChange("companyType", event.target.value)
          }
        />
      </label>
      <label>
        {copy.status}
        <NativeSelect
          value={filters.status}
          onChange={(event) => onFilterChange("status", event.target.value)}
        >
          <option value="">{copy.all}</option>
          <option value="ACTIVE">{copy.clientStatusActive}</option>
          <option value="INACTIVE">{copy.clientStatusInactive}</option>
          <option value="RESIGNED">{copy.clientStatusResigned}</option>
        </NativeSelect>
      </label>
      {(
        [
          ["annualAudit", "Annual Audit"],
          ["review", "Review"],
          ["specialAudit", "Special audit"],
          ["others", "Others"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <NativeSelect
            value={filters[key]}
            onChange={(event) => onFilterChange(key, event.target.value)}
          >
            <option value="">{copy.all}</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </NativeSelect>
        </label>
      ))}
      <label className="cmp-filter-wide">
        {copy.keyword}
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={copy.searchClientDirectory}
        />
      </label>
      <Button
        type="button"
        className="cmp-secondary-button"
        onClick={onClear}
        disabled={!hasFilters}
      >
        {copy.clear}
      </Button>
    </div>
  );
}

export function ClientTable({
  clients,
  onContact,
  onEdit,
  canEdit,
  loadingEditClientId,
}: {
  clients: CmpClient[];
  onContact: (client: CmpClient) => void;
  onEdit: (client: CmpClient) => void;
  canEdit: boolean;
  loadingEditClientId: string | null;
}) {
  const { dictionary, localizedPath } = useCmpI18n();
  const copy = dictionary.workspace;
  return (
    <div className="cmp-table-wrap cmp-client-list-table-wrap cmp-results-settle">
      <table className="cmp-data-table cmp-client-management-table cmp-clients-master-table">
        <thead>
          <tr>
            <th>{copy.companyCode}</th>
            <th>{copy.companyNumber}</th>
            <th>{copy.clientCode}</th>
            <th>{copy.clientName}</th>
            <th>{copy.chineseName}</th>
            <th>{copy.companyType}</th>
            <th>{copy.yearEnd}</th>
            <th>{copy.placeOfIncorporation}</th>
            <th>{copy.business}</th>
            <th>{copy.contact}</th>
            <th>Annual Audit</th>
            <th>Review</th>
            <th>Special audit</th>
            <th>Others</th>
            <th>{copy.status}</th>
            <th>{copy.remarks}</th>
            <th className="cmp-actions-column">{copy.actions}</th>
          </tr>
        </thead>
        <tbody>
          {clients.length > 0 ? (
            clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <strong>{client.companyCode || "-"}</strong>
                </td>
                <td>
                  <strong>{client.companyNumber || "-"}</strong>
                </td>
                <td>
                  <strong>{client.clientCode}</strong>
                </td>
                <td>
                  <strong>{client.nameEn || client.nameZh}</strong>
                  {client.contactPerson ? (
                    <span>Contact: {client.contactPerson}</span>
                  ) : null}
                </td>
                <td>{client.nameZh}</td>
                <td>
                  {client.listedOrPrivate === "LISTED"
                    ? "Listed (Legacy)"
                    : client.listedOrPrivate === "OTHER"
                      ? client.companyTypeOtherDescription || "Others"
                      : client.listedOrPrivate || "-"}
                </td>
                <td>{formatClientYearEndMonth(client.yearEndMonth)}</td>
                <td>{client.placeOfIncorporation || "-"}</td>
                <td>
                  {client.hsicSectionCode === "OTHER"
                    ? client.industryOtherDescription || "Other"
                    : client.hsicSectionCode || "-"}
                </td>
                <td>
                  {(() => {
                    const hasContactDetails = Boolean(
                      client.contactPerson ||
                      client.email ||
                      client.telephone ||
                      client.website ||
                      client.address
                    );
                    return hasContactDetails ? (
                      <Button
                        type="button"
                        className="cmp-contact-entry-button is-available"
                        onClick={() => onContact(client)}
                        aria-label={copy.contact}
                      >
                        <UserCheck aria-hidden="true" />
                      </Button>
                    ) : (
                      <>
                        <span
                          className="cmp-contact-indicator is-missing"
                          aria-hidden="true"
                        >
                          <Minus />
                        </span>
                        <span className="sr-only">
                          {`${copy.contact}: ${copy.contactMissing}`}
                        </span>
                      </>
                    );
                  })()}
                </td>
                <td>
                  <CmpBooleanIndicator
                    value={hasClientServiceType(client, "Annual Audit")}
                    label="Annual Audit"
                    yesLabel={copy.yes}
                    noLabel={copy.no}
                  />
                </td>
                <td>
                  <CmpBooleanIndicator
                    value={hasClientServiceType(client, "Review")}
                    label="Review"
                    yesLabel={copy.yes}
                    noLabel={copy.no}
                  />
                </td>
                <td>
                  <CmpBooleanIndicator
                    value={hasClientServiceType(
                      client,
                      "Special audit for private co. (with audit opinion issued)"
                    )}
                    label="Special audit"
                    yesLabel={copy.yes}
                    noLabel={copy.no}
                  />
                </td>
                <td>
                  <CmpBooleanIndicator
                    value={hasClientServiceType(client, "Others")}
                    label="Others"
                    yesLabel={copy.yes}
                    noLabel={copy.no}
                  />
                </td>
                <td>
                  <span
                    className={`cmp-master-status is-${client.status.toLowerCase()}`}
                  >
                    {client.status === "ACTIVE"
                      ? copy.clientStatusActive
                      : client.status === "INACTIVE"
                        ? copy.clientStatusInactive
                        : copy.clientStatusResigned}
                  </span>
                </td>
                <td>{client.remarks || "-"}</td>
                <td className="cmp-actions-column">
                  {canEdit ? (
                    <ButtonGroup>
                      <Button
                        className="cmp-icon-action-button"
                        aria-label={`Create engagement for ${client.clientCode}`}
                        nativeButton={false}
                        render={
                          <Link
                            href={localizedPath(
                              `/engagement/new?clientId=${encodeURIComponent(client.id)}`
                            )}
                          />
                        }
                      >
                        <BriefcaseBusiness aria-hidden="true" size={16} />
                      </Button>
                      <Button
                        className="cmp-icon-action-button"
                        aria-label={`${copy.edit} ${copy.client.toLowerCase()}`}
                        disabled={loadingEditClientId === client.id}
                        onClick={() => onEdit(client)}
                      >
                        {loadingEditClientId === client.id ? (
                          <Skeleton className="size-4 rounded-full" />
                        ) : (
                          <Pencil aria-hidden="true" size={16} />
                        )}
                      </Button>
                    </ButtonGroup>
                  ) : null}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={16}>
                <div className="cmp-empty">{copy.noMatchingClients}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function _includesText(value: string | null | undefined, filter: string) {
  if (!filter) {
    return true;
  }
  return String(value ?? "")
    .toLowerCase()
    .includes(filter);
}

function formatClientYearEndMonth(month: number | null | undefined) {
  if (!month || month < 1 || month > 12) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(Date.UTC(2020, month - 1, 1))
  );
}

function hasClientServiceType(
  client: CmpClient,
  serviceType: ClientServiceType
) {
  return parseClientServiceTypes(
    client.serviceLines,
    client.serviceType
  ).includes(serviceType);
}

function _matchesClientServiceFilter(
  client: CmpClient,
  filter: string,
  serviceType: ClientServiceType
) {
  if (!filter) {
    return true;
  }
  const selected = hasClientServiceType(client, serviceType);
  return filter === "y" ? selected : filter === "n" ? !selected : true;
}
