"use client";

import type { CmpEngagement } from "@project-wing/shared";
import { Button } from "@project-wing/ui";
import { LoaderCircle, Plus } from "lucide-react";

import { SearchSelect } from "@/components/cmp-form-controls";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BillingCreateCopy = {
  cancel: string;
  chooseEngagement: string;
  create: string;
  createHint: string;
  engagement: string;
  newBilling: string;
  noMatchingEngagements: string;
  searchEngagement: string;
  unnamedClient: string;
};

export function BillingCreateDialog({
  open,
  copy,
  engagementId,
  selectedEngagementId,
  setSelectedEngagementId,
  engagements,
  pending,
  onClose,
  onCreate,
}: {
  open: boolean;
  copy: BillingCreateCopy;
  engagementId?: string;
  selectedEngagementId: string;
  setSelectedEngagementId: (value: string) => void;
  engagements: CmpEngagement[];
  pending: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="billing-create-dialog max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto p-6 sm:max-w-[42rem]">
        <DialogHeader>
          <DialogTitle>{copy.newBilling}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{copy.createHint}</p>
        {engagementId ? null : (
          <SearchSelect
            label={copy.engagement}
            value={selectedEngagementId}
            options={engagements.map((engagement) => ({
              value: engagement.id,
              label: engagement.engagementCode,
              description: `${engagement.client.clientCode} · ${engagement.client.nameZh || engagement.client.nameEn || copy.unnamedClient} · ${engagement.feeCurrency}`,
              keywords: `${engagement.client.clientCode} ${engagement.client.nameZh ?? ""} ${engagement.client.nameEn ?? ""}`,
            }))}
            placeholder={copy.chooseEngagement}
            searchPlaceholder={copy.searchEngagement}
            emptyText={copy.noMatchingEngagements}
            popoverClassName="static mt-1 w-full"
            onChange={setSelectedEngagementId}
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button disabled={pending} onClick={onCreate}>
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {copy.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
