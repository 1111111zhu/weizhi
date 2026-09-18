"use client";

import type {
  CmpRecordPreviewDocument,
  CmpRecordPreviewLocale,
} from "@project-wing/shared/cmp-record-preview";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/api/client";
import { CmpDocumentPreviewSections } from "@/components/cmp-document-preview-sections";
import { useCmpToast } from "@/components/cmp-toast";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useCmpI18n } from "@/i18n/client";

type RecordKind = "CLIENT" | "ENGAGEMENT";

export function CmpRecordPreviewPage({
  recordId,
  kind,
}: {
  recordId: string;
  kind: RecordKind;
}) {
  const router = useRouter();
  const { locale, localizedPath, dictionary } = useCmpI18n();
  const { toast } = useCmpToast();
  const [exporting, setExporting] = useState<"pdf" | null>(null);
  const copy = dictionary.recordPreview;
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const preview = useQuery({
    queryKey: ["cmp-record-preview", kind, recordId, locale],
    queryFn: () => getPreview(kind, recordId, locale),
    enabled: Boolean(me.data),
    retry: false,
  });
  const engagement = useQuery({
    queryKey: ["cmp-engagement", recordId],
    queryFn: () => api.cmpEngagement(recordId),
    enabled: Boolean(me.data && kind === "ENGAGEMENT"),
    retry: false,
  });
  const canArchive =
    kind === "ENGAGEMENT" &&
    Boolean(engagement.data) &&
    ["ACTIVE", "COMPLETED"].includes(engagement.data?.status ?? "") &&
    (me.data?.globalRole === "SUPER_ADMIN" ||
      me.data?.globalRole === "PARTNER" ||
      engagement.data?.picUserId === me.data?.id ||
      engagement.data?.micUserId === me.data?.id);

  useEffect(() => {
    if (!me.isError && (me.isLoading || me.data)) {
      return;
    }
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.replace(
      `${localizedPath("/login")}?redirect=${encodeURIComponent(returnTo)}`
    );
  }, [localizedPath, me.data, me.isError, me.isLoading, router]);

  const backHref = localizedPath(
    kind === "CLIENT" ? "/clients" : "/engagements"
  );
  const documentLabel =
    kind === "CLIENT" ? copy.clientDocument : copy.engagementDocument;

  async function exportPdf() {
    if (exporting || !preview.data) {
      return;
    }
    setExporting("pdf");
    try {
      await downloadFile(
        getPdfUrl(kind, recordId, locale),
        defaultPdfFileName(preview.data)
      );
      toast({ title: copy.exportStarted, variant: "success" });
    } catch {
      toast({ title: copy.exportFailed, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  }

  if (me.isLoading || (me.data && preview.isLoading)) {
    return <PreviewLoading label={copy.loading} />;
  }
  if (me.isError || !me.data) {
    return null;
  }

  return (
    <main className="cmp-record-preview-page min-h-screen bg-muted/25 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button
            nativeButton={false}
            render={
              <a
                href={backHref}
                aria-label={
                  kind === "CLIENT"
                    ? copy.backToClients
                    : copy.backToEngagements
                }
              />
            }
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {kind === "CLIENT" ? copy.backToClients : copy.backToEngagements}
          </Button>
          <ButtonGroup>
            {canArchive ? (
              <Button
                nativeButton={false}
                render={
                  <a
                    aria-label={copy.archive}
                    href={localizedPath(`/engagement/${recordId}/archive`)}
                  />
                }
                variant="outline"
              >
                <Archive aria-hidden="true" className="size-4" />
                {copy.archive}
              </Button>
            ) : null}
            <Button
              disabled={Boolean(exporting) || !preview.data}
              onClick={() => void exportPdf()}
              variant={kind === "ENGAGEMENT" ? "outline" : "default"}
            >
              {exporting === "pdf" ? (
                <Skeleton className="size-4 rounded-full" />
              ) : (
                <Download aria-hidden="true" className="size-4" />
              )}
              {exporting === "pdf" ? copy.exportingPdf : copy.exportPdf}
            </Button>
          </ButtonGroup>
        </header>

        {preview.data ? (
          <RecordDocument document={preview.data} label={documentLabel} />
        ) : (
          <section className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <FileText
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground"
            />
            <h1 className="mt-4 text-lg font-semibold">{copy.unavailable}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.unavailableDescription}
            </p>
            <Button
              className="mt-5"
              onClick={() => void preview.refetch()}
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {copy.retry}
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}

function RecordDocument({
  document,
  label,
}: {
  document: CmpRecordPreviewDocument;
  label: string;
}) {
  return (
    <article className="cmp-record-preview-document overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 py-7 sm:px-8">
        <p className="text-sm font-medium text-primary">{label}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {document.title}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {document.code}
        </p>
      </header>
      <CmpDocumentPreviewSections sections={document.sections} />
    </article>
  );
}

function PreviewLoading({ label }: { label: string }) {
  return (
    <main
      aria-busy="true"
      aria-label={label}
      className="min-h-screen bg-muted/25 px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-2 border-b border-border pb-6">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </div>
      </div>
    </main>
  );
}

function getPreview(
  kind: RecordKind,
  recordId: string,
  locale: CmpRecordPreviewLocale
) {
  return kind === "CLIENT"
    ? api.cmpClientPreview(recordId, locale)
    : api.cmpEngagementPreview(recordId, locale);
}

function getPdfUrl(
  kind: RecordKind,
  recordId: string,
  locale: CmpRecordPreviewLocale
) {
  return kind === "CLIENT"
    ? api.cmpClientPreviewPdfUrl(recordId, locale)
    : api.cmpEngagementPreviewPdfUrl(recordId, locale);
}

function defaultPdfFileName(document: CmpRecordPreviewDocument) {
  const suffix =
    document.kind === "CLIENT" ? "client-profile" : "engagement-profile";
  return `${document.code}-${suffix}.pdf`;
}

async function downloadFile(url: string, fallbackFileName: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new ApiError(response.status, "Export failed");
  }
  const body = await response.blob();
  const downloadUrl = URL.createObjectURL(body);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download =
    readFileName(response.headers.get("content-disposition")) ??
    fallbackFileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}

function readFileName(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}
