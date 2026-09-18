"use client";

import type {
  ConfirmationDispatchEventType,
  ConfirmationDispatchMethod,
  ConfirmationStatus,
  CreateProjectConfirmationDispatchInput,
} from "@project-wing/shared";
import {
  Archive,
  Clock3,
  FileCheck2,
  PackageCheck,
  RotateCcw,
  Send,
  Truck,
} from "lucide-react";
import { useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_DEFAULT_ARRAY: never[] = [];

const EMPTY_DEFAULT_OBJECT: Record<string, never> = {};

export type ConfirmationTrackingCopy = {
  artifactHash: string;
  artifactVersion: string;
  cancel: string;
  claimed: string;
  claimedBy: string;
  confirmWithdraw: string;
  dispatchReference: string;
  dispatchRecords: string;
  eventLabels: Record<ConfirmationDispatchEventType, string>;
  latestPackage: string;
  noDispatchEvents: string;
  noPackage: string;
  pendingResponse: string;
  queueState: string;
  queued: string;
  responseState: string;
  returned: string;
  trackingNumber: string;
  withdraw: string;
  withdrawDescription: string;
  withdrawReason: string;
  withdrawTitle: string;
  send: string;
  sendTitle: string;
  sendDescription: string;
  sendEmailTitle: string;
  sendEmailDescription: string;
  recordTrackingTitle: string;
  recordTrackingDescription: string;
  method: string;
  recipientName: string;
  recipientContact: string;
  recipientEmail: string;
  recipientPhone: string;
  courierName: string;
  trackingCarrier: string;
  trackingCarrierAuto: string;
  trackingCarrierSearch: string;
  trackingCarrierHelp: string;
  trackingQueryTitle: string;
  trackingQuerySelectPlaceholder: string;
  trackingQueryExample: string;
  trackingQueryLabels: Record<string, string>;
  trackingCarrierLoading: string;
  trackingCarrierEmpty: string;
  trackingCarrierError: string;
  trackingCorrection: string;
  trackingCorrectionTitle: string;
  trackingCorrectionDescription: string;
  trackingCorrectionReason: string;
  trackingCorrectionReasonPlaceholder: string;
  trackingCorrectionConfirm: string;
  trackingCorrectionCancel: string;
  trackingNumberInput: string;
  reference: string;
  notes: string;
  confirmSent: string;
  confirmCourierSent: string;
  mailboxTitle: string;
  mailboxConnected: string;
  mailboxDisconnected: string;
  mailboxError: string;
  mailboxClientPassword: string;
  mailboxClientPasswordHelp: string;
  mailboxManageHint: string;
  connectMailbox: string;
  testMailbox: string;
  disconnectMailbox: string;
  emailSubject: string;
  emailBody: string;
  emailSender: string;
  emailAttachment: string;
  emailAttachmentFixed: string;
  emailPdfAttachment: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  sendEmail: string;
  dispatchScanUpload: string;
  dispatchScanOptional: string;
  dispatchScanUploadSuccess: string;
  dispatchScanUploadError: string;
};

const fallbackCopy: ConfirmationTrackingCopy = {
  artifactHash: "Artifact hash",
  artifactVersion: "Version {version}",
  cancel: "Cancel",
  claimed: "Claimed",
  claimedBy: "Claimed by {name}",
  confirmWithdraw: "Confirm withdrawal",
  dispatchReference: "Dispatch reference",
  dispatchRecords: "Dispatch records",
  eventLabels: {
    CREATED: "Dispatch record created",
    QUEUED: "Queued for dispatch",
    CLAIMED: "Claimed by confirmation officer",
    RETURNED: "Returned to project team",
    STARTED: "Processing started",
    SENT: "Sent",
    DELIVERED: "Delivered",
    FAILED: "Failed",
    DISPATCHED: "Dispatched",
    RECEIVED: "Response received",
    VOIDED: "Voided",
  },
  latestPackage: "Latest package",
  noDispatchEvents: "No dispatch events yet",
  noPackage: "No package or tracking data yet",
  pendingResponse: "Pending response",
  queueState: "Dispatch status",
  queued: "Pending dispatch",
  responseState: "Response state",
  returned: "Returned for revision",
  trackingNumber: "Tracking number",
  withdraw: "Withdraw",
  withdrawDescription:
    "Return this pending confirmation to draft so it can be corrected.",
  withdrawReason: "Withdrawal reason",
  withdrawTitle: "Withdraw confirmation",
  send: "Send confirmation",
  sendTitle: "Send confirmation",
  sendDescription:
    "Confirm the recipient and record how this confirmation was sent.",
  sendEmailTitle: "Send email",
  sendEmailDescription:
    "Review the recipient and message. The confirmation PDF is attached automatically.",
  recordTrackingTitle: "Record tracking number",
  recordTrackingDescription:
    "Enter the tracking number from the external order.",
  method: "Dispatch method",
  recipientName: "Recipient",
  recipientContact: "Contact / email / address",
  recipientEmail: "To",
  recipientPhone: "Phone",
  courierName: "Courier / postal service",
  trackingCarrier: "Carrier",
  trackingCarrierAuto: "Auto detect",
  trackingCarrierSearch: "Search carrier name or code",
  trackingCarrierHelp:
    "Choose a carrier when known to avoid tracking-number detection failures.",
  trackingQueryTitle: "Carrier query details",
  trackingQuerySelectPlaceholder: "Select",
  trackingQueryExample: "Example:",
  trackingQueryLabels: {
    destination_country: "Destination country",
    number_type: "Tracking number type",
    parameter: "Query parameter",
    phone_number: "Phone number",
    phone_number_last_4: "Last 4 digits of phone number",
    postal_code: "Destination postal code",
    ship_date: "Shipping date",
  },
  trackingCarrierLoading: "Searching carriers...",
  trackingCarrierEmpty: "No matching carriers",
  trackingCarrierError: "Could not load carriers. Try again.",
  trackingCorrection: "Correct tracking",
  trackingCorrectionTitle: "Correct tracking information",
  trackingCorrectionDescription:
    "The current record is replaced only after 17TRACK accepts the new details.",
  trackingCorrectionReason: "Reason for correction",
  trackingCorrectionReasonPlaceholder:
    "Explain why the carrier or tracking number must change",
  trackingCorrectionConfirm: "Confirm correction",
  trackingCorrectionCancel: "Cancel",
  trackingNumberInput: "Tracking number",
  reference: "Dispatch reference",
  notes: "Dispatch notes",
  confirmSent: "Confirm sent",
  confirmCourierSent: "Confirm dispatched",
  mailboxTitle: "Enterprise mailbox",
  mailboxConnected: "Connected",
  mailboxDisconnected: "Not connected",
  mailboxError: "Connection needs attention",
  mailboxClientPassword: "Client-specific password",
  mailboxClientPasswordHelp:
    "Generate a client-specific password in WeCom Mail settings.",
  mailboxManageHint:
    "Manage this connection once from Settings → Connections & integrations.",
  connectMailbox: "Connect mailbox",
  testMailbox: "Test connection",
  disconnectMailbox: "Disconnect",
  emailSubject: "Email subject",
  emailBody: "Email body",
  emailSender: "From",
  emailAttachment: "Attachment",
  emailAttachmentFixed: "Fixed",
  emailPdfAttachment: "Confirmation PDF",
  emailSubjectTemplate: "Confirmation: {name}",
  emailBodyTemplate:
    "Hello,\n\nPlease find the confirmation attached. Please review and respond using the instructions in the confirmation.\n\nThank you.",
  sendEmail: "Send email",
  dispatchScanUpload: "Upload sent confirmation scan",
  dispatchScanOptional: "Optional; it will not block dispatch",
  dispatchScanUploadSuccess: "Sent confirmation scan uploaded",
  dispatchScanUploadError: "Failed to upload sent confirmation scan",
};

export type ProjectConfirmationTrackingProps = {
  artifact?: { pdfSha256: string; version: number } | null;
  copy?: Partial<ConfirmationTrackingCopy>;
  dispatchRecords?: {
    at?: string | null;
    method: string;
    reference?: string | null;
    trackingNumber?: string | null;
  }[];
  isWithdrawing?: boolean;
  latestPackage?: {
    code?: string | null;
    status?: string | null;
    trackingNumber?: string | null;
  } | null;
  locale: string;
  onWithdraw?: (reason: string) => void;
  onDispatch?: (input: CreateProjectConfirmationDispatchInput) => void;
  isDispatching?: boolean;
  methodLabels?: Partial<Record<ConfirmationDispatchMethod, string>>;
  queue?: {
    claimedAt?: string | null;
    queuedAt?: string | null;
  } | null;
  response?: { status?: string | null } | null;
  status: ConfirmationStatus;
  validationErrors?: string[];
};

export function ProjectConfirmationTracking({
  artifact,
  copy: copyOverrides,
  dispatchRecords = EMPTY_DEFAULT_ARRAY,
  isWithdrawing = false,
  latestPackage,
  locale,
  onWithdraw,
  onDispatch,
  isDispatching = false,
  methodLabels = EMPTY_DEFAULT_OBJECT,
  queue,
  response,
  status,
  validationErrors = EMPTY_DEFAULT_ARRAY,
}: ProjectConfirmationTrackingProps) {
  const copy = { ...fallbackCopy, ...copyOverrides };
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [method, setMethod] = useState<ConfirmationDispatchMethod>("EMAIL");
  const [recipientName, setRecipientName] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [dispatchReference, setDispatchReference] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [emailSubject, setEmailSubject] = useState(
    copy.emailSubjectTemplate.replace("{name}", "")
  );
  const [emailBody, setEmailBody] = useState(copy.emailBodyTemplate);
  const canWithdraw =
    status === "PREPARED" && Boolean(artifact) && Boolean(onWithdraw);
  const canDispatch =
    status === "PREPARED" && Boolean(artifact) && Boolean(onDispatch);
  const queueLabel =
    status === "DRAFT"
      ? copy.returned
      : status === "AWAITING_RESPONSE"
        ? copy.eventLabels.DISPATCHED
        : copy.queued;

  return (
    <div className="grid gap-5">
      {canDispatch ? (
        <ButtonGroup className="justify-end">
          <Button type="button" onClick={() => setSendOpen(true)}>
            <Send />
            {copy.send}
          </Button>
        </ButtonGroup>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TrackingFact
          icon={FileCheck2}
          label={copy.artifactVersion}
          value={
            artifact
              ? copy.artifactVersion.replace(
                  "{version}",
                  String(artifact.version)
                )
              : "-"
          }
          detail={
            artifact
              ? `${copy.artifactHash}: ${artifact.pdfSha256.slice(0, 12)}`
              : undefined
          }
        />
        <TrackingFact
          icon={Clock3}
          label={copy.queueState}
          value={queueLabel}
          detail={formatDate(queue?.claimedAt ?? queue?.queuedAt, locale)}
        />
        <TrackingFact
          icon={PackageCheck}
          label={copy.latestPackage}
          value={latestPackage?.code || copy.noPackage}
          detail={latestPackage?.status || undefined}
        />
        <TrackingFact
          icon={Archive}
          label={copy.responseState}
          value={
            response?.status && response.status !== "PENDING"
              ? response.status
              : copy.pendingResponse
          }
        />
      </div>

      {latestPackage?.trackingNumber ? (
        <div className="flex items-center gap-2 text-sm">
          <Truck className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{copy.trackingNumber}</span>
          <span className="font-mono font-medium">
            {latestPackage.trackingNumber}
          </span>
        </div>
      ) : null}

      <Separator />
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">{copy.dispatchRecords}</h3>
        {dispatchRecords.length > 0 ? (
          <ol className="grid gap-3">
            {dispatchRecords.map((dispatch, index) => (
              <li
                key={`${dispatch.method}-${dispatch.at ?? index}`}
                className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-sm"
              >
                <span
                  className="mt-1.5 size-2 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">{dispatch.method}</p>
                  <p className="text-muted-foreground">
                    {formatDate(dispatch.at, locale)}
                  </p>
                  {dispatch.reference ? (
                    <p className="text-xs text-muted-foreground">
                      {copy.dispatchReference}: {dispatch.reference}
                    </p>
                  ) : null}
                  {dispatch.trackingNumber ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      {copy.trackingNumber}: {dispatch.trackingNumber}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.noDispatchEvents}
          </p>
        )}
      </section>

      {validationErrors.length > 0 ? (
        <div
          className="grid gap-1 border-t border-border pt-3 text-sm text-destructive"
          role="alert"
        >
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {canWithdraw ? (
        <ButtonGroup className="justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setWithdrawOpen(true)}
          >
            <RotateCcw className="size-4" />
            {copy.withdraw}
          </Button>
        </ButtonGroup>
      ) : null}

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.withdrawTitle}</DialogTitle>
            <DialogDescription>{copy.withdrawDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="confirmation-withdraw-reason">
              {copy.withdrawReason}
            </Label>
            <Textarea
              id="confirmation-withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWithdrawOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
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
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.sendTitle}</DialogTitle>
            <DialogDescription>{copy.sendDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="confirmation-dispatch-method">
                {copy.method}
              </Label>
              <Select
                value={method}
                onValueChange={(value) =>
                  value && setMethod(value as ConfirmationDispatchMethod)
                }
              >
                <SelectTrigger
                  id="confirmation-dispatch-method"
                  className="w-full"
                >
                  <SelectValue>{methodLabels[method] ?? method}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "EMAIL",
                      "COURIER",
                      "POST",
                      "HAND_DELIVERY",
                      "OTHER",
                    ] as const
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {methodLabels[value] ?? value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DispatchInput
              id="confirmation-recipient-name"
              label={copy.recipientName}
              value={recipientName}
              onChange={setRecipientName}
            />
            <DispatchInput
              id="confirmation-recipient-contact"
              label={copy.recipientContact}
              value={recipientContact}
              onChange={setRecipientContact}
            />
            {method === "EMAIL" ? (
              <>
                <DispatchInput
                  id="confirmation-email-subject"
                  label={copy.emailSubject}
                  value={emailSubject}
                  onChange={setEmailSubject}
                />
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="confirmation-email-body">
                    {copy.emailBody}
                  </Label>
                  <Textarea
                    id="confirmation-email-body"
                    className="min-h-36"
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                  />
                </div>
              </>
            ) : null}
            <DispatchInput
              id="confirmation-recipient-phone"
              label={copy.recipientPhone}
              value={recipientPhone}
              onChange={setRecipientPhone}
            />
            {method === "COURIER" || method === "POST" ? (
              <>
                <DispatchInput
                  id="confirmation-courier"
                  label={copy.courierName}
                  value={courierName}
                  onChange={setCourierName}
                />
                <DispatchInput
                  id="confirmation-tracking-number"
                  label={copy.trackingNumberInput}
                  value={trackingNumber}
                  onChange={setTrackingNumber}
                />
              </>
            ) : null}
            <DispatchInput
              id="confirmation-dispatch-reference"
              label={copy.reference}
              value={dispatchReference}
              onChange={setDispatchReference}
            />
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="confirmation-dispatch-notes">{copy.notes}</Label>
              <Textarea
                id="confirmation-dispatch-notes"
                value={dispatchNotes}
                onChange={(event) => setDispatchNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setSendOpen(false)}>
                {copy.cancel}
              </Button>
              <Button
                disabled={
                  isDispatching ||
                  !recipientContact.trim() ||
                  (method === "EMAIL" &&
                    (!emailSubject.trim() || !emailBody.trim()))
                }
                onClick={() => {
                  onDispatch?.({
                    idempotencyKey: globalThis.crypto.randomUUID(),
                    method,
                    sentAt: new Date().toISOString(),
                    recipientName: recipientName.trim() || undefined,
                    recipientContact: recipientContact.trim(),
                    recipientPhone: recipientPhone.trim() || undefined,
                    courierName: courierName.trim() || undefined,
                    trackingNumber: trackingNumber.trim() || undefined,
                    dispatchReference: dispatchReference.trim() || undefined,
                    notes: dispatchNotes.trim() || undefined,
                    emailSubject:
                      method === "EMAIL" ? emailSubject.trim() : undefined,
                    emailBody:
                      method === "EMAIL" ? emailBody.trim() : undefined,
                  });
                  setSendOpen(false);
                }}
              >
                <Send />
                {copy.confirmSent}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function TrackingFact({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail?: string;
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 gap-2 border-l border-border pl-3 first:border-l-0 first:pl-0">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="truncate text-sm font-semibold">{value}</p>
      {detail ? (
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
      }).format(date);
}
