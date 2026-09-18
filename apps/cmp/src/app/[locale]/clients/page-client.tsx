"use client";

import type {
  CreateCmpAcceptanceRequestInput,
  CreateCmpClientGroupInput,
} from "@project-wing/shared";
import { ProjectWingLoadingProgress } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "../../../api/client";
import {
  EMPTY_CLIENT_MASTER_FORM,
  clientMasterFormFromClient,
} from "../../../components/client-master-form";
import type { ClientMasterFormSubmit } from "../../../components/client-master-form";
import { CmpAppShell } from "../../../components/cmp-app-shell";
import { useCmpSignOut } from "../../../components/cmp-auth-adapter";
import { CmpClientFormPage } from "../../../components/cmp-client-form-page";
import { CmpClientsView } from "../../../components/cmp-clients-view";
import { CmpFormRouteUnavailable } from "../../../components/cmp-form-route-shell";
import { useCmpToast } from "../../../components/cmp-toast";
import { useCmpI18n } from "../../../i18n/client";
import { useUnsavedFormNavigationGuard } from "../../../lib/use-unsaved-form-navigation-guard";

type ClientPageMode = "list" | "new" | "edit";

export function CmpClientsClient({
  formMode = "list",
  clientId,
}: {
  formMode?: ClientPageMode;
  clientId?: string;
}) {
  const [search, setSearch] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [acceptanceDraftId, setAcceptanceDraftId] = useState<string | null>(
    null
  );
  const [canDeleteAcceptanceDraft, setCanDeleteAcceptanceDraft] =
    useState(false);
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
  const groups = useQuery({
    queryKey: ["cmp-client-groups"],
    queryFn: api.cmpClientGroups,
    enabled: Boolean(me.data),
  });
  const clients = useQuery({
    queryKey: ["cmp-clients"],
    queryFn: () => api.cmpClients(),
    enabled: Boolean(me.data),
  });
  const users = useQuery({
    queryKey: ["cmp-users"],
    queryFn: api.cmpUsers,
    enabled: Boolean(me.data),
  });
  const clientDrafts = useQuery({
    queryKey: ["cmp-client-drafts"],
    queryFn: () => api.cmpAcceptanceDrafts("CLIENT"),
    enabled: Boolean(me.data && !isFormPage),
    staleTime: 0,
  });
  const relatedEntities = useQuery({
    queryKey: ["cmp-related-entities", clientId],
    queryFn: () => {
      if (!clientId) {
        throw new Error("A client is required");
      }
      return api.cmpRelatedEntities(clientId);
    },
    enabled: Boolean(me.data && formMode === "edit" && clientId),
  });
  const relatedRelationships = useQuery({
    queryKey: ["cmp-entity-relationships", clientId],
    queryFn: () => {
      if (!clientId) {
        throw new Error("A client is required");
      }
      return api.cmpEntityRelationships(clientId);
    },
    enabled: Boolean(me.data && formMode === "edit" && clientId),
  });
  const relatedGroupRelationships = useQuery({
    queryKey: ["cmp-group-relationships", clientId],
    queryFn: () => {
      if (!clientId) {
        throw new Error("A client is required");
      }
      return api.cmpGroupRelationships(clientId);
    },
    enabled: Boolean(me.data && formMode === "edit" && clientId),
  });
  const createGroup = useMutation({
    mutationFn: (input: CreateCmpClientGroupInput) =>
      api.createCmpClientGroup(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cmp-client-groups"],
      });
      toast({ title: "Group created", variant: "success" });
    },
    onError: (_error) => {
      toast({
        title: "Could not create group",
        variant: "destructive",
      });
    },
  });
  const updateGroup = useMutation({
    mutationFn: (input: {
      id: string;
      data: Parameters<typeof api.updateCmpClientGroup>[1];
    }) => api.updateCmpClientGroup(input.id, input.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cmp-client-groups"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-clients"] }),
      ]);
      toast({ title: "Group updated", variant: "success" });
    },
    onError: (_error) => {
      toast({
        title: "Could not update group",
        variant: "destructive",
      });
    },
  });
  const submitClientChange = useMutation({
    mutationFn: ({
      action: _action,
      draftId,
      input,
    }: {
      action: ClientMasterFormSubmit["action"];
      draftId: string | null;
      input: CreateCmpAcceptanceRequestInput;
    }) => {
      if (!draftId) {
        return api.createCmpAcceptance(input);
      }
      const { type: _type, ...updateInput } = input;
      return api.updateCmpAcceptance(draftId, updateInput);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["cmp-client-drafts"] });
      if (variables.action === "draft") {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cmp-acceptance"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-approvals"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-inbox"] }),
      ]);
      if (variables.action === "submit") {
        toast({ title: "Client acceptance submitted", variant: "success" });
      }
    },
    onError: (error, variables) => {
      toast({
        title:
          variables.action === "submit"
            ? "Could not submit client acceptance"
            : "Could not save client acceptance",
        description: isDisplayableApiError(error) ? error.message : undefined,
        trustedDescription: isDisplayableApiError(error),
        variant: "destructive",
      });
    },
  });
  const deleteClientDraft = useMutation({
    mutationFn: (id: string) => api.deleteCmpAcceptance(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cmp-acceptance"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-client-drafts"] }),
        queryClient.invalidateQueries({ queryKey: ["cmp-dashboard"] }),
      ]);
      setAcceptanceDraftId(null);
      setCanDeleteAcceptanceDraft(false);
      setFormDirty(false);
      allowNextNavigation();
      guardedNavigate(localizedPath("/client"));
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
    groups.isLoading ||
    clients.isLoading ||
    users.isLoading ||
    (!isFormPage && clientDrafts.isLoading) ||
    (formMode === "edit" &&
      (relatedEntities.isLoading ||
        relatedRelationships.isLoading ||
        relatedGroupRelationships.isLoading))
  ) {
    return <ProjectWingLoadingProgress />;
  }

  if (!me.data) {
    return null;
  }

  const clientList = clients.data?.clients ?? [];
  const groupsList = groups.data?.groups ?? [];
  const usersList = users.data ?? [];
  const selectedClient = clientId
    ? clientList.find((client) => client.id === clientId)
    : undefined;
  const canCreateAcceptance = ["MANAGER", "PARTNER"].includes(
    me.data.globalRole
  );
  const defaultRouting = buildDefaultClientRouting(usersList, me.data);
  const initialFormValue = selectedClient
    ? clientMasterFormFromClient(selectedClient, {
        ...defaultRouting,
        ...materializedRelatedParties(
          relatedEntities.data,
          relatedRelationships.data,
          relatedGroupRelationships.data
        ),
      })
    : { ...EMPTY_CLIENT_MASTER_FORM, ...defaultRouting };
  const isAuthorizedForm =
    formMode === "new" ? canCreateAcceptance : canCreateAcceptance;
  const returnToList = () => {
    guardedNavigate(localizedPath("/client"));
  };
  const submitForm = async (result: ClientMasterFormSubmit) => {
    const request = await submitClientChange.mutateAsync({
      action: result.action,
      draftId: acceptanceDraftId,
      input: {
        type: formMode === "edit" ? "CLIENT_CHANGE" : "CLIENT",
        targetClientId: formMode === "edit" ? clientId : undefined,
        clientPayload: result.payload,
        draftName: result.draftName,
        draftAssigneeId: result.draftAssigneeId,
        micApproverId: result.micApproverId,
        picApproverId: result.picApproverId,
        itApproverId: result.itApproverId,
        submit: result.action === "submit",
      },
    });
    setAcceptanceDraftId(request.id);
    setCanDeleteAcceptanceDraft(request.status === "DRAFT");
    return request;
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
      activeSection="clients"
      user={me.data}
      onSignOut={handleSignOut}
      searchValue={search}
      onSearchChange={setSearch}
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
        !isAuthorizedForm || (formMode === "edit" && !selectedClient) ? (
          <CmpFormRouteUnavailable
            title={
              formMode === "edit"
                ? dictionary.workspace.formRouteClientEditUnavailable
                : dictionary.workspace.formRouteClientUnavailable
            }
            message={
              isAuthorizedForm
                ? dictionary.workspace.formRouteRecordNotFound
                : dictionary.workspace.formRoutePermissionDenied
            }
            backLabel={dictionary.workspace.formRouteBackToList}
            onBack={returnToList}
          />
        ) : (
          <CmpClientFormPage
            client={formMode === "edit" ? selectedClient : undefined}
            initialValue={initialFormValue}
            groups={groupsList}
            existingClients={clientList}
            users={usersList}
            currentUser={me.data}
            isBusy={submitClientChange.isPending}
            hasPersistedDraft={canDeleteAcceptanceDraft}
            acceptanceDraftId={acceptanceDraftId}
            isDeletingDraft={deleteClientDraft.isPending}
            onBack={returnToList}
            onSubmit={submitForm}
            onSubmitSuccess={(result) => {
              if (result.action === "submit") {
                setFormDirty(false);
                allowNextNavigation();
                guardedNavigate(localizedPath("/client"));
              }
            }}
            onDirtyChange={setFormDirty}
            onDeleteDraft={() => {
              if (!acceptanceDraftId) {
                return Promise.resolve();
              }
              return deleteClientDraft.mutateAsync(acceptanceDraftId);
            }}
          />
        )
      ) : (
        <CmpClientsView
          clients={clientList}
          groups={groupsList}
          users={usersList}
          currentUser={me.data}
          drafts={clientDrafts.data?.drafts ?? []}
          searchValue={search}
          onSearchValueChange={setSearch}
          isCreatingClient={submitClientChange.isPending}
          isCreatingGroup={createGroup.isPending}
          isUpdating={updateGroup.isPending}
          isSubmittingChange={submitClientChange.isPending}
          onCreateGroup={(input) => createGroup.mutateAsync(input)}
          onLoadGroupStructure={(id) => api.cmpClientGroupStructure(id)}
          onSubmitClientChange={(input) =>
            submitClientChange.mutateAsync({
              action: input.submit ? "submit" : "draft",
              draftId: null,
              input,
            })
          }
          onUpdateGroup={(id, input) =>
            updateGroup.mutateAsync({ id, data: input })
          }
          onCreateClient={() => router.push(localizedPath("/client/new"))}
          onEditClient={(client) =>
            router.push(localizedPath(`/client/${client.id}/edit`))
          }
          onDeleteDraft={(id) => deleteClientDraft.mutateAsync(id)}
        />
      )}
    </CmpAppShell>
  );
}

