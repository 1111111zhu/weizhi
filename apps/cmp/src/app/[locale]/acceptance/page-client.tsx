"use client";

import type {
  CmpAcceptanceRequest,
  CmpAcceptanceRequestsResponse,
  CreateCmpAcceptanceRequestInput,
  UpdateCmpAcceptanceRequestInput,
} from "@project-wing/shared";
import { ProjectWingLoadingProgress } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "../../../api/client";
import { AcceptanceViewSwitcher } from "../../../components/acceptance-view-switcher";
import {
  CmpAcceptanceView,
  canEditCmpAcceptanceRequest,
} from "../../../components/cmp-acceptance-view";
import type { CmpAcceptancePendingAction } from "../../../components/cmp-acceptance-view";
import { CmpAppShell } from "../../../components/cmp-app-shell";
import { useCmpSignOut } from "../../../components/cmp-auth-adapter";
import {
  CmpFormRouteShell,
  CmpFormRouteUnavailable,
} from "../../../components/cmp-form-route-shell";
import { useCmpToast } from "../../../components/cmp-toast";
import { useCmpI18n } from "../../../i18n/client";
import {
  reconcileApprovalQueue,
  upsertAcceptanceRequest,
} from "../../../lib/acceptance-cache";
import { useUnsavedFormNavigationGuard } from "../../../lib/use-unsaved-form-navigation-guard";

type AcceptanceTab = "requests" | "approvals";

const CMP_APPROVAL_ROLES = new Set([
  "MANAGER",
  "PARTNER",
  "PRINCIPAL",
  "SUPER_ADMIN",
]);

type PendingAcceptanceActionState = CmpAcceptancePendingAction & {
  count: number;
};

