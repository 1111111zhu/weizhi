"use client";

import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconButton } from "@project-wing/ui";
import * as React from "react";

import { PreviewLoadingState } from "@/components/extend/preview-loading-state";
import { ProjectFileTypeIcon } from "@/components/project-file-type-icon";
import {
  emailAttachmentBlob,
  parseDocumentEmail,
} from "@/lib/document-asset-preview";
import type { DocumentEmailPreview } from "@/lib/document-asset-preview";
import { showErrorToast } from "@/lib/error-toast";
import type { TextPreviewSearchResult } from "@/lib/text-preview-search";

import { TextSearchContent } from "./text-search-content";
import { ScrollArea } from "./ui/scroll-area";

function downloadFile(file: File, fileName: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function EmailAttachmentRow({
  attachment,
  onDownload,
}: {
  attachment: DocumentEmailPreview["attachments"][number];
  onDownload: (attachment: DocumentEmailPreview["attachments"][number]) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
      <ProjectFileTypeIcon fileName={attachment.fileName} />
      <span
        className="min-w-0 flex-1 truncate text-sm"
        title={attachment.fileName}
      >
        {attachment.fileName}
      </span>
      <span className="text-xs text-muted-foreground">
        {attachment.mimeType}
      </span>
      <IconButton
        type="button"
        variant="quiet"
        size="xs"
        icon={<HugeiconsIcon icon={Download01Icon} />}
        label={`Download ${attachment.fileName}`}
        onClick={() => onDownload(attachment)}
      />
    </div>
  );
}

export function EmailAsset({
  activeResult,
  onEmailChange,
  results,
  source,
  fileName,
}: {
  activeResult: TextPreviewSearchResult | null;
  onEmailChange: (email: DocumentEmailPreview | null) => void;
  results: TextPreviewSearchResult[];
  source: Blob;
  fileName: string;
}) {
  const [email, setEmail] = React.useState<DocumentEmailPreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    setEmail(null);
    setPreviewError(null);
    onEmailChange(null);
    void parseDocumentEmail(source, fileName)
      .then((value) => {
        if (active) {
          setEmail(value);
          onEmailChange(value);
        }
      })
      .catch((error) => {
        if (active) {
          showErrorToast(error, "Unable to parse email");
          setPreviewError("Email preview could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [fileName, onEmailChange, source]);
  if (previewError) {
    return null;
  }
  if (!email) {
    return <PreviewLoadingState className="flex-1" />;
  }
  return (
    <ScrollArea className="min-h-0 flex-1">
      <article className="mx-auto max-w-4xl space-y-4 p-5">
        <header className="space-y-2 rounded-lg border bg-background p-4">
          <h2 className="text-base font-semibold">{email.subject}</h2>
          <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-[4rem_minmax(0,1fr)]">
            <dt>From</dt>
            <dd className="truncate">{email.from || "—"}</dd>
            <dt>To</dt>
            <dd className="truncate">{email.to || "—"}</dd>
            {email.cc ? (
              <>
                <dt>Cc</dt>
                <dd className="truncate">{email.cc}</dd>
              </>
            ) : null}
            <dt>Date</dt>
            <dd>{email.date || "—"}</dd>
          </dl>
        </header>
        {email.html ? (
          <iframe
            title={`${email.subject} HTML body`}
            sandbox=""
            srcDoc={email.html}
            className="min-h-[24rem] w-full rounded-lg border bg-white"
          />
        ) : (
          <pre className="rounded-lg border bg-background p-4 text-sm leading-6 break-words whitespace-pre-wrap">
            <TextSearchContent
              activeResult={activeResult}
              results={results}
              text={email.text || "(empty message)"}
            />
          </pre>
        )}
        {email.attachments.length > 0 ? (
          <section className="rounded-lg border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              Attachments ({email.attachments.length})
            </div>
            {email.attachments.map((attachment) => (
              <EmailAttachmentRow
                key={attachment.fileName}
                attachment={attachment}
                onDownload={(value) =>
                  downloadFile(
                    new File([emailAttachmentBlob(value)], value.fileName, {
                      type: value.mimeType,
                    }),
                    value.fileName
                  )
                }
              />
            ))}
          </section>
        ) : null}
      </article>
    </ScrollArea>
  );
}
