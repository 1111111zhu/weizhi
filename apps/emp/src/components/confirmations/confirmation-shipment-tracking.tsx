"use client";

import type { CorrectProjectConfirmationTrackingInput } from "@project-wing/shared";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Mail,
  MapPin,
  RefreshCw,
  RotateCcw,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type {
  ProjectConfirmationDispatch,
  Tracking17TrackCarrier,
} from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import {
  getUserFacingErrorMessage,
  showErrorToast,
} from "../../lib/error-toast";
import {
  TrackingCarrierPicker,
  TrackingCarrierQueryFields,
  hasMissingCarrierRequirements,
} from "./project-confirmation-dispatch-action";

type TrackingCopy = Dictionary["confirmations"]["tracking"];
type TrackingState = keyof TrackingCopy["shipmentStatuses"];

export function ConfirmationShipmentTracking({
  copy,
  dispatch,
  isRefreshing,
  locale,
  onCorrectTracking,
  onRefreshTracking,
  searchTrackingCarriers,
}: {
  copy: TrackingCopy;
  dispatch: ProjectConfirmationDispatch;
  isRefreshing?: boolean;
  locale: string;
  onCorrectTracking?: (
    input: CorrectProjectConfirmationTrackingInput
  ) => Promise<unknown>;
  onRefreshTracking?: () => void;
  searchTrackingCarriers?: (query: string) => Promise<Tracking17TrackCarrier[]>;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionNumber, setCorrectionNumber] = useState(
    dispatch.trackingNumber ?? ""
  );
  const [correctionCarrier, setCorrectionCarrier] =
    useState<Tracking17TrackCarrier | null>(null);
  const [correctionQueryParameters, setCorrectionQueryParameters] = useState<
    Record<string, string>
  >({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [queryError, setQueryError] = useState<Error | null>(null);
  const trackingPending =
    dispatch.executionStatus === "SENT" &&
    !dispatch.trackingRegisteredAt &&
    !dispatch.trackingStoppedAt;
  const phoneRequired =
    trackingPending &&
    `${queryError?.message ?? ""} ${dispatch.trackingError ?? ""}`.includes(
      "phone_number_last_4"
    );
  const events = dispatch.trackingEvents ?? [];
  const state = resolveTrackingState(dispatch);
  const [latest] = events;
  const latestDescription =
    dispatch.trackingDescription ??
    latest?.description ??
    (trackingPending
      ? phoneRequired
        ? copy.shipmentPhoneRequired
        : copy.shipmentPending
      : state === "ERROR"
        ? copy.shipmentRegistrationError
        : copy.shipmentRegistered);
  const latestLocation = dispatch.trackingLocation ?? latest?.location;
  const updatedAt =
    dispatch.trackingLastEventAt ??
    dispatch.trackingUpdatedAt ??
    dispatch.trackingRegisteredAt;
  const physicalMethod =
    dispatch.method === "COURIER" || dispatch.method === "POST";

  useEffect(() => {
    if (!trackingPending && state === "ERROR" && dispatch.trackingError) {
      showErrorToast(
        new Error(dispatch.trackingError),
        copy.shipmentRegistrationError
      );
    }
  }, [
    copy.shipmentRegistrationError,
    dispatch.trackingError,
    state,
    trackingPending,
  ]);

  if (!physicalMethod || !dispatch.trackingNumber) {
    return null;
  }

  const copyTrackingNumber = async () => {
    await navigator.clipboard.writeText(dispatch.trackingNumber ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-8">
      <Separator className="mb-6" />
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-xl border bg-card p-5 text-card-foreground">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {dispatch.method === "POST" ? (
                    <Mail data-icon="inline-start" />
                  ) : (
                    <Truck data-icon="inline-start" />
                  )}
                  {dispatch.method === "POST"
                    ? copy.shipmentPost
                    : copy.shipmentCourier}
                </Badge>
                <Badge
                  variant={
                    trackingPending ? "secondary" : trackingBadgeVariant(state)
                  }
                >
                  {trackingPending
                    ? copy.shipmentPendingBadge
                    : copy.shipmentStatuses[state]}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-semibold">{copy.shipmentTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dispatch.trackingCarrierName ?? dispatch.courierName ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <span className="font-mono text-sm font-medium">
                  {dispatch.trackingNumber}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        tooltip={copy.shipmentCopyNumber}
                        showTooltip={false}
                        onClick={copyTrackingNumber}
                      />
                    }
                  >
                    {copied ? <Check /> : <Copy />}
                  </TooltipTrigger>
                  <TooltipContent>
                    {copied
                      ? copy.shipmentNumberCopied
                      : copy.shipmentCopyNumber}
                  </TooltipContent>
                </Tooltip>
              </div>
              {onRefreshTracking ||
              (onCorrectTracking && searchTrackingCarriers) ? (
                <ButtonGroup>
                  {onRefreshTracking && !trackingPending ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isRefreshing}
                      onClick={onRefreshTracking}
                    >
                      <RefreshCw
                        className={isRefreshing ? "animate-spin" : undefined}
                      />
                      {isRefreshing
                        ? copy.shipmentRefreshing
                        : copy.shipmentRefresh}
                    </Button>
                  ) : null}
                  {onCorrectTracking && searchTrackingCarriers ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCorrectionOpen(true)}
                    >
                      <RotateCcw />
                      {copy.trackingCorrection}
                    </Button>
                  ) : null}
                </ButtonGroup>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <p className="text-base font-medium">{latestDescription}</p>
            {latestLocation ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {latestLocation}
              </p>
            ) : null}
            {updatedAt ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {copy.shipmentUpdatedAt.replace(
                  "{time}",
                  formatDateTime(updatedAt, locale)
                )}
                <span aria-hidden="true">·</span>
                {copy.shipmentSource}
              </p>
            ) : null}
          </div>

          {trackingPending && onCorrectTracking ? (
            <div className="mt-4 grid gap-3">
              {phoneRequired ? (
                <div className="grid max-w-52 gap-2">
                  <Label htmlFor={`shipment-phone-${dispatch.id}`}>
                    {copy.trackingQueryLabels.phone_number_last_4}
                  </Label>
                  <Input
                    id={`shipment-phone-${dispatch.id}`}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={phoneDigits}
                    onChange={(event) =>
                      setPhoneDigits(
                        event.target.value.replaceAll(/\D/g, "").slice(0, 4)
                      )
                    }
                  />
                </div>
              ) : null}
              {queryError ? (
                <p role="alert" className="text-sm text-destructive">
                  {getUserFacingErrorMessage(
                    queryError,
                    copy.shipmentRefreshError
                  )}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={
                  isCorrecting ||
                  (phoneRequired && !/^\d{4}$/.test(phoneDigits))
                }
                onClick={async () => {
                  setIsCorrecting(true);
                  setQueryError(null);
                  try {
                    await onCorrectTracking({
                      trackingNumber: dispatch.trackingNumber ?? "",
                      trackingCarrierCode:
                        dispatch.trackingCarrierCode ?? undefined,
                      courierName: dispatch.courierName ?? undefined,
                      trackingQueryParameters: phoneRequired
                        ? { phone_number_last_4: phoneDigits }
                        : undefined,
                      reason: copy.shipmentQueryReason,
                    });
                    setPhoneDigits("");
                  } catch (error) {
                    setQueryError(
                      error instanceof Error
                        ? error
                        : new Error(copy.shipmentRefreshError)
                    );
                  } finally {
                    setIsCorrecting(false);
                  }
                }}
              >
                {isCorrecting
                  ? copy.shipmentRefreshing
                  : phoneRequired
                    ? copy.shipmentQuery
                    : copy.shipmentRetry}
              </Button>
            </div>
          ) : null}

          {events.length > 0 ? (
            <div className="mt-4">
              <CollapsibleTrigger
                render={<Button type="button" size="sm" variant="ghost" />}
              >
                {open ? copy.shipmentHideTimeline : copy.shipmentViewTimeline}
                <ChevronDown
                  data-icon="inline-end"
                  className={open ? "rotate-180" : undefined}
                />
              </CollapsibleTrigger>
            </div>
          ) : null}

          <CollapsibleContent>
            <Separator className="my-4" />
            <ol className="grid gap-4">
              {events.map((event, index) => (
                <li
                  key={`${event.at ?? "unknown"}-${event.description}-${index}`}
                  className="grid grid-cols-[auto_1fr] gap-3"
                >
                  <span className="mt-1.5 size-2 rounded-full bg-primary" />
                  <div className="grid gap-1">
                    <p className="text-sm font-medium">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        event.location,
                        formatOptionalDateTime(event.at, locale),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </div>
      </Collapsible>
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.trackingCorrectionTitle}</DialogTitle>
            <DialogDescription>
              {copy.trackingCorrectionDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label id="dispatch-carrier-label">{copy.trackingCarrier}</Label>
              <TrackingCarrierPicker
                copy={copy}
                locale={locale}
                onChange={(carrier) => {
                  setCorrectionCarrier(carrier);
                  setCorrectionQueryParameters({});
                }}
                searchTrackingCarriers={
                  searchTrackingCarriers ?? (() => Promise.resolve([]))
                }
                value={correctionCarrier}
              />
              <p className="text-xs text-muted-foreground">
                {copy.trackingCarrierHelp}
              </p>
            </div>
            <TrackingCarrierQueryFields
              carrier={correctionCarrier}
              copy={copy}
              onChange={setCorrectionQueryParameters}
              values={correctionQueryParameters}
            />
            <div className="grid gap-2">
              <Label htmlFor="tracking-correction-number">
                {copy.trackingNumberInput}
              </Label>
              <Input
                id="tracking-correction-number"
                autoComplete="off"
                value={correctionNumber}
                onChange={(event) => setCorrectionNumber(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tracking-correction-reason">
                {copy.trackingCorrectionReason}
              </Label>
              <Textarea
                id="tracking-correction-reason"
                placeholder={copy.trackingCorrectionReasonPlaceholder}
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCorrectionOpen(false)}
            >
              {copy.trackingCorrectionCancel}
            </Button>
            <Button
              type="button"
              disabled={
                isCorrecting ||
                !correctionNumber.trim() ||
                !correctionReason.trim() ||
                hasMissingCarrierRequirements(
                  correctionCarrier,
                  correctionQueryParameters
                )
              }
              onClick={async () => {
                setIsCorrecting(true);
                try {
                  await onCorrectTracking?.({
                    trackingNumber: correctionNumber.trim(),
                    trackingCarrierCode: correctionCarrier?.code,
                    trackingQueryParameters:
                      Object.keys(correctionQueryParameters).length > 0
                        ? correctionQueryParameters
                        : undefined,
                    courierName: correctionCarrier
                      ? locale === "zh-CN"
                        ? correctionCarrier.nameZh
                        : correctionCarrier.name
                      : undefined,
                    reason: correctionReason.trim(),
                  });
                  setCorrectionOpen(false);
                  setCorrectionReason("");
                } catch (error) {
                  showErrorToast(error, copy.shipmentRefreshError);
                } finally {
                  setIsCorrecting(false);
                }
              }}
            >
              {copy.trackingCorrectionConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function resolveTrackingState(
  dispatch: ProjectConfirmationDispatch
): TrackingState {
  if (dispatch.trackingStoppedAt) {
    return "STOPPED";
  }
  if (dispatch.trackingError && !dispatch.trackingRegisteredAt) {
    return "ERROR";
  }
  const status = dispatch.trackingStatus?.toLowerCase().replaceAll("_", "");
  if (!status || status.includes("notfound")) {
    return "UNKNOWN";
  }
  if (status.includes("delivered")) {
    return "DELIVERED";
  }
  if (status.includes("outfordelivery")) {
    return "OUT_FOR_DELIVERY";
  }
  if (status.includes("availableforpickup")) {
    return "AVAILABLE_FOR_PICKUP";
  }
  if (status.includes("exception") || status.includes("failure")) {
    return "EXCEPTION";
  }
  if (status.includes("return")) {
    return "RETURNED";
  }
  if (status.includes("transit")) {
    return "IN_TRANSIT";
  }
  if (status.includes("inforeceived")) {
    return "INFO_RECEIVED";
  }
  if (status.includes("expired")) {
    return "STOPPED";
  }
  return "UNKNOWN";
}

function trackingBadgeVariant(state: TrackingState) {
  if (state === "DELIVERED") {
    return "default" as const;
  }
  if (state === "EXCEPTION" || state === "ERROR") {
    return "destructive" as const;
  }
  if (state === "STOPPED" || state === "RETURNED") {
    return "outline" as const;
  }
  return "secondary" as const;
}

function formatOptionalDateTime(
  value: string | null | undefined,
  locale: string
) {
  return value ? formatDateTime(value, locale) : null;
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(date);
}