function materializedRelatedParties(
  entities?: Awaited<ReturnType<typeof api.cmpRelatedEntities>>,
  relationships?: Awaited<ReturnType<typeof api.cmpEntityRelationships>>,
  groupRelationships?: Awaited<ReturnType<typeof api.cmpGroupRelationships>>
) {
  if (!entities) {
    return {};
  }
  const { rootEntityId } = entities;
  const relatedEntities = entities.entities
    .filter((entity) => entity.role !== "ROOT")
    .map((entity) => ({
      draftKey: entity.id,
      existingEntityId: entity.id,
      kind: entity.kind,
      displayName: entity.displayName,
      nameZh: entity.nameZh,
      nameEn: entity.nameEn,
      jurisdiction: entity.jurisdiction,
      registrationNumber: entity.registrationNumber,
      status: entity.status,
      companyProfile: entity.companyProfile,
      personProfile: entity.personProfile,
    }));
  const scopedEntityIds = new Set([
    ...(rootEntityId ? [rootEntityId] : []),
    ...relatedEntities.map((entity) => entity.existingEntityId),
  ]);
  const reference = (entityId: string) =>
    entityId === rootEntityId
      ? ({ type: "ROOT" } as const)
      : ({ type: "EXISTING", entityId } as const);

  return {
    relatedEntities,
    relatedRelationships: (relationships?.relationships ?? [])
      .filter(
        (relationship) =>
          scopedEntityIds.has(relationship.fromEntityId) &&
          scopedEntityIds.has(relationship.toEntityId)
      )
      .map((relationship) => ({
        draftKey: relationship.id,
        fromRef: reference(relationship.fromEntityId),
        toRef: reference(relationship.toEntityId),
        type: relationship.type,
        ownershipPercentage: relationship.ownershipPercentage,
        effectiveFrom: relationship.effectiveFrom?.slice(0, 10) ?? null,
        effectiveTo: relationship.effectiveTo?.slice(0, 10) ?? null,
        sourceDocument: relationship.sourceDocument,
        remarks: relationship.remarks,
      })),
    relatedGroupRelationships: (groupRelationships?.relationships ?? [])
      .filter(
        (relationship) =>
          scopedEntityIds.has(relationship.targetEntityId) &&
          relationship.participants.every((participant) =>
            scopedEntityIds.has(participant.entityId)
          )
      )
      .map((relationship) => ({
        draftKey: relationship.id,
        existingRelationshipId: relationship.id,
        targetRef: reference(relationship.targetEntityId),
        type: relationship.type,
        participants: relationship.participants.map((participant) => ({
          entityRef: reference(participant.entityId),
          method: participant.method,
          ownershipPercentage: participant.ownershipPercentage,
          otherDescription: participant.otherDescription,
        })),
        effectiveFrom: relationship.effectiveFrom?.slice(0, 10) ?? null,
        effectiveTo: relationship.effectiveTo?.slice(0, 10) ?? null,
        sourceDocument: relationship.sourceDocument,
        remarks: relationship.remarks,
      })),
  };
}

function buildDefaultClientRouting(
  users: { id: string; globalRole: string; status?: string }[],
  currentUser: { id: string; globalRole: string }
) {
  const currentUserCanBeMic = ["MANAGER", "SENIOR_MANAGER"].includes(
    currentUser.globalRole
  );
  const currentUserIsActive = users.some(
    (user) => user.id === currentUser.id && user.status !== "DISABLED"
  );
  return {
    clientManagerMicId:
      currentUserCanBeMic && currentUserIsActive ? currentUser.id : "",
    picApproverId: "",
    itApproverId: "",
  };
}

function isDisplayableApiError(error: unknown): error is Error {
  return error instanceof Error && error.name === "ApiError";
}
