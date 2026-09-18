"use client";

import type {
  ProjectLanguage,
  SmartFormLocale,
  SmartFormV2Node,
  WorkingPaperBucket,
} from "@project-wing/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  FileSearch,
  Files,
  FileText,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ProjectFileTypeIcon } from "@/components/project-file-type-icon";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DynamicBox, DynamicButton } from "@/components/ui/dynamic-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../api/client";
import type {
  Attachment,
  ProjectAttachment,
  ProjectTemplate,
  ProjectTemplateApplyPreview,
  ProjectTemplateNode,
  SmartFormTemplate,
  WorkflowNode,
} from "../api/client";
import { formatDisplayName } from "../lib/project-layout";
import { cn } from "../lib/utils";
import { useToast } from "./toast";

const defaultBucketLabels: Record<WorkingPaperBucket, string> = {
  CURRENT: "Current workpapers",
  PRIOR: "Prior workpapers",
  TEMPORARY: "Temporary files",
};
const EMPTY_PROJECT_TEMPLATES: ProjectTemplate[] = [];
const EMPTY_SMART_FORM_TEMPLATES: SmartFormTemplate[] = [];

export type WorkbenchTemplateLibraryCopy = {
  label: string;
  dialogTitle: string;
  targetLabel: string;
  targetPlaceholder: string;
  targetHelp: string;
  currentLocation?: string;
  templatesTitle: string;
  projectTemplatesTitle?: string;
  smartFormTemplatesTitle?: string;
  templateUnit: string;
  templateUnitPlural: string;
  searchPlaceholder: string;
  searchLabel: string;
  loadingTemplates: string;
  noMatchingTemplates: string;
  noTemplates: string;
  previewTitle: string;
  chooseTemplate: string;
  chooseTarget: string;
  applyTo: string;
  suggested: string;
  selectAllItems?: string;
  selectTemplateItem?: string;
  total: string;
  newItems: string;
  existing: string;
  code: string;
  title: string;
  type: string;
  bucket: string;
  status: string;
  newStatus: string;
  existingStatus: string;
  notSelectedStatus?: string;
  workpaperType: string;
  supplementType: string;
  smartFormType?: string;
  loadingPreview: string;
  noMatchingTemplatesSentence: string;
  noTemplatesSentence: string;
  alreadyAppliedHint: string;
  noSelectedItemsHint?: string;
  cancel: string;
  apply: string;
  applying: string;
  alreadyApplied: string;
  appliedTitle: string;
  createdDescription: string;
  createdFoldersDescription?: string;
  noNewDescription: string;
  itemUnit: string;
  itemUnitPlural: string;
  selectTemplate: string;
  willInsert?: string;
  viewTemplateFile?: string;
  languageLabel?: string;
  chineseLanguage?: string;
  englishLanguage?: string;
  fileColumn?: string;
  recommendedFrameworkColumn?: string;
  selectColumn?: string;
  commonFramework?: string;
  referenceCodeImportTitle?: string;
  referenceCodeImportDescription?: string;
  referenceCode?: string;
  importSelectedItems?: string;
};

export const defaultTemplateLibraryCopy: WorkbenchTemplateLibraryCopy = {
  label: "Use template",
  dialogTitle: "Use template",
  targetLabel: "Current folder",
  targetPlaceholder: "Select a workpaper folder",
  targetHelp: "Select a workpaper folder before importing a template.",
  currentLocation: "Current location",
  templatesTitle: "Templates",
  projectTemplatesTitle: "Project templates",
  smartFormTemplatesTitle: "Smart Forms",
  templateUnit: "template",
  templateUnitPlural: "templates",
  searchPlaceholder: "Search templates, subjects, or workpapers",
  searchLabel: "Search templates",
  loadingTemplates: "Loading templates...",
  noMatchingTemplates: "No matching templates",
  noTemplates: "No templates available",
  previewTitle: "Use preview",
  chooseTemplate: "Choose a template from the library",
  chooseTarget: "Choose a target workpaper folder",
  applyTo: "Import into",
  suggested: "Suggested",
  selectAllItems: "Select all template workpapers",
  selectTemplateItem: "Select {title}",
  total: "Total",
  newItems: "New",
  existing: "Existing",
  code: "Code",
  title: "Title",
  type: "Type",
  bucket: "Bucket",
  status: "Status",
  newStatus: "New",
  existingStatus: "Existing",
  notSelectedStatus: "Not selected",
  workpaperType: "Workpaper",
  supplementType: "Supplement",
  smartFormType: "Smart Form",
  loadingPreview: "Loading preview...",
  noMatchingTemplatesSentence: "No matching templates.",
  noTemplatesSentence: "No templates available.",
  alreadyAppliedHint:
    "This template has already been applied to the selected directory.",
  noSelectedItemsHint: "Select at least one template workpaper.",
  cancel: "Cancel",
  apply: "Use",
  applying: "Creating...",
  alreadyApplied: "Already applied",
  appliedTitle: "Template used",
  createdDescription: "Created {count} workpaper(s).",
  createdFoldersDescription: "Created {count} folder(s).",
  noNewDescription: "No new workpapers were needed.",
  itemUnit: "item",
  itemUnitPlural: "items",
  selectTemplate: "Select {name}",
  willInsert: "Will be inserted",
  viewTemplateFile: "View template workpaper",
  languageLabel: "Language",
  chineseLanguage: "Chinese",
  englishLanguage: "English",
  fileColumn: "File",
  recommendedFrameworkColumn: "Recommended standard",
  selectColumn: "Select",
  commonFramework: "General",
  referenceCodeImportTitle: "Confirm reference codes",
  referenceCodeImportDescription:
    "Review or edit the reference code for each selected item before importing.",
  referenceCode: "Reference code",
  importSelectedItems: "Import items",
};

type TemplateLibrarySelection =
  | { kind: "project-template"; id: string }
  | { kind: "smart-form-template"; id: string };

type PendingTemplateImportItem = {
  itemId: string;
  title: string;
  code: string;
};

