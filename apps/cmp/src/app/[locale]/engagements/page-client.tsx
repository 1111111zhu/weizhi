"use client";

import type { CreateCmpAcceptanceRequestInput } from "@project-wing/shared";
import { ProjectWingLoadingProgress } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "../../../api/client";
import { CmpAppShell } from "../../../components/cmp-app-shell";
import { useCmpSignOut } from "../../../components/cmp-auth-adapter";
import { parseEngagementImportSections } from "../../../components/cmp-engagement-import-sections";
import { CmpEngagementsView } from "../../../components/cmp-engagements-view";
import {
  CmpFormRouteShell,
  CmpFormRouteUnavailable,
} from "../../../components/cmp-form-route-shell";
import { useCmpToast } from "../../../components/cmp-toast";
import { useCmpI18n } from "../../../i18n/client";
import { useUnsavedFormNavigationGuard } from "../../../lib/use-unsaved-form-navigation-guard";

type EngagementPageMode = "list" | "new" | "edit";

export function CmpEngagementsClient({
  initialClientId,
  initialSourceEngagementId,
  initialSourceIsArchived = false,
  initialImportSections,
  initialGroupedClientId,
  initialView = "list",
  formMode = "list",
  engagementId,
  validateOnOpen = false,
}: {
  initialClientId?: string;
  initialSourceEngagementId?: string;
  initialSourceIsArchived?: boolean;
  initialImportSections?: string;
  initialGroupedClientId?: string;
  initialView?: "list" | "client";
  formMode?: EngagementPageMode;
  engagementId?: string;
  validateOnOpen?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [acceptanceDraftId, setAcceptanceDraftId] = useState<string | null>(
    null
  );
  const [canDeleteAcceptanceDraft, setCanDeleteAcceptanceDraft] =
    useState(false);
  const [tmsSummaryEngagementId, setTmsSummaryEngagementId] = useState<
    string | null
  >(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useCmpToast();
  const { dictionary, localizedPath } = useCmpI18n();
  const signOut = useCmpSignOut();
  const isFormPage = formMode !== "list";
  const { guardedNavigate, guardedAction, allowNextNavigation } =
    useUnsavedFormNavigationGuard({
      isDirty: isFormPage && formDirty,
      message: dictionary.workspace.formUnsavedConfirm,
    });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });
  const clients = useQuery({
    queryKey: ["cmp-clients"],
    queryFn: () => api.cmpClients(),
    enabled: Boolean(me.data),
  });
  const engagements = useQuery({
    queryKey: ["cmp-engagements"],
    queryFn: () => api.cmpEngagements(),
    enabled: Boolean(me.data),
  });
  const archivedSource = useQuery({
    queryKey: ["cmp-engagement-archive-source", initialSourceEngagementId],
    queryFn: () =>
      api.cmpEngagementArchiveSnapshot(initialSourceEngagementId ?? ""),
    enabled: Boolean(
      me.data &&
      formMode === "new" &&
      initialSourceIsArchived &&
      initialSourceEngagementId
    ),
    retry: false,
  });
  const engagementChangeDrafts = useQuery({
    queryKey: ["cmp-engagement-change-draft", engagementId],
    queryFn: () =>
      api.cmpAcceptance({
        type: "ENGAGEMENT_CHANGE",
        targetEngagementId: engagementId,
      }),
    enabled: Boolean(me.data && formMode === "edit" && engagementId),
    staleTime: 0,
  });
  const engagementDrafts = useQuery({
    queryKey: ["cmp-engagement-drafts"],
    queryFn: () => api.cmpAcceptanceDrafts("ENGAGEMENT"),
    enabled: Boolean(me.data && !isFormPage),
    staleTime: 0,
  });
  const archives = useQuery({
    queryKey: ["cmp-engagement-archives"],
    queryFn: api.cmpEngagementArchives,
    enabled: Boolean(me.data && !isFormPage),
    staleTime: 0,
  });
  const users = useQuery({
    queryKey: ["cmp-users"],
    queryFn: api.cmpUsers,
    enabled: Boolean(me.data),
  });
  const exchangeRates = useQuery({
    queryKey: ["cmp-budget-exchange-rates"],
    queryFn: api.cmpBudgetExchangeRates,
    enabled: Boolean(me.data),
    staleTime: 60 * 60 * 1000,
  });
  const tmsSummary = useQuery({
    queryKey: ["cmp-tms-summary", tmsSummaryEngagementId],
    queryFn: () => {
      if (!tmsSummaryEngagementId) {
        throw new Error("An engagement is required");
      }
      return api.cmpTmsEngagementSummary(tmsSummaryEngagementId);
    },
    enabled: Boolean(tmsSummaryEngagementId),
    staleTime: 0,
    refetchOnMount: true,
  });
  const persistedEngagementChangeDraft =
    engagementChangeDrafts.data?.requests.find((request) =>
      ["DRAFT", "STAFF_EDITING", "RETURNED"].includes(request.status)
    ) ?? null;
  const engagementChangeDraftId =
    acceptanceDraftId ?? persistedEngagementChangeDraft?.id ?? null;

  useEffect(() => {
    if (
      formMode !== "edit" ||
      !engagementId ||
      engagementChangeDrafts.isLoading
    ) {
      return;
    }
    setAcceptanceDraftId(persistedEngagementChangeDraft?.id ?? null);
    setCanDeleteAcceptanceDraft(
      persistedEngagementChangeDraft?.status === "DRAFT"
    );
  }, [
    engagementChangeDrafts.isLoading,
    engagementId,
    formMode,
    persistedEngagementChangeDraft,
  ]);

  const saveEngagementAcceptance = useMutation({
    mutationFn: ({
      draftId,
      input,
    }: {
      draftId: string | null;
      input: CreateCmpAcceptanceRequestInput;
    }) => {
      if (!draftId) {
        return api.createCmpAcceptance(input);
      }
      const { type: _type, ...updateInput } = input;
      return api.updateCmpAcceptance(draftId, updateInput);
    },
    onSuccess: async (request, variables) => {
      setAcceptanceDraftId(request.id);
      setCanDeleteAcceptanceDraft(request.status === "DRAFT");
      await queryClient.invalidateQueries({
        queryKey: ["cmp-engagement-drafts"],
      });
      if (!variables.input.submit) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cmp-acceptance"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-approvals"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-inbox"] }),
      ]);
      toast({ title: "Engagement acceptance submitted", variant: "success" });
    },
    onError: (_, variables) => {
      toast({
        title: variables.input.submit
          ? "Could not submit engagement acceptance"
          : "Could not save engagement acceptance",
        variant: "destructive",
      });
    },
  });
  const deleteEngagementDraft = useMutation({
    mutationFn: (id: string) => api.deleteCmpAcceptance(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cmp-acceptance"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-engagement-drafts"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-dashboard"] }),
      ]);
      setAcceptanceDraftId(null);
      setCanDeleteAcceptanceDraft(false);
      setFormDirty(false);
      allowNextNavigation();
      guardedNavigate(localizedPath("/engagement"));
      toast({
        title: dictionary.workspace.formDraftDeleted,
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: dictionary.workspace.formDraftDeleteFailed,
        variant: "destructive",
      });
    },
  });
  if (
    me.isLoading ||
    clients.isLoading ||
    engagements.isLoading ||
    archivedSource.isLoading ||
    users.isLoading ||
    (!isFormPage && engagementDrafts.isLoading)
  ) {
    return <ProjectWingLoadingProgress />;
  }

  if (!me.data) {
    return null;
  }

  const clientList = clients.data?.clients ?? [];
  const engagementList = engagements.data?.engagements ?? [];
  const selectedEngagement = engagementId
    ? engagementList.find((engagement) => engagement.id === engagementId)
    : undefined;
  const selectedClientIdIsInvalid = Boolean(
    formMode === "new" &&
    initialClientId &&
    !clientList.some((client) => client.id === initialClientId)
  );
  const selectedSourceEngagement = initialSourceEngagementId
    ? initialSourceIsArchived
      ? archivedSource.data?.engagement
      : engagementList.find(
          (engagement) => engagement.id === initialSourceEngagementId
        )
    : undefined;
  const selectedSourceEngagementIsInvalid = Boolean(
    formMode === "new" &&
    initialSourceEngagementId &&
    (!initialClientId ||
      !selectedSourceEngagement ||
      selectedSourceEngagement.clientId !== initialClientId)
  );
  const canCreateAcceptance = ["MANAGER", "PARTNER"].includes(
    me.data.globalRole
  );
  const canEditEngagement = canCreateAcceptance;
  const returnToList = () => {
    guardedNavigate(localizedPath("/engagement"));
  };
  const handleSignOut = () => {
    const action = () => signOut();
    if (isFormPage) {
      void guardedAction(() => void action());
      return;
    }
    void action();
  };

  return (
    <CmpAppShell
      activeSection="engagements"
      user={me.data}
      onSignOut={handleSignOut}
      searchValue={isFormPage ? undefined : search}
      onSearchChange={isFormPage ? undefined : setSearch}
      navigate={isFormPage ? guardedNavigate : undefined}
      hideSidebar={isFormPage}
      onExternalNavigate={
        isFormPage
          ? (url) => {
              void guardedAction(() => window.location.assign(url));
            }
          : undefined
      }
      canNavigate={isFormPage ? () => guardedAction(() => {}) : undefined}
    >
      {isFormPage ? (
        !canEditEngagement ||
        (formMode === "edit" && !selectedEngagement) ||
        selectedClientIdIsInvalid ||
        selectedSourceEngagementIsInvalid ? (
          <CmpFormRouteUnavailable
            title={
              formMode === "edit"
                ? dictionary.workspace.formRouteEngagementEditUnavailable
                : dictionary.workspace.formRouteEngagementUnavailable
            }
            message={
              canEditEngagement
                ? selectedSourceEngagementIsInvalid
                  ? dictionary.workspace.formRouteEngagementSourceUnavailable
                  : dictionary.workspace.formRouteRecordNotFound
                : dictionary.workspace.formRoutePermissionDenied
            }
            backLabel={dictionary.workspace.formRouteBackToList}
            onBack={returnToList}
          />
        ) : (
          <CmpFormRouteShell
            eyebrow={dictionary.workspace.engagements}
            title={
              formMode === "edit"
                ? dictionary.workspace.formRouteEngagementChangeTitle
                : dictionary.workspace.formRouteEngagementAcceptanceTitle
            }
            description={dictionary.workspace.formRouteEngagementDescription}
            backLabel={dictionary.workspace.formRouteBack}
            onBack={returnToList}
            compact
          >
            <CmpEngagementsView
              clients={clientList}
              engagements={engagementList}
              users={users.data ?? []}
              exchangeRates={exchangeRates.data?.rates ?? []}
              currentUser={me.data}
              initialClientId={initialClientId}
              initialSourceEngagement={selectedSourceEngagement}
              initialImportSections={parseEngagementImportSections(
                initialImportSections
              )}
              initialFormMode={formMode === "new" ? "create" : "edit"}
              initialEngagementId={engagementId}
              formPageMode
              searchValue={undefined}
              tmsSummary={tmsSummary.data ?? null}
              isTmsSummaryLoading={tmsSummary.isFetching}
              onEditingEngagementIdChange={setTmsSummaryEngagementId}
              initialValidateOnOpen={validateOnOpen}
              isCreating={
                saveEngagementAcceptance.isPending ||
                engagementChangeDrafts.isLoading
              }
              hasPersistedDraft={canDeleteAcceptanceDraft}
              isDeletingDraft={deleteEngagementDraft.isPending}
              onFormClose={(reason) => {
                setFormDirty(false);
                allowNextNavigation();
                if (reason === "submitted" || reason === "cancelled") {
                  guardedNavigate(localizedPath("/engagement"));
                }
              }}
              onFormDirtyChange={setFormDirty}
              onSubmitEngagementAcceptance={(input) =>
                saveEngagementAcceptance.mutateAsync({
                  draftId: engagementChangeDraftId,
                  input,
                })
              }
              onDeleteDraft={() => {
                if (!engagementChangeDraftId) {
                  return Promise.resolve();
                }
                return deleteEngagementDraft.mutateAsync(
                  engagementChangeDraftId
                );
              }}
            />
          </CmpFormRouteShell>
        )
      ) : (
        <CmpEngagementsView
          clients={clientList}
          engagements={engagementList}
          users={users.data ?? []}
          exchangeRates={exchangeRates.data?.rates ?? []}
          currentUser={me.data}
          archiveCount={archives.data?.archives.length ?? 0}
          drafts={engagementDrafts.data?.drafts ?? []}
          initialClientId={initialClientId}
          initialGroupedClientId={initialGroupedClientId}
          initialView={initialView}
          searchValue={search}
          tmsSummary={tmsSummary.data ?? null}
          isTmsSummaryLoading={tmsSummary.isFetching}
          onEditingEngagementIdChange={setTmsSummaryEngagementId}
          onCreateEngagement={(clientId) =>
            router.push(
              localizedPath(
                clientId
                  ? `/engagement/new?clientId=${encodeURIComponent(clientId)}`
                  : "/engagement/new"
              )
            )
          }
          onEditEngagement={(engagement) =>
            router.push(localizedPath(`/engagement/${engagement.id}/edit`))
          }
          onOpenFeeNote={(engagement) =>
            router.push(localizedPath(`/engagement/${engagement.id}/billing`))
          }
          isCreating={saveEngagementAcceptance.isPending}
          onSubmitEngagementAcceptance={(input) =>
            saveEngagementAcceptance.mutateAsync({ draftId: null, input })
          }
          onDeleteListedDraft={(id) => deleteEngagementDraft.mutateAsync(id)}
        />
      )}
    </CmpAppShell>
  );
}
