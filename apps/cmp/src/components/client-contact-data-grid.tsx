"use client";

import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { Badge } from "@project-wing/ui";
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

export type ClientContactFormRow = {
  id: string;
  key: string;
  name: string;
  position: string;
  department: string;
  officePhone: string;
  mobile: string;
  email: string;
  remarks: string;
};

type WorkspaceCopy = CmpDictionary["workspace"];
type ContactGridColumn =
  ProjectWingMasterDataGridProps<ClientContactFormRow>["columns"][number];
type ContactGridCallbacks = {
  contacts: ClientContactFormRow[];
  copy: WorkspaceCopy;
  onChange: (contacts: ClientContactFormRow[]) => void;
  openEditor: (contact?: ClientContactFormRow) => void;
};

const EMPTY_CONTACT: ClientContactFormRow = {
  id: "",
  key: "",
  name: "",
  position: "",
  department: "",
  officePhone: "",
  mobile: "",
  email: "",
  remarks: "",
};

export function ClientContactDataGrid({
  contacts,
  copy,
  onChange,
}: {
  contacts: ClientContactFormRow[];
  copy: WorkspaceCopy;
  onChange: (contacts: ClientContactFormRow[]) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ClientContactFormRow>(EMPTY_CONTACT);
  const [pendingDelete, setPendingDelete] =
    useState<ClientContactFormRow | null>(null);
  const callbacksRef = useRef<ContactGridCallbacks>({
    contacts,
    copy,
    onChange,
    openEditor: () => {},
  });
  const openEditor = useCallback((contact?: ClientContactFormRow) => {
    setDraft(
      contact ? { ...contact } : { ...EMPTY_CONTACT, key: crypto.randomUUID() }
    );
    setDialogOpen(true);
  }, []);
  useEffect(() => {
    callbacksRef.current = { contacts, copy, onChange, openEditor };
  }, [contacts, copy, onChange, openEditor]);

  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<ContactGridColumn[]>(() => {
    const header = (title: string) =>
      function ContactColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          ClientContactFormRow,
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
    const textColumn = (
      id: keyof Pick<
        ClientContactFormRow,
        "position" | "department" | "officePhone" | "mobile" | "email"
      >,
      title: string,
      size: number
    ): ContactGridColumn => ({
      accessorKey: id,
      id,
      header: header(title),
      cell: ({ row }) => (
        <span className="block truncate text-foreground">
          {row.original[id] || copy.clientFormNotProvided}
        </span>
      ),
      enableHiding: true,
      enableResizing: true,
      enableSorting: true,
      filterFn: cmpSelectedValuesFilter,
      meta: { autoSize: true, headerTitle: title },
      size,
    });

    return [
      {
        accessorKey: "name",
        id: "name",
        header: header(copy.clientFormContactName),
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <strong className="block truncate font-medium text-foreground">
              {row.original.name || copy.clientFormNotProvided}
            </strong>
            {row.original.key === callbacksRef.current.contacts[0]?.key ? (
              <Badge variant="secondary">{copy.clientFormPrimaryContact}</Badge>
            ) : null}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.clientFormContactName,
        },
        size: 190,
      },
      textColumn("position", copy.clientFormPosition, 130),
      textColumn("department", copy.clientFormDepartment, 130),
      textColumn("officePhone", copy.clientFormOfficeTelephone, 150),
      textColumn("mobile", copy.clientFormMobile, 140),
      textColumn("email", copy.clientFormEmail, 210),
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => (
          <ButtonGroup>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormEditContact}
              onClick={() => callbacksRef.current.openEditor(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              accessibleName={copy.clientFormDeleteContact}
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
  const hasContactValue = [
    draft.name,
    draft.position,
    draft.department,
    draft.officePhone,
    draft.mobile,
    draft.email,
    draft.remarks,
  ].some((value) => Boolean(value.trim()));
  const emailValid =
    !draft.email.trim() ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());
  const saveContact = () => {
    if (!hasContactValue || !emailValid) {
      return;
    }
    const normalized = {
      ...draft,
      key: draft.key || crypto.randomUUID(),
      name: draft.name.trim(),
      position: draft.position.trim(),
      department: draft.department.trim(),
      officePhone: draft.officePhone.trim(),
      mobile: draft.mobile.trim(),
      email: draft.email.trim(),
      remarks: draft.remarks.trim(),
    };
    const existingIndex = contacts.findIndex(
      (contact) => contact.key === normalized.key
    );
    onChange(
      existingIndex === -1
        ? [...contacts, normalized]
        : contacts.map((contact, index) =>
            index === existingIndex ? normalized : contact
          )
    );
    setDialogOpen(false);
  };

  return (
    <section className="cmp-form-subsection cmp-form-span-full cmp-client-contacts-section">
      <header className="cmp-form-subsection-heading cmp-resource-editor-heading cmp-client-contacts-heading">
        <div>
          <h3>{copy.clientFormContactPerson}</h3>
          <p>{copy.clientFormContactDescription}</p>
        </div>
        <Button type="button" size="sm" onClick={() => openEditor()}>
          <Plus />
          {copy.clientFormAddContact}
        </Button>
      </header>

      <div className="cmp-client-contact-grid">
        <CmpMasterDataGrid
          mobile={{ titleColumn: "name", summaryColumns: ["email", "phone"] }}
          columns={columns}
          data={contacts}
          emptyMessage={copy.clientFormContactsEmpty}
          getRowId={(contact) => contact.key}
          initialSorting={[]}
          showRecordCount={false}
          showRowSelection={false}
          showToolbar={false}
          tableLabel={copy.clientFormContactPerson}
          tableLayout={{ headerSticky: false, columnsVisibility: false }}
          testId="cmp-client-contact-data-grid"
          title={copy.clientFormContactPerson}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl"
          closeLabel={copy.close}
        >
          <DialogHeader>
            <DialogTitle>
              {contacts.some((contact) => contact.key === draft.key)
                ? copy.clientFormEditContact
                : copy.clientFormAddContact}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {copy.clientFormContactDialogDescription}
            </p>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ContactField
              label={copy.clientFormContactName}
              value={draft.name}
              onChange={(name) => setDraft((current) => ({ ...current, name }))}
            />
            <ContactField
              label={copy.clientFormPosition}
              value={draft.position}
              onChange={(position) =>
                setDraft((current) => ({ ...current, position }))
              }
            />
            <ContactField
              label={copy.clientFormDepartment}
              value={draft.department}
              onChange={(department) =>
                setDraft((current) => ({ ...current, department }))
              }
            />
            <ContactField
              label={copy.clientFormOfficeTelephone}
              value={draft.officePhone}
              onChange={(officePhone) =>
                setDraft((current) => ({ ...current, officePhone }))
              }
            />
            <ContactField
              label={copy.clientFormMobile}
              value={draft.mobile}
              onChange={(mobile) =>
                setDraft((current) => ({ ...current, mobile }))
              }
            />
            <ContactField
              label={copy.clientFormEmail}
              type="email"
              value={draft.email}
              invalid={!emailValid}
              onChange={(email) =>
                setDraft((current) => ({ ...current, email }))
              }
            />
            <label className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
              <span className="text-sm font-medium">
                {copy.clientFormContactNotes}
              </span>
              <Textarea
                aria-label={copy.clientFormContactNotes}
                value={draft.remarks}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    remarks: event.target.value,
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
              disabled={!hasContactValue || !emailValid}
              onClick={saveContact}
            >
              {copy.clientFormSaveContact}
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
              {copy.clientFormDeleteContactTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy.clientFormDeleteContactDescription.replace(
                "{name}",
                pendingDelete?.name || copy.clientFormNotProvided
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
                  contacts.filter(
                    (contact) => contact.key !== pendingDelete.key
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

function ContactField({
  invalid = false,
  label,
  onChange,
  type = "text",
  value,
}: {
  invalid?: boolean;
  label: string;
  onChange: (value: string) => void;
  type?: "email" | "text";
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input
        aria-label={label}
        aria-invalid={invalid || undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