export function WorkbenchTemplateLibraryDialog({
  open,
  onOpenChange,
  mode = "all",
  projectId,
  projectLanguage,
  projectFrameworkTemplateId,
  workflow,
  initialTargetNodeId,
  initialBucket = "CURRENT",
  copy = defaultTemplateLibraryCopy,
  bucketLabels = defaultBucketLabels,
  templateFileDetailHref,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "all" | "project-template" | "smart-form";
  projectId: string;
  projectLanguage?: ProjectLanguage;
  projectFrameworkTemplateId?: string | null;
  workflow: WorkflowNode[];
  initialTargetNodeId?: string | null;
  initialBucket?: WorkingPaperBucket;
  copy?: WorkbenchTemplateLibraryCopy;
  bucketLabels?: Record<WorkingPaperBucket, string>;
  templateFileDetailHref?: (templateId: string, fileId: string) => string;
  onApplied: (result: {
    targetNodeId: string;
    bucket: WorkingPaperBucket;
    createdWorkingPaperCount: number;
    createdWorkflowNodeCount?: number;
  }) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bucket, setBucket] = useState<WorkingPaperBucket>(initialBucket);
  const [targetNodeId, setTargetNodeId] = useState(initialTargetNodeId ?? "");
  const [selection, setSelection] = useState<TemplateLibrarySelection | null>(
    null
  );
  const [selectedTemplateFileIds, setSelectedTemplateFileIds] = useState<
    string[]
  >([]);
  const [selectedTemplateSmartFormIds, setSelectedTemplateSmartFormIds] =
    useState<string[]>([]);
  const [pendingTemplateImportItems, setPendingTemplateImportItems] = useState<
    PendingTemplateImportItem[] | null
  >(null);
  const [
    selectedDirectSmartFormTemplateIds,
    setSelectedDirectSmartFormTemplateIds,
  ] = useState<string[]>([]);
  const defaultSmartFormLanguage: SmartFormLocale =
    projectLanguage === "en-US" ? "en-US" : "zh-CN";
  const [smartFormLanguagesByTemplateId, setSmartFormLanguagesByTemplateId] =
    useState<Record<string, SmartFormLocale>>({});
  const targetOptions = useMemo(
    () => collectTemplateTargetOptions(workflow),
    [workflow]
  );
  const selectedTargetOption =
    targetOptions.find((target) => target.id === targetNodeId) ?? null;
  const selectedTarget = selectedTargetOption?.node ?? null;
  const projectTemplates = useQuery({
    queryKey: ["projectTemplates", "workbench"],
    queryFn: () => api.projectTemplates(),
    enabled: open && mode !== "smart-form",
  });
  const smartFormTemplates = useQuery({
    queryKey: ["smartFormTemplates", "workbench", projectFrameworkTemplateId],
    queryFn: () =>
      api.smartFormTemplates({
        frameworkTemplateId: projectFrameworkTemplateId ?? undefined,
      }),
    enabled: open && mode !== "project-template",
  });
  const allTemplates = projectTemplates.data ?? EMPTY_PROJECT_TEMPLATES;
  const templates = useMemo(
    () =>
      sortProjectTemplatesForLibrary(
        allTemplates,
        selectedTarget,
        projectFrameworkTemplateId
      ),
    [allTemplates, projectFrameworkTemplateId, selectedTarget]
  );
  const projectTemplateOptions = useMemo(
    () => (mode === "smart-form" ? EMPTY_PROJECT_TEMPLATES : templates),
    [mode, templates]
  );
  const directSmartFormTemplates = useMemo(
    () =>
      sortSmartFormTemplatesForLibrary(
        smartFormTemplates.data ?? EMPTY_SMART_FORM_TEMPLATES,
        projectFrameworkTemplateId
      ).filter(hasPublishedSmartFormV2Definition),
    [projectFrameworkTemplateId, smartFormTemplates.data]
  );
  const smartFormTemplateOptions = useMemo(
    () =>
      mode === "project-template"
        ? EMPTY_SMART_FORM_TEMPLATES
        : directSmartFormTemplates,
    [directSmartFormTemplates, mode]
  );
  const selectedTemplateId =
    selection?.kind === "project-template" ? selection.id : "";
  const selectedTemplateDetails = useQuery({
    queryKey: ["projectTemplate", "workbench", selectedTemplateId],
    queryFn: () => api.projectTemplate(selectedTemplateId),
    enabled: open && selection?.kind === "project-template",
  });
  const selectedTemplate =
    selectedTemplateDetails.data ??
    templates.find((template) => template.id === selectedTemplateId) ??
    null;
  const selectedDirectSmartFormTemplates = useMemo(
    () =>
      directSmartFormTemplates.filter((template) =>
        selectedDirectSmartFormTemplateIds.includes(template.id)
      ),
    [directSmartFormTemplates, selectedDirectSmartFormTemplateIds]
  );
  const selectedTemplateFiles = useMemo(
    () => getProjectTemplateFiles(selectedTemplate?.nodes ?? []),
    [selectedTemplate?.nodes]
  );
  const selectedTemplateSmartForms = useMemo(
    () => getProjectTemplateSmartForms(selectedTemplate?.nodes ?? []),
    [selectedTemplate?.nodes]
  );
  useEffect(() => {
    if (!open) {
      return;
    }
    setBucket(initialBucket);
    setTargetNodeId(initialTargetNodeId ?? "");
    setSmartFormLanguagesByTemplateId({});
    setSelectedDirectSmartFormTemplateIds([]);
    setPendingTemplateImportItems(null);
  }, [initialBucket, initialTargetNodeId, open, projectLanguage]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (
      projectTemplateOptions.length === 0 &&
      smartFormTemplateOptions.length === 0
    ) {
      if (selection) {
        setSelection(null);
      }
      if (selectedTemplateFileIds.length > 0) {
        setSelectedTemplateFileIds([]);
      }
      if (selectedTemplateSmartFormIds.length > 0) {
        setSelectedTemplateSmartFormIds([]);
      }
      return;
    }
    if (
      selection?.kind === "project-template" &&
      projectTemplateOptions.some((template) => template.id === selection.id)
    ) {
      return;
    }
    if (
      selection?.kind === "smart-form-template" &&
      smartFormTemplateOptions.some((template) => template.id === selection.id)
    ) {
      return;
    }
    if (projectTemplateOptions[0]) {
      setSelection({
        kind: "project-template",
        id: projectTemplateOptions[0].id,
      });
    }
  }, [
    open,
    projectTemplateOptions,
    selection,
    selectedTemplateFileIds.length,
    selectedTemplateSmartFormIds.length,
    smartFormTemplateOptions,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedTemplateFileIds([]);
    setSelectedTemplateSmartFormIds([]);
    setPendingTemplateImportItems(null);
  }, [open, selectedTemplateId]);

  const selectedTemplateFileIdSet = useMemo(
    () => new Set(selectedTemplateFileIds),
    [selectedTemplateFileIds]
  );
  const selectedTemplateSmartFormIdSet = useMemo(
    () => new Set(selectedTemplateSmartFormIds),
    [selectedTemplateSmartFormIds]
  );
  const previewSelectedTemplateFileIds = useMemo(
    () =>
      selectedTemplateFiles
        .map((file) => file.id)
        .filter((id) => selectedTemplateFileIdSet.has(id)),
    [selectedTemplateFileIdSet, selectedTemplateFiles]
  );
  const previewSelectedSmartFormReferenceIds = useMemo(
    () =>
      selectedTemplateSmartForms
        .map((smartForm) => smartForm.id)
        .filter((id) => selectedTemplateSmartFormIdSet.has(id)),
    [selectedTemplateSmartFormIdSet, selectedTemplateSmartForms]
  );
  const selectedSmartFormInput =
    previewSelectedSmartFormReferenceIds.length > 0
      ? {
          selectedSmartFormReferenceIds: previewSelectedSmartFormReferenceIds,
        }
      : {};
  const hasTemplateSelection =
    previewSelectedTemplateFileIds.length > 0 ||
    previewSelectedSmartFormReferenceIds.length > 0;
  const preview = useQuery({
    queryKey: [
      "projectTemplatePreview",
      projectId,
      targetNodeId,
      selectedTemplateId,
      bucket,
      previewSelectedTemplateFileIds.join(","),
      previewSelectedSmartFormReferenceIds.join(","),
    ],
    queryFn: () =>
      api.previewProjectTemplate(projectId, selectedTemplateId, {
        workflowNodeId: targetNodeId,
        bucket,
        selectedTemplateFileIds: previewSelectedTemplateFileIds,
        ...selectedSmartFormInput,
      }),
    enabled:
      open &&
      selection?.kind === "project-template" &&
      Boolean(targetNodeId) &&
      Boolean(selectedTemplateId) &&
      hasTemplateSelection,
  });
  const createDirectSmartForm = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedDirectSmartFormTemplates.map((template) =>
          api.createProjectSmartForm(projectId, targetNodeId, {
            smartFormTemplateVersionId:
              template.currentPublishedVersionId ?? "",
            title: template.name,
            language:
              smartFormLanguagesByTemplateId[template.id] ??
              defaultSmartFormLanguage,
          })
        )
      ),
    onSuccess: (createdSmartForms) => {
      const createdProjectAttachments = selectedTargetOption
        ? createdSmartForms.map((attachment) =>
            buildSmartFormProjectAttachment(attachment, selectedTargetOption)
          )
        : [];
      const mergeCreatedAttachments = () => {
        if (createdProjectAttachments.length === 0) {
          return;
        }
        queryClient.setQueryData<ProjectAttachment[]>(
          ["project-attachments", projectId],
          (current = []) =>
            upsertProjectAttachments(current, createdProjectAttachments)
        );
      };
      mergeCreatedAttachments();
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]).finally(mergeCreatedAttachments);
      toast({
        title: copy.appliedTitle,
        description: copy.createdDescription.replace(
          "{count}",
          String(createdSmartForms.length)
        ),
        variant: "success",
        duration: 3000,
      });
      onOpenChange(false);
      onApplied({
        targetNodeId,
        bucket: "CURRENT",
        createdWorkingPaperCount: createdSmartForms.length,
      });
    },
  });
  const applyTemplate = useMutation({
    mutationFn: (referenceCodeOverrides: PendingTemplateImportItem[]) =>
      api.applyProjectTemplate(projectId, selectedTemplateId, {
        workflowNodeId: targetNodeId,
        bucket,
        selectedTemplateFileIds: previewSelectedTemplateFileIds,
        ...selectedSmartFormInput,
        referenceCodeOverrides: referenceCodeOverrides.map((item) => ({
          itemId: item.itemId,
          code: item.code.trim(),
        })),
      }),
    onSuccess: (result) => {
      const createdProjectAttachments = selectedTargetOption
        ? [
            ...result.createdWorkingPapers,
            ...(result.createdSmartForms ?? []),
          ].flatMap((paper) =>
            "fileKind" in paper
              ? [buildSmartFormProjectAttachment(paper, selectedTargetOption)]
              : (paper.attachments ?? []).map((attachment) =>
                  buildSmartFormProjectAttachment(
                    {
                      ...attachment,
                      workingPaperId: paper.id,
                      code: paper.code,
                      title: paper.title,
                      bucket: paper.bucket,
                    },
                    selectedTargetOption
                  )
                )
          )
        : [];
      const mergeCreatedAttachments = () => {
        if (!createdProjectAttachments.length) {
          return;
        }
        queryClient.setQueryData<ProjectAttachment[]>(
          ["project-attachments", projectId],
          (current = []) =>
            upsertProjectAttachments(
              current,
              createdProjectAttachments.filter(
                (attachment) =>
                  !current.some((existing) => existing.id === attachment.id)
              )
            )
        );
      };
      mergeCreatedAttachments();
      // The server has committed the import. Background list/audit refreshes
      // must not extend the mutation's pending state or hold the dialog open.
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
        queryClient.invalidateQueries({
          queryKey: ["project-attachments", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]).then(mergeCreatedAttachments);
      const createdWorkingPaperCount =
        result.createdWorkingPapers.length +
        (result.createdSmartForms?.length ?? 0);
      toast({
        title: copy.appliedTitle,
        description: createdWorkingPaperCount
          ? copy.createdDescription.replace(
              "{count}",
              String(createdWorkingPaperCount)
            )
          : copy.noNewDescription,
        variant: "success",
        duration: 3000,
      });
      onOpenChange(false);
      setPendingTemplateImportItems(null);
      onApplied({
        targetNodeId,
        bucket,
        createdWorkingPaperCount,
      });
    },
  });
  const showTargetSelector = !initialTargetNodeId || !selectedTarget;
  const isProjectTemplateSelection = selection?.kind === "project-template";
  const hasDirectSmartFormSelection =
    selectedDirectSmartFormTemplates.length > 0 &&
    selectedDirectSmartFormTemplates.every((template) =>
      Boolean(template.currentPublishedVersionId)
    );
  const createCount = isProjectTemplateSelection
    ? (preview.data?.plan.summary.create ?? 0)
    : selectedDirectSmartFormTemplates.length;
  const isApplying = applyTemplate.isPending || createDirectSmartForm.isPending;
  const canApplyProjectTemplate =
    Boolean(targetNodeId) &&
    isProjectTemplateSelection &&
    Boolean(selectedTemplateId) &&
    hasTemplateSelection &&
    Boolean(preview.data) &&
    createCount > 0 &&
    !projectTemplates.isLoading &&
    !selectedTemplateDetails.isLoading &&
    !preview.isLoading &&
    !preview.isFetching &&
    !isApplying;
  const canApplyDirectSmartForm =
    Boolean(targetNodeId) &&
    hasDirectSmartFormSelection &&
    !smartFormTemplates.isLoading &&
    !isApplying;
  const canApply = canApplyProjectTemplate || canApplyDirectSmartForm;
  const toggleDirectSmartFormTemplate = (templateId: string) => {
    setSelectedDirectSmartFormTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId]
    );
  };
  const toggleTemplateFile = (fileId: string) => {
    setSelectedTemplateFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId]
    );
  };
  const toggleTemplateSmartForm = (smartFormId: string) => {
    setSelectedTemplateSmartFormIds((current) =>
      current.includes(smartFormId)
        ? current.filter((id) => id !== smartFormId)
        : [...current, smartFormId]
    );
  };
  const openReferenceCodeConfirmation = () => {
    const items = [
      ...(preview.data?.plan.items ?? [])
        .filter(
          (item) =>
            item.status === "CREATE" &&
            Boolean(item.plannedCode) &&
            selectedTemplateFileIdSet.has(item.templateFileId)
        )
        .map((item) => ({
          itemId: item.templateFileId,
          title: item.originalName || item.title,
          code: item.plannedCode ?? "",
        })),
      ...(preview.data?.plan.smartFormItems ?? [])
        .filter(
          (item) =>
            item.status === "CREATE" &&
            Boolean(item.plannedCode) &&
            selectedTemplateSmartFormIdSet.has(item.smartFormReferenceId)
        )
        .map((item) => ({
          itemId: item.smartFormReferenceId,
          title: item.originalName || item.title,
          code: item.plannedCode ?? "",
        })),
    ];
    if (items.length > 0) {
      setPendingTemplateImportItems(items);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[min(92vh,56rem)] max-h-[min(92vh,56rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-6xl"
          closeLabel={copy.cancel}
        >
          <DialogHeader className="border-b border-border/60 px-6 py-5 pr-14 sm:px-8">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Files
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
              {copy.dialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedTarget
                ? `${copy.currentLocation ?? copy.targetLabel}: ${formatTemplateTargetLabel(selectedTarget)}, ${bucketLabels[bucket]}`
                : copy.targetHelp}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {mode === "smart-form" ? null : (
              <section
                aria-label={copy.templatesTitle}
                className="flex max-h-48 min-h-0 shrink-0 flex-col border-b border-border/60 bg-muted/20 md:max-h-none md:w-64 md:border-r md:border-b-0"
              >
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {projectTemplates.isLoading ||
                  smartFormTemplates.isLoading ? (
                    <div
                      className="space-y-2 p-2"
                      aria-busy="true"
                      aria-label={copy.loadingTemplates}
                    >
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                    </div>
                  ) : projectTemplateOptions.length > 0 ||
                    smartFormTemplateOptions.length > 0 ? (
                    <div className="grid gap-4">
                      {projectTemplateOptions.length > 0 ? (
                        <TemplateLibraryOptionGroup
                          title={
                            copy.projectTemplatesTitle ?? copy.templatesTitle
                          }
                        >
                          {projectTemplateOptions.map((template) => (
                            <TemplateLibraryOption
                              key={template.id}
                              template={template}
                              node={selectedTarget}
                              copy={copy}
                              selected={
                                selection?.kind === "project-template" &&
                                template.id === selection.id
                              }
                              onSelect={() =>
                                setSelection({
                                  kind: "project-template",
                                  id: template.id,
                                })
                              }
                            />
                          ))}
                        </TemplateLibraryOptionGroup>
                      ) : null}
                      {smartFormTemplateOptions.length > 0 ? (
                        <TemplateLibraryOptionGroup
                          title={
                            copy.smartFormTemplatesTitle ??
                            copy.smartFormType ??
                            "Smart Forms"
                          }
                        >
                          {smartFormTemplateOptions.map((template) => (
                            <SmartFormTemplateLibraryOption
                              key={template.id}
                              template={template}
                              copy={copy}
                              selected={
                                selection?.kind === "smart-form-template" &&
                                template.id === selection.id
                              }
                              onSelect={() =>
                                setSelection({
                                  kind: "smart-form-template",
                                  id: template.id,
                                })
                              }
                            />
                          ))}
                        </TemplateLibraryOptionGroup>
                      ) : null}
                    </div>
                  ) : (
                    <TemplateLibraryEmptyState
                      title={
                        allTemplates.length > 0 ||
                        smartFormTemplates.data?.length
                          ? copy.noMatchingTemplates
                          : copy.noTemplates
                      }
                    />
                  )}
                </div>
              </section>
            )}

            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {(mode !== "smart-form" && selectedTemplate) ||
              showTargetSelector ? (
                <div className="grid gap-4 px-6 pt-6 pb-4 sm:px-8">
                  {mode !== "smart-form" && selectedTemplate ? (
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-foreground">
                        {selectedTemplate.name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {formatProjectTemplateSubtitle(selectedTemplate)}
                      </p>
                    </div>
                  ) : null}
                  {showTargetSelector ? (
                    <div className="grid max-w-md gap-2">
                      <label
                        className="text-xs font-semibold text-muted-foreground"
                        htmlFor="workpaper-template-target"
                      >
                        {copy.targetLabel}
                      </label>
                      <TemplateTargetSelect
                        id="workpaper-template-target"
                        value={targetNodeId}
                        placeholder={copy.targetPlaceholder}
                        onValueChange={setTargetNodeId}
                        options={targetOptions.map((target) => ({
                          label: target.label,
                          value: target.id,
                        }))}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-auto px-4 py-2 pb-6 sm:px-6">
                {mode === "smart-form" ? (
                  <div className="grid gap-3">
                    <DirectSmartFormTemplateList
                      templates={smartFormTemplateOptions}
                      selectedTemplateIds={
                        new Set(selectedDirectSmartFormTemplateIds)
                      }
                      languageByTemplateId={smartFormLanguagesByTemplateId}
                      defaultLanguage={defaultSmartFormLanguage}
                      hasTarget={Boolean(targetNodeId)}
                      loading={smartFormTemplates.isLoading}
                      copy={copy}
                      onSelect={toggleDirectSmartFormTemplate}
                      onLanguageChange={(templateId, language) =>
                        setSmartFormLanguagesByTemplateId((current) => ({
                          ...current,
                          [templateId]: language,
                        }))
                      }
                    />
                  </div>
                ) : (
                  <TemplateApplyPlanPreview
                    template={selectedTemplate}
                    preview={preview.data}
                    selectedTemplateFileIds={selectedTemplateFileIdSet}
                    selectedTemplateSmartFormIds={
                      selectedTemplateSmartFormIdSet
                    }
                    onToggleTemplateFile={toggleTemplateFile}
                    onToggleTemplateSmartForm={toggleTemplateSmartForm}
                    templateFileDetailHref={templateFileDetailHref}
                    loading={
                      selectedTemplateDetails.isLoading ||
                      preview.isLoading ||
                      preview.isFetching
                    }
                    empty={
                      !projectTemplates.isLoading &&
                      !smartFormTemplates.isLoading &&
                      projectTemplateOptions.length === 0 &&
                      smartFormTemplateOptions.length === 0
                    }
                    hasTarget={Boolean(targetNodeId)}
                    copy={copy}
                  />
                )}
              </div>
            </section>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 items-center gap-3 border-t border-border/60 bg-transparent px-6 py-6 sm:justify-between sm:px-8">
            <div className="min-h-5 text-xs text-muted-foreground">
              {selection?.kind === "project-template" && !hasTemplateSelection
                ? (copy.noSelectedItemsHint ?? null)
                : null}
            </div>
            <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-w-24 rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
                size="lg"
                className="min-w-28 rounded-xl bg-foreground text-background hover:bg-foreground/90"
                disabled={!canApply}
                onClick={() => {
                  if (mode === "smart-form") {
                    createDirectSmartForm.mutate();
                  } else {
                    openReferenceCodeConfirmation();
                  }
                }}
              >
                {isApplying
                  ? copy.applying
                  : createCount > 0
                    ? `${copy.apply} ${formatTemplateItemCount(createCount, copy)}`
                    : copy.apply}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingTemplateImportItems)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !applyTemplate.isPending) {
            setPendingTemplateImportItems(null);
          }
        }}
      >
        <DialogContent
          className="rounded-2xl p-6 sm:max-w-2xl sm:p-8"
          showCloseButton={!applyTemplate.isPending}
        >
          <DialogHeader>
            <DialogTitle>
              {copy.referenceCodeImportTitle ?? "Confirm reference codes"}
            </DialogTitle>
            <DialogDescription>
              {copy.referenceCodeImportDescription ??
                "Review or edit the reference code for each selected item before importing."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 gap-3 overflow-y-auto pr-1">
            {pendingTemplateImportItems?.map((item, index) => (
              <div
                className="grid grid-cols-1 items-center gap-3 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_11rem]"
                key={item.itemId}
              >
                <span className="truncate text-sm" title={item.title}>
                  {item.title}
                </span>
                <Input
                  aria-label={`${copy.referenceCode ?? "Reference code"}: ${item.title}`}
                  disabled={applyTemplate.isPending}
                  value={item.code}
                  onChange={(event) => {
                    setPendingTemplateImportItems((current) => {
                      if (!current) {
                        return current;
                      }
                      const next = [...current];
                      next[index] = { ...item, code: event.target.value };
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-w-24 rounded-xl"
                disabled={applyTemplate.isPending}
                onClick={() => setPendingTemplateImportItems(null)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
                size="lg"
                className="min-w-28 rounded-xl bg-foreground text-background hover:bg-foreground/90"
                disabled={
                  applyTemplate.isPending ||
                  !pendingTemplateImportItems?.length ||
                  pendingTemplateImportItems.some((item) => !item.code.trim())
                }
                onClick={() => {
                  if (pendingTemplateImportItems) {
                    applyTemplate.mutate(pendingTemplateImportItems);
                  }
                }}
              >
                {applyTemplate.isPending
                  ? copy.applying
                  : (copy.importSelectedItems ?? copy.apply)}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildSmartFormProjectAttachment(
  attachment: Attachment,
  target: TemplateTargetOption
): ProjectAttachment {
  const code = attachment.code ?? "";
  const title =
    attachment.title ?? attachment.originalName ?? attachment.fileName;
  return {
    ...attachment,
    workingPaper: {
      id: attachment.workingPaperId ?? attachment.id,
      attachmentId: attachment.id,
      code,
      title,
      bucket: attachment.bucket ?? "CURRENT",
      workflowNodeId: target.node.id,
      workflowNodeCode: target.node.code,
      workflowNodeTitle: target.node.title,
      signoffs: attachment.signoffs ?? [],
      reviewQuestions: attachment.reviewQuestions ?? [],
      path: target.path,
    },
  };
}

function upsertProjectAttachments(
  current: ProjectAttachment[],
  created: ProjectAttachment[]
) {
  const createdById = new Map(
    created.map((attachment) => [attachment.id, attachment])
  );
  return [
    ...current.map(
      (attachment) => createdById.get(attachment.id) ?? attachment
    ),
    ...created.filter(
      (attachment) => !current.some((existing) => existing.id === attachment.id)
    ),
  ];
}

function TemplateLibraryOption({
  template,
  node,
  copy,
  selected,
  onSelect,
}: {
  template: ProjectTemplate;
  node: WorkflowNode | null;
  copy: WorkbenchTemplateLibraryCopy;
  selected: boolean;
  onSelect: () => void;
}) {
  const relevance = getProjectTemplateRelevanceScore(template, node);
  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      accessibleName={copy.selectTemplate.replace("{name}", template.name)}
      aria-pressed={selected}
      className={cn(
        "grid h-auto w-full min-w-0 justify-start gap-2 whitespace-normal rounded-xl border-0 p-4 text-left transition-colors",
        selected
          ? "bg-muted text-foreground hover:bg-muted"
          : "bg-transparent hover:bg-muted/60"
      )}
      onClick={onSelect}
    >
      <span className="block w-full min-w-0 truncate text-sm font-semibold text-foreground">
        {template.name}
      </span>
      <span className="block w-full min-w-0 truncate text-xs text-muted-foreground">
        {formatProjectTemplateSubtitle(template)}
      </span>
      {relevance > 0 ? (
        <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {copy.suggested}
        </span>
      ) : null}
    </Button>
  );
}

function TemplateLibraryOptionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h4 className="px-4 text-xs font-medium text-muted-foreground">
        {title}
      </h4>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function SmartFormTemplateLibraryOption({
  template,
  copy,
  selected,
  onSelect,
}: {
  template: SmartFormTemplate;
  copy: WorkbenchTemplateLibraryCopy;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      aria-pressed={selected}
      className={cn(
        "grid h-auto w-full min-w-0 justify-start gap-2 whitespace-normal rounded-xl border-0 p-4 text-left transition-colors",
        selected
          ? "bg-muted text-foreground hover:bg-muted"
          : "bg-transparent hover:bg-muted/60"
      )}
      onClick={onSelect}
    >
      <span className="block w-full min-w-0 truncate text-sm font-semibold text-foreground">
        {template.name}
      </span>
      <span className="block w-full min-w-0 truncate text-xs text-muted-foreground">
        {formatSmartFormTemplateSubtitle(template)}
      </span>
      <span className="block w-full min-w-0 truncate text-xs text-muted-foreground">
        {copy.smartFormType ?? "Smart Form"}
      </span>
    </Button>
  );
}

function TemplateLibraryEmptyState({ title }: { title: string }) {
  return (
    <div className="grid min-h-40 place-items-center px-4 py-8 text-center text-sm text-muted-foreground">
      {title}
    </div>
  );
}

function DirectSmartFormTemplateList({
  templates,
  selectedTemplateIds,
  languageByTemplateId,
  defaultLanguage,
  hasTarget,
  loading,
  copy,
  onSelect,
  onLanguageChange,
}: {
  templates: SmartFormTemplate[];
  selectedTemplateIds: Set<string>;
  languageByTemplateId: Record<string, SmartFormLocale>;
  defaultLanguage: SmartFormLocale;
  hasTarget: boolean;
  loading: boolean;
  copy: WorkbenchTemplateLibraryCopy;
  onSelect: (templateId: string) => void;
  onLanguageChange: (templateId: string, language: SmartFormLocale) => void;
}) {
  if (!hasTarget) {
    return (
      <div className="grid min-h-48 place-items-center px-4 py-6 text-center text-sm text-muted-foreground">
        {copy.chooseTarget}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center px-4 py-6 text-sm text-muted-foreground">
        {copy.loadingPreview}
      </div>
    );
  }
  if (templates.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center px-4 py-6 text-center text-sm text-muted-foreground">
        {copy.noTemplatesSentence}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="max-h-[min(62vh,38rem)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-32">{copy.code}</TableHead>
              <TableHead>{copy.fileColumn ?? "File"}</TableHead>
              <TableHead className="w-52">
                {copy.recommendedFrameworkColumn ?? "Recommended standard"}
              </TableHead>
              <TableHead className="w-48">
                {copy.languageLabel ?? "Language"}
              </TableHead>
              <TableHead className="w-24 text-center">
                {copy.selectColumn ?? "Select"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => {
              const selected = selectedTemplateIds.has(template.id);
              const language =
                languageByTemplateId[template.id] ?? defaultLanguage;
              const publishedDefinition =
                template.currentPublishedVersion?.definitionJson;
              const questionCount = publishedDefinition
                ? countSmartFormV2Fields(publishedDefinition.children)
                : 0;
              return (
                <TableRow
                  key={template.id}
                  data-state={selected ? "selected" : undefined}
                  className={cn(
                    "transition",
                    selected && "shadow-[inset_3px_0_0_var(--primary)]"
                  )}
                >
                  <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                    {template.code}
                  </TableCell>
                  <TableCell className="min-w-64">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {formatDisplayName(template.name)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {copy.total}: {questionCount}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block truncate text-sm text-foreground">
                      {formatSmartFormRecommendedFramework(template, copy)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Tabs
                      value={language}
                      onValueChange={(value) =>
                        onLanguageChange(template.id, value as SmartFormLocale)
                      }
                    >
                      <TabsList>
                        {getSmartFormLanguageOptions(copy).map((option) => (
                          <TabsTrigger
                            key={option.value}
                            value={option.value}
                            className="h-7 px-2.5"
                          >
                            {option.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        "inline-grid size-6 place-items-center rounded-full border transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-transparent hover:border-primary/50"
                      )}
                      tooltip={(copy.selectTemplateItem ?? "{title}").replace(
                        "{title}",
                        template.name
                      )}
                      onClick={() => {
                        onSelect(template.id);
                      }}
                    >
                      <Check className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function hasPublishedSmartFormV2Definition(template: SmartFormTemplate) {
  const definition = template.currentPublishedVersion?.definitionJson;
  return Boolean(
    definition &&
    typeof definition === "object" &&
    Array.isArray((definition as { children?: unknown }).children)
  );
}

function countSmartFormV2Fields(nodes: SmartFormV2Node[] | undefined): number {
  if (!nodes) {
    return 0;
  }
  return nodes.reduce((count, node) => {
    const own = node.kind === "field" || node.kind === "conditional" ? 1 : 0;
    const children =
      node.kind === "conditional"
        ? countSmartFormV2Fields([
            ...node.branches.flatMap((branch) => branch.children),
            ...node.otherwise.children,
          ])
        : "children" in node
          ? countSmartFormV2Fields(node.children)
          : 0;
    return count + own + children;
  }, 0);
}

function getSmartFormLanguageOptions(
  copy: WorkbenchTemplateLibraryCopy
): { value: SmartFormLocale; label: string }[] {
  return [
    { value: "zh-CN", label: copy.chineseLanguage ?? "Chinese" },
    { value: "en-US", label: copy.englishLanguage ?? "English" },
  ];
}

function TemplateTargetSelect({
  id,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  id: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
  value: string;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedOption?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="" onClick={() => onValueChange("")}>
          {placeholder}
        </SelectItem>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TemplateApplyPlanPreview({
  template,
  preview,
  selectedTemplateFileIds,
  selectedTemplateSmartFormIds,
  onToggleTemplateFile,
  onToggleTemplateSmartForm,
  templateFileDetailHref,
  loading,
  empty,
  hasTarget,
  copy,
}: {
  template: ProjectTemplate | null;
  preview?: ProjectTemplateApplyPreview;
  selectedTemplateFileIds: Set<string>;
  selectedTemplateSmartFormIds: Set<string>;
  onToggleTemplateFile: (fileId: string) => void;
  onToggleTemplateSmartForm: (smartFormId: string) => void;
  templateFileDetailHref?: (templateId: string, fileId: string) => string;
  loading: boolean;
  empty: boolean;
  hasTarget: boolean;
  copy: WorkbenchTemplateLibraryCopy;
}) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set()
  );
  useEffect(() => {
    setExpandedNodeIds(new Set());
  }, [template?.id]);
  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!hasTarget) {
    return (
      <div className="grid min-h-48 place-items-center px-4 py-6 text-center text-sm text-muted-foreground">
        {copy.chooseTarget}
      </div>
    );
  }
  if (loading && !template?.nodes?.length) {
    return (
      <div className="grid min-h-48 place-items-center rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        {copy.loadingPreview}
      </div>
    );
  }
  if (empty || !template) {
    return null;
  }
  const tree = buildProjectTemplateTree(template.nodes ?? []);
  if (tree.length === 0) {
    return null;
  }
  const planByFileId = new Map(
    (preview?.plan.items ?? []).map((item) => [item.templateFileId, item])
  );
  const planBySmartFormId = new Map(
    (preview?.plan.smartFormItems ?? []).map((item) => [
      item.smartFormReferenceId,
      item,
    ])
  );
  return (
    <div className="min-h-0">
      <div className="space-y-1 py-2">
        {tree.map((node) => (
          <ProjectTemplateTreeNodeView
            key={node.id}
            node={node}
            depth={0}
            expandedNodeIds={expandedNodeIds}
            planByFileId={planByFileId}
            planBySmartFormId={planBySmartFormId}
            selectedTemplateFileIds={selectedTemplateFileIds}
            selectedTemplateSmartFormIds={selectedTemplateSmartFormIds}
            onToggleNode={toggleNode}
            onToggleTemplateFile={onToggleTemplateFile}
            onToggleTemplateSmartForm={onToggleTemplateSmartForm}
            templateFileDetailHref={templateFileDetailHref}
            templateId={template.id}
            copy={copy}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectTemplateTreeNodeView({
  node,
  depth,
  expandedNodeIds,
  planByFileId,
  planBySmartFormId,
  selectedTemplateFileIds,
  selectedTemplateSmartFormIds,
  onToggleNode,
  onToggleTemplateFile,
  onToggleTemplateSmartForm,
  templateFileDetailHref,
  templateId,
  copy,
}: {
  node: ProjectTemplateTreeNode;
  depth: number;
  expandedNodeIds: Set<string>;
  planByFileId: Map<
    string,
    NonNullable<ProjectTemplateApplyPreview["plan"]["items"][number]>
  >;
  planBySmartFormId: Map<
    string,
    NonNullable<
      NonNullable<ProjectTemplateApplyPreview["plan"]["smartFormItems"]>[number]
    >
  >;
  selectedTemplateFileIds: Set<string>;
  selectedTemplateSmartFormIds: Set<string>;
  onToggleNode: (nodeId: string) => void;
  onToggleTemplateFile: (fileId: string) => void;
  onToggleTemplateSmartForm: (smartFormId: string) => void;
  templateFileDetailHref?: (templateId: string, fileId: string) => string;
  templateId: string;
  copy: WorkbenchTemplateLibraryCopy;
}) {
  const files = [...(node.files ?? [])].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
  );
  const smartForms = [...(node.smartForms ?? [])].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
  );
  const hasChildren = node.children.length > 0;
  const hasFiles = files.length > 0;
  const hasSmartForms = smartForms.length > 0;
  const canExpand = hasChildren || hasFiles || hasSmartForms;
  const isExpanded = expandedNodeIds.has(node.id);
  return (
    <Collapsible open={isExpanded} className="grid gap-1">
      <DynamicButton
        type="button"
        variant="ghost"
        size="default"
        aria-expanded={canExpand ? isExpanded : undefined}
        className="flex h-auto w-full min-w-0 items-center justify-start gap-3 self-stretch rounded-lg px-3 py-3 text-left text-sm text-foreground transition hover:bg-muted/50"
        paddingLeft={`${depth * 1.25 + 0.5}rem`}
        onClick={() => {
          if (canExpand) {
            onToggleNode(node.id);
          }
        }}
      >
        <span
          className={cn(
            "grid size-4 shrink-0 place-items-center text-muted-foreground",
            !canExpand && "opacity-35"
          )}
          aria-hidden="true"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)] motion-reduce:transition-none",
              isExpanded && "rotate-90"
            )}
          />
        </span>
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">
          {formatTemplateTargetLabel(node)}
        </span>
      </DynamicButton>
      <CollapsibleContent>
        <div className="grid gap-1">
          {files.map((file) => {
            const item = planByFileId.get(file.id);
            const selected = selectedTemplateFileIds.has(file.id);
            const plannedCode = item?.plannedCode;
            const detailHref = templateFileDetailHref?.(templateId, file.id);
            return (
              <DynamicBox
                key={file.id}
                className={cn(
                  "grid grid-cols-[1rem_7.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded px-2 py-2 text-sm transition hover:bg-muted/50",
                  !selected && "text-muted-foreground"
                )}
                paddingLeft={`${depth * 1.25 + 1.75}rem`}
              >
                <ProjectFileTypeIcon
                  fileName={file.originalName || file.fileName || file.title}
                />
                <span className="truncate text-left font-mono text-xs font-medium text-muted-foreground">
                  {plannedCode ?? file.code}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-auto min-w-0 justify-start text-left"
                  onClick={() => onToggleTemplateFile(file.id)}
                >
                  <span className="block truncate font-medium text-foreground">
                    {formatDisplayName(
                      file.title || file.originalName || file.fileName
                    )}
                  </span>
                </Button>
                <span className="flex items-center gap-2">
                  {selected ? null : (
                    <span className="text-xs text-muted-foreground">
                      {copy.notSelectedStatus ?? ""}
                    </span>
                  )}
                  {detailHref ? (
                    <Link
                      href={detailHref}
                      title={copy.viewTemplateFile}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none"
                    >
                      <FileSearch className="size-4" />
                    </Link>
                  ) : null}
                  <label
                    htmlFor={`template-file-${file.id}`}
                    className="grid size-7 place-items-center"
                  >
                    <Checkbox
                      id={`template-file-${file.id}`}
                      label={(copy.selectTemplateItem ?? "{title}").replace(
                        "{title}",
                        file.title || file.originalName || file.fileName
                      )}
                      checked={selected}
                      onCheckedChange={() => onToggleTemplateFile(file.id)}
                    />
                  </label>
                </span>
              </DynamicBox>
            );
          })}
          {smartForms.map((smartForm) => {
            const item = planBySmartFormId.get(smartForm.id);
            const selected = selectedTemplateSmartFormIds.has(smartForm.id);
            const plannedCode = item?.plannedCode;
            return (
              <DynamicBox
                key={smartForm.id}
                className={cn(
                  "grid grid-cols-[1rem_7.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded px-2 py-2 text-sm transition hover:bg-muted/50",
                  !selected && "text-muted-foreground"
                )}
                paddingLeft={`${depth * 1.25 + 1.75}rem`}
              >
                <ProjectFileTypeIcon
                  fileName={smartForm.fileName || smartForm.title}
                />
                <span className="truncate text-left font-mono text-xs font-medium text-muted-foreground">
                  {plannedCode ?? smartForm.code}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-auto min-w-0 justify-start text-left"
                  onClick={() => onToggleTemplateSmartForm(smartForm.id)}
                >
                  <span className="block truncate font-medium text-foreground">
                    {formatDisplayName(smartForm.title || smartForm.fileName)}
                  </span>
                </Button>
                <span className="flex items-center gap-2">
                  {selected ? null : (
                    <span className="text-xs text-muted-foreground">
                      {copy.notSelectedStatus ?? ""}
                    </span>
                  )}
                  <label
                    htmlFor={`template-smart-form-${smartForm.id}`}
                    className="grid size-7 place-items-center"
                  >
                    <Checkbox
                      id={`template-smart-form-${smartForm.id}`}
                      label={(copy.selectTemplateItem ?? "{title}").replace(
                        "{title}",
                        smartForm.title || smartForm.fileName
                      )}
                      checked={selected}
                      onCheckedChange={() =>
                        onToggleTemplateSmartForm(smartForm.id)
                      }
                    />
                  </label>
                </span>
              </DynamicBox>
            );
          })}
          {node.children.map((child) => (
            <ProjectTemplateTreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodeIds={expandedNodeIds}
              planByFileId={planByFileId}
              planBySmartFormId={planBySmartFormId}
              selectedTemplateFileIds={selectedTemplateFileIds}
              selectedTemplateSmartFormIds={selectedTemplateSmartFormIds}
              onToggleNode={onToggleNode}
              onToggleTemplateFile={onToggleTemplateFile}
              onToggleTemplateSmartForm={onToggleTemplateSmartForm}
              templateFileDetailHref={templateFileDetailHref}
              templateId={templateId}
              copy={copy}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function sortProjectTemplatesForLibrary(
  templates: ProjectTemplate[],
  node: WorkflowNode | null,
  projectFrameworkTemplateId?: string | null
) {
  return [...templates].sort((left, right) => {
    const frameworkPreference =
      getProjectTemplateFrameworkPreference(right, projectFrameworkTemplateId) -
      getProjectTemplateFrameworkPreference(left, projectFrameworkTemplateId);
    if (frameworkPreference !== 0) {
      return frameworkPreference;
    }
    const relevance =
      getProjectTemplateRelevanceScore(right, node) -
      getProjectTemplateRelevanceScore(left, node);
    if (relevance !== 0) {
      return relevance;
    }
    return (
      (left.frameworkTemplate?.code ?? "").localeCompare(
        right.frameworkTemplate?.code ?? ""
      ) || left.code.localeCompare(right.code)
    );
  });
}

function sortSmartFormTemplatesForLibrary(
  templates: SmartFormTemplate[],
  projectFrameworkTemplateId?: string | null
) {
  return [...templates].sort((left, right) => {
    const frameworkPreference =
      getSmartFormTemplateFrameworkPreference(
        right,
        projectFrameworkTemplateId
      ) -
      getSmartFormTemplateFrameworkPreference(left, projectFrameworkTemplateId);
    if (frameworkPreference !== 0) {
      return frameworkPreference;
    }
    return (
      (left.frameworkTemplate?.code ?? "").localeCompare(
        right.frameworkTemplate?.code ?? ""
      ) || left.code.localeCompare(right.code)
    );
  });
}

function getProjectTemplateFrameworkPreference(
  template: ProjectTemplate,
  projectFrameworkTemplateId?: string | null
) {
  return projectFrameworkTemplateId &&
    template.frameworkTemplateId === projectFrameworkTemplateId
    ? 1
    : 0;
}

function getSmartFormTemplateFrameworkPreference(
  template: SmartFormTemplate,
  projectFrameworkTemplateId?: string | null
) {
  return projectFrameworkTemplateId &&
    template.frameworkTemplateId === projectFrameworkTemplateId
    ? 1
    : 0;
}

function getProjectTemplateRelevanceScore(
  template: ProjectTemplate,
  node: WorkflowNode | null
) {
  if (!node) {
    return 0;
  }
  const target = `${node.code} ${node.title}`.toLowerCase();
  let score = 0;
  if (template.code && target.includes(template.code.toLowerCase())) {
    score += 3;
  }
  if (template.name && target.includes(template.name.toLowerCase())) {
    score += 2;
  }
  if (
    getProjectTemplateFiles(template.nodes ?? []).some((file) =>
      target.includes(file.title.toLowerCase())
    )
  ) {
    score += 1;
  }
  if (
    getProjectTemplateSmartForms(template.nodes ?? []).some((smartForm) =>
      target.includes(smartForm.title.toLowerCase())
    )
  ) {
    score += 1;
  }
  return score;
}

function formatProjectTemplateSubtitle(template: ProjectTemplate) {
  const framework =
    template.frameworkTemplate?.name ?? template.frameworkTemplate?.code ?? "";
  return [template.code, framework].filter(Boolean).join(" - ");
}

function formatSmartFormTemplateSubtitle(template: SmartFormTemplate) {
  const framework =
    template.frameworkTemplate?.name ?? template.frameworkTemplate?.code ?? "";
  return [template.code, framework].filter(Boolean).join(" - ");
}

function formatSmartFormRecommendedFramework(
  template: SmartFormTemplate,
  copy: WorkbenchTemplateLibraryCopy
) {
  return (
    template.frameworkTemplate?.name ??
    template.frameworkTemplate?.code ??
    copy.commonFramework ??
    "General"
  );
}

type ProjectTemplateTreeNode = ProjectTemplateNode & {
  children: ProjectTemplateTreeNode[];
};

function buildProjectTemplateTree(nodes: ProjectTemplateNode[]) {
  const byId = new Map<string, ProjectTemplateTreeNode>(
    nodes.map((node) => [node.id, { ...node, children: [] }])
  );
  const roots: ProjectTemplateTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (items: ProjectTemplateTreeNode[]) => {
    items.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.code.localeCompare(right.code)
    );
    for (const item of items) {
      sortNodes(item.children);
    }
    return items;
  };
  return sortNodes(roots);
}

function getProjectTemplateFiles(nodes: ProjectTemplateNode[]) {
  return nodes.flatMap((node) => node.files ?? []);
}

function getProjectTemplateSmartForms(nodes: ProjectTemplateNode[]) {
  return nodes.flatMap((node) => node.smartForms ?? []);
}

function formatTemplateItemCount(
  count: number,
  copy: WorkbenchTemplateLibraryCopy
) {
  return `${count} ${count === 1 ? copy.itemUnit : copy.itemUnitPlural}`;
}

export function formatTemplateTargetLabel(
  node: Pick<WorkflowNode, "code" | "title">
) {
  return formatDisplayName(node.code);
}

type TemplateTargetOption = {
  id: string;
  label: string;
  node: WorkflowNode;
  path: {
    id: string;
    code: string;
    title: string;
    level: number;
  }[];
};

function collectTemplateTargetOptions(
  nodes: WorkflowNode[],
  ancestors: WorkflowNode[] = []
): TemplateTargetOption[] {
  return nodes.flatMap((node) => {
    const currentAncestors = [...ancestors, node];
    const children = collectTemplateTargetOptions(
      node.children ?? [],
      currentAncestors
    );
    const parentPath = ancestors
      .map((item) => formatDisplayName(item.code))
      .filter(Boolean)
      .join(" / ");
    const label = parentPath
      ? `${formatTemplateTargetLabel(node)} (${parentPath})`
      : formatTemplateTargetLabel(node);
    return [
      {
        id: node.id,
        label,
        node,
        path: currentAncestors.map(({ id, code, title, level }) => ({
          id,
          code,
          title,
          level,
        })),
      },
      ...children,
    ];
  });
}
