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
  Text,
  Tooltip,
} from "@fluentui/react-components";
import {
  Archive20Regular,
  ArrowReset20Regular,
  Delete20Regular,
  Edit20Regular,
} from "@fluentui/react-icons";
import {
  projectWingToast,
  useCompactViewport,
  useMobileKeyboardViewport,
} from "@project-wing/ui";
import { useRef, useState } from "react";

import { KnowledgePublishDialog } from "@/components/knowledge-publish-dialog";
import type { IntranetDictionary } from "@/i18n/dictionaries";
import {
  archiveKnowledgeDocument,
  deleteKnowledgeDocument,
  restoreKnowledgeDocument,
} from "@/lib/knowledge-api";
import type { KnowledgeItem } from "@/lib/knowledge-catalog";

export function KnowledgeManageDialog({
  copy,
  item,
  onChanged,
}: {
  copy: IntranetDictionary;
  item: KnowledgeItem;
  onChanged: (item: KnowledgeItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const mobileSurface = useRef<HTMLDivElement>(null);
  const mobile = useCompactViewport(767);
  useMobileKeyboardViewport(mobileSurface, mobile && open);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const archived = item.status === "ARCHIVED";

  async function changeArchiveState() {
    if (!item.id) {
      return;
    }
    setPending(true);
    try {
      const updated = archived
        ? await restoreKnowledgeDocument(item.id)
        : await archiveKnowledgeDocument(item.id);
      onChanged(updated);
      setOpen(false);
    } catch {
      projectWingToast.error(copy.knowledge.manage.operationError, {
        duration: 5000,
      });
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!item.id) {
      return;
    }
    setPending(true);
    try {
      await deleteKnowledgeDocument(item.id);
      onChanged(null);
      setOpen(false);
    } catch {
      projectWingToast.error(copy.knowledge.manage.operationError, {
        duration: 5000,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Tooltip content={copy.knowledge.manage.edit} relationship="label">
        <Button
          appearance="subtle"
          aria-label={copy.knowledge.manage.edit}
          icon={<Edit20Regular />}
          onClick={() => setEditOpen(true)}
          size="small"
        />
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          setOpen(data.open);
          if (!data.open) {
            setConfirmingDelete(false);
          }
        }}
      >
        <DialogTrigger disableButtonEnhancement>
          <Tooltip content={copy.knowledge.manage.action} relationship="label">
            <Button
              appearance="subtle"
              aria-label={copy.knowledge.manage.action}
              icon={<Delete20Regular />}
              size="small"
            />
          </Tooltip>
        </DialogTrigger>
        <DialogSurface ref={mobileSurface} data-responsive-dialog="">
          <DialogBody>
            <DialogTitle>{copy.knowledge.manage.title}</DialogTitle>
            <DialogContent className="grid gap-3">
              <Text weight="semibold">{item.title}</Text>
              <Text className="text-muted-foreground">
                {confirmingDelete
                  ? copy.knowledge.manage.deleteDescription
                  : copy.knowledge.manage.archiveDescription}
              </Text>
            </DialogContent>
            <DialogActions className="flex-wrap">
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">
                  {copy.knowledge.manage.cancel}
                </Button>
              </DialogTrigger>
              {confirmingDelete ? (
                <Button
                  appearance="primary"
                  disabled={pending}
                  icon={<Delete20Regular />}
                  onClick={remove}
                >
                  {copy.knowledge.manage.confirmDelete}
                </Button>
              ) : (
                <>
                  <Button
                    appearance="secondary"
                    disabled={pending}
                    icon={
                      archived ? <ArrowReset20Regular /> : <Archive20Regular />
                    }
                    onClick={changeArchiveState}
                  >
                    {archived
                      ? copy.knowledge.manage.restore
                      : copy.knowledge.manage.archive}
                  </Button>
                  <Button
                    appearance="secondary"
                    icon={<Delete20Regular />}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    {copy.knowledge.manage.delete}
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <KnowledgePublishDialog
        copy={copy}
        department={item.department}
        item={item}
        kind={item.kind ?? "FILE"}
        onOpenChange={setEditOpen}
        onPublished={(updated) => {
          onChanged(updated);
          setEditOpen(false);
        }}
        open={editOpen}
        secondaryCategory={item.secondaryCategory}
        tertiaryCategory={item.tertiaryCategory}
      />
    </>
  );
}
