"use client";

import type { CmpClient, CmpClientGroup } from "@project-wing/shared";

import type { CurrentUser, DirectoryUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import { ClientMasterForm } from "./client-master-form";
import type {
  ClientMasterFormData,
  ClientMasterFormSubmit,
} from "./client-master-form";
import { CmpFormRouteShell } from "./cmp-form-route-shell";

export function CmpClientFormPage({
  client,
  initialValue,
  groups,
  existingClients,
  users,
  currentUser,
  isBusy,
  hasPersistedDraft,
  acceptanceDraftId,
  initialDraftName,
  isDeletingDraft,
  onBack,
  onSubmit,
  onSubmitSuccess,
  onDirtyChange,
  onDeleteDraft,
}: {
  client?: CmpClient;
  initialValue: Partial<ClientMasterFormData>;
  groups: CmpClientGroup[];
  existingClients: CmpClient[];
  users: DirectoryUser[];
  currentUser: CurrentUser;
  isBusy?: boolean;
  hasPersistedDraft?: boolean;
  acceptanceDraftId?: string | null;
  initialDraftName?: string;
  isDeletingDraft?: boolean;
  onBack: () => void;
  onSubmit: (result: ClientMasterFormSubmit) => Promise<unknown>;
  onSubmitSuccess?: (result: ClientMasterFormSubmit) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onDeleteDraft?: () => Promise<unknown>;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const isEdit = Boolean(client);
  const isPartnerInitiator = currentUser.globalRole === "PARTNER";
  const title = isEdit ? copy.clientChangeTitle : copy.newClientAcceptance;
  const submitLabel = isEdit
    ? isPartnerInitiator
      ? "Submit change to MIC"
      : "Submit change request"
    : isPartnerInitiator
      ? "Submit to MIC"
      : "Submit client acceptance";

  return (
    <CmpFormRouteShell
      eyebrow={copy.clients}
      title={title}
      description={
        isEdit
          ? copy.formRouteClientEditDescription
          : copy.formRouteClientNewDescription
      }
      backLabel={copy.formRouteBack}
      onBack={onBack}
      compact
    >
      <ClientMasterForm
        initialValue={initialValue}
        groups={groups}
        existingClients={existingClients}
        excludeClientId={client?.id}
        users={users}
        submitTargetUsers={
          isPartnerInitiator
            ? users.filter(
                (user) =>
                  user.globalRole === "MANAGER" &&
                  (!user.status || user.status === "ACTIVE")
              )
            : []
        }
        mode={isEdit ? "edit-request" : "acceptance"}
        actionsPlacement="header"
        autoSaveDraft
        title={title}
        isBusy={isBusy}
        hasPersistedDraft={hasPersistedDraft}
        acceptanceDraftId={acceptanceDraftId}
        initialDraftName={initialDraftName}
        isDeletingDraft={isDeletingDraft}
        submitLabel={submitLabel}
        reviewLabel={
          isPartnerInitiator ? "Review & send to MIC" : "Review & submit"
        }
        canDelegateDraft={
          currentUser.globalRole === "MANAGER" ||
          currentUser.globalRole === "PARTNER"
        }
        draftOwnerLabel={isPartnerInitiator ? copy.requestOwner : undefined}
        showCloseButton={false}
        onCancel={onBack}
        onSubmit={onSubmit}
        onSubmitSuccess={onSubmitSuccess}
        onDirtyChange={onDirtyChange}
        onDeleteDraft={onDeleteDraft}
      />
    </CmpFormRouteShell>
  );
}
