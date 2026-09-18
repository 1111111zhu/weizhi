"use client";

import type {
  ConfirmationDispatchMethod,
  CreateProjectConfirmationDispatchInput,
} from "@project-wing/shared";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Mail,
  Paperclip,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type {
  ProjectConfirmation,
  Tracking17TrackCarrier,
  UserMailConnection,
} from "../../api/client";
import type { ConfirmationTrackingCopy } from "./project-confirmation-tracking";

const METHODS: ConfirmationDispatchMethod[] = [
  "POST",
  "COURIER",
  "EMAIL",
  "OTHER",
];

type TrackingQueryCopy = Pick<
  ConfirmationTrackingCopy,
  | "trackingQueryTitle"
  | "trackingQuerySelectPlaceholder"
  | "trackingQueryExample"
  | "trackingQueryLabels"
>;

export function ProjectConfirmationDispatchAction({
  copy,
  isDispatching,
  methodLabels,
  onDispatch,
  isWithdrawing,
  onWithdraw,
  confirmationName,
  attachmentFileName,
  defaultRecipientName,
  defaultRecipientContact,
  mailConnection,
  locale,
  searchTrackingCarriers,
  isRedispatch = false,
  showWithdraw = true,
  triggerLabel,
  onUploadDispatchScan,
}: {
  copy: ConfirmationTrackingCopy;
  isDispatching?: boolean;
  methodLabels: Partial<Record<ConfirmationDispatchMethod, string>>;
  onDispatch: (
    input: CreateProjectConfirmationDispatchInput
  ) => Promise<ProjectConfirmation> | ProjectConfirmation | undefined;
  onUploadDispatchScan?: (
    confirmation: ProjectConfirmation,
    file: File
  ) => Promise<unknown> | undefined;
  isWithdrawing?: boolean;
  onWithdraw?: (reason: string) => void;
  confirmationName: string;
  attachmentFileName: string;
  defaultRecipientName?: string;
  defaultRecipientContact?: string;
  mailConnection?: UserMailConnection;
  locale: string;
  searchTrackingCarriers: (query: string) => Promise<Tracking17TrackCarrier[]>;
  isRedispatch?: boolean;
  showWithdraw?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ConfirmationDispatchMethod>("EMAIL");
  const [recipientName, setRecipientName] = useState(
    defaultRecipientName ?? ""
  );
  const [recipientContact, setRecipientContact] = useState(
    defaultRecipientContact ?? ""
  );
  const [recipientPhone, setRecipientPhone] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [selectedCarrier, setSelectedCarrier] =
    useState<Tracking17TrackCarrier | null>(null);
  const [trackingQueryParameters, setTrackingQueryParameters] = useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [dispatchScanFile, setDispatchScanFile] = useState<File | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState("");
  const isTrackingOnly = method === "COURIER" || method === "POST";
  const carrierDisplayName = (carrier: Tracking17TrackCarrier) =>
    locale === "zh-CN" ? carrier.nameZh : carrier.name;

  return (
    <>
      <ButtonGroup>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button">
                <Send />
                {triggerLabel ?? copy.send}
                <ChevronDown />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {METHODS.map((value) => (
              <DropdownMenuItem
                key={value}
                onClick={() => {
                  setMethod(value);
                  setRecipientName(defaultRecipientName ?? "");
                  setRecipientContact(defaultRecipientContact ?? "");
                  setTrackingNumber("");
                  setSelectedCarrier(null);
                  setTrackingQueryParameters({});
                  setDispatchScanFile(null);
                  if (value === "EMAIL") {
                    setEmailSubject(
                      copy.emailSubjectTemplate.replace(
                        "{name}",
                        confirmationName
                      )
                    );
                    setEmailBody(copy.emailBodyTemplate);
                  }
                  setOpen(true);
                }}
              >
                {methodLabels[value] ?? value}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {showWithdraw ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setWithdrawOpen(true)}
          >
            <RotateCcw />
            {copy.withdraw}
          </Button>
        ) : null}
      </ButtonGroup>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "max-h-[calc(100vh-2rem)] overflow-hidden",
            method === "EMAIL"
              ? "sm:max-w-4xl"
              : isTrackingOnly
                ? "sm:max-w-lg"
                : "sm:max-w-xl"
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {method === "EMAIL"
                ? copy.sendEmailTitle
                : isTrackingOnly
                  ? copy.recordTrackingTitle
                  : copy.sendTitle}
            </DialogTitle>
            <DialogDescription>
              {method === "EMAIL"
                ? copy.sendEmailDescription
                : isTrackingOnly
                  ? copy.recordTrackingDescription
                  : copy.sendDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto pr-1">
            {method === "EMAIL" ? (
              <div className="grid gap-5">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary ring-1 ring-border">
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {copy.emailSender}
                      </p>
                      <p className="truncate font-medium">
                        {mailConnection?.emailAddress ?? copy.mailboxTitle}
                      </p>
                    </div>
                  </div>
                  <MailboxStatusBadge
                    copy={copy}
                    status={mailConnection?.status}
                  />
                </div>

                <div className="grid gap-4">
                  <ComposeField
                    id="dispatch-recipient-contact"
                    label={copy.recipientEmail}
                    type="email"
                    value={recipientContact}
                    onChange={setRecipientContact}
                  />
                  <Separator />
                  <ComposeField
                    id="dispatch-email-subject"
                    label={copy.emailSubject}
                    value={emailSubject}
                    onChange={setEmailSubject}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dispatch-email-body">{copy.emailBody}</Label>
                  <Textarea
                    id="dispatch-email-body"
                    className="min-h-64 resize-y leading-6"
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>{copy.emailAttachment}</Label>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {attachmentFileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {copy.emailPdfAttachment}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {copy.emailAttachmentFixed}
                    </Badge>
                  </div>
                </div>

                {mailConnection?.status === "CONNECTED" ? null : (
                  <p className="text-xs text-muted-foreground">
                    {copy.mailboxManageHint}
                  </p>
                )}
              </div>
            ) : isTrackingOnly ? (
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <Label id="dispatch-carrier-label">
                    {copy.trackingCarrier}
                  </Label>
                  <TrackingCarrierPicker
                    copy={copy}
                    locale={locale}
                    onChange={(carrier) => {
                      setSelectedCarrier(carrier);
                      setTrackingQueryParameters({});
                    }}
                    searchTrackingCarriers={searchTrackingCarriers}
                    value={selectedCarrier}
                  />
                  <p className="text-xs text-muted-foreground">
                    {copy.trackingCarrierHelp}
                  </p>
                </div>
                <TrackingCarrierQueryFields
                  carrier={selectedCarrier}
                  copy={copy}
                  onChange={setTrackingQueryParameters}
                  values={trackingQueryParameters}
                />
                <Label htmlFor="dispatch-tracking-number">
                  {copy.trackingNumberInput}
                </Label>
                <Input
                  id="dispatch-tracking-number"
                  autoComplete="off"
                  autoFocus
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {copy.dispatchScanOptional}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <p className="text-sm font-medium sm:col-span-2">
                  {copy.method}: {methodLabels[method] ?? method}
                </p>
                <DispatchInput
                  id="dispatch-recipient-name"
                  label={copy.recipientName}
                  value={recipientName}
                  onChange={setRecipientName}
                />
                <DispatchInput
                  id="dispatch-recipient-contact"
                  label={copy.recipientContact}
                  value={recipientContact}
                  onChange={setRecipientContact}
                />
                <DispatchInput
                  id="dispatch-recipient-phone"
                  label={copy.recipientPhone}
                  value={recipientPhone}
                  onChange={setRecipientPhone}
                />
                <DispatchInput
                  id="dispatch-reference"
                  label={copy.reference}
                  value={reference}
                  onChange={setReference}
                />
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="dispatch-notes">{copy.notes}</Label>
                  <Textarea
                    id="dispatch-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="mt-5 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor="dispatch-scan-file">
                  {copy.dispatchScanUpload}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {copy.dispatchScanOptional}
                </span>
              </div>
              <Input
                id="dispatch-scan-file"
                aria-label={copy.dispatchScanUpload}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) =>
                  setDispatchScanFile(event.target.files?.[0] ?? null)
                }
              />
              {dispatchScanFile ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Upload className="size-3.5" />
                  {dispatchScanFile.name}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {copy.cancel}
              </Button>
              <Button
                disabled={
                  isDispatching ||
                  isSubmitting ||
                  (!isTrackingOnly && !recipientContact.trim()) ||
                  (method === "EMAIL" &&
                    (mailConnection?.status !== "CONNECTED" ||
                      !emailSubject.trim() ||
                      !emailBody.trim()))
                }
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    const dispatched = await onDispatch({
                      idempotencyKey: globalThis.crypto.randomUUID(),
                      method,
                      sentAt: new Date().toISOString(),
                      recipientName: recipientName.trim() || undefined,
                      recipientContact: recipientContact.trim(),
                      recipientPhone: recipientPhone.trim() || undefined,
                      courierName: selectedCarrier
                        ? carrierDisplayName(selectedCarrier)
                        : undefined,
                      trackingNumber: trackingNumber.trim() || undefined,
                      trackingCarrierCode: selectedCarrier?.code,
                      trackingQueryParameters:
                        Object.keys(trackingQueryParameters).length > 0
                          ? trackingQueryParameters
                          : undefined,
                      dispatchReference: reference.trim() || undefined,
                      notes: notes.trim() || undefined,
                      emailSubject:
                        method === "EMAIL" ? emailSubject.trim() : undefined,
                      emailBody:
                        method === "EMAIL" ? emailBody.trim() : undefined,
                      isRedispatch,
                    });
                    if (
                      dispatchScanFile &&
                      dispatched &&
                      onUploadDispatchScan
                    ) {
                      void Promise.resolve()
                        .then(() =>
                          onUploadDispatchScan(dispatched, dispatchScanFile)
                        )
                        .catch(() => {});
                    }
                    setOpen(false);
                  } catch {
                    // The parent mutation presents the API error. Keep the form open.
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
              >
                <Send />
                {method === "EMAIL"
                  ? copy.sendEmail
                  : isTrackingOnly
                    ? copy.confirmCourierSent
                    : copy.confirmSent}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.withdrawTitle}</DialogTitle>
            <DialogDescription>{copy.withdrawDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="toolbar-withdraw-reason">
              {copy.withdrawReason}
            </Label>
            <Textarea
              id="toolbar-withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                {copy.cancel}
              </Button>
              <Button
                disabled={isWithdrawing}
                onClick={() => {
                  onWithdraw?.(reason.trim());
                }}
              >
                {copy.confirmWithdraw}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MailboxStatusBadge({
  copy,
  status,
}: {
  copy: ConfirmationTrackingCopy;
  status?: UserMailConnection["status"];
}) {
  if (status === "CONNECTED") {
    return <Badge>{copy.mailboxConnected}</Badge>;
  }
  if (status === "ERROR") {
    return <Badge variant="destructive">{copy.mailboxError}</Badge>;
  }
  return <Badge variant="outline">{copy.mailboxDisconnected}</Badge>;
}

export function TrackingCarrierPicker({
  copy,
  locale,
  onChange,
  searchTrackingCarriers,
  value,
}: {
  copy: Pick<
    ConfirmationTrackingCopy,
    | "trackingCarrier"
    | "trackingCarrierAuto"
    | "trackingCarrierEmpty"
    | "trackingCarrierError"
    | "trackingCarrierLoading"
    | "trackingCarrierSearch"
  >;
  locale: string;
  onChange: (carrier: Tracking17TrackCarrier | null) => void;
  searchTrackingCarriers: (query: string) => Promise<Tracking17TrackCarrier[]>;
  value: Tracking17TrackCarrier | null;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Tracking17TrackCarrier[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const displayName = (carrier: Tracking17TrackCarrier) =>
    locale === "zh-CN" ? carrier.nameZh : carrier.name;

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setState("loading");
    const timer = window.setTimeout(() => {
      searchTrackingCarriers(query)
        .then((carriers) => {
          if (cancelled) {
            return;
          }
          setOptions(carriers);
          setState("success");
        })
        .catch(() => {
          if (!cancelled) {
            setState("error");
          }
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, searchTrackingCarriers]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && details.reason === "focus-out") {
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-labelledby="dispatch-carrier-label"
            aria-controls={listboxId}
            aria-expanded={open}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className="truncate">
          {value ? displayName(value) : copy.trackingCarrierAuto}
        </span>
        <ChevronsUpDown className="text-muted-foreground" />
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionAvoidance={{ side: "flip", align: "shift" }}
          className="max-h-(--available-height) w-(--anchor-width) min-w-72 overflow-hidden p-2"
        >
          <Input
            aria-label={copy.trackingCarrierSearch}
            autoComplete="off"
            autoFocus
            placeholder={copy.trackingCarrierSearch}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            role="listbox"
            id={listboxId}
            aria-label={copy.trackingCarrier}
            className="max-h-64 min-h-0 overflow-y-auto overscroll-contain"
          >
            <CarrierOption
              active={!value}
              label={copy.trackingCarrierAuto}
              onSelect={() => {
                onChange(null);
                setOpen(false);
              }}
            />
            {state === "loading" ? (
              <div
                aria-busy="true"
                aria-label={copy.trackingCarrierLoading}
                className="flex flex-col gap-2 px-2 py-3"
              >
                <Skeleton className="h-6 w-full rounded-md" />
                <Skeleton className="h-6 w-3/4 rounded-md" />
              </div>
            ) : state === "error" ? (
              <p className="px-2 py-3 text-sm text-destructive">
                {copy.trackingCarrierError}
              </p>
            ) : options.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {copy.trackingCarrierEmpty}
              </p>
            ) : (
              options.map((carrier) => (
                <CarrierOption
                  key={carrier.code}
                  active={value?.code === carrier.code}
                  label={displayName(carrier)}
                  detail={`${locale === "zh-CN" ? carrier.name : carrier.nameZh} · ${carrier.code}`}
                  onSelect={() => {
                    onChange(carrier);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

export function TrackingCarrierQueryFields({
  carrier,
  copy,
  onChange,
  values,
}: {
  carrier: Tracking17TrackCarrier | null;
  copy: TrackingQueryCopy;
  onChange: (next: Record<string, string>) => void;
  values: Record<string, string>;
}) {
  const requirements = carrier?.requirements ?? [];
  if (requirements.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border/70 bg-muted/20 p-4">
      <p className="text-sm font-medium">{copy.trackingQueryTitle}</p>
      {requirements.map((requirement) => {
        const id = `tracking-query-${requirement.key}`;
        const label =
          copy.trackingQueryLabels[requirement.key] ?? requirement.description;
        const value = values[requirement.key] ?? "";
        const setValue = (nextValue: string) =>
          onChange({ ...values, [requirement.key]: nextValue });
        return (
          <div className="grid gap-2" key={requirement.key}>
            <Label htmlFor={id}>
              {label}
              {requirement.required ? (
                <span className="ml-1 text-destructive">*</span>
              ) : null}
            </Label>
            {requirement.options ? (
              <Select
                value={value}
                onValueChange={(nextValue) => {
                  if (nextValue) {
                    setValue(nextValue);
                  }
                }}
              >
                <SelectTrigger id={id} className="w-full" label={label}>
                  <SelectValue
                    placeholder={copy.trackingQuerySelectPlaceholder}
                  >
                    {value ? requirement.options[value] : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(requirement.options).map(
                    ([option, optionLabel]) => (
                      <SelectItem key={option} value={option}>
                        {optionLabel}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                autoComplete="off"
                inputMode={
                  requirement.key === "phone_number_last_4"
                    ? "numeric"
                    : undefined
                }
                maxLength={
                  requirement.key === "phone_number_last_4" ? 4 : undefined
                }
                placeholder={requirement.sample ?? undefined}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
            {requirement.sample ? (
              <p className="text-xs text-muted-foreground">
                {copy.trackingQueryExample} {requirement.sample}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function hasMissingCarrierRequirements(
  carrier: Tracking17TrackCarrier | null,
  values: Record<string, string>
) {
  return Boolean(
    carrier?.requirements?.some(
      (requirement) => requirement.required && !values[requirement.key]?.trim()
    )
  );
}

function CarrierOption({
  active,
  detail,
  label,
  onSelect,
}: {
  active: boolean;
  detail?: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="option"
      aria-selected={active}
      className="h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left font-normal"
      onClick={onSelect}
    >
      <Check
        className={cn(
          "size-4 shrink-0 text-primary",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{label}</span>
        {detail ? (
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
    </Button>
  );
}

function ComposeField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
}) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DispatchInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
