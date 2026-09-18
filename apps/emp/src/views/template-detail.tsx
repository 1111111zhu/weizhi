"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";

import { BlobFilePreviewPane } from "@/components/file-preview-pane";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorToast } from "@/lib/error-toast";

import type {
  ProjectTemplate,
  ProjectTemplateFile,
} from "../api/client";
import { api } from "../api/client";
import { useI18n } from "../i18n/client";

export function ProjectTemplateFileDetailPage({
  fileId,
  templateId,
}: {
  fileId: string;
  templateId: string;
}) {
  const searchParams = useSearchParams();
  const { dictionary, localizedPath } = useI18n();
  const copy = dictionary.templateDetail;
  const returnHref = getSafeReturnHref(
    searchParams.get("returnTo"),
    localizedPath("/engagement")
  );
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const canManageTemplates = me.data?.globalRole === "SUPER_ADMIN";
  const template = useQuery({
    queryKey: ["projectTemplate", "detail", templateId, canManageTemplates],
    queryFn: () =>
      canManageTemplates
        ? api.adminProjectTemplate(templateId)
        : api.projectTemplate(templateId),
    enabled: Boolean(templateId) && Boolean(me.data),
  });
  const detail = useMemo(
    () => findProjectTemplateFile(template.data, fileId),
    [fileId, template.data]
  );
  useEffect(() => {
    if (me.error || template.error) {
      showErrorToast(me.error ?? template.error, copy.loadFailed);
    }
  }, [copy.loadFailed, me.error, template.error]);

  return (
    <div className="min-h-full bg-workbench-panel p-6">
      <div className="mx-auto grid w-full max-w-5xl gap-4">
        <Link
          href={returnHref}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" />
          {copy.back}
        </Link>

        {me.isLoading || template.isLoading ? (
          <div
            className="space-y-4 p-5"
            aria-busy="true"
            aria-label={copy.loading}
          >
            <Skeleton className="h-[calc(100vh-8rem)] w-full rounded-md" />
          </div>
        ) : me.error || template.error ? (
          <TemplateDetailStatus tone="destructive" />
        ) : !template.data || !detail ? (
          <TemplateDetailStatus tone="destructive">
            <span className="font-medium text-foreground">
              {copy.notFoundTitle}
            </span>
            <span className="mt-1 block">{copy.notFoundDescription}</span>
          </TemplateDetailStatus>
        ) : detail.file.placeholderType || !detail.file.fileUrl ? (
          <TemplateDetailStatus>{copy.previewUnavailable}</TemplateDetailStatus>
        ) : (
          <BlobFilePreviewPane
            ariaLabel={detail.file.title}
            className="h-[calc(100vh-8rem)] min-h-96 rounded-md border border-border"
            copy={{
              failedTitle: copy.loadFailed,
              loading: copy.loading,
              retry: copy.retry,
              unsupported: copy.previewUnsupported,
            }}
            fileName={
              detail.file.originalName ||
              detail.file.fileName ||
              detail.file.title
            }
            loadFile={() =>
              api.previewProjectTemplateFile(templateId, detail.file.id)
            }
            mimeType={detail.file.mimeType}
            queryKey={[
              "projectTemplateFilePreview",
              templateId,
              detail.file.id,
              detail.file.updatedAt,
            ]}
          />
        )}
      </div>
    </div>
  );
}

function TemplateDetailStatus({
  children,
  tone = "muted",
}: {
  children?: ReactNode;
  tone?: "muted" | "destructive";
}) {
  return (
    <div
      className={
        tone === "destructive"
          ? "p-6 text-sm text-destructive"
          : "p-6 text-sm text-muted-foreground"
      }
    >
      {children}
    </div>
  );
}

function findProjectTemplateFile(
  template: ProjectTemplate | undefined,
  fileId: string
): {
  file: ProjectTemplateFile;
} | null {
  if (!template?.nodes?.length) {
    return null;
  }
  for (const node of template.nodes) {
    const file = node.files?.find((item) => item.id === fileId);
    if (!file) {
      continue;
    }
    return { file };
  }
  return null;
}

function getSafeReturnHref(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}