export function CmpAcceptanceClient({
  editRequestId,
  returnTo,
  validateOnOpen = false,
}: {
  editRequestId?: string;
  returnTo?: string;
  validateOnOpen?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [recentlyUpdatedRequestId, setRecentlyUpdatedRequestId] = useState<
    string | null
  >(null);
  const updatedRequestTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useCmpToast();
  const { dictionary, localizedPath } = useCmpI18n();
  const signOut = useCmpSignOut();
  const isFormPage = Boolean(editRequestId);
  const { guardedNavigate, guardedAction, allowNextNavigation } =
    useUnsavedFormNavigationGuard({
      isDirty: isFormPage && formDirty,
      message: dictionary.workspace.formUnsavedConfirm,
    });
  const copy = dictionary.workspace;
  const [pendingActions, setPendingActions] = useState<
    Record<string, PendingAcceptanceActionState>
  >({});
  const requestedTab: AcceptanceTab =
    searchParams.get("tab") === "approvals" ? "approvals" : "requests";
  const statusFilter = searchParams.get("status");
  const selectedRequestId = searchParams.get("requestId");
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });
  const canAccessApprovals = Boolean(
    me.data && CMP_APPROVAL_ROLES.has(me.data.globalRole)
  );
  const activeTab: AcceptanceTab =
    canAccessApprovals && requestedTab === "approvals"
      ? "approvals"
      : "requests";

  useEffect(() => {
    if (me.data && requestedTab === "approvals" && !canAccessApprovals) {
      router.replace(localizedPath("/acceptance"));
    }
  }, [canAccessApprovals, localizedPath, me.data, requestedTab, router]);

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
  const clients = useQuery({
    queryKey: ["cmp-clients"],
    queryFn: () => api.cmpClients(),
    enabled: Boolean(me.data),
  });
  const groups = useQuery({
    queryKey: ["cmp-client-groups"],
    queryFn: api.cmpClientGroups,
    enabled: Boolean(me.data),
  });
  const acceptance = useQuery({
    queryKey: ["cmp-acceptance"],
    queryFn: () => api.cmpAcceptance(),
    enabled: Boolean(me.data),
  });
  const approvals = useQuery({
    queryKey: ["cmp-approvals"],
    queryFn: () => api.cmpApprovals(),
    enabled: canAccessApprovals,
  });
  const createAcceptance = useMutation({
    mutationFn: (input: CreateCmpAcceptanceRequestInput) =>
      api.createCmpAcceptance(input),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({ title: "Acceptance request saved", variant: "success" });
    },
    onError: (_error) => {
      toast({
        title: "Could not save acceptance request",
        variant: "destructive",
      });
    },
  });
  const updateAcceptance = useMutation({
    mutationFn: (input: {
      id: string;
      data: UpdateCmpAcceptanceRequestInput;
    }) => api.updateCmpAcceptance(input.id, input.data),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({ title: "Acceptance request updated", variant: "success" });
    },
    onError: (_error) => {
      toast({
        title: "Could not update acceptance request",
        variant: "destructive",
      });
    },
  });
  const submitAcceptance = useMutation({
    mutationFn: (id: string) => api.submitCmpAcceptance(id),
    onMutate: (id) => beginPendingAction(id, "submit"),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({
        title:
          request.status === "PENDING_IT"
            ? copy.toastResubmittedToIt
            : copy.toastSubmittedToPic,
        variant: "success",
      });
    },
    onError: (_error) => {
      toast({
        title: "Could not submit acceptance",
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => endPendingAction(id),
  });
  const assignDraft = useMutation({
    mutationFn: (input: { id: string; assigneeId: string }) =>
      api.assignCmpAcceptanceDraft(input.id, {
        assigneeId: input.assigneeId,
      }),
    onMutate: (input) => beginPendingAction(input.id, "assign"),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({ title: copy.toastDraftAssigned, variant: "success" });
    },
    onError: (_error) =>
      toast({
        title: "Could not assign draft",
        variant: "destructive",
      }),
    onSettled: (_, __, input) => endPendingAction(input.id),
  });
  const recallDraft = useMutation({
    mutationFn: (id: string) => api.recallCmpAcceptanceDraft(id),
    onMutate: (id) => beginPendingAction(id, "recall"),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({ title: copy.toastDraftRecalled, variant: "success" });
    },
    onError: (_error) =>
      toast({
        title: "Could not recall draft",
        variant: "destructive",
      }),
    onSettled: (_, __, id) => endPendingAction(id),
  });
  const completeDraft = useMutation({
    mutationFn: (id: string) => api.completeCmpAcceptanceDraft(id),
    onMutate: (id) => beginPendingAction(id, "complete"),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({ title: copy.toastDraftReady, variant: "success" });
    },
    onError: (_error) =>
      toast({
        title: "Could not complete draft",
        variant: "destructive",
      }),
    onSettled: (_, __, id) => endPendingAction(id),
  });
  const approveAcceptance = useMutation({
    mutationFn: (input: { id: string; comment?: string }) =>
      api.approveCmpAcceptance(input.id, { comment: input.comment }),
    onMutate: (input) => beginPendingAction(input.id, "approve"),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({
        title:
          request.status === "APPROVED"
            ? copy.toastApprovedAndApplied
            : copy.toastApprovalRecorded,
        description:
          request.status === "APPROVED"
            ? copy.toastApprovedAndAppliedDescription
            : undefined,
        variant: "success",
      });
    },
    onError: (_error) => {
      toast({
        title: "Could not approve request",
        variant: "destructive",
      });
    },
    onSettled: (_, __, input) => endPendingAction(input.id),
  });
  const returnAcceptance = useMutation({
    mutationFn: (input: { id: string; comment: string }) =>
      api.returnCmpAcceptance(input.id, { comment: input.comment }),
    onMutate: (input) => beginPendingAction(input.id, "return"),
    onSuccess: async (request) => {
      updateCachedAcceptance(queryClient, request, me.data?.id);
      flashUpdatedRequest(request.id);
      await invalidateAcceptance(queryClient);
      toast({ title: copy.toastReturnedToMic, variant: "success" });
    },
    onError: (_error) => {
      toast({
        title: "Could not return request",
        variant: "destructive",
      });
    },
    onSettled: (_, __, input) => endPendingAction(input.id),
  });

  useEffect(
    () => () => {
      if (updatedRequestTimerRef.current !== null) {
        window.clearTimeout(updatedRequestTimerRef.current);
      }
    },
    []
  );

  function flashUpdatedRequest(requestId: string) {
    if (updatedRequestTimerRef.current !== null) {
      window.clearTimeout(updatedRequestTimerRef.current);
    }
    setRecentlyUpdatedRequestId(requestId);
    updatedRequestTimerRef.current = window.setTimeout(() => {
      setRecentlyUpdatedRequestId(null);
      updatedRequestTimerRef.current = null;
    }, 1100);
  }

  function beginPendingAction(
    requestId: string,
    kind: CmpAcceptancePendingAction["kind"]
  ) {
    setPendingActions((current) => {
      const existing = current[requestId];
      return {
        ...current,
        [requestId]: {
          requestId,
          kind,
          count: (existing?.count ?? 0) + 1,
        },
      };
    });
  }

  function endPendingAction(requestId: string) {
    setPendingActions((current) => {
      const active = current[requestId];
      if (!active) {
        return current;
      }
      if (active.count > 1) {
        return {
          ...current,
          [requestId]: { ...active, count: active.count - 1 },
        };
      }
      const { [requestId]: _, ...remaining } = current;
      return remaining;
    });
  }

  if (
    me.isLoading ||
    users.isLoading ||
    clients.isLoading ||
    groups.isLoading ||
    acceptance.isLoading ||
    approvals.isLoading
  ) {
    return <ProjectWingLoadingProgress />;
  }

  if (!me.data) {
    return null;
  }

  const requestList = acceptance.data?.requests ?? [];
  const editingRequest = editRequestId
    ? requestList.find((request) => request.id === editRequestId)
    : undefined;
  const canEditRequest = Boolean(
    editingRequest && canEditCmpAcceptanceRequest(editingRequest, me.data.id)
  );
  const returnPath = normalizeAcceptanceReturnPath(returnTo, localizedPath);
  const leaveForm = () => {
    guardedNavigate(returnPath);
  };
  const handleSignOut = () => {
    const action = () => signOut();
    if (isFormPage) {
      void guardedAction(() => void action());
      return;
    }
    void action();
  };
  const handleAcceptanceEdit = (
    request: CmpAcceptanceRequest,
    shouldValidate = false
  ) => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({ returnTo: currentPath });
    if (shouldValidate) {
      params.set("validate", "1");
    }
    router.push(
      localizedPath(
        `/acceptance/requests/${request.id}/edit?${params.toString()}`
      )
    );
  };
  const isApprovals = activeTab === "approvals";

  function openAcceptanceTab(tab: AcceptanceTab) {
    if (tab === "approvals" && !canAccessApprovals) {
      return;
    }
    router.push(localizedPath(`/acceptance?tab=${tab}`));
  }

  return (
    <CmpAppShell
      activeSection="acceptance"
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
        !editingRequest || !canEditRequest ? (
          <CmpFormRouteUnavailable
            title={copy.formRouteAcceptanceUnavailable}
            message={
              editingRequest
                ? copy.formRoutePermissionDenied
                : copy.formRouteRecordNotFound
            }
            backLabel={copy.formRouteBackToList}
            onBack={leaveForm}
          />
        ) : (
          <CmpFormRouteShell
            eyebrow={copy.clientAndEngagementAcceptance}
            title={
              editingRequest.type === "CLIENT"
                ? copy.newClientAcceptance
                : editingRequest.type === "CLIENT_CHANGE"
                  ? copy.clientChangeTitle
                  : editingRequest.type === "ENGAGEMENT_CHANGE"
                    ? copy.formRouteEngagementChangeTitle
                    : copy.formRouteEngagementAcceptanceTitle
            }
            description={copy.formRouteAcceptanceDescription}
            backLabel={copy.formRouteBack}
            onBack={leaveForm}
            compact
          >
            <CmpAcceptanceView
              mode="acceptance"
              formPageMode
              initialEditRequestId={editRequestId}
              currentUser={me.data}
              users={users.data ?? []}
              exchangeRates={exchangeRates.data?.rates ?? []}
              clients={clients.data?.clients ?? []}
              groups={groups.data?.groups ?? []}
              requests={requestList}
              validateOnOpen={validateOnOpen}
              isBusy={createAcceptance.isPending || updateAcceptance.isPending}
              onFormClose={(reason) => {
                setFormDirty(false);
                allowNextNavigation();
                if (reason === "submitted" || reason === "cancelled") {
                  guardedNavigate(returnPath);
                }
              }}
              onFormDirtyChange={setFormDirty}
              pendingActions={Object.entries(pendingActions).map(
                ([requestId, action]) => ({ requestId, kind: action.kind })
              )}
              onUpdate={(id, input) =>
                updateAcceptance.mutateAsync({ id, data: input })
              }
            />
          </CmpFormRouteShell>
        )
      ) : (
        <CmpAcceptanceView
          mode={isApprovals ? "approvals" : "acceptance"}
          currentUser={me.data}
          users={users.data ?? []}
          exchangeRates={exchangeRates.data?.rates ?? []}
          clients={clients.data?.clients ?? []}
          groups={groups.data?.groups ?? []}
          requests={
            isApprovals
              ? (approvals.data?.requests ?? [])
              : (acceptance.data?.requests ?? [])
          }
          searchValue={search}
          initialStatus={isApprovals ? null : statusFilter}
          selectedRequestId={selectedRequestId}
          recentlyUpdatedRequestId={recentlyUpdatedRequestId}
          onDetailClose={
            selectedRequestId
              ? () => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("requestId");
                  const query = params.toString();
                  router.replace(
                    localizedPath(
                      query ? `/acceptance?${query}` : "/acceptance"
                    )
                  );
                }
              : undefined
          }
          titleActions={
            <AcceptanceViewSwitcher
              activeTab={activeTab}
              canAccessApprovals={canAccessApprovals}
              requestsLabel={copy.myRequests}
              approvalsLabel={copy.myApprovals}
              ariaLabel={copy.clientAndEngagementAcceptance}
              onTabChange={openAcceptanceTab}
            />
          }
          isBusy={createAcceptance.isPending || updateAcceptance.isPending}
          pendingActions={Object.entries(pendingActions).map(
            ([requestId, action]) => ({ requestId, kind: action.kind })
          )}
          onCreate={(input) => createAcceptance.mutateAsync(input)}
          onUpdate={(id, input) =>
            updateAcceptance.mutateAsync({ id, data: input })
          }
          onEditRequest={handleAcceptanceEdit}
          onSubmit={(id) => submitAcceptance.mutateAsync(id)}
          onApprove={(id, comment) =>
            approveAcceptance.mutateAsync({ id, comment })
          }
          onReturn={(id, comment) =>
            returnAcceptance.mutateAsync({ id, comment })
          }
          onAssignDraft={(id, assigneeId) =>
            assignDraft.mutateAsync({ id, assigneeId })
          }
          onRecallDraft={(id) => recallDraft.mutateAsync(id)}
          onCompleteDraft={(id) => completeDraft.mutateAsync(id)}
        />
      )}
    </CmpAppShell>
  );
}

function normalizeAcceptanceReturnPath(
  value: string | undefined,
  localizedPath: (pathname: string) => string
) {
  if (!value || !value.startsWith("/")) {
    return localizedPath("/acceptance");
  }
  const [pathname, query] = value.split("?");
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "zh-CN" || parts[0] === "en-US") {
    parts.shift();
  }
  const normalized = `/${parts.join("/") || "acceptance"}${query ? `?${query}` : ""}`;
  return localizedPath(normalized);
}

function invalidateAcceptance(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["cmp-acceptance"] }),
    queryClient.invalidateQueries({ queryKey: ["cmp-approvals"] }),
    queryClient.invalidateQueries({ queryKey: ["cmp-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["cmp-inbox"] }),
  ]);
}

function updateCachedAcceptance(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedRequest: CmpAcceptanceRequest,
  currentUserId: string | undefined
) {
  queryClient.setQueryData<CmpAcceptanceRequestsResponse>(
    ["cmp-acceptance"],
    (current) => upsertAcceptanceRequest(current, updatedRequest)
  );
  queryClient.setQueryData<CmpAcceptanceRequestsResponse>(
    ["cmp-approvals"],
    (current) => reconcileApprovalQueue(current, updatedRequest, currentUserId)
  );
}
