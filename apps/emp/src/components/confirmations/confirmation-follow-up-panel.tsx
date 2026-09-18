"use client";

import { ConfirmationLogisticsReadMarker } from "./confirmation-logistics-unread";

import { ConfirmationReturnShipmentSchema } from "@project-wing/shared";
import type {
  ConfirmationFollowUpEventType,
  CorrectProjectConfirmationTrackingInput,
  CreateProjectConfirmationFollowUpEventInput,
} from "@project-wing/shared";
import {
  CheckCircle2,
  Clock3,
  PackageCheck,
  Send,
  Truck,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import type {
  ProjectConfirmation,
  ProjectConfirmationDispatch,
  ProjectConfirmationFollowUpEvent,
  Tracking17TrackCarrier,
} from "../../api/client";
import { formatConfirmationRedispatchOrdinal } from "../../i18n/dictionaries";
import type { Dictionary } from "../../i18n/dictionaries";
import { ConfirmationShipmentTracking } from "./confirmation-shipment-tracking";
import { TrackingCarrierPicker, TrackingCarrierQueryFields } from "./project-confirmation-dispatch-action";

type ManualEvent = CreateProjectConfirmationFollowUpEventInput["eventType"];
type ProgressChoice = ManualEvent | "RESPONSE_RECEIVED";
const progressOptions: ProgressChoice[] = [
  "COUNTERPARTY_RECEIVED",
  "COUNTERPARTY_SENT_RESPONSE",
  "RESPONSE_RECEIVED",
];

type FollowUpCopy = {
  title: string;
  description: string;
  currentStatus: string;
  waitingResponse: string;
  responseReceived: string;
  programCompleted: string;
  completeAlternativeProcedure?: string;
  timelineEmpty: string;
  recordProgress: string;
  uploadResponse: string;
  completeProgram: string;
  followUpSheetTitle: string;
  followUpSheetDescription: string;
  progressType: string;
  progressNotes: string;
  progressNotesPlaceholder: string;
  saveProgress: string;
  cancel: string;
  firstDispatch: string;
  deliveredTitle?: string;
  latestLabel?: string;
  redispatch: string;
  redispatchTitle: string;
  registeredBy: string;
  systemActor: string;
  eventLabels: Record<ConfirmationFollowUpEventType, string>;
};

export function ConfirmationFollowUpPanel({
  confirmation,
  copy,
  locale,
  canEdit,
  statusLabel: statusLabelOverride,
  isSaving,
  isCompleting,
  isRefreshingTracking,
  trackingCopy,
  resolveActorName,
  redispatchAction,
  undoReviewAction,
  onRecordProgress,
  onUploadResponse,
  canSupplementResponse = false,
  onCompleteProgram,
  onRefreshTracking,
  onCorrectTracking,
  searchTrackingCarriers,
}: {
  confirmation: ProjectConfirmation;
  copy: FollowUpCopy;
  locale: string;
  canEdit: boolean;
  statusLabel?: string;
  isSaving?: boolean;
  isCompleting?: boolean;
  isRefreshingTracking?: boolean;
  trackingCopy: Dictionary["confirmations"]["tracking"];
  resolveActorName?: (userId: string | null | undefined) => string | null;
  redispatchAction?: ReactNode;
  undoReviewAction?: ReactNode;
  onRecordProgress: (
    input: CreateProjectConfirmationFollowUpEventInput
  ) => void;
  onUploadResponse: () => void;
  canSupplementResponse?: boolean;
  onCompleteProgram: () => void;
  onRefreshTracking?: (dispatchId: string) => void;
  onCorrectTracking?: (
    dispatchId: string,
    input: CorrectProjectConfirmationTrackingInput
  ) => Promise<unknown>;
  searchTrackingCarriers?: (query: string) => Promise<Tracking17TrackCarrier[]>;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ProgressChoice>("COUNTERPARTY_RECEIVED");
  const [notes, setNotes] = useState("");
  const [returnNumber, setReturnNumber] = useState("");
  const [returnCarrier, setReturnCarrier] = useState<Tracking17TrackCarrier | null>(null);
  const [returnParameters, setReturnParameters] = useState<Record<string, string>>({});
  const [trackingDispatchId, setTrackingDispatchId] = useState<string | null>(
    null
  );
  const timeline = useMemo(
    () => buildTimeline(confirmation, copy, locale, resolveActorName),
    [confirmation, copy, locale, resolveActorName]
  );
  const allShipments = [...(confirmation.dispatches ?? []),
    ...(confirmation.followUpEvents ?? []).flatMap(event => {
      const shipment = returnShipmentDispatch(event);
      return shipment ? [shipment] : [];
    })];
  const trackingDispatch = allShipments.find(dispatch => dispatch.id === trackingDispatchId);
  const statusLabel =
    statusLabelOverride ??
    (confirmation.status === "CLOSED"
      ? copy.programCompleted
      : confirmation.status === "RESPONSE_RECEIVED"
        ? copy.responseReceived
        : copy.waitingResponse);

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-[minmax(0,1fr)_18rem]">
      <ConfirmationLogisticsReadMarker confirmation={confirmation} />
      <div className="min-w-0 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">{copy.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.description}
            </p>
          </div>
          <Badge variant="outline">{timeline.length}</Badge>
        </div>
        <Separator className="my-4" />
        {timeline.length > 0 ? (
          <ol className="grid gap-0">
            {timeline.map((item, index) => {
              const { dispatchId } = item;

              return (
                <li
                  key={item.id}
                  className="relative grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-3 pb-5 last:pb-0"
                >
                  {index < timeline.length - 1 ? (
                    <span className="absolute top-4 bottom-0 left-[0.4375rem] w-px bg-border" />
                  ) : null}
                  <span className="relative z-10 mt-1.5 size-3 rounded-full border-2 border-card bg-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{item.title}</p>
                      {index === 0 && Number.isFinite(Date.parse(item.at)) ? (
                        <Badge className="border-transparent bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white">
                          {copy.latestLabel ?? (locale.startsWith("zh") ? "最新" : "Latest")}
                        </Badge>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    {dispatchId &&
                    allShipments.some(
                      (dispatch) =>
                        dispatch.id === dispatchId &&
                        dispatch.executionStatus === "SENT" &&
                        !dispatch.trackingRegisteredAt &&
                        dispatch.trackingError
                    ) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{trackingCopy.shipmentPending}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setTrackingDispatchId(dispatchId)}
                        >
                          {trackingCopy.shipmentSupplement}
                        </Button>
                      </div>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {copy.registeredBy.replace(
                        "{name}",
                        item.actor ?? copy.systemActor
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dispatchId ? (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        tooltip={`${item.title} · ${trackingCopy.shipmentViewTimeline}`}
                        onClick={() => {
                          setTrackingDispatchId(dispatchId);
                          if (
                            canEdit &&
                            allShipments.find(
                              (dispatch) => dispatch.id === dispatchId
                            )?.trackingRegisteredAt
                          ) {
                            onRefreshTracking?.(dispatchId);
                          }
                        }}
                      >
                        <Truck />
                      </Button>
                    ) : null}
                    <time className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(item.at, locale)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {copy.timelineEmpty}
          </p>
        )}
      </div>

      <aside className="border-t border-border bg-muted/35 px-5 py-4 lg:border-t-0 lg:border-l">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          {copy.currentStatus}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {confirmation.status === "CLOSED" ? (
            <CheckCircle2 className="size-5 text-primary" />
          ) : confirmation.status === "RESPONSE_RECEIVED" ? (
            <PackageCheck className="size-5 text-primary" />
          ) : (
            <Clock3 className="size-5 text-primary" />
          )}
          <p className="font-semibold text-foreground">{statusLabel}</p>
        </div>
        {canEdit &&
        canSupplementResponse &&
        (confirmation.status === "RESPONSE_RECEIVED" ||
          confirmation.status === "CLOSED") ? (
          <Button
            type="button"
            variant="outline"
            className="mt-5 w-full cursor-pointer hover:border-primary hover:bg-primary/10 hover:text-primary"
            onClick={onUploadResponse}
          >
            <Upload />
            {trackingCopy.responseAddFiles}
          </Button>
        ) : null}
        {canEdit && confirmation.status === "AWAITING_RESPONSE" ? (
          <ButtonGroup
            orientation="vertical"
            className="mt-5 w-full [&>*]:w-full"
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(true)}
            >
              <Clock3 />
              {copy.recordProgress}
            </Button>
            <Button type="button" variant="outline" onClick={onUploadResponse}>
              <Upload />
              {copy.uploadResponse}
            </Button>
            {redispatchAction}
            {confirmation.differenceStatus === "EXCEPTION"
              ? undoReviewAction
              : null}
          </ButtonGroup>
        ) : null}
        {canEdit &&
        confirmation.status === "RESPONSE_RECEIVED" &&
        confirmation.differenceStatus === "PENDING_FOLLOW_UP" ? (
          <Button
            className="mt-5 w-full"
            type="button"
            disabled={isCompleting}
            onClick={onCompleteProgram}
          >
            <CheckCircle2 />
            {copy.completeAlternativeProcedure ?? copy.completeProgram}
          </Button>
        ) : null}
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{copy.followUpSheetTitle}</SheetTitle>
            <SheetDescription>{copy.followUpSheetDescription}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-5 px-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="confirmation-progress-type">
                {copy.progressType}
              </Label>
              <Select
                value={choice}
                onValueChange={(value) =>
                  value && setChoice(value as ProgressChoice)
                }
              >
                <SelectTrigger
                  id="confirmation-progress-type"
                  className="w-full"
                >
                  <SelectValue>{copy.eventLabels[choice]}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  align="start"
                  className="border border-border shadow-lg"
                >
                  {progressOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.eventLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {choice === "COUNTERPARTY_SENT_RESPONSE" ? (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  {locale.startsWith("zh") ? "物流信息选填；未填写或暂时无法跟踪，也可保存并人工跟进。" : "Tracking is optional. You can save and follow up manually if tracking is unavailable."}
                </p>
                {searchTrackingCarriers ? <TrackingCarrierPicker
                  copy={trackingCopy} locale={locale} searchTrackingCarriers={searchTrackingCarriers}
                  value={returnCarrier} onChange={carrier => { setReturnCarrier(carrier); setReturnParameters({}); }}
                /> : null}
                <Label htmlFor="confirmation-return-number">{trackingCopy.trackingNumberInput}</Label>
                <Input id="confirmation-return-number" value={returnNumber} onChange={event => setReturnNumber(event.target.value)} />
                <TrackingCarrierQueryFields carrier={returnCarrier} copy={trackingCopy} values={returnParameters} onChange={setReturnParameters} />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="confirmation-progress-notes">
                {copy.progressNotes}
              </Label>
              <Textarea
                id="confirmation-progress-notes"
                value={notes}
                placeholder={copy.progressNotesPlaceholder}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (choice === "RESPONSE_RECEIVED") {
                    setOpen(false);
                    onUploadResponse();
                    return;
                  }
                  onRecordProgress({
                    eventType: choice,
                    notes: notes.trim() || undefined,
                    ...(choice === "COUNTERPARTY_SENT_RESPONSE" && returnNumber.trim() ? {
                      trackingNumber: returnNumber.trim(),
                      courierName: returnCarrier ? (locale.startsWith("zh") ? returnCarrier.nameZh : returnCarrier.name) : undefined,
                      trackingCarrierCode: returnCarrier?.code,
                      trackingQueryParameters: Object.fromEntries(Object.entries(returnParameters).filter(([, value]) => value.trim())),
                    } : {}),
                  });
                  setReturnNumber(""); setReturnCarrier(null); setReturnParameters({});
                  setNotes("");
                  setOpen(false);
                }}
              >
                <Send />
                {copy.saveProgress}
              </Button>
            </ButtonGroup>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(trackingDispatch)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setTrackingDispatchId(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {trackingDispatch?.id.startsWith("return:") ? copy.eventLabels.COUNTERPARTY_SENT_RESPONSE : trackingDispatch
                ? trackingDispatch.sequence > 1
                  ? formatRedispatchTitle(
                      copy.redispatchTitle,
                      trackingDispatch.sequence,
                      locale
                    )
                  : copy.firstDispatch
                : trackingCopy.shipmentTitle}
            </SheetTitle>
            <SheetDescription>
              {trackingDispatch
                ? [
                    trackingDispatch.trackingCarrierName ??
                      trackingDispatch.courierName,
                    trackingDispatch.trackingNumber,
                  ]
                    .filter(Boolean)
                    .join(" · ") || trackingCopy.shipmentRegistered
                : trackingCopy.shipmentRegistered}
            </SheetDescription>
          </SheetHeader>
          {trackingDispatch?.trackingNumber ? (
            <ConfirmationShipmentTracking
              key={trackingDispatch.id}
              copy={trackingCopy}
              dispatch={trackingDispatch}
              onCorrectTracking={
                canEdit &&
                trackingDispatch.executionStatus === "SENT" &&
                onCorrectTracking
                  ? (input) => onCorrectTracking(trackingDispatch.id, input)
                  : undefined
              }
              searchTrackingCarriers={searchTrackingCarriers}
              isRefreshing={isRefreshingTracking}
              locale={locale}
              onRefreshTracking={
                canEdit && onRefreshTracking
                  ? () => onRefreshTracking(trackingDispatch.id)
                  : undefined
              }
            />
          ) : trackingDispatch ? (
            <div className="grid gap-3 px-5 py-8">
              <p className="text-sm text-muted-foreground">{trackingCopy.noPackage}</p>
              {canEdit && onCorrectTracking ? <>
                <Label htmlFor="supplement-return-number">{trackingCopy.trackingNumberInput}</Label>
                <Input id="supplement-return-number" value={returnNumber} onChange={event => setReturnNumber(event.target.value)} />
                {searchTrackingCarriers ? <TrackingCarrierPicker copy={trackingCopy} locale={locale}
                  searchTrackingCarriers={searchTrackingCarriers} value={returnCarrier} onChange={setReturnCarrier} /> : null}
                <Button disabled={!returnNumber.trim() || isSaving} onClick={async () => {
                  await onCorrectTracking(trackingDispatch.id, {
                    trackingNumber: returnNumber.trim(), trackingCarrierCode: returnCarrier?.code,
                    courierName: returnCarrier ? (locale.startsWith("zh") ? returnCarrier.nameZh : returnCarrier.name) : undefined,
                    reason: locale.startsWith("zh") ? "补充物流信息" : "Add tracking information",
                  });
                  setReturnNumber(""); setReturnCarrier(null);
                }}>{locale.startsWith("zh") ? "补填物流" : "Add tracking"}</Button>
              </> : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function buildTimeline(
  confirmation: ProjectConfirmation,
  copy: FollowUpCopy,
  locale: string,
  resolveActorName?: (userId: string | null | undefined) => string | null
) {
  const items: {
    id: string;
    at: string;
    stage: number;
    index: number;
    title: string;
    description?: string;
    actor?: string | null;
    dispatchId?: string;
  }[] = [];
  let index = 0;
  const events = confirmation.followUpEvents ?? [];
  if (!events.some(event => event.eventType === "CONFIRMATION_CREATED")) {
    items.push({
      id: `created-${confirmation.id}`, at: confirmation.createdAt,
      stage: 0, index: (index += 1),
      title: copy.eventLabels.CONFIRMATION_CREATED,
      actor: confirmation.creator?.name ?? resolveActorName?.(confirmation.createdBy) ?? confirmation.createdBy,
    });
  }
  const frozenAt = confirmation.preparedDispatchReadyAt ?? confirmation.currentArtifact?.submittedAt;
  const frozenBy = confirmation.preparedDispatchReadyBy ?? confirmation.currentArtifact?.submittedBy;
  if (frozenAt && confirmation.status !== "DRAFT" &&
      !events.some(event => event.eventType === "CONFIRMATION_FROZEN")) {
    items.push({
      id: `frozen-${confirmation.id}`, at: frozenAt,
      stage: 5, index: (index += 1),
      title: copy.eventLabels.CONFIRMATION_FROZEN,
      actor: resolveActorName?.(frozenBy) ?? frozenBy,
    });
  }
  for (const dispatch of confirmation.dispatches ?? []) {
    const physicalDispatch =
      dispatch.method === "COURIER" || dispatch.method === "POST";
    items.push({
      id: `dispatch-${dispatch.id}`,
      at: dispatch.sentAt ?? dispatch.createdAt,
      stage: 10,
      index: (index += 1),
      title:
        dispatch.sequence > 1
          ? formatRedispatchTitle(
              copy.redispatchTitle,
              dispatch.sequence,
              locale
            )
          : copy.firstDispatch,
      actor: resolveActorName?.(dispatch.createdBy) ?? dispatch.createdBy,
      dispatchId: physicalDispatch ? dispatch.id : undefined,
    });
    if (
      physicalDispatch &&
      (dispatch.trackingStatus?.toLowerCase() === "delivered" ||
        dispatch.executionStatus === "DELIVERED")
    ) {
      const deliveredEvent = dispatch.trackingEvents?.find(
        (event) => event.stage?.toLowerCase() === "delivered" && event.at
      );
      items.push({
        id: `delivered-${dispatch.id}`,
        at:
          deliveredEvent?.at ??
          dispatch.deliveredAt ??
          dispatch.trackingLastEventAt ??
          "",
        stage: 20,
        index: (index += 1),
        title:
          copy.deliveredTitle ??
          (locale.startsWith("zh") ? "函证已送达" : "Confirmation delivered"),
        description: [
          dispatch.trackingCarrierName ?? dispatch.courierName,
          dispatch.trackingNumber,
        ].filter(Boolean).join(" · "),
        dispatchId: dispatch.id,
      });
    }
  }
  for (const event of confirmation.followUpEvents ?? []) {
    // Older warehouse matches used the original receipt date for the registration event.
    const warehouseMatch = event.eventType === "RESPONSE_RECEIVED"
      && event.source === "RESPONSE_INTAKE"
      && event.payload && typeof event.payload === "object"
      && "responseLibraryFileId" in event.payload;
    items.push({
      id: event.id,
      at: warehouseMatch ? event.createdAt : event.occurredAt,
      stage: eventTimelineStage(event.eventType),
      index: (index += 1),
      title: copy.eventLabels[event.eventType],
      description: event.notes ?? undefined,
      actor: resolveActorName?.(event.actorId) ?? event.actorId,
      dispatchId: returnShipmentDispatch(event)?.id,
    });
    const shipment = returnShipmentDispatch(event);
    if (shipment?.trackingStatus?.toLowerCase() === "delivered") {
      items.push({
        id: `return-delivered-${event.id}`, at: shipment.deliveredAt ?? shipment.trackingLastEventAt ?? "",
        stage: 35, index: (index += 1),
        title: locale.startsWith("zh") ? "回函快递已送达" : "Return shipment delivered",
        description: [shipment.trackingCarrierName ?? shipment.courierName, shipment.trackingNumber].filter(Boolean).join(" · "),
        dispatchId: shipment.id,
      });
    }
  }
  return items.sort((left, right) => {
    const leftTime = Date.parse(left.at);
    const rightTime = Date.parse(right.at);
    const sortableLeft = Number.isFinite(leftTime) ? leftTime : -Infinity;
    const sortableRight = Number.isFinite(rightTime) ? rightTime : -Infinity;
    return sortableLeft === sortableRight
      ? left.index - right.index
      : sortableRight - sortableLeft;
  });
}

function eventTimelineStage(eventType: ConfirmationFollowUpEventType) {
  switch (eventType) {
    case "REDISPATCH_REQUESTED": {
      return 15;
    }
    case "COUNTERPARTY_RECEIVED": {
      return 20;
    }
    case "COUNTERPARTY_SENT_RESPONSE": {
      return 30;
    }
    case "RESPONSE_RECEIVED": {
      return 40;
    }
    case "REVIEW_RECORDED": {
      return 50;
    }
    case "PROGRAM_COMPLETED": {
      return 60;
    }
    case "RESPONSE_WITHDRAWN": {
      return 70;
    }
    case "REVIEW_RETRACTED": {
      return 80;
    }
    default: {
      return 0;
    }
  }
}
function formatRedispatchTitle(
  template: string,
  sequence: number,
  locale: string
) {
  const ordinal = locale.startsWith("zh")
    ? formatConfirmationRedispatchOrdinal(sequence)
    : String(sequence);
  return template
    .replace("{ordinal}", ordinal)
    .replace("{sequence}", String(sequence));
}

function formatDate(value: string, locale: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function returnShipmentDispatch(event: ProjectConfirmationFollowUpEvent): ProjectConfirmationDispatch | null {
  if (event.eventType !== "COUNTERPARTY_SENT_RESPONSE") return null;
  const payload = event.payload as { returnShipment?: unknown } | null;
  const parsed = ConfirmationReturnShipmentSchema.safeParse(payload?.returnShipment);
  const tracking = parsed.success ? parsed.data : {};
  return {
    ...tracking, id: `return:${event.id}`, confirmationId: event.confirmationId,
    sequence: 1, method: "COURIER", executionStatus: (parsed.success && parsed.data.trackingStatus === "Delivered") ? "DELIVERED" : "SENT",
    createdBy: event.actorId ?? "", createdAt: event.createdAt, sentAt: event.occurredAt,
  };
}
