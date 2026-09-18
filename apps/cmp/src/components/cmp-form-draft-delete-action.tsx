"use client";

import { MotionButton, Skeleton } from "@project-wing/ui";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type CmpFormDraftDeleteCopy = {
  cancel: string;
  delete: string;
  deleteDraft: string;
  deleteDraftDescription: string;
  deleteDraftTitle: string;
  deletingDraft: string;
};

export function CmpFormDraftDeleteAction({
  copy,
  disabled = false,
  isDeleting = false,
  onDelete,
}: {
  copy: CmpFormDraftDeleteCopy;
  disabled?: boolean;
  isDeleting?: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const confirmDelete = () => {
    void onDelete().then(() => setIsOpen(false));
  };

  return (
    <>
      <MotionButton
        aria-label={copy.deleteDraft}
        className="size-7 cursor-pointer rounded-md"
        data-action-id="delete-draft"
        disabled={disabled || isDeleting}
        size="icon"
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </MotionButton>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteDraftTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.deleteDraftDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {copy.cancel}
            </AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? (
                <Skeleton className="mr-1.5 inline-block size-3.5 rounded-full" />
              ) : null}
              {isDeleting ? copy.deletingDraft : copy.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
