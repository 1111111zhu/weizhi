"use client";

import { canGlobalRoleCreateProject } from "@project-wing/shared";
import {
  ProjectWingTopBar,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  ProjectWingTopBarTitle,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  FolderInput,
  FolderKanban,
  Plus,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb as BaseBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { Project } from "../api/client";
import { api } from "../api/client";
import { EmptyState } from "../components/empty-state";
import { LabeledField as Field } from "../components/labeled-field";
import { ProjectFrameworkBadge } from "../components/project-framework-badge";
import {
  EmpPortalAction,
  EmpTopBarControls,
} from "../components/project-wing-top-bar-controls";
import { useI18n } from "../i18n/client";
import {
  newWorkspaceProjectPath,
  workspacePath,
  workspaceProjectPath,
} from "../lib/navigation";
import {
  PAGE_CONTENT_CLASS,
  PAGE_SHELL_CLASS,
  formatDisplayName,
} from "../lib/project-layout";

function formatDate(value: string) {
  return value.slice(0, 10);
}

type WorkspaceFormValues = {
  name: string;
  clientName: string;
  description?: string;
};

export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dictionary, localizedPath } = useI18n();
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const workspace = workspaces.data?.find((item) => item.id === workspaceId);
  const canCreateProjects = me.data
    ? canGlobalRoleCreateProject(me.data.globalRole)
    : false;
  const [moveProject, setMoveProject] = useState<Project | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [moveWorkspaceId, setMoveWorkspaceId] = useState("");
  const [isCreatingMoveWorkspace, setIsCreatingMoveWorkspace] = useState(false);
  const moveDialogTriggerRef = useRef<HTMLButtonElement>(null);
  const form = useForm<WorkspaceFormValues>({
    defaultValues: { name: "", clientName: "", description: "" },
  });
  const moveForm = useForm<WorkspaceFormValues>({
    defaultValues: { name: "", clientName: "", description: "" },
  });
  const updateWorkspace = useMutation({
    mutationFn: (values: WorkspaceFormValues) =>
      api.updateWorkspace(workspaceId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
  const movePlacement = useMutation({
    mutationFn: ({
      projectId,
      targetWorkspaceId,
    }: {
      projectId: string;
      targetWorkspaceId: string;
    }) =>
      api.moveProjectPlacement(projectId, {
        folderId: targetWorkspaceId,
      }),
    onSuccess: async (_, variables) => {
      closeMoveDialog();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      router.push(localizedPath(workspacePath(variables.targetWorkspaceId)));
    },
  });
  const createWorkspaceAndMove = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      if (!moveProject) {
        throw new Error(dictionary.workspaces.selectProjectToMoveError);
      }
      const createdWorkspace = await api.createWorkspace(values);
      await api.moveProjectPlacement(moveProject.id, {
        folderId: createdWorkspace.id,
      });
      return createdWorkspace;
    },
    onSuccess: async (createdWorkspace) => {
      closeMoveDialog();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      router.push(localizedPath(workspacePath(createdWorkspace.id)));
    },
  });
  const openMoveDialog = (project: Project) => {
    setMoveProject(project);
    setIsMoveDialogOpen(true);
    setMoveWorkspaceId(workspaceId);
    setIsCreatingMoveWorkspace(false);
    moveForm.reset({
      name: "",
      clientName: workspace?.clientName ?? "",
      description: "",
    });
  };
  const closeMoveDialog = () => {
    setIsMoveDialogOpen(false);
  };

  useEffect(() => {
    if (!workspace) {
      return;
    }
    form.reset({
      name: workspace.name,
      clientName: workspace.clientName,
      description: workspace.description ?? "",
    });
  }, [form, workspace]);

  if (workspaces.isLoading) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        {dictionary.workspaces.loading}
      </Card>
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <Link href={localizedPath("/workspaces")}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            {dictionary.workspaces.back}
          </Button>
        </Link>
        <EmptyState
          title={dictionary.workspaces.notFoundTitle}
          description={dictionary.workspaces.notFoundDescription}
        />
      </div>
    );
  }

  const workspaceSettings = (
    <div className="grid gap-5">
      {canCreateProjects ? (
        <Link href={localizedPath(newWorkspaceProjectPath(workspace.id))}>
          <Button className="w-full">
            <Plus className="h-4 w-4" />
            {dictionary.workspaces.newProject}
          </Button>
        </Link>
      ) : null}
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit((values) => updateWorkspace.mutate(values))}
      >
        <Field label={dictionary.workspaces.name}>
          <Input {...form.register("name", { required: true })} />
        </Field>
        <Field label={dictionary.workspaces.clientName}>
          <Input {...form.register("clientName", { required: true })} />
        </Field>
        <Field label={dictionary.workspaces.descriptionLabel}>
          <Input {...form.register("description")} />
        </Field>
        <ButtonGroup className="ml-auto">
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              form.reset({
                name: workspace.name,
                clientName: workspace.clientName,
                description: workspace.description ?? "",
              })
            }
          >
            <X className="h-4 w-4" />
            {dictionary.workspaces.reset}
          </Button>
          <Button type="submit" disabled={updateWorkspace.isPending}>
            <Save className="h-4 w-4" />
            {dictionary.workspaces.save}
          </Button>
        </ButtonGroup>
      </form>
    </div>
  );

  return (
    <div className={PAGE_SHELL_CLASS}>
      <ProjectWingTopBar
        centerOnMobile
        leading={
          <>
            <ProjectWingTopBarBrand />
            <ProjectWingTopBarReturnAction
              label={dictionary.workspaces.back}
              onClick={() => router.push(localizedPath("/workspaces"))}
            />
            <EmpPortalAction />
          </>
        }
        center={
          <ProjectWingTopBarTitle
            title={formatDisplayName(workspace.clientName)}
            titleContent={
              <ClientBreadcrumb
                clientName={formatDisplayName(workspace.clientName)}
                workspaceHref={localizedPath("/workspaces")}
                workspaceLabel={dictionary.workspaces.title}
                breadcrumbLabel={dictionary.workspaces.breadcrumbLabel}
              />
            }
          />
        }
        actions={<EmpTopBarControls />}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <Card className="p-5">{workspaceSettings}</Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">
              {dictionary.workspaces.projectCountLabel}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {workspace.projects.length}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">
              {dictionary.workspaces.clientLabel}
            </p>
            <p className="mt-2 font-semibold text-foreground">
              {formatDisplayName(workspace.clientName)}
            </p>
          </Card>
        </div>

        <section className="grid gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {dictionary.workspaces.projectsTitle}
          </h2>
          {workspace.projects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {workspace.projects.map((project) => (
                <Card
                  key={project.id}
                  className="p-5 transition-[border-color,box-shadow] duration-200 hover:border-secondary hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <FolderKanban className="h-4 w-4" />
                        {formatDisplayName(project.projectCode)}
                      </div>
                      <h3 className="mt-2 truncate text-lg font-semibold text-foreground">
                        {formatDisplayName(project.name)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dictionary.workspaces.reportingDate}:{" "}
                        {formatDate(project.reportingDate)}
                      </p>
                      <div className="mt-2">
                        <ProjectFrameworkBadge
                          applicableAccountingStandard={
                            project.applicableAccountingStandard
                          }
                          frameworkTemplate={project.frameworkTemplate}
                          frameworkTemplateId={project.frameworkTemplateId}
                        />
                      </div>
                    </div>
                    <Badge variant="secondary">{project.status}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={localizedPath(
                        workspaceProjectPath(workspace.id, project.id)
                      )}
                    >
                      <Button variant="secondary" size="sm">
                        <ExternalLink className="h-4 w-4" />
                        {dictionary.workspaces.openProject}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      type="button"
                      size="sm"
                      onClick={(event) => {
                        moveDialogTriggerRef.current = event.currentTarget;
                        openMoveDialog(project);
                      }}
                    >
                      <FolderInput className="h-4 w-4" />
                      {dictionary.workspaces.moveProject}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title={dictionary.workspaces.emptyProjectsTitle}
              description={dictionary.workspaces.emptyProjectsDescription}
            />
          )}
        </section>

        {moveProject ? (
          <Dialog
            open={isMoveDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeMoveDialog();
              }
            }}
            onOpenChangeComplete={(open) => {
              if (!open) {
                setMoveProject(null);
                setMoveWorkspaceId("");
                setIsCreatingMoveWorkspace(false);
                moveForm.reset({ name: "", clientName: "", description: "" });
              }
            }}
          >
            <DialogContent
              finalFocus={moveDialogTriggerRef}
              showCloseButton={false}
              className="max-w-xl rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl"
            >
              <DialogHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {moveProject.projectCode}
                  </p>
                  <DialogTitle className="mt-1 text-lg font-semibold text-foreground">
                    {dictionary.workspaces.moveProjectToWorkspace}
                  </DialogTitle>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  size="icon"
                  tooltip={dictionary.workspaces.close}
                  onClick={closeMoveDialog}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogHeader>
              <DialogDescription className="mt-3 leading-6">
                {dictionary.workspaces.moveProjectDescription}
              </DialogDescription>

              <div className="mt-5 grid gap-2">
                {workspaces.data?.map((item) => {
                  const isCurrent = item.id === workspace.id;
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:border-secondary"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Input
                          type="radio"
                          name="targetWorkspace"
                          value={item.id}
                          checked={moveWorkspaceId === item.id}
                          onChange={() => setMoveWorkspaceId(item.id)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {item.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.clientName}
                          </span>
                        </span>
                      </span>
                      {isCurrent ? (
                        <Badge>{dictionary.workspaces.current}</Badge>
                      ) : null}
                    </label>
                  );
                })}
              </div>

              {isCreatingMoveWorkspace ? (
                <form
                  className="mt-5 grid gap-3 rounded-md border border-border bg-background p-4"
                  onSubmit={moveForm.handleSubmit((values) =>
                    createWorkspaceAndMove.mutate(values)
                  )}
                >
                  <Field label={dictionary.workspaces.name}>
                    <Input
                      {...moveForm.register("name", { required: true })}
                      autoFocus
                    />
                  </Field>
                  <Field label={dictionary.workspaces.clientName}>
                    <Input
                      {...moveForm.register("clientName", { required: true })}
                    />
                  </Field>
                  <Field label={dictionary.workspaces.descriptionLabel}>
                    <Input {...moveForm.register("description")} />
                  </Field>
                  <ButtonGroup className="ml-auto">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setIsCreatingMoveWorkspace(false)}
                    >
                      {dictionary.workspaces.cancelCreate}
                    </Button>
                    <Button
                      type="submit"
                      disabled={createWorkspaceAndMove.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      {dictionary.workspaces.createAndMove}
                    </Button>
                  </ButtonGroup>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  onClick={() => setIsCreatingMoveWorkspace(true)}
                >
                  <Plus className="h-4 w-4" />
                  {dictionary.workspaces.createWorkspaceAndMove}
                </Button>
              )}

              <ButtonGroup className="mt-5 ml-auto">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeMoveDialog}
                >
                  {dictionary.common.cancel}
                </Button>
                <Button
                  type="button"
                  disabled={
                    movePlacement.isPending ||
                    isCreatingMoveWorkspace ||
                    !moveWorkspaceId ||
                    moveWorkspaceId === workspace.id
                  }
                  onClick={() =>
                    movePlacement.mutate({
                      projectId: moveProject.id,
                      targetWorkspaceId: moveWorkspaceId,
                    })
                  }
                >
                  <FolderInput className="h-4 w-4" />
                  {dictionary.workspaces.move}
                </Button>
              </ButtonGroup>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}

function ClientBreadcrumb({
  breadcrumbLabel,
  clientName,
  workspaceHref,
  workspaceLabel,
}: {
  breadcrumbLabel: string;
  clientName: string;
  workspaceHref: string;
  workspaceLabel: string;
}) {
  return (
    <BaseBreadcrumb label={breadcrumbLabel} className="min-w-0">
      <BreadcrumbList className="gap-2 text-lg font-semibold">
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbLink
            className="max-w-36 truncate text-muted-foreground"
            render={<Link href={workspaceHref} />}
          >
            {workspaceLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-muted-foreground" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="max-w-[320px] truncate font-semibold">
            {clientName}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </BaseBreadcrumb>
  );
}
