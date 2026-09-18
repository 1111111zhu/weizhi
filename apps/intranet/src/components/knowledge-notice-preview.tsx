"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from "@fluentui/react-components";
import { Open20Regular } from "@fluentui/react-icons";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { ReactElement } from "react";

import { KnowledgeAttachment } from "@/components/knowledge-attachment";
import type { IntranetDictionary } from "@/i18n/dictionaries";
import type { KnowledgeItem } from "@/lib/knowledge-catalog";

export function KnowledgeNoticePreview({
  copy,
  item,
  triggerLabel,
  trigger,
}: {
  copy: IntranetDictionary;
  item: KnowledgeItem;
  triggerLabel?: string;
  trigger?: ReactElement;
}) {
  const editor = useEditor({
    content: item.body ?? "",
    editable: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: true } }),
      KnowledgeAttachment.configure({
        removeLabel: copy.knowledge.notice.removeAttachment,
      }),
    ],
    immediatelyRender: false,
  });

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        {trigger ?? (
          <Button
            appearance="subtle"
            aria-label={triggerLabel ?? copy.knowledge.actions.preview}
            icon={<Open20Regular />}
          >
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogSurface className="!w-[min(64rem,calc(100vw-2rem))] !max-w-[min(64rem,calc(100vw-2rem))]">
        <DialogBody>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogContent className="grid gap-4 pt-3">
            <EditorContent
              className="knowledge-notice-preview"
              editor={editor}
            />
            {item.externalLink ? (
              <Button
                appearance="secondary"
                as="a"
                href={item.externalLink}
                icon={<Open20Regular />}
                target="_blank"
              >
                {copy.knowledge.notice.openLink}
              </Button>
            ) : null}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary">
                {copy.knowledge.notice.close}
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
