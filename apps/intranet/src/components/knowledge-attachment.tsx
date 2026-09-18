"use client";

import { Button } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

import type { AttachmentKind } from "./knowledge-attachment-utils";

function KnowledgeAttachmentView({
  deleteNode,
  editor,
  extension,
  node,
}: NodeViewProps) {
  const { fileKind, fileName, fileSize, previewUrl } = node.attrs as {
    fileKind: AttachmentKind;
    fileName: string;
    fileSize: string;
    previewUrl?: string;
  };
  const content = (
    <>
      <span className="knowledge-attachment-icon">{fileKind}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{fileName}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {fileSize}
        </span>
      </span>
      {editor.isEditable ? (
        <Button
          appearance="subtle"
          aria-label={extension.options.removeLabel}
          icon={<Dismiss20Regular />}
          onClick={deleteNode}
          size="small"
          type="button"
        />
      ) : null}
    </>
  );
  return (
    <NodeViewWrapper
      className="knowledge-attachment-card"
      data-file-kind={fileKind}
    >
      {!editor.isEditable && previewUrl ? (
        <a
          className="contents"
          href={previewUrl}
          rel="noreferrer"
          target="_blank"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </NodeViewWrapper>
  );
}

export const KnowledgeAttachment = Node.create({
  name: "knowledgeAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { removeLabel: "Remove attachment" };
  },

  addAttributes() {
    return {
      fileKind: {
        default: "FILE",
        parseHTML: (element) => element.dataset.fileKind ?? "FILE",
        renderHTML: (attributes) => ({
          "data-file-kind": attributes.fileKind,
        }),
      },
      fileName: {
        default: "",
        parseHTML: (element) => element.dataset.fileName ?? "",
        renderHTML: (attributes) => ({
          "data-file-name": attributes.fileName,
        }),
      },
      fileSize: {
        default: "",
        parseHTML: (element) => element.dataset.fileSize ?? "",
        renderHTML: (attributes) => ({
          "data-file-size": attributes.fileSize,
        }),
      },
      clientId: { default: null },
      attachmentId: {
        default: null,
        parseHTML: (element) => element.dataset.attachmentId,
        renderHTML: (attributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      downloadUrl: {
        default: null,
        parseHTML: (element) => element.dataset.downloadUrl,
        renderHTML: (attributes) => ({
          "data-download-url": attributes.downloadUrl,
        }),
      },
      previewUrl: {
        default: null,
        parseHTML: (element) => element.dataset.previewUrl,
        renderHTML: (attributes) => ({
          "data-preview-url": attributes.previewUrl,
        }),
      },
      previewSourceUrl: {
        default: null,
        parseHTML: (element) => element.dataset.previewSourceUrl,
        renderHTML: (attributes) => ({
          "data-preview-source-url": attributes.previewSourceUrl,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-knowledge-attachment]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-knowledge-attachment": "",
        class: "knowledge-attachment-card",
      }),
      ["span", { class: "knowledge-attachment-icon" }, node.attrs.fileKind],
      [
        "span",
        { class: "knowledge-attachment-details" },
        ["span", { class: "knowledge-attachment-name" }, node.attrs.fileName],
        ["span", { class: "knowledge-attachment-size" }, node.attrs.fileSize],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KnowledgeAttachmentView);
  },
});
