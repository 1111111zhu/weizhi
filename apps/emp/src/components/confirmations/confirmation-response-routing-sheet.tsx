"use client";

import type {
  ConfirmationType,
  RouteConfirmationResponseLibraryFileInput,
} from "@project-wing/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderKanban, Link2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import type { ConfirmationResponseLibraryFile } from "@/api/client";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirmationResponseRoutingCopy } from "@/i18n/confirmation-response-routing-copy";

const TYPES: ConfirmationType[] = [
  "BANK",
  "INTERMEDIARY",
  "BALANCE",
  "RELATED_PARTY",
  "LAWYER",
  "INVENTORY",
  "OTHER",
];

export function ConfirmationResponseRoutingSheet({
  response,
  open,
  onOpenChange,
  locale,
  initialProjectId,
  allowNoSourceRequest = false,
  onRouted,
}: {
  response: ConfirmationResponseLibraryFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  initialProjectId?: string;
  allowNoSourceRequest?: boolean;
  onRouted?: (
    response: ConfirmationResponseLibraryFile,
    action: "MATCH_CONFIRMATION" | "PENDING_MATCH" | "NO_SOURCE_REQUEST"
  ) => void;
}) {
  const zh = locale.startsWith("zh");
  const text = confirmationResponseRoutingCopy[zh ? "zh-CN" : "en-US"];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(initialProjectId ? 2 : 1);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [projectSearch, setProjectSearch] = useState("");
  const [action, setAction] = useState<
    "MATCH_CONFIRMATION" | "PENDING_MATCH" | "NO_SOURCE_REQUEST"
  >("MATCH_CONFIRMATION");
  const [confirmationId, setConfirmationId] = useState("");
  const [confirmationSearch, setConfirmationSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [provisionalType, setProvisionalType] =
    useState<ConfirmationType>("OTHER");

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(initialProjectId ? 2 : 1);
    setProjectId(initialProjectId ?? response?.projectId ?? "");
    setAction(
      response?.routingStatus === "PENDING_MATCH" && !initialProjectId
        ? "PENDING_MATCH"
        : response?.routingStatus === "NO_SOURCE_REQUEST" &&
            allowNoSourceRequest
          ? "NO_SOURCE_REQUEST"
          : "MATCH_CONFIRMATION"
    );
    setConfirmationId("");
    setConfirmationSearch("");
    setCategoryFilter("ALL");
    setProvisionalType(
      response?.provisionalType === "UNCLASSIFIED"
        ? "OTHER"
        : (response?.provisionalType ?? "OTHER")
    );
  }, [allowNoSourceRequest, initialProjectId, open, response]);

  const projects = useQuery({
    queryKey: ["projects", "response-routing"],
    queryFn: api.projects,
    enabled: open,
  });
  const confirmations = useQuery({
    queryKey: ["project-confirmations", projectId],
    queryFn: () => api.projectConfirmations(projectId),
    enabled: open && Boolean(projectId) && action === "MATCH_CONFIRMATION",
  });
  const visibleProjects = useMemo(() => {
    const q = projectSearch.trim().toLocaleLowerCase(locale);
    return (projects.data ?? []).filter(
      (project) =>
        project.status === "ACTIVE" &&
        (!q ||
          [
            project.name,
            project.projectCode,
            project.cmpClient?.nameZh ?? "",
            project.cmpClient?.nameEn ?? "",
          ].some((value) => value.toLocaleLowerCase(locale).includes(q)))
    );
  }, [locale, projectSearch, projects.data]);
  const candidates = useMemo(() => {
    const search = confirmationSearch.trim().toLocaleLowerCase(locale);
    const includeOtherStatuses = Boolean(search) || categoryFilter !== "ALL";
    const responseRef = response?.referenceNumber?.trim().toLowerCase();
    const responseEntity = response?.respondingEntity.trim().toLowerCase();
    return (confirmations.data ?? [])
      .filter((item) =>
        item.status !== "RESPONSE_RECEIVED" &&
        (includeOtherStatuses || item.status === "AWAITING_RESPONSE") &&
        !(item.responses ?? []).some(response => response.responseStatus === "RECEIVED" && response.routingStatus === "ROUTED") &&
        (categoryFilter === "ALL" || item.type === categoryFilter) &&
        (!search || [item.confirmationCode, item.counterpartyName, item.respondingEntityName, item.displayName,
          ...(item.dispatches ?? []).map(dispatch => dispatch.trackingNumber)]
          .some(value => value?.toLocaleLowerCase(locale).includes(search)))
      )
      .map((item) => ({
        ...item,
        score:
          (responseRef &&
          [item.confirmationCode, item.preparedDispatchReference]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase() === responseRef)
            ? 2
            : 0) +
          (responseEntity &&
          [item.counterpartyName, item.respondingEntityName]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(responseEntity))
            ? 1
            : 0),
      }))
      .sort((a, b) => b.score - a.score);
  }, [confirmations.data, response, confirmationSearch, categoryFilter, locale]);
  const route = useMutation({
    mutationFn: () => {
      if (!response || !projectId) {
        throw new Error(text.selectProjectError);
      }
      const input: RouteConfirmationResponseLibraryFileInput =
        action === "MATCH_CONFIRMATION"
          ? { action, projectId, confirmationId }
          : {
              action,
              projectId,
              provisionalType,
            };
      return api.routeConfirmationResponseLibraryFile(response.id, input);
    },
    onSuccess: async (updated) => {
      if (response) {
        queryClient.setQueryData<ConfirmationResponseLibraryFile[]>(
          ["confirmation-response-library"],
          (current) =>
            current?.map((item) =>
              item.id === response.id
                ? mergeRoutedResponse(item, updated)
                : item
            )
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-confirmations", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-pending-confirmation-responses", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-confirmation-response-warehouse", projectId],
        }),
      ]);
      await onRouted?.(updated, action);
      if (action === "MATCH_CONFIRMATION" && updated.confirmationId) {
        const destination = `/${locale}/engagement/${encodeURIComponent(updated.projectId ?? projectId)}?workspace=confirmations&confirmationId=${encodeURIComponent(updated.confirmationId)}&confirmationStage=draft`;
        toast({
          title: text.matchSuccess,
          variant: "success",
          duration: 5000,
          closeButton: true,
          dismissOnNavigation: true,
          actions: [{ label: text.goToConfirmation, onClick: () => window.location.assign(destination) }],
        });
      } else if (action === "PENDING_MATCH") {
        const destination = `/${locale}/engagement/${encodeURIComponent(updated.projectId ?? projectId)}?workspace=confirmations&confirmationView=unmatched`;
        toast({
          title: text.updateSuccess,
          variant: "success",
          duration: 5000,
          closeButton: true,
          dismissOnNavigation: true,
          actions: [{ label: text.goToUnmatched, onClick: () => window.location.assign(destination) }],
        });
      } else {
        toast({ title: text.updateSuccess });
      }
      onOpenChange(false);
    },
    onError: (_unused_error) =>
      toast({
        title: text.updateError,
        variant: "destructive",
      }),
  });
  const canContinue =
    (step === 1 && Boolean(projectId)) ||
    step === 2 ||
    (step === 3 &&
      (action !== "MATCH_CONFIRMATION" ||
        candidates.some((candidate) => candidate.id === confirmationId)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[85dvh] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:w-[85vw] sm:max-w-[1200px]"
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>{text.drawerTitle}</DialogTitle>
          <DialogDescription className="break-words">
            {response?.title} · {text.step(step)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
          {step === 1 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <Label>{text.selectProject}</Label>
              <div className="relative">
                <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder={text.searchProject}
                />
              </div>
              <RadioGroup
                value={projectId}
                onValueChange={(value) => {
                  setProjectId(value);
                  setConfirmationId("");
                }}
                className="min-h-0 gap-2 overflow-y-auto"
              >
                {visibleProjects.map((project) => (
                  <Label
                    key={project.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/50"
                  >
                    <RadioGroupItem value={project.id} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block font-medium">{project.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {project.projectCode} ·{" "}
                        {project.cmpClient?.nameZh ??
                          project.cmpClient?.nameEn ??
                          "—"}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          ) : null}

          {step === 2 ? (
            <RadioGroup
              value={action}
              onValueChange={(value) => setAction(value as typeof action)}
              className="gap-3 overflow-y-auto"
            >
              <RouteChoice
                value="MATCH_CONFIRMATION"
                icon={<Link2 />}
                title={text.matchConfirmation}
                description={text.matchConfirmationDescription}
              />
              {!initialProjectId ? (
                <RouteChoice
                  value="PENDING_MATCH"
                  icon={<FolderKanban />}
                  title={text.matchLater}
                  description={text.matchLaterDescription}
                />
              ) : null}
              {allowNoSourceRequest ? (
                <RouteChoice
                  value="NO_SOURCE_REQUEST"
                  icon={<FolderKanban />}
                  title={text.noOutgoingRequest}
                  description={text.noOutgoingRequestDescription}
                />
              ) : null}
            </RadioGroup>
          ) : null}

          {step === 3 && action === "MATCH_CONFIRMATION" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <Label>{text.selectOutgoing}</Label>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input className="pl-9" aria-label={text.searchConfirmation} placeholder={text.searchConfirmation}
                    value={confirmationSearch} onChange={event => setConfirmationSearch(event.target.value)} />
                </div>
                <Select value={categoryFilter} onValueChange={value => setCategoryFilter(value ?? "ALL")}>
                  <SelectTrigger aria-label={text.confirmationCategory} className="w-44 shrink-0"><SelectValue>{categoryFilter === "ALL" ? text.allCategories : typeLabel(categoryFilter as ConfirmationType, zh)}</SelectValue></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} align="start" side="bottom" sideOffset={4} className="border border-border shadow-lg">
                    <SelectItem value="ALL">{text.allCategories}</SelectItem>
                    {TYPES.map(type => <SelectItem key={type} value={type}>{typeLabel(type, zh)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {text.candidateHint}
              </p>
              <RadioGroup
                value={confirmationId}
                onValueChange={setConfirmationId}
                aria-label={text.selectOutgoing}
                className="min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border"
              >
                <Table
                  aria-label={text.selectOutgoing}
                  containerClassName="h-full min-h-0 overflow-auto"
                >
                  <TableHeader className="sticky top-0 z-10 bg-popover">
                    <TableRow>
                      <TableHead className="w-12"><span className="sr-only">{text.selectOutgoing}</span></TableHead>
                      <TableHead>{text.confirmationName}</TableHead>
                      <TableHead className="hidden sm:table-cell">{text.confirmationNumber}</TableHead>
                      <TableHead>{text.confirmationCategory}</TableHead>
                      <TableHead className="hidden sm:table-cell">{text.matchSuggestion}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((item) => (
                      <TableRow
                        key={item.id}
                        data-state={confirmationId === item.id ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setConfirmationId(item.id)}
                      >
                        <TableCell className="w-12 pl-4">
                          <RadioGroupItem value={item.id} aria-label={`${item.displayName || item.counterpartyName} ${item.confirmationCode || ""}`} />
                        </TableCell>
                        <TableCell className="max-w-md whitespace-normal break-words font-medium">
                          {item.displayName || item.counterpartyName}
                          <span className="mt-1 block text-xs font-normal text-muted-foreground sm:hidden">
                            {item.confirmationCode || "—"}{item.score ? ` · ${text.suggested}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{item.confirmationCode || "—"}</TableCell>
                        <TableCell>{typeLabel(item.type, zh)}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {item.score ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{text.suggested}</span> : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RadioGroup>
              {!confirmations.isLoading && candidates.length === 0 ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {text.noCandidates}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 3 && action !== "MATCH_CONFIRMATION" ? (
            <div className="grid gap-3">
              <Label>{text.provisionalCategory}</Label>
              <Select
                value={provisionalType}
                onValueChange={(value) =>
                  setProvisionalType(value as ConfirmationType)
                }
              >
                <SelectTrigger className="w-full" aria-label={text.provisionalCategory}>
                  <SelectValue>{typeLabel(provisionalType, zh)}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="border border-border shadow-lg"
                  align="start"
                  collisionAvoidance={{
                    align: "shift",
                    fallbackAxisSide: "none",
                    side: "shift",
                  }}
                  side="bottom"
                  sideOffset={4}
                >
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabel(type, zh)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <DialogFooter className="m-0 shrink-0 flex-row border-t px-6 py-4">
          {step > (initialProjectId ? 2 : 1) ? (
            <Button
              variant="outline"
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeft />
              {text.back}
            </Button>
          ) : null}
          <Button
            className="ml-auto"
            disabled={!canContinue || route.isPending}
            onClick={() =>
              step < 3 ? setStep((value) => value + 1) : route.mutate()
            }
          >
            {step < 3
              ? text.continue
              : route.isPending
                ? text.saving
                : text.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RouteChoice({
  value,
  icon,
  title,
  description,
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 hover:bg-muted/50">
      <RadioGroupItem value={value} className="mt-1" />
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">
        {icon}
      </span>
      <span>
        <span className="block font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
    </Label>
  );
}

function mergeRoutedResponse(
  current: ConfirmationResponseLibraryFile,
  updated: ConfirmationResponseLibraryFile
) {
  const merged = { ...current, ...updated };
  if (updated.projectId === null) {
    merged.project = null;
    merged.confirmation = null;
    merged.confirmationId = null;
    merged.matchedResponseId = null;
  }
  return merged;
}

export function typeLabel(type: ConfirmationType, zh: boolean) {
  const text = confirmationResponseRoutingCopy[zh ? "zh-CN" : "en-US"];
  if (type === "UNCLASSIFIED") {
    return text.unclassified;
  }
  return text.typeLabels[type];
}
