import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { ConfirmationInformationLibraryField } from "./confirmation-information-library-field";
import type { ConfirmationInformationLibraryDraftPatch } from "./confirmation-information-library-match";

export type ConfirmationInformationLibraryDraftValues = {
  confirmationInformationLibraryEntryId?: string;
  bankName: string;
  counterpartyAddress: string;
  counterpartyAttention: string;
  counterpartyContact: string;
  recipientAddress?: string;
  recipientName?: string;
};

type ConfirmationInformationLibraryDraftFieldsProps = {
  copy: {
    addressMissing: string;
    apply: string;
    clear: string;
    attention: string;
    bankLookup: string;
    contact: string;
    empty: string;
    loadError: string;
    loading: string;
    mailingAddress: string;
    searchPlaceholder: string;
  };
  locale: string;
  templateCode: string;
  values: ConfirmationInformationLibraryDraftValues;
  readOnly?: boolean;
  disabled?: boolean;
  onChange: (
    patch: Partial<ConfirmationInformationLibraryDraftValues> &
      Partial<ConfirmationInformationLibraryDraftPatch>
  ) => void;
};

export function ConfirmationInformationLibraryDraftFields({
  copy,
  locale,
  templateCode,
  values,
  readOnly = false,
  disabled = false,
  onChange,
}: ConfirmationInformationLibraryDraftFieldsProps) {
  const [pendingPatch, setPendingPatch] =
    useState<ConfirmationInformationLibraryDraftPatch | null>(null);
  const [bankLookupOpen, setBankLookupOpen] = useState(true);
  const clearAppliedLibraryValues = () => {
    const mappedAddress = values.counterpartyAddress.trim();
    const mappedRecipientNames = [
      values.counterpartyAttention,
      values.counterpartyContact,
      values.bankName,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim());
    const patch: Partial<ConfirmationInformationLibraryDraftValues> = {
      confirmationInformationLibraryEntryId: "",
      bankName: "",
      counterpartyAddress: "",
      counterpartyAttention: "",
      counterpartyContact: "",
    };

    if (
      values.recipientAddress?.trim() &&
      values.recipientAddress.trim() === mappedAddress
    ) {
      patch.recipientAddress = "";
    }
    if (
      values.recipientName?.trim() &&
      mappedRecipientNames.includes(values.recipientName.trim())
    ) {
      patch.recipientName = "";
    }

    onChange(patch);
    setPendingPatch(null);
  };

  return (
    <div className="grid gap-3 border-b border-border bg-muted/20 px-3 py-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(20rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
      <div className="space-y-2">
        <Label htmlFor="confirmation-information-library-bank-trigger">
          {copy.bankLookup}
        </Label>
        <Button
          aria-expanded={bankLookupOpen}
          aria-haspopup="dialog"
          className="h-8 w-full justify-between px-2.5 font-normal"
          disabled={disabled || readOnly}
          id="confirmation-information-library-bank-trigger"
          type="button"
          variant="outline"
          onClick={() => setBankLookupOpen(true)}
        >
          <span className="min-w-0 truncate text-left">
            {values.bankName || copy.searchPlaceholder}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {copy.bankLookup}
          </span>
        </Button>
      </div>
      <DraftMetadataInput
        disabled={disabled}
        id="confirmation-information-library-mailing-address"
        label={copy.mailingAddress}
        onValueChange={(counterpartyAddress) =>
          onChange({ counterpartyAddress })
        }
        readOnly={readOnly}
        value={values.counterpartyAddress}
      />
      <DraftMetadataInput
        disabled={disabled}
        id="confirmation-information-library-attention"
        label={copy.attention}
        onValueChange={(counterpartyAttention) =>
          onChange({ counterpartyAttention })
        }
        readOnly={readOnly}
        value={values.counterpartyAttention}
      />
      <DraftMetadataInput
        disabled={disabled}
        id="confirmation-information-library-contact"
        label={copy.contact}
        onValueChange={(counterpartyContact) =>
          onChange({ counterpartyContact })
        }
        readOnly={readOnly}
        value={values.counterpartyContact}
      />
      <Sheet
        open={bankLookupOpen}
        onOpenChange={(open) => {
          setBankLookupOpen(open);
          if (!open) {
            setPendingPatch(null);
          }
        }}
      >
        <SheetContent
          className="h-[min(42rem,calc(100vh-2rem))] w-full max-w-none gap-0 overflow-hidden rounded-b-2xl p-0 sm:max-w-none"
          side="top"
        >
          <SheetHeader className="border-b border-border/70 bg-muted/30 px-6 py-5 pr-14">
            <SheetTitle>{copy.bankLookup}</SheetTitle>
            <SheetDescription>{copy.searchPlaceholder}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto grid max-w-5xl gap-5">
              <div className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
                <ConfirmationInformationLibraryField
                  copy={{
                    addressMissing: copy.addressMissing,
                    empty: copy.empty,
                    loadError: copy.loadError,
                    loading: copy.loading,
                  }}
                  disabled={disabled}
                  id="confirmation-information-library-bank"
                  label={copy.bankLookup}
                  locale={locale}
                  onEntrySelect={(_entry, patch) => setPendingPatch(patch)}
                  placeholder={copy.searchPlaceholder}
                  readOnly={readOnly}
                  templateCode={templateCode}
                  value={values.bankName}
                />
              </div>
            </div>
          </div>
          {pendingPatch || values.confirmationInformationLibraryEntryId ? (
            <SheetFooter className="border-t border-border/70 bg-background px-6 py-4">
              <div className="mx-auto flex w-full max-w-5xl justify-end">
                <ButtonGroup>
                  {values.confirmationInformationLibraryEntryId ? (
                    <Button
                      aria-label={copy.clear}
                      disabled={disabled || readOnly}
                      type="button"
                      variant="outline"
                      onClick={clearAppliedLibraryValues}
                    >
                      {copy.clear}
                    </Button>
                  ) : null}
                  {pendingPatch ? (
                    <Button
                      disabled={disabled || readOnly}
                      type="button"
                      onClick={() => {
                        onChange(pendingPatch);
                        setPendingPatch(null);
                        setBankLookupOpen(false);
                      }}
                    >
                      {copy.apply}
                    </Button>
                  ) : null}
                </ButtonGroup>
              </div>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DraftMetadataInput({
  disabled,
  id,
  label,
  onValueChange,
  readOnly,
  value,
}: {
  disabled: boolean;
  id: string;
  label: string;
  onValueChange: (value: string) => void;
  readOnly: boolean;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        disabled={disabled}
        id={id}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        readOnly={readOnly}
        value={value}
      />
    </div>
  );
}
