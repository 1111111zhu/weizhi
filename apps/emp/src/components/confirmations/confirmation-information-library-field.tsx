import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/api/client";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus,
} from "@/components/reui/autocomplete";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BankTemplateRequiredDialog } from "./bank-template-required-dialog";

import {
  buildConfirmationInformationLibraryDraftPatch,
  matchesConfirmationInformationLibraryEntry,
} from "./confirmation-information-library-match";
import type {
  ConfirmationInformationLibraryDraftPatch,
  ConfirmationInformationLibraryMatchEntry,
} from "./confirmation-information-library-match";

type ConfirmationInformationLibraryEntry =
  ConfirmationInformationLibraryMatchEntry & {
    isReadyForDispatch: boolean;
  };

type ConfirmationInformationLibraryFieldProps = {
  copy: {
    addressMissing: string;
    empty: string;
    loadError: string;
    loading: string;
  };
  id: string;
  label: string;
  locale: string;
  placeholder: string;
  templateCode: string;
  value: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  onEntrySelect: (
    entry: ConfirmationInformationLibraryEntry,
    patch: ConfirmationInformationLibraryDraftPatch
  ) => void;
};

export function ConfirmationInformationLibraryField({
  copy,
  id,
  label,
  locale,
  placeholder,
  templateCode,
  value,
  readOnly = false,
  disabled = false,
  className,
  containerClassName,
  onEntrySelect,
}: ConfirmationInformationLibraryFieldProps) {
  const canSearch = !readOnly && !disabled;
  const [bankTemplateRequiredOpen, setBankTemplateRequiredOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value);
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  const query = useQuery({
    queryKey: ["confirmation-information-library", "active"],
    queryFn: () =>
      api.confirmationInformationLibrary({ includeInactive: false }),
    enabled: canSearch,
  });
  const entries = (query.data ?? []) as ConfirmationInformationLibraryEntry[];
  const matchingEntries = entries.filter((entry) =>
    matchesConfirmationInformationLibraryEntry(entry, searchValue)
  );
  const preferredName = (entry: ConfirmationInformationLibraryEntry) =>
    locale.toLowerCase().startsWith("zh")
      ? entry.bankNameZh || entry.bankNameEn
      : entry.bankNameEn || entry.bankNameZh;
  const selectEntry = (entry: ConfirmationInformationLibraryEntry) => {
    if (entry.requiresBankTemplate) {
      setSearchValue(value);
      setBankTemplateRequiredOpen(true);
      return;
    }
    const patch = buildConfirmationInformationLibraryDraftPatch(
      entry,
      templateCode
    );
    setSearchValue(preferredName(entry));
    onEntrySelect(entry, patch);
  };

  return (
    <div className={cn("space-y-2", containerClassName)}>
      <Label htmlFor={id}>{label}</Label>
      <Autocomplete
        filter={null}
        itemToStringValue={(item: unknown) =>
          preferredName(item as ConfirmationInformationLibraryEntry)
        }
        items={matchingEntries}
        onValueChange={(nextValue, details) => {
          if (details.reason !== "item-press") {
            setSearchValue(nextValue);
          }
        }}
        value={searchValue}
      >
        <AutocompleteInput
          aria-label={label}
          className={className}
          disabled={disabled}
          id={id}
          placeholder={placeholder}
          readOnly={readOnly}
          showClear={canSearch}
          showTrigger={canSearch}
        />
        {canSearch ? (
          <AutocompleteContent>
            {query.isPending ? (
              <AutocompleteStatus>{copy.loading}</AutocompleteStatus>
            ) : query.isError ? (
              <AutocompleteStatus>{copy.loadError}</AutocompleteStatus>
            ) : matchingEntries.length > 0 ? (
              <AutocompleteList>
                <AutocompleteCollection>
                  {(entry: ConfirmationInformationLibraryEntry) => (
                    <AutocompleteItem
                      className="flex w-full items-start gap-2 py-2"
                      key={entry.id}
                      onClick={() => selectEntry(entry)}
                      value={entry}
                    >
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {entry.bankCode}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {preferredName(entry)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {locale.toLowerCase().startsWith("zh")
                            ? entry.bankNameEn
                            : entry.bankNameZh}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {entry.effectiveMailingAddress ?? copy.addressMissing}
                        </span>
                      </span>
                    </AutocompleteItem>
                  )}
                </AutocompleteCollection>
              </AutocompleteList>
            ) : (
              <AutocompleteEmpty>{copy.empty}</AutocompleteEmpty>
            )}
          </AutocompleteContent>
        ) : null}
      </Autocomplete>
      <BankTemplateRequiredDialog open={bankTemplateRequiredOpen} onOpenChange={setBankTemplateRequiredOpen} locale={locale} />
    </div>
  );
}
