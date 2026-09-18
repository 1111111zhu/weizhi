"use client";

import {
  readPdfRichNote,
  readPdfReviewNote,
} from "@project-wing/shared/pdf-rich-note";
import {
  FileText,
  ImageIcon,
  ExternalLink,
  BookOpen,
  Sheet,
  Presentation,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { api } from "@/api/client";
import { ReviewNoteRichText } from "@/components/review-note-rich-text";
import { RichTextDocument } from "@/components/smart-form-v2-readonly";
import type { RichTextReference } from "@/components/smart-form-v2-readonly";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { openAuthorizedPreviewWindow } from "@/lib/open-preview-window";

import { getPdfNoteFileType } from "./pdf-note-file-type";

// Only the surrounding application supplies project scope, never PDF metadata.
export const PdfNoteProjectContext = createContext<string | undefined>(
  undefined
);
const referenceClassName =
  "inline-flex max-w-full items-center gap-2 text-sm font-normal leading-6 text-primary! underline-offset-4 hover:underline!";

function PdfNoteLink({
  href,
  children,
  icon: Icon = ExternalLink,
}: {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  const safeHref =
    safePdfNoteLink(href) ??
    (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")
      ? href
      : undefined);
  if (!safeHref) {
    return <span>{children}</span>;
  }
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className={referenceClassName}
      data-pdf-note-reference
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </a>
  );
}
const renderPdfNoteLink = (href: string, label: ReactNode) => (
  <PdfNoteLink href={href}>{label}</PdfNoteLink>
);

export function safePdfNoteLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function PdfNoteContent({
  custom,
  text,
}: {
  custom?: unknown;
  text: string;
}) {
  const review = readPdfReviewNote(custom);
  const document = readPdfRichNote(custom);
  if (review) {
    return (
      <div className="space-y-5 text-sm leading-6">
        {review.target ? (
          <p className="text-muted-foreground">{review.target}</p>
        ) : null}
        {review.questions.map((question, index) => (
          <section
            key={question.id}
            aria-label={`Q${index + 1}`}
            className="space-y-4 border-t border-border pt-4 first:border-0 first:pt-0"
          >
            <h3 className="flex flex-wrap items-baseline gap-2 font-semibold">
              <span>Q{index + 1}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {question.status}
              </span>
            </h3>
            {question.messages.map((message) => (
              <article
                key={message.id}
                aria-label={`${message.author} ${message.date}`}
                className="space-y-2 border-l border-border pl-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="flex items-baseline gap-2">
                    <span className="font-medium">{message.author}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {message.date}
                  </p>
                </div>
                <ReviewNoteRichText
                  value={message.body}
                  renderLink={renderPdfNoteLink}
                />
                {message.images.map((image, imageIndex) => (
                  <div key={image.id ?? imageIndex}>
                    {image.id ? (
                      <PdfNoteReference
                        reference={{
                          entityType: "attachment",
                          entityId: `review-image:${image.id}`,
                          labelSnapshot: image.label,
                        }}
                      />
                    ) : (
                      <PdfNoteReference
                        reference={{
                          entityType: "attachment",
                          entityId: "",
                          labelSnapshot: image.label,
                        }}
                      />
                    )}
                  </div>
                ))}
                {message.references.map((ref, referenceIndex) => (
                  <div key={ref.id ?? referenceIndex}>
                    {ref.id ? (
                      <PdfNoteReference
                        reference={{
                          entityType: "workingPaper",
                          entityId: ref.id,
                          labelSnapshot: ref.label,
                        }}
                      />
                    ) : (
                      <PdfNoteReference
                        reference={{
                          entityType: "workingPaper",
                          entityId: "",
                          labelSnapshot: ref.label,
                        }}
                      />
                    )}
                  </div>
                ))}
              </article>
            ))}
            {question.assignedTo ? (
              <p className="text-xs text-muted-foreground">
                {question.assignedTo}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    );
  }
  return document ? (
    <RichTextDocument
      document={document}
      renderLink={renderPdfNoteLink}
      className="space-y-3 text-sm leading-6 [&_p]:whitespace-pre-wrap [&_table]:text-sm"
      renderReference={(reference) => (
        <PdfNoteReference reference={reference} />
      )}
    />
  ) : (
    <div className="break-words whitespace-pre-wrap">
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => {
        const href = /^https?:\/\//.test(part)
          ? safePdfNoteLink(part)
          : undefined;
        return href ? (
          <PdfNoteLink key={index} href={href}>
            {part}
          </PdfNoteLink>
        ) : (
          part
        );
      })}
    </div>
  );
}

function PdfNoteReference({ reference }: { reference: RichTextReference }) {
  const projectId = useContext(PdfNoteProjectContext);
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const label = reference.labelSnapshot ?? reference.entityId;
  const fileType = getPdfNoteFileType(label);
  const fileReference = ["attachment", "image"].includes(reference.entityType);
  const image = fileReference && fileType.kind === "image";
  const reviewImageId =
    fileReference && reference.entityId.startsWith("review-image:")
      ? reference.entityId.slice("review-image:".length)
      : undefined;
  const [preview, setPreview] = useState<{
    key: string;
    url?: string;
    failed?: boolean;
  }>();
  const [expanded, setExpanded] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const key = `${projectId ?? ""}:${reference.entityId}:${imageAttempt}`;
  const current = preview?.key === key ? preview : undefined;
  useEffect(() => {
    if (!image || !projectId || !expanded) {
      return;
    }
    let active = true;
    let objectUrl: string | undefined;
    const loadImage = reviewImageId
      ? api.downloadReviewQuestionImage(
          encodeURIComponent(projectId),
          encodeURIComponent(reviewImageId)
        )
      : api.previewAttachmentContent(
          encodeURIComponent(projectId),
          encodeURIComponent(reference.entityId)
        );
    void loadImage
      .then((blob) => {
        if (!active) {
          return;
        }
        // Never open HTML/SVG from an untrusted PDF as an executable document.
        if (!/^image\/(png|jpeg|gif|webp|avif|bmp)$/i.test(blob.type)) {
          throw new Error("Unsupported image preview");
        }
        objectUrl = URL.createObjectURL(blob);
        setPreview({ key, url: objectUrl });
      })
      .catch(() => {
        if (active) {
          setPreview({ key, failed: true });
        }
      });
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [image, projectId, reference.entityId, key, reviewImageId, expanded]);

  const openFile = async () => {
    if (!projectId || opening) {
      return;
    }
    if (image) {
      setExpanded(true);
      return;
    }
    if (reviewImageId && !fileType.preview) {
      await downloadFile();
      return;
    }
    setOpening(true);
    setOpenFailed(false);
    try {
      const ok = await openAuthorizedPreviewWindow({
        projectId,
        fileName: reviewImageId
          ? label.trim()
          : `${label.replace(/\.[^.]+$/, "")}.pdf`,
        mimeType: reviewImageId ? fileType.mimeType : "application/pdf",
        loadBlob: () =>
          reviewImageId
            ? api.downloadReviewQuestionImage(
                encodeURIComponent(projectId),
                encodeURIComponent(reviewImageId)
              )
            : api.previewAttachmentPdf(
                encodeURIComponent(projectId),
                encodeURIComponent(reference.entityId)
              ),
      });
      setOpenFailed(!ok);
    } catch {
      setOpenFailed(true);
    } finally {
      setOpening(false);
    }
  };
  const params = new URLSearchParams({
    tab: "overview",
    locatePaperId: reference.entityId,
  });
  const downloadFile = async () => {
    if (!projectId || opening) {
      return;
    }
    setOpening(true);
    try {
      const blob = await (reviewImageId
        ? api.downloadReviewQuestionImage(
            encodeURIComponent(projectId),
            encodeURIComponent(reviewImageId)
          )
        : api.downloadAttachment(
            encodeURIComponent(projectId),
            encodeURIComponent(reference.entityId)
          ));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = label;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpenFailed(false);
    } catch {
      setOpenFailed(true);
    } finally {
      setOpening(false);
    }
  };
  const href =
    reference.entityType === "externalLink"
      ? safePdfNoteLink(reference.entityId)
      : projectId &&
          reference.entityId &&
          reference.entityType === "workingPaper"
        ? `/${locale}/engagement/${encodeURIComponent(projectId)}?${params}`
        : undefined;
  const fileAction = projectId && reference.entityId && fileReference;
  const Icon = image
    ? ImageIcon
    : reference.entityType === "externalLink"
      ? ExternalLink
      : reference.entityType === "workingPaper"
        ? BookOpen
        : fileType.kind === "spreadsheet"
          ? Sheet
          : fileType.kind === "presentation"
            ? Presentation
            : FileText;
  return (
    <span className="inline-flex max-w-full flex-col gap-1 align-top text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {fileAction ? (
          <Button
            variant="link"
            size="sm"
            className={`${referenceClassName} h-auto min-w-0 justify-start p-0 text-left whitespace-normal`}
            data-pdf-note-reference
            disabled={opening}
            onClick={openFile}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{label}</span>
          </Button>
        ) : href ? (
          <PdfNoteLink href={href} icon={Icon}>
            {label}
          </PdfNoteLink>
        ) : (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="break-words">{label}</span>
          </span>
        )}
      </span>
      {image && projectId ? (
        <Dialog
          open={expanded}
          onOpenChange={(open) => {
            setExpanded(open);
            if (!open) {
              setPreview(undefined);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
            </DialogHeader>
            {current?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Render authorized local bytes only, without proxying through an optimizer.
              <img
                src={current.url}
                alt={label}
                className="max-h-[70vh] w-full object-contain"
              />
            ) : (
              <output className="text-sm text-muted-foreground">
                {current?.failed
                  ? zh
                    ? "图片暂不可用，请检查访问权限后重试。"
                    : "Image unavailable. Check access and retry."
                  : zh
                    ? "正在加载图片…"
                    : "Loading image…"}
              </output>
            )}
            {current?.failed ? (
              <Button
                variant="outline"
                onClick={() => setImageAttempt((value) => value + 1)}
              >
                {zh ? "重试" : "Retry"}
              </Button>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
      {openFailed ? (
        <span className="flex flex-col items-start gap-1">
          <span role="alert" className="text-xs text-destructive">
            {zh
              ? "无法打开预览，请检查文件权限、预览支持或弹出窗口设置。"
              : "Unable to open preview. Check file access, preview support or pop-up settings."}
          </span>
          {!image && fileAction ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={opening}
              onClick={downloadFile}
            >
              {zh ? "下载原文件" : "Download original"}
            </Button>
          ) : null}
        </span>
      ) : null}
      {!href && !fileAction && reference.entityType !== "projectMember" ? (
        <span className="text-xs text-muted-foreground">
          {zh
            ? "请从所属项目打开此引用。"
            : "Open this reference from its project."}
        </span>
      ) : null}
    </span>
  );
}
