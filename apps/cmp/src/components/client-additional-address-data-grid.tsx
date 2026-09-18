"use client";

import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CmpDictionary } from "@/i18n/client";

import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

export type ClientAdditionalAddressFormRow = {
  id: string;
  key: string;
  label: string;
  address: string;
};

type WorkspaceCopy = CmpDictionary["workspace"];
type AddressGridColumn =
  ProjectWingMasterDataGridProps<ClientAdditionalAddressFormRow>["columns"][number];
type AddressGridCallbacks = {
  addresses: ClientAdditionalAddressFormRow[];
  copy: WorkspaceCopy;
  onChange: (addresses: ClientAdditionalAddressFormRow[]) => void;
  openEditor: (address?: ClientAdditionalAddressFormRow) => void;
};

const EMPTY_ADDRESS: ClientAdditionalAddressFormRow = {
  id: "",
  key: "",
  label: "",
  address: "",
};

export function ClientAdditionalAddressDataGrid({
  addresses,
  copy,
  onChange,
}: {
  addresses: ClientAdditionalAddressFormRow[];
  copy: WorkspaceCopy;
  onChange: (addresses: ClientAdditionalAddressFormRow[]) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] =
    useState<ClientAdditionalAddressFormRow>(EMPTY_ADDRESS);
  const [pendingDelete, setPendingDelete] =
    useState<ClientAdditionalAddressFormRow | null>(null);
  const callbacksRef = useRef<AddressGridCallbacks>({
    addresses,
    copy,
    onChange,
    openEditor: () => {},
  });
  const openEditor = useCallback((address?: ClientAdditionalAddressFormRow) => {
    setDraft(
      address
        ? { ...address }
        : { ...EMPTY_ADDRESS, key: `address-${crypto.randomUUID()}` }
    );
    setDialogOpen(true);
  }, []);
  useEffect(() => {
    callbacksRef.current = { addresses, copy, onChange, openEditor };
  }, [addresses, copy, onChange, openEditor]);

  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<AddressGridColumn[]>(() => {
    const header = (title: string) =>
      function AddressColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          ClientAdditionalAddressFormRow,
          unknown
        >["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };

    return [
      {
        accessorKey: "label",
        id: "label",
        header: header(copy.clientFormAddressLabel),
        cell: ({ row }) => (
          <strong className="block truncate font-medium text-foreground">
            {row.original.label}
          </strong>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormAddressLabel,
        },
        size: 220,
      },
      {
        accessorKey: "address",
        id: "address",
        header: header(copy.clientFormAddress),
        cell: ({ row }) => (
          <span className="block truncate text-foreground">
            {row.original.address}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormAddress,
        },
        size: 640,
      },
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => (
          <ButtonGroup>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormEditAddress}
              onClick={() => callbacksRef.current.openEditor(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormDeleteAddress}
              onClick={() => setPendingDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </ButtonGroup>
        ),
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { headerTitle: copy.action },
        size: 86,
      },
    ];
  }, [copy, menuCopy]);
  const labelValid = Boolean(draft.label.trim());
  const addressValid = Boolean(draft.address.trim());
  const saveAddress = () => {
    if (!labelValid || !addressValid) {
      return;
    }
    const normalized = {
      ...draft,
      key: draft.key || `address-${crypto.randomUUID()}`,
      label: draft.label.trim(),
      address: draft.address.trim(),
    };
    const existingIndex = addresses.findIndex(
      (address) => address.key === normalized.key
    );
    onChange(
      existingIndex === -1
        ? [...addresses, normalized]
        : addresses.map((address, index) =>
            index === existingIndex ? normalized : address
          )
    );
    setDialogOpen(false);
  };

  return (
    <section className="cmp-additional-addresses">
      <header className="cmp-resource-editor-heading cmp-additional-addresses-heading">
        <div>
          <h4>{copy.clientFormAdditionalAddresses}</h4>
        </div>
        <Button type="button" size="sm" onClick={() => openEditor()}>
          <Plus />
          {copy.clientFormAddAddress}
        </Button>
      </header>

      <div className="cmp-additional-address-grid">
        <CmpMasterDataGrid
          mobile={{ titleColumn: "label", summaryColumns: ["address"] }}
          columns={columns}
          data={addresses}
          emptyMessage={copy.clientFormAddressesEmpty}
          getRowId={(address) => address.key}
          initialSorting={[]}
          showRecordCount={false}
          showRowSelection={false}
          showToolbar={false}
          tableLabel={copy.clientFormAdditionalAddresses}
          tableLayout={{ headerSticky: false, columnsVisibility: false }}
          testId="cmp-client-additional-address-data-grid"
          title={copy.clientFormAdditionalAddresses}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
          closeLabel={copy.close}
        >
          <DialogHeader>
            <DialogTitle>
              {addresses.some((address) => address.key === draft.key)
                ? copy.clientFormEditAddress
                : copy.clientFormAddAddress}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {copy.clientFormAddressDialogDescription}
            </p>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">
                {copy.clientFormAddressLabel}
              </span>
              <Input
                aria-label={copy.clientFormAddressLabel}
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">
                {copy.clientFormAddress}
              </span>
              <Textarea
                aria-label={copy.clientFormAddress}
                className="min-h-28"
                value={draft.address}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <ButtonGroup className="justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              disabled={!labelValid || !addressValid}
              onClick={saveAddress}
            >
              {copy.clientFormSaveAddress}
            </Button>
          </ButtonGroup>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy.clientFormDeleteAddressTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(
                copy.clientFormDeleteAddressDescription ?? "Delete {label}?"
              ).replace(
                "{label}",
                pendingDelete?.label || copy.clientFormAddress
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDelete) {
                  return;
                }
                onChange(
                  addresses.filter(
                    (address) => address.key !== pendingDelete.key
                  )
                );
                setPendingDelete(null);
              }}
            >
              {copy.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
