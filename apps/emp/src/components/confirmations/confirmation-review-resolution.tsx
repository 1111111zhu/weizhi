"use client";

import type {
  ConfirmationDifferenceStatus,
  ConfirmationStatus,
  ReviewProjectConfirmationResponseInput,
} from "@project-wing/shared";
import { CheckCircle2, CircleAlert, Undo2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export type ConfirmationReviewResolutionCopy = {
  title: string;
  description: string;
  pending: string;
  matched: string;
  mismatched: string;
  confirmMatched: string;
  chooseAction: string;
  redispatch: string;
  alternativeProcedure: string;
  notes: string;
  notesPlaceholder: string;
  submit: string;
  completeAlternative: string;
  undoReview: string;
};

export type ConfirmationReviewResolutionProps = {
  status: ConfirmationStatus;
  differenceStatus?: ConfirmationDifferenceStatus | null;
  canEdit: boolean;
  isSaving?: boolean;
  isCompleting?: boolean;
  canUndo?: boolean;
  isUndoing?: boolean;
  copy: ConfirmationReviewResolutionCopy;
  onReview: (input: ReviewProjectConfirmationResponseInput) => void;
  onCompleteAlternativeProcedure: () => void;
  onUndo?: () => void;
};

export function ConfirmationReviewResolution({
  status,
  differenceStatus,
  canEdit,
  isSaving,
  isCompleting,
  canUndo,
  isUndoing,
  copy,
  onReview,
  onCompleteAlternativeProcedure,
  onUndo,
}: ConfirmationReviewResolutionProps) {
  const [result, setResult] = useState<"MATCHED" | "MISMATCHED" | null>(null);
  const [action, setAction] = useState<
    "REDISPATCH" | "ALTERNATIVE_PROCEDURE" | null
  >(null);
  const [notes, setNotes] = useState("");
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const undoButton =
    canEdit && canUndo && onUndo ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isUndoing}
        onClick={onUndo}
      >
        <Undo2 />
        {copy.undoReview}
      </Button>
    ) : null;

  if (differenceStatus === "PENDING_FOLLOW_UP") {
    return canEdit ? (
      <ButtonGroup className="shrink-0 gap-1">
        {undoButton}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isCompleting}
          onClick={onCompleteAlternativeProcedure}
        >
          <CheckCircle2 />
          {copy.completeAlternative}
        </Button>
      </ButtonGroup>
    ) : null;
  }

  if (status !== "RESPONSE_RECEIVED" || differenceStatus || !canEdit) {
    return undoButton;
  }

  const submit = () => {
    if (!result) {
      return;
    }
    if (result === "MATCHED") {
      onReview({ result });
      setMismatchOpen(false);
      return;
    }
    if (!action) {
      return;
    }
    onReview({
      result,
      action,
      notes: notes.trim() || undefined,
    });
    setMismatchOpen(false);
  };

  return (
    <Popover open={mismatchOpen} onOpenChange={setMismatchOpen}>
      <ButtonGroup className="shrink-0 gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-foreground hover:border-success/50 hover:bg-success/10 hover:text-success"
          disabled={isSaving}
          onClick={() => {
            setResult("MATCHED");
            setAction(null);
            onReview({ result: "MATCHED" });
          }}
        >
          <CheckCircle2 />
          {copy.matched}
        </Button>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              disabled={isSaving}
              aria-expanded={mismatchOpen}
              onClick={() => setResult("MISMATCHED")}
            >
              <CircleAlert />
              {copy.mismatched}
            </Button>
          }
        />
      </ButtonGroup>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] p-3"
      >
        <div className="grid gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {copy.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.description}
            </p>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">
              {copy.chooseAction}
            </p>
            <ButtonGroup className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={action === "REDISPATCH"}
                className={
                  action === "REDISPATCH"
                    ? "border-primary/60 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20 hover:border-primary/70 hover:bg-primary/15 hover:text-primary"
                    : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                }
                onClick={() => setAction("REDISPATCH")}
              >
                {copy.redispatch}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={action === "ALTERNATIVE_PROCEDURE"}
                className={
                  action === "ALTERNATIVE_PROCEDURE"
                    ? "border-primary/60 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20 hover:border-primary/70 hover:bg-primary/15 hover:text-primary"
                    : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                }
                onClick={() => setAction("ALTERNATIVE_PROCEDURE")}
              >
                {copy.alternativeProcedure}
              </Button>
            </ButtonGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmation-review-notes">{copy.notes}</Label>
            <Textarea
              id="confirmation-review-notes"
              autoFocus
              value={notes}
              placeholder={copy.notesPlaceholder}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!action || isSaving}
            onClick={submit}
          >
            {copy.submit}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
