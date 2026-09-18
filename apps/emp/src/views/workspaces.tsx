"use client";

import {
  ProjectWingTopBar,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  ProjectWingTopBarTitle,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FolderPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import {
  Breadcrumb as BaseBreadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { api } from "../api/client";
import { EmptyState } from "../components/empty-state";
import { LabeledField as Field } from "../components/labeled-field";
import {
  EmpPortalAction,
  EmpTopBarControls,
  getIntranetPortalUrl,
} from "../components/project-wing-top-bar-controls";
import { useI18n } from "../i18n/client";
import { workspacePath } from "../lib/navigation";
import {
  PAGE_CONTENT_CLASS,
  PAGE_SHELL_CLASS,
  formatDisplayName,
} from "../lib/project-layout";

type FormValues = { name: string; clientName: string; description?: string };

export function WorkspacesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dictionary, localizedPath } = useI18n();
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces,
  });
  const form = useForm<FormValues>({
    defaultValues: { name: "", clientName: "", description: "" },
  });
  const create = useMutation({
    mutationFn: api.createWorkspace,
    onSuccess: async (workspace) => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(localizedPath(workspacePath(workspace.id)));
    },
  });
  const createWorkspaceForm = (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => create.mutate(values))}
    >
      <Field label={dictionary.workspaces.name}>
        <Input
          placeholder={dictionary.workspaces.namePlaceholder}
          {...form.register("name", { required: true })}
        />
      </Field>
      <Field label={dictionary.workspaces.clientName}>
        <Input
          placeholder={dictionary.workspaces.clientNamePlaceholder}
          {...form.register("clientName", { required: true })}
        />
      </Field>
      <Field label={dictionary.workspaces.descriptionLabel}>
        <Input
          placeholder={dictionary.workspaces.optional}
          {...form.register("description")}
        />
      </Field>
      <Button type="submit" disabled={create.isPending}>
        <FolderPlus className="h-4 w-4" />
        {dictionary.workspaces.create}
      </Button>
    </form>
  );

  return (
    <div className={PAGE_SHELL_CLASS}>
      <ProjectWingTopBar
        centerOnMobile
        leading={
          <>
            <ProjectWingTopBarBrand />
            <ProjectWingTopBarReturnAction
              label={`${dictionary.common.backTo ?? "Back to"} Intranet`}
              onClick={() => window.location.assign(getIntranetPortalUrl())}
            />
            <EmpPortalAction />
          </>
        }
        center={
          <ProjectWingTopBarTitle
            title={dictionary.workspaces.title}
            titleContent={<WorkspaceBreadcrumb />}
          />
        }
        actions={<EmpTopBarControls />}
      />
      <div className={PAGE_CONTENT_CLASS}>
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-foreground">
              {dictionary.workspaces.createTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dictionary.workspaces.createDescription}
            </p>
          </div>
          {createWorkspaceForm}
        </Card>
        {workspaces.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {workspaces.data.map((workspace) => (
              <Link
                key={workspace.id}
                href={localizedPath(workspacePath(workspace.id))}
              >
                <Card className="p-5 transition-[border-color,box-shadow] duration-200 hover:border-secondary hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <FolderOpen className="h-4 w-4" />
                        {dictionary.workspaces.folder}
                      </div>
                      <h2 className="mt-2 font-semibold text-foreground">
                        {formatDisplayName(workspace.name)}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDisplayName(workspace.clientName)}
                      </p>
                    </div>
                    <p className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-foreground">
                      {workspace.projects.length}{" "}
                      {dictionary.workspaces.projectCountSuffix}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title={dictionary.workspaces.emptyTitle}
            description={dictionary.workspaces.emptyDescription}
          />
        )}
      </div>
    </div>
  );
}

function WorkspaceBreadcrumb() {
  const { dictionary } = useI18n();

  return (
    <BaseBreadcrumb
      label={dictionary.workspaces.breadcrumbLabel}
      className="min-w-0"
    >
      <BreadcrumbList className="project-wing-top-bar-title-breadcrumb-list">
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="project-wing-top-bar-title-breadcrumb-page">
            {dictionary.workspaces.title}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </BaseBreadcrumb>
  );
}
