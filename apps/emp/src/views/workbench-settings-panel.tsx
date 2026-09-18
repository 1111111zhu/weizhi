"use client";

import type {
  CmpEngagement,
  LinkProjectEngagementInput,
  TmsProjectLink,
} from "@project-wing/shared";
import {
  UI_UNIT_LABELS,
  Button as MobileButton,
  ThemePreferenceCards,
  useCompactViewport,
  ViewSwitcher,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  Handshake,
  Minus,
  MonitorCog,
  PanelsTopLeft,
  PlugZap,
  Plus,
  Recycle,
  Search,
  Settings2,
  Trash2,
  Users2,
  Unlink,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../api/client";
import type {
  ArchiveCheckJobSnapshot,
  ArchiveCheckReport,
  ArchiveJobSnapshot,
  Project,
} from "../api/client";
import { CmpSharedInformation } from "../components/cmp-shared-information";
import { DesktopAgentSettings } from "../components/desktop-agent-settings";
import { SettingsDialogShell } from "../components/settings-dialog-shell";
import { useTheme } from "../components/theme-provider";
import { useToast } from "../components/toast";
import { UserIntegrationsSettings } from "../components/user-integrations-settings";
import { getArchiveMobileCopy } from "../i18n/archive-mobile";
import { useI18n } from "../i18n/client";
import type { Dictionary } from "../i18n/dictionaries";
import {
  localizedPath as buildLocalizedPath,
  localeCookieName,
} from "../i18n/settings";
import type { Locale } from "../i18n/settings";
import {
  CALENDAR_END_MONTH,
  CALENDAR_START_MONTH,
  formatCalendarDate,
  formatIsoDate,
  getCalendarLocale,
  parseIsoDate,
} from "../lib/calendar-date";
import type { ThemeFontSize } from "../lib/theme";
import { useSurfaceTransition } from "../lib/use-surface-transition";
import { cn } from "../lib/utils";
import { MembersPage } from "./members";

import archiveStyles from "./workbench-archive-mobile.module.css";

type SettingsSectionId =
  | "general"
  | "archive"
  | "members"
  | "cmpEngagement"
  | "tmsLinks"
  | "recycleBin"
  | "personal"
  | "desktopAgent"
  | "integrations";
type ProjectSettingsSectionId = Extract<
  SettingsSectionId,
  "general" | "archive"
>;
type SettingsPanelCopy = Dictionary["workbench"]["settingsPanel"];

function getCmpEngagementErrorDescription(
  error: unknown,
  copy: SettingsPanelCopy["project"],
  fallback: string
) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  switch (code) {
    case "PROJECT_ENGAGEMENT_ALREADY_LINKED": {
      return copy.cmpEngagementAlreadyLinked;
    }
    case "PROJECT_CODE_ALREADY_IN_USE": {
      return copy.cmpEngagementCodeConflict;
    }
    case "VALIDATION_FAILED": {
      return copy.cmpEngagementUnavailable;
    }
    case "FORBIDDEN": {
      return copy.cmpEngagementPermissionDenied;
    }
    case "NOT_FOUND": {
      return copy.cmpEngagementProjectNotEditable;
    }
    default: {
      return fallback;
    }
  }
}
type ArchiveCheckCopy = Dictionary["workbench"]["archiveCheck"];
export type LocateWorkingPaperHandler = (
  paperId: string,
  attachmentId?: string
) => void;
export type ArchiveCheckNavigatorSnapshot = {
  report: ArchiveCheckReport;
  activeIssueKey: string;
};
type OpenArchiveCheckNavigatorHandler = (
  snapshot: ArchiveCheckNavigatorSnapshot
) => void;
type SettingsCalendarFieldId = "yearEndDate" | "reportDate" | "archiveDeadline";

const DEFAULT_ARCHIVE_DEADLINE_DAYS = 60;
const SETTINGS_CANCEL_BUTTON_CLASS =
  "rounded-[5px] bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20";
const SETTINGS_CONFIRM_BUTTON_CLASS =
  "rounded-[5px] bg-transparent text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-200";
const SETTINGS_CONTROL_CLASS = "w-full";
const SETTINGS_CONTROL_COLUMN_CLASS = "w-full min-w-0 justify-self-stretch";
const SETTINGS_FIELD_CLASS = "gap-2";
const SETTINGS_FORM_LABEL_CLASS =
  "justify-self-start text-sm font-medium text-foreground";
const GENERAL_SETTINGS_ROW_CLASS =
  "grid grid-cols-1 gap-2 border-b border-border/60 py-5 first:pt-0 last:border-b-0 @md/settings-general:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] @md/settings-general:items-center @md/settings-general:gap-6";
const SETTINGS_LABEL_CLASS = "text-sm font-normal text-foreground";
const FONT_SIZE_OPTION_CLASS: Record<ThemeFontSize, string> = {
  sm: "text-[15px]",
  md: "text-[16px]",
  lg: "text-[17px]",
};

export function WorkbenchSettingsPanel({
  projectId,
  canArchiveProject,
  canDeleteProject,
  canRunArchiveWorkflow = canArchiveProject,
  isFinalArchiveReview = false,
  canEditProject,
  archivePending,
  archiveJob,
  initialSection,
  archiveReviewRequestKey = 0,
  onArchiveProject,
  onReopenProject,
  onLocateWorkingPaper,
  onOpenArchiveCheckNavigator,
  recycleBinContent,
  projectOnly = false,
}: {
  projectId: string;
  canArchiveProject: boolean;
  canDeleteProject: boolean;
  canRunArchiveWorkflow?: boolean;
  isFinalArchiveReview?: boolean;
  canEditProject: boolean;
  archivePending: boolean;
  archiveJob?: ArchiveJobSnapshot | null;
  archiveJobErrorMessage?: string;
  initialSection?: SettingsSectionId;
  archiveReviewRequestKey?: number;
  onArchiveProject: () => void;
  onReopenProject?: () => void;
  onLocateWorkingPaper?: LocateWorkingPaperHandler;
  onOpenArchiveCheckNavigator?: OpenArchiveCheckNavigatorHandler;
  recycleBinContent?: ReactNode;
  projectOnly?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dictionary, locale } = useI18n();
  const {
    fontSize,
    mounted,
    resolvedTheme,
    setFontSize,
    setTheme,
    theme,
    setUseNativePdfViewer,
    useNativePdfViewer,
  } = useTheme();
  const [pending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    initialSection ?? "general"
  );
  const settingsContentRef = useSurfaceTransition<HTMLDivElement>(activeSection);
  const copy = dictionary.workbench.settingsPanel;
  const selectedTheme =
    mounted && theme === "system"
      ? "system"
      : mounted && resolvedTheme === "dark"
        ? "dark"
        : "light";
  const sections = useMemo(
    () => [
      {
        id: "general" as const,
        label: copy.sections.general.label,
        icon: PanelsTopLeft,
      },
      {
        id: "archive" as const,
        label: copy.sections.archive.label,
        icon: Archive,
      },
      {
        id: "members" as const,
        label: copy.sections.members.label,
        icon: Users2,
      },
      {
        id: "cmpEngagement" as const,
        label: copy.sections.cmpEngagement.label,
        icon: Handshake,
      },
      {
        id: "tmsLinks" as const,
        label: copy.sections.tmsLinks.label,
        icon: Clock3,
      },
      ...(recycleBinContent
        ? [
            {
              id: "recycleBin" as const,
              label: copy.project.recycleBinTitle,
              icon: Recycle,
            },
          ]
        : []),
      {
        id: "personal" as const,
        label: copy.sections.personal.label,
        icon: Settings2,
      },
      {
        id: "desktopAgent" as const,
        label: copy.sections.desktopAgent?.label ?? "Desktop Agent",
        icon: MonitorCog,
      },
      {
        id: "integrations" as const,
        label: copy.sections.integrations.label,
        icon: PlugZap,
      },
    ],
    [copy, recycleBinContent]
  );
  useEffect(() => {
    if (!initialSection) {
      return;
    }
    setActiveSection(initialSection);
  }, [initialSection]);

  return (
    <div
      className="h-full min-h-0 overflow-hidden"
      data-testid="workbench-settings-panel"
    >
      <SettingsDialogShell
        activeId={activeSection}
        mobileNavigation="pages"
        mobileInitialDetail={Boolean(initialSection)}
        mobileDetailRequestKey={archiveReviewRequestKey}
        mobileBackLabel={dictionary.common.settings}
        breadcrumbRoot={
          projectOnly
            ? (dictionary.projects.settingsTitle ?? "Project settings")
            : (dictionary.common?.settings ?? "Settings")
        }
        items={
          projectOnly
            ? sections.filter((section) =>
                [
                  "general",
                  "archive",
                  "members",
                  "cmpEngagement",
                  "tmsLinks",
                ].includes(section.id)
              )
            : sections
        }
        mainClassName={cn("min-w-0", activeSection === "members" && "relative")}
        navigationLabel={copy.menu.navAriaLabel}
        onActiveIdChange={setActiveSection}
      >
        <div
          ref={settingsContentRef}
          className="max-w-full min-w-0 overflow-x-hidden"
          data-testid="settings-content-panel"
        >
          {activeSection === "personal" ? (
            <PersonalSettingsSection
              copy={copy}
              dictionary={dictionary}
              fontSize={fontSize}
              selectedTheme={selectedTheme}
              locale={locale}
              pathname={pathname}
              pending={pending}
              searchParams={searchParams}
              setFontSize={setFontSize}
              setTheme={setTheme}
              setUseNativePdfViewer={setUseNativePdfViewer}
              startTransition={startTransition}
              useNativePdfViewer={useNativePdfViewer}
            />
          ) : null}

          {activeSection === "members" ? (
            <MembersPage projectId={projectId} presentation="sheet" />
          ) : null}

          {activeSection === "tmsLinks" ? (
            <TmsProjectLinksSection projectId={projectId} copy={copy} />
          ) : null}

          {activeSection === "cmpEngagement" ? (
            <CmpEngagementLinkSection
              projectId={projectId}
              canEditProject={canEditProject}
              copy={copy}
            />
          ) : null}

          {activeSection === "recycleBin" ? recycleBinContent : null}

          {activeSection === "integrations" ? (
            <UserIntegrationsSettings />
          ) : null}

          {activeSection === "desktopAgent" ? <DesktopAgentSettings /> : null}

          {activeSection === "general" || activeSection === "archive" ? (
            <ProjectActionsSection
              projectId={projectId}
              section={activeSection}
              archivePending={archivePending}
              archiveJob={archiveJob ?? null}
              canRunArchiveWorkflow={canRunArchiveWorkflow}
              isFinalArchiveReview={isFinalArchiveReview}
              canEditProject={canEditProject}
              archiveReviewRequestKey={archiveReviewRequestKey}
              copy={copy}
              onLocateWorkingPaper={onLocateWorkingPaper}
              onOpenArchiveCheckNavigator={onOpenArchiveCheckNavigator}
              onArchiveProject={onArchiveProject}
              onReopenProject={onReopenProject}
              canDeleteProject={canDeleteProject}
            />
          ) : null}
        </div>
      </SettingsDialogShell>
    </div>
  );
}

function TmsProjectLinksSection({
  projectId,
  copy,
}: {
  projectId: string;
  copy: SettingsPanelCopy;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const deferredPendingQuery = useDeferredValue(pendingQuery);
  const pendingLinks = useQuery({
    queryKey: ["tms-project-links", "pending", deferredPendingQuery],
    queryFn: () => {
      const query = deferredPendingQuery.trim();
      return api.tmsProjectLinks({
        status: "PENDING",
        ...(query ? { q: query } : {}),
      });
    },
    enabled: pickerOpen,
  });
  const currentUser = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
  });
  const linkedLinks = useQuery({
    queryKey: ["tms-project-links", projectId],
    queryFn: () => api.tmsProjectLinks({ projectId }),
  });
  const currentLinks =
    linkedLinks.data?.links.filter(
      (link) =>
        link.projectId === projectId &&
        link.status === "LINKED" &&
        link.ownerUserId === currentUser.data?.id
    ) ?? [];
  const availablePendingLinks =
    pendingLinks.data?.links.filter(
      (link) => link.status === "PENDING" && !link.projectId
    ) ?? [];
  const refreshLinks = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tms-project-links"] }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
    ]);
  };
  const linkMutation = useMutation({
    mutationFn: (rowId: string) => api.linkTmsProject(rowId, projectId),
    onSuccess: refreshLinks,
    onError: () =>
      toast({ title: copy.tmsLinks.error, variant: "destructive" }),
  });
  const unlinkMutation = useMutation({
    mutationFn: (rowId: string) => api.unlinkTmsProject(rowId),
    onSuccess: refreshLinks,
    onError: () =>
      toast({ title: copy.tmsLinks.error, variant: "destructive" }),
  });
  const linkPendingRow = (link: TmsProjectLink) => {
    const hasPeriodConflict = currentLinks.some(
      (current) =>
        current.year === link.year &&
        current.month === link.month &&
        periodScopesOverlap(current.periodScope, link.periodScope)
    );
    if (hasPeriodConflict) {
      toast({
        title: copy.tmsLinks.periodConflict,
        variant: "destructive",
      });
      return;
    }
    linkMutation.mutate(link.rowId);
  };

  return (
    <section className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {copy.tmsLinks.linked}
          </h3>
          <Button
            type="button"
            size="sm"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((current) => !current)}
          >
            <Plus className="size-4" />
            {copy.tmsLinks.add}
          </Button>
        </div>
        {linkedLinks.isLoading || currentUser.isLoading ? (
          <p className="text-sm text-muted-foreground">
            {copy.tmsLinks.loadingLinked}
          </p>
        ) : currentLinks.length > 0 ? (
          <TmsProjectLinksTable
            links={currentLinks}
            actionLabel={copy.tmsLinks.unlink}
            destructive
            busyRowId={
              unlinkMutation.isPending ? unlinkMutation.variables : undefined
            }
            copy={copy}
            onAction={(link) => unlinkMutation.mutate(link.rowId)}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {copy.tmsLinks.noLinked}
          </div>
        )}
        {pickerOpen ? (
          <section
            aria-label={copy.tmsLinks.pickerTitle}
            className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-muted/25 px-4 py-3">
              <div className="grid gap-1">
                <h4 className="font-semibold text-foreground">
                  {copy.tmsLinks.pickerTitle}
                </h4>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={copy.tmsLinks.close}
                onClick={() => setPickerOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-4 p-4">
              <InputGroup>
                <InputGroupAddon>
                  <Search className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label={copy.tmsLinks.searchPlaceholder}
                  placeholder={copy.tmsLinks.searchPlaceholder}
                  value={pendingQuery}
                  onChange={(event) => setPendingQuery(event.target.value)}
                />
              </InputGroup>
              {pendingLinks.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {copy.tmsLinks.loading}
                </p>
              ) : availablePendingLinks.length ? (
                <TmsProjectLinksTable
                  links={availablePendingLinks}
                  actionLabel={copy.tmsLinks.link}
                  busyRowId={
                    linkMutation.isPending ? linkMutation.variables : undefined
                  }
                  copy={copy}
                  onAction={linkPendingRow}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  {copy.tmsLinks.noPending}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function TmsProjectLinksTable({
  links,
  actionLabel,
  busyRowId,
  copy,
  destructive = false,
  onAction,
}: {
  links: TmsProjectLink[];
  actionLabel: string;
  busyRowId?: string;
  copy: SettingsPanelCopy;
  destructive?: boolean;
  onAction: (link: TmsProjectLink) => void;
}) {
  return (
    <Table
      label={copy.tmsLinks.tableLabel}
      containerClassName="overflow-hidden rounded-lg border border-border/60"
    >
      <TableHeader className="bg-muted/35">
        <TableRow className="border-b border-border/60 hover:bg-transparent hover:shadow-none">
          <TableHead>{copy.tmsLinks.period}</TableHead>
          <TableHead>{copy.tmsLinks.type}</TableHead>
          <TableHead>{copy.tmsLinks.timeEntries}</TableHead>
          <TableHead>{copy.tmsLinks.descriptionColumn}</TableHead>
          <TableHead className="text-right">
            {copy.tmsLinks.totalHours}
          </TableHead>
          <TableHead className="w-32 min-w-32 text-center">
            {copy.tmsLinks.actions}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-border/50">
        {links.map((link) => (
          <TableRow
            key={link.id}
            className="border-0 hover:bg-muted/30 hover:shadow-none"
          >
            <TableCell className="font-medium">
              {formatTmsLinkPeriod(link, copy)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {formatTmsWorkType(link.workType, copy)}
              </Badge>
            </TableCell>
            <TableCell className="max-w-80 whitespace-normal">
              <TmsTimeEntries hoursByDate={link.hoursByDate} copy={copy} />
            </TableCell>
            <TableCell className="max-w-64 truncate">
              {link.description || link.label || "—"}
            </TableCell>
            <TableCell className="text-right font-medium">
              {(link.periodTotal ?? 0).toFixed(1)}
              {UI_UNIT_LABELS.hours}
            </TableCell>
            <TableCell className="text-center">
              <Button
                type="button"
                size="sm"
                variant={destructive ? "ghost" : "outline"}
                className={cn(
                  "min-w-20",
                  destructive &&
                    "text-destructive hover:bg-destructive/10 hover:text-destructive"
                )}
                disabled={Boolean(busyRowId)}
                onClick={() => onAction(link)}
              >
                {actionLabel}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function periodScopesOverlap(
  left: TmsProjectLink["periodScope"],
  right: TmsProjectLink["periodScope"]
) {
  return left === "all" || right === "all" || left === right;
}

function formatTmsLinkPeriod(link: TmsProjectLink, copy: SettingsPanelCopy) {
  const scope =
    link.periodScope === "first"
      ? copy.tmsLinks.firstHalf
      : link.periodScope === "second"
        ? copy.tmsLinks.secondHalf
        : copy.tmsLinks.fullMonth;
  return `${link.year}/${String(link.month).padStart(2, "0")} · ${scope}`;
}

function formatTmsWorkType(
  workType: TmsProjectLink["workType"],
  copy: SettingsPanelCopy
) {
  if (workType === "OT") {
    return copy.tmsLinks.ot;
  }
  if (workType === "Absent") {
    return copy.tmsLinks.absent;
  }
  return copy.tmsLinks.normal;
}

function TmsTimeEntries({
  hoursByDate,
  copy,
}: {
  hoursByDate: TmsProjectLink["hoursByDate"];
  copy: SettingsPanelCopy;
}) {
  const entries = Object.entries(hoursByDate ?? {})
    .filter(([, hours]) => hours > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {copy.tmsLinks.noHours}
      </span>
    );
  }
  const visible = entries.slice(0, 4);
  const remaining = entries.length - visible.length;
  return (
    <div className="flex min-w-max items-center gap-2">
      <TmsTimeEntryStrip entries={visible} />
      {remaining > 0 ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto min-h-8 px-2 text-xs text-muted-foreground"
                aria-label={`${copy.tmsLinks.showAllTimeEntries} (${entries.length})`}
              >
                +{remaining} {copy.tmsLinks.moreTimeEntries}
              </Button>
            }
          />
          <PopoverContent align="start" sideOffset={6} className="w-80">
            <p className="mb-3 text-xs font-semibold text-foreground">
              {copy.tmsLinks.timeEntries}
            </p>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3">
              {entries.map(([date, hours]) => (
                <TmsTimeEntry key={date} date={date} hours={hours} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function TmsTimeEntryStrip({ entries }: { entries: [string, number][] }) {
  return (
    <div className="inline-grid auto-cols-max grid-flow-col divide-x divide-border/40">
      {entries.map(([date, hours]) => (
        <TmsTimeEntry key={date} date={date} hours={hours} />
      ))}
    </div>
  );
}

function TmsTimeEntry({ date, hours }: { date: string; hours: number }) {
  const [, month, day] = date.split("-");
  return (
    <span className="grid min-w-14 justify-items-center gap-0.5 px-2 first:pl-0 last:pr-0">
      <span className="text-[11px] leading-none text-muted-foreground">
        {month}/{day}
      </span>
      <span className="text-xs font-medium text-foreground">
        {hours.toFixed(1)}
        {UI_UNIT_LABELS.hours}
      </span>
    </span>
  );
}

function CmpEngagementLinkSection({
  projectId,
  canEditProject,
  copy,
}: {
  projectId: string;
  canEditProject: boolean;
  copy: SettingsPanelCopy;
}) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const { dictionary, locale } = useI18n();
  const [query, setQuery] = useState("");
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.project(projectId),
    refetchInterval: 30_000,
  });
  const candidates = useQuery({
    queryKey: ["cmpEngagements", "settings-link", query.trim()],
    queryFn: () =>
      api.cmpEngagements({ q: query.trim(), availableForProject: true }),
    enabled: canEditProject && query.trim().length >= 2,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["members", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
    ]);
  };
  const link = useMutation({
    mutationFn: (input: LinkProjectEngagementInput) =>
      api.linkProjectEngagement(projectId, input),
    onSuccess: async () => {
      setQuery("");
      await refresh();
      toast({ title: copy.project.cmpEngagementLinked, variant: "success" });
    },
    onError: (error) =>
      toast({
        title: copy.project.cmpEngagementLinkFailed,
        description: getCmpEngagementErrorDescription(
          error,
          copy.project,
          copy.project.cmpEngagementLinkFailed
        ),
        variant: "destructive",
      }),
  });
  const unlink = useMutation({
    mutationFn: () => api.unlinkProjectEngagement(projectId),
    onSuccess: async () => {
      await refresh();
      toast({ title: copy.project.cmpEngagementUnlinked, variant: "success" });
    },
    onError: (error) =>
      toast({
        title: copy.project.cmpEngagementUnlinkFailed,
        description: getCmpEngagementErrorDescription(
          error,
          copy.project,
          copy.project.cmpEngagementUnlinkFailed
        ),
        variant: "destructive",
      }),
  });
  const linked = project.data?.cmpEngagement ?? null;
  const formatSearchResult = (engagement: CmpEngagement) =>
    copy.project.cmpEngagementSearchResult
      .replace("{clientCode}", engagement.client.clientCode)
      .replace(
        "{clientName}",
        engagement.client.nameEn || engagement.client.nameZh
      )
      .replace("{pic}", engagement.pic ?? "—")
      .replace("{mic}", engagement.mic ?? "—");
  const select = (engagement: CmpEngagement) =>
    link.mutate({
      cmpClientId: engagement.clientId,
      cmpEngagementId: engagement.id,
    });
  const disconnect = async () => {
    const accepted = await confirm({
      title: copy.project.cmpEngagementUnlink,
      description: copy.project.cmpEngagementConfirmUnlink,
      confirmLabel: copy.project.cmpEngagementUnlink,
      cancelLabel: dictionary.common.cancel,
    });
    if (accepted) {
      unlink.mutate();
    }
  };

  return (
    <section className="grid gap-5" aria-label={copy.project.cmpEngagement}>
      {project.isLoading ? <Skeleton className="h-20 w-full" /> : null}
      {linked && project.data ? (
        <CmpSharedInformation
          copy={copy.project.cmpSharedInformation}
          locale={locale}
          project={project.data}
        />
      ) : project.isLoading ? null : (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {copy.project.cmpEngagementNoCurrent}
        </p>
      )}
      {canEditProject ? (
        <div className="grid gap-3">
          {linked ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={unlink.isPending}
              onClick={() => {
                disconnect();
              }}
            >
              <Unlink />
              {copy.project.cmpEngagementUnlink}
            </Button>
          ) : (
            <>
              <Field className={SETTINGS_FIELD_CLASS}>
                <FieldLabel htmlFor="settings-cmp-engagement-search">
                  {copy.project.cmpEngagementSearch}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="settings-cmp-engagement-search"
                    value={query}
                    placeholder={copy.project.cmpEngagementSearchPlaceholder}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <Search className="size-4 text-muted-foreground" />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              {query.trim().length >= 2 ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  {candidates.isLoading ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      {copy.project.loading}
                    </p>
                  ) : null}
                  {!candidates.isLoading &&
                  !candidates.data?.engagements.length ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      {copy.project.cmpEngagementNoResults}
                    </p>
                  ) : null}
                  {candidates.data?.engagements.map((engagement) => (
                    <Button
                      key={engagement.id}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-none border-b border-border px-3 py-2.5 text-left last:border-b-0"
                      disabled={link.isPending}
                      onClick={() => select(engagement)}
                    >
                      <span className="grid gap-0.5">
                        <span className="font-medium">
                          {engagement.engagementCode}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatSearchResult(engagement)}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {copy.project.readOnly}
        </p>
      )}
    </section>
  );
}

function PersonalSettingsSection({
  copy,
  dictionary,
  fontSize,
  selectedTheme,
  locale,
  pathname,
  pending,
  searchParams,
  setFontSize,
  setTheme,
  setUseNativePdfViewer,
  startTransition,
  useNativePdfViewer,
}: {
  copy: SettingsPanelCopy;
  dictionary: {
    language: {
      label: string;
      zhCN: string;
      zhCNShort: string;
      zhHKShort: string;
      enUS: string;
      enUSShort: string;
    };
  };
  fontSize: ThemeFontSize;
  selectedTheme: "light" | "dark" | "system";
  locale: Locale;
  pathname: string;
  pending: boolean;
  searchParams: ReturnType<typeof useSearchParams>;
  setFontSize: (fontSize: ThemeFontSize) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setUseNativePdfViewer: (enabled: boolean) => void;
  startTransition: ReturnType<typeof useTransition>[1];
  useNativePdfViewer: boolean;
}) {
  const selectLocale = (nextLocale: Locale) => {
    if (nextLocale === locale || pending) {
      return;
    }

    const query = searchParams.toString();
    const nextPath = buildLocalizedPath(
      `${pathname}${query ? `?${query}` : ""}`,
      nextLocale
    );
    void api.updatePreferredLocale(nextLocale).catch(() => {});
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      window.location.assign(nextPath);
    });
  };
  const languageTabs: {
    value: Locale;
    label: string;
  }[] = [
    { value: "zh-CN", label: dictionary.language.zhCN },
    { value: "en-US", label: dictionary.language.enUS },
  ];

  return (
    <FieldGroup className="mx-auto w-full max-w-2xl gap-0">
      <Field className="pb-8">
        <FieldTitle>{copy.personal.darkMode}</FieldTitle>
        <ThemePreferenceCards
          label={copy.personal.darkMode}
          value={selectedTheme}
          onValueChange={setTheme}
          labels={{
            system: copy.personal.system,
            light: copy.personal.day,
            dark: copy.personal.night,
          }}
        />
      </Field>
      <Field
        orientation="horizontal"
        className="items-center justify-between gap-4 border-t border-border/60 py-5"
      >
        <FieldTitle>{dictionary.language.label}</FieldTitle>
        <Tabs
          value={locale}
          onValueChange={(value) => {
            selectLocale(value as Locale);
          }}
          label={dictionary.language.label}
          className="w-fit shrink-0 justify-self-start"
        >
          <TabsList>
            {languageTabs.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                disabled={pending}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Field>

      <Field
        orientation="horizontal"
        className="items-center justify-between gap-4 border-t border-border/60 py-5"
      >
        <FieldTitle>{copy.personal.fontSize}</FieldTitle>
        <Tabs
          value={fontSize}
          onValueChange={(value) => setFontSize(value as ThemeFontSize)}
          label={copy.personal.fontSize}
          className="w-fit shrink-0 justify-self-start"
        >
          <TabsList>
            {(["sm", "md", "lg"] as ThemeFontSize[]).map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className={FONT_SIZE_OPTION_CLASS[item]}
              >
                {copy.fontSizeOptions[item]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Field>

      <Field
        orientation="horizontal"
        className="items-center justify-between gap-4 border-t border-border/60 py-5"
      >
        <FieldTitle>{copy.personal.nativePdfViewer}</FieldTitle>
        <Switch
          checked={useNativePdfViewer}
          aria-label={copy.personal.nativePdfViewer}
          onCheckedChange={setUseNativePdfViewer}
        />
      </Field>
    </FieldGroup>
  );
}

function ProjectActionsSection({
  projectId,
  section,
  archivePending,
  archiveJob,
  canDeleteProject,
  canRunArchiveWorkflow,
  isFinalArchiveReview,
  canEditProject,
  archiveReviewRequestKey,
  copy,
  onLocateWorkingPaper,
  onOpenArchiveCheckNavigator,
  onArchiveProject,
  onReopenProject,
}: {
  projectId: string;
  section: ProjectSettingsSectionId;
  archivePending: boolean;
  archiveJob?: ArchiveJobSnapshot | null;
  canDeleteProject: boolean;
  canRunArchiveWorkflow: boolean;
  isFinalArchiveReview: boolean;
  canEditProject: boolean;
  archiveReviewRequestKey: number;
  copy: SettingsPanelCopy;
  onLocateWorkingPaper?: LocateWorkingPaperHandler;
  onOpenArchiveCheckNavigator?: OpenArchiveCheckNavigatorHandler;
  onArchiveProject: () => void;
  onReopenProject?: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { dictionary, locale } = useI18n();
  const { toast } = useToast();
  const deleteProjectLabel = copy.project.deleteProject;
  const phone = useCompactViewport(767.98);
  const archiveMobileCopy = getArchiveMobileCopy(locale);
  const deletingProjectLabel =
    copy.project.deletingProject ?? deleteProjectLabel;
  const archivingProjectLabel = copy.project.archivingProject;
  const checkingFilesLabel = copy.project.checkingFiles;
  const handledArchiveReviewRequestKey = useRef(0);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.project(projectId),
    enabled: Boolean(projectId),
  });
  const pendingFinalCheck =
    isFinalArchiveReview || project.data?.status === "PENDING_FINAL_CHECK";
  const archiveProjectLabel = pendingFinalCheck
    ? dictionary.projects.confirmArchive
    : copy.project.archiveProject;
  const calendarTodayLabel = dictionary.common.datePicker?.today ?? "Today";
  const frameworkTemplates = useQuery({
    queryKey: ["frameworkTemplates"],
    queryFn: api.frameworkTemplates,
  });
  const [archiveCheckDialogOpen, setArchiveCheckDialogOpen] = useState(false);
  const [archiveCheckReport, setArchiveCheckReport] =
    useState<ArchiveCheckReport | null>(null);
  const [archiveCheckJobId, setArchiveCheckJobId] = useState<string | null>(
    null
  );
  const [archiveCheckJobSnapshot, setArchiveCheckJobSnapshot] =
    useState<ArchiveCheckJobSnapshot | null>(null);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [archivePasswordVisible, setArchivePasswordVisible] = useState(false);
  const [projectActionLabel, setProjectActionLabel] =
    useState(archiveProjectLabel);
  const [openCalendarField, setOpenCalendarField] =
    useState<SettingsCalendarFieldId | null>(null);
  const form = useForm<{
    name: string;
    projectCode: string;
    frameworkTemplateId: string;
    yearEndDate: string;
    reportDate: string;
    archiveDeadline: string;
    archivePassword?: string;
  }>({
    defaultValues: {
      name: "",
      projectCode: "",
      frameworkTemplateId: "",
      yearEndDate: "",
      reportDate: "",
      archiveDeadline: "",
      archivePassword: "",
    },
  });
  const updateProject = useMutation({
    mutationFn: (values: {
      name: string;
      projectCode: string;
      frameworkTemplateId: string;
      yearEndDate: string;
      reportDate: string;
      archiveDeadline: string;
      archivePassword?: string;
    }) => {
      const { frameworkTemplateId: _frameworkTemplateId, ...editableValues } =
        values;
      return api.updateProject(projectId, {
        ...editableValues,
        archiveDeadline:
          addDaysIsoDate(values.reportDate, DEFAULT_ARCHIVE_DEADLINE_DAYS) ??
          values.archiveDeadline,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
      ]);
      toast({
        title: copy.project.updated,
        variant: "success",
        duration: 3000,
      });
    },
  });
  const deleteProject = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: async () => {
      setDeleteProjectDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", "deleted"] }),
      ]);
      router.replace(buildLocalizedPath("/engagement", locale));
    },
  });
  const archiveCheckStart = useMutation({
    mutationFn: () => api.startArchiveCheckJob(projectId),
    onSuccess: (job) => {
      setArchiveCheckJobSnapshot(job);
      if (job.status === "completed" && job.report) {
        setArchiveCheckReport(job.report);
        setArchiveCheckJobId(null);
        return;
      }
      if (job.status === "failed") {
        setArchiveCheckJobId(null);
        return;
      }
      setArchiveCheckJobId(job.jobId);
      setArchiveCheckDialogOpen(true);
    },
  });
  const { mutate: mutateArchiveCheck, reset: resetArchiveCheck } =
    archiveCheckStart;
  const archiveCheckJobQuery = useQuery({
    queryKey: ["archiveCheckJob", projectId, archiveCheckJobId],
    queryFn: () => api.archiveCheckJob(projectId, archiveCheckJobId ?? ""),
    enabled: Boolean(archiveCheckJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1000;
    },
  });
  useEffect(() => {
    const job = archiveCheckJobQuery.data;
    if (!job) {
      return;
    }
    setArchiveCheckJobSnapshot(job);
    if (job.status === "completed" && job.report) {
      setArchiveCheckReport(job.report);
      setArchiveCheckJobId(null);
    }
    if (job.status === "failed") {
      setArchiveCheckJobId(null);
    }
  }, [archiveCheckJobQuery.data]);
  useEffect(() => {
    if (archiveCheckJobQuery.error) {
      setArchiveCheckJobId(null);
    }
  }, [archiveCheckJobQuery.error]);
  const archiveDownload = useMutation({
    mutationFn: () => api.downloadArchiveArtifact(projectId),
    onSuccess: (blob) => {
      downloadBlob(blob, "project-archive.zip");
    },
  });
  const archiveCheckRunning =
    archiveCheckStart.isPending ||
    Boolean(
      archiveCheckJobId &&
      !archiveCheckReport &&
      archiveCheckJobSnapshot?.status !== "failed"
    );
  const archiveJobVisible = Boolean(archiveJob);
  const archiveJobRunning =
    archiveJob?.status === "queued" || archiveJob?.status === "running";
  const languageValue = project.data?.language ?? "zh-CN";
  const projectNameValue = form.watch("name");
  const projectCodeValue = form.watch("projectCode");
  const frameworkTemplateIdValue = form.watch("frameworkTemplateId");
  const yearEndDateValue = form.watch("yearEndDate");
  const reportDateValue = form.watch("reportDate");
  const archiveDeadlineValue = form.watch("archiveDeadline");
  const parsedArchiveDeadline = parseIsoDate(archiveDeadlineValue);
  const isProjectNameDirty = projectNameValue !== (project.data?.name ?? "");
  const isProjectCodeDirty =
    projectCodeValue !== (project.data?.projectCode ?? "");
  const isYearEndDateDirty =
    yearEndDateValue !== toDateInputValue(project.data?.yearEndDate);
  const isReportDateDirty =
    reportDateValue !== toDateInputValue(project.data?.reportDate);
  const languageOptions = [
    {
      value: "zh-CN",
      label: dictionary.projects.languages["zh-CN"],
    },
    {
      value: "en-US",
      label: dictionary.projects.languages["en-US"],
    },
  ];
  const frameworkTemplateOptions =
    frameworkTemplates.data?.map((template) => ({
      value: template.id,
      label: `${template.code} - ${template.name}`,
    })) ?? [];

  useEffect(() => {
    if (!project.data) {
      return;
    }
    form.reset({
      name: project.data.name ?? "",
      projectCode: project.data.projectCode ?? "",
      frameworkTemplateId: project.data.frameworkTemplateId ?? "",
      yearEndDate: toDateInputValue(project.data.yearEndDate),
      reportDate: toDateInputValue(project.data.reportDate),
      archiveDeadline:
        addDaysIsoDate(
          toDateInputValue(project.data.reportDate),
          DEFAULT_ARCHIVE_DEADLINE_DAYS
        ) ?? toDateInputValue(project.data.archiveDeadline),
      archivePassword: project.data.archivePassword ?? "",
    });
  }, [form, project.data]);

  const startArchiveReview = useCallback(() => {
    setProjectActionLabel(archiveProjectLabel);
    if (archiveJobVisible) {
      setArchiveCheckDialogOpen(true);
      return;
    }
    setArchiveCheckReport(null);
    setArchiveCheckJobId(null);
    setArchiveCheckJobSnapshot(null);
    setArchiveCheckDialogOpen(true);
    resetArchiveCheck();
    mutateArchiveCheck();
  }, [
    archiveJobVisible,
    archiveProjectLabel,
    mutateArchiveCheck,
    resetArchiveCheck,
  ]);

  useEffect(() => {
    if (!archiveReviewRequestKey) {
      return;
    }
    if (handledArchiveReviewRequestKey.current === archiveReviewRequestKey) {
      return;
    }
    handledArchiveReviewRequestKey.current = archiveReviewRequestKey;
    if (archiveJobVisible) {
      setArchiveCheckDialogOpen(true);
      return;
    }
    if (!canRunArchiveWorkflow || archivePending || archiveCheckRunning) {
      return;
    }
    startArchiveReview();
  }, [
    archiveCheckRunning,
    archiveJobVisible,
    archivePending,
    archiveReviewRequestKey,
    canRunArchiveWorkflow,
    startArchiveReview,
  ]);

  return (
    <div
      className={cn("grid gap-5", section === "archive" && archiveStyles.page)}
      data-testid={
        section === "archive" ? "project-archive-settings" : undefined
      }
    >
      <section className="grid gap-4">
        {project.isLoading ? (
          <div
            className="space-y-4 p-4"
            aria-busy="true"
            aria-label={copy.project.loading}
          >
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : null}
        {!project.isLoading && !project.error && section === "general" ? (
          <form
            className="@container/settings-general grid gap-4"
            onSubmit={form.handleSubmit((values) =>
              updateProject.mutate(values)
            )}
          >
            <FieldGroup className="mx-auto w-full max-w-2xl gap-0">
              <Field
                orientation="horizontal"
                className={GENERAL_SETTINGS_ROW_CLASS}
              >
                <FieldLabel
                  htmlFor="settings-project-name"
                  className={SETTINGS_FORM_LABEL_CLASS}
                >
                  {dictionary.projects.name}
                </FieldLabel>
                <FieldContent className={SETTINGS_CONTROL_COLUMN_CLASS}>
                  <InputGroup className={SETTINGS_CONTROL_CLASS}>
                    <InputGroupInput
                      id="settings-project-name"
                      className={cn(isProjectNameDirty && "pr-14")}
                      disabled={!canEditProject || updateProject.isPending}
                      {...form.register("name", { required: true })}
                    />
                    {isProjectNameDirty ? (
                      <InputGroupAddon
                        align="inline-end"
                        className="absolute inset-y-0 right-0 gap-0"
                      >
                        <ButtonGroup className="gap-0.5">
                          <InputGroupButton
                            type="submit"
                            size="icon-xs"
                            className={SETTINGS_CONFIRM_BUTTON_CLASS}
                            tooltip={dictionary.common.confirm}
                            disabled={
                              !canEditProject || updateProject.isPending
                            }
                          >
                            <Check />
                          </InputGroupButton>
                          <InputGroupButton
                            type="button"
                            size="icon-xs"
                            className={SETTINGS_CANCEL_BUTTON_CLASS}
                            tooltip={dictionary.common.cancel}
                            disabled={
                              !canEditProject || updateProject.isPending
                            }
                            onClick={() =>
                              form.resetField("name", {
                                defaultValue: project.data?.name ?? "",
                              })
                            }
                          >
                            <X />
                          </InputGroupButton>
                        </ButtonGroup>
                      </InputGroupAddon>
                    ) : null}
                  </InputGroup>
                  <FieldError errors={[form.formState.errors.name]} />
                </FieldContent>
              </Field>
              <Field
                orientation="horizontal"
                className={GENERAL_SETTINGS_ROW_CLASS}
              >
                <FieldLabel
                  htmlFor="settings-project-code"
                  className={SETTINGS_FORM_LABEL_CLASS}
                >
                  {dictionary.projects.projectCode}
                </FieldLabel>
                <FieldContent className={SETTINGS_CONTROL_COLUMN_CLASS}>
                  <InputGroup className={SETTINGS_CONTROL_CLASS}>
                    <InputGroupInput
                      id="settings-project-code"
                      className={cn(isProjectCodeDirty && "pr-14")}
                      disabled={!canEditProject || updateProject.isPending}
                      {...form.register("projectCode", { required: true })}
                    />
                    {isProjectCodeDirty ? (
                      <InputGroupAddon
                        align="inline-end"
                        className="absolute inset-y-0 right-0 gap-0"
                      >
                        <ButtonGroup className="gap-0.5">
                          <InputGroupButton
                            type="submit"
                            size="icon-xs"
                            className={SETTINGS_CONFIRM_BUTTON_CLASS}
                            tooltip={dictionary.common.confirm}
                            disabled={
                              !canEditProject || updateProject.isPending
                            }
                          >
                            <Check />
                          </InputGroupButton>
                          <InputGroupButton
                            type="button"
                            size="icon-xs"
                            className={SETTINGS_CANCEL_BUTTON_CLASS}
                            tooltip={dictionary.common.cancel}
                            disabled={
                              !canEditProject || updateProject.isPending
                            }
                            onClick={() =>
                              form.resetField("projectCode", {
                                defaultValue: project.data?.projectCode ?? "",
                              })
                            }
                          >
                            <X />
                          </InputGroupButton>
                        </ButtonGroup>
                      </InputGroupAddon>
                    ) : null}
                  </InputGroup>
                  <FieldError errors={[form.formState.errors.projectCode]} />
                </FieldContent>
              </Field>
              <Field
                orientation="horizontal"
                className={GENERAL_SETTINGS_ROW_CLASS}
              >
                <FieldTitle
                  id="settings-project-language-label"
                  className={SETTINGS_FORM_LABEL_CLASS}
                >
                  {dictionary.projects.language}
                </FieldTitle>
                <FieldContent className={SETTINGS_CONTROL_COLUMN_CLASS}>
                  <div
                    id="settings-project-language"
                    aria-labelledby="settings-project-language-label"
                    className="min-w-0 py-1 text-sm leading-6 text-muted-foreground"
                  >
                    {languageOptions.find((o) => o.value === languageValue)
                      ?.label ?? languageValue}
                  </div>
                </FieldContent>
              </Field>
              <Field
                orientation="horizontal"
                className={GENERAL_SETTINGS_ROW_CLASS}
              >
                <FieldTitle
                  id="settings-project-framework-label"
                  className={SETTINGS_FORM_LABEL_CLASS}
                >
                  {dictionary.projects.frameworkTemplate}
                </FieldTitle>
                <FieldContent className={SETTINGS_CONTROL_COLUMN_CLASS}>
                  <div
                    id="settings-project-framework"
                    aria-labelledby="settings-project-framework-label"
                    className="min-w-0 py-1 text-sm leading-6 break-words text-muted-foreground"
                  >
                    {frameworkTemplateOptions.find(
                      (option) => option.value === frameworkTemplateIdValue
                    )?.label ??
                      project.data?.frameworkTemplate?.name ??
                      frameworkTemplateIdValue ??
                      "-"}
                  </div>
                  <FieldError
                    errors={[form.formState.errors.frameworkTemplateId]}
                  />
                </FieldContent>
              </Field>
              <Field
                orientation="horizontal"
                className={GENERAL_SETTINGS_ROW_CLASS}
              >
                <FieldLabel
                  htmlFor="settings-project-year-end-date"
                  className={SETTINGS_FORM_LABEL_CLASS}
                >
                  {dictionary.projects.yearEndDate}
                </FieldLabel>
                <FieldContent className={SETTINGS_CONTROL_COLUMN_CLASS}>
                  {renderCalendarDateControl({
                    id: "settings-project-year-end-date",
                    value: yearEndDateValue,
                    onChange: (value) =>
                      form.setValue("yearEndDate", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      }),
                    locale,
                    placeholder: dictionary.projects.yearEndDate,
                    todayLabel: calendarTodayLabel,
                    disabled: !canEditProject || updateProject.isPending,
                    className: SETTINGS_CONTROL_CLASS,
                    isDirty: isYearEndDateDirty,
                    confirmLabel: dictionary.common.confirm,
                    cancelLabel: dictionary.common.cancel,
                    onCancel: () =>
                      form.setValue(
                        "yearEndDate",
                        toDateInputValue(project.data?.yearEndDate),
                        {
                          shouldValidate: true,
                        }
                      ),
                    open: openCalendarField === "yearEndDate",
                    setOpen: (open) =>
                      setOpenCalendarField(open ? "yearEndDate" : null),
                  })}
                  <FieldError errors={[form.formState.errors.yearEndDate]} />
                </FieldContent>
              </Field>
              <Field
                orientation="horizontal"
                className={GENERAL_SETTINGS_ROW_CLASS}
              >
                <FieldLabel
                  htmlFor="settings-project-report-date"
                  className={SETTINGS_FORM_LABEL_CLASS}
                >
                  {dictionary.projects.reportDate}
                </FieldLabel>
                <FieldContent className={SETTINGS_CONTROL_COLUMN_CLASS}>
                  {renderCalendarDateControl({
                    id: "settings-project-report-date",
                    value: reportDateValue,
                    onChange: (value) => {
                      form.setValue("reportDate", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      const archiveDeadline = addDaysIsoDate(
                        value,
                        DEFAULT_ARCHIVE_DEADLINE_DAYS
                      );
                      if (archiveDeadline) {
                        form.setValue("archiveDeadline", archiveDeadline, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    },
                    locale,
                    placeholder: dictionary.projects.reportDate,
                    todayLabel: calendarTodayLabel,
                    disabled: !canEditProject || updateProject.isPending,
                    className: SETTINGS_CONTROL_CLASS,
                    isDirty: isReportDateDirty,
                    confirmLabel: dictionary.common.confirm,
                    cancelLabel: dictionary.common.cancel,
                    onCancel: () => {
                      const reportDate = toDateInputValue(
                        project.data?.reportDate
                      );
                      form.setValue("reportDate", reportDate, {
                        shouldValidate: true,
                      });
                      form.setValue(
                        "archiveDeadline",
                        addDaysIsoDate(
                          reportDate,
                          DEFAULT_ARCHIVE_DEADLINE_DAYS
                        ) ?? toDateInputValue(project.data?.archiveDeadline)
                      );
                    },
                    open: openCalendarField === "reportDate",
                    setOpen: (open) =>
                      setOpenCalendarField(open ? "reportDate" : null),
                  })}
                  <FieldError errors={[form.formState.errors.reportDate]} />
                </FieldContent>
              </Field>
            </FieldGroup>

            {canEditProject ? null : (
              <div className="rounded-xl border border-dashed border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                {copy.project.readOnly}
              </div>
            )}
          </form>
        ) : null}

        {!project.isLoading && !project.error && section === "archive" ? (
          <>
            <div
              className={cn(
                "grid h-[calc(80dvh-6rem)] min-h-0 grid-rows-[minmax(0,1fr)] gap-5",
                archiveStyles.layout
              )}
            >
              <div
                className={cn(
                  "grid h-full min-h-0 gap-6 lg:grid-cols-[20rem_auto_minmax(0,1fr)]",
                  archiveStyles.columns
                )}
              >
                <form
                  className={cn("grid content-start gap-5", archiveStyles.form)}
                  onSubmit={form.handleSubmit((values) =>
                    updateProject.mutate(values)
                  )}
                >
                  <FieldGroup
                    className={cn("grid max-w-xs gap-5", archiveStyles.fields)}
                  >
                    {phone ? (
                      <dl className={archiveStyles.deadline}>
                        <dt id="archive-deadline-label">
                          {dictionary.projects.archiveDeadline}
                        </dt>
                        <dd aria-labelledby="archive-deadline-label">
                          <CalendarDays aria-hidden />
                          <time dateTime={archiveDeadlineValue}>
                            {parsedArchiveDeadline
                              ? formatCalendarDate(
                                  parsedArchiveDeadline,
                                  locale
                                )
                              : dictionary.workbench.archiveCheck.emptyValue}
                          </time>
                        </dd>
                        <dd className={archiveStyles.hint}>
                          {archiveMobileCopy.deadlineHint}
                        </dd>
                      </dl>
                    ) : (
                      <Field className={SETTINGS_FIELD_CLASS}>
                        <FieldLabel
                          htmlFor="settings-project-archive-deadline"
                          className={SETTINGS_LABEL_CLASS}
                        >
                          {dictionary.projects.archiveDeadline}
                        </FieldLabel>
                        {renderCalendarDateControl({
                          id: "settings-project-archive-deadline",
                          value: archiveDeadlineValue,
                          onChange: () => {},
                          locale,
                          placeholder: dictionary.projects.archiveDeadline,
                          todayLabel: calendarTodayLabel,
                          disabled: true,
                          className: SETTINGS_CONTROL_CLASS,
                          open: openCalendarField === "archiveDeadline",
                          setOpen: (open) =>
                            setOpenCalendarField(
                              open ? "archiveDeadline" : null
                            ),
                        })}
                        <FieldError
                          errors={[form.formState.errors.archiveDeadline]}
                        />
                      </Field>
                    )}

                    <Field className={SETTINGS_FIELD_CLASS}>
                      <FieldLabel
                        htmlFor="settings-project-archive-password"
                        className={SETTINGS_LABEL_CLASS}
                      >
                        {copy.project.archivePassword}
                      </FieldLabel>
                      <InputGroup className={SETTINGS_CONTROL_CLASS}>
                        <InputGroupInput
                          id="settings-project-archive-password"
                          type={archivePasswordVisible ? "text" : "password"}
                          placeholder={copy.project.archivePasswordPlaceholder}
                          disabled={!canEditProject || updateProject.isPending}
                          {...form.register("archivePassword")}
                        />
                        <InputGroupAddon align="inline-end" className="gap-0">
                          <ButtonGroup className="gap-0.5">
                            <InputGroupButton
                              type="button"
                              size="icon-sm"
                              tooltip={
                                archivePasswordVisible
                                  ? copy.project.hideArchivePassword
                                  : copy.project.showArchivePassword
                              }
                              disabled={
                                !canEditProject || updateProject.isPending
                              }
                              onClick={() =>
                                setArchivePasswordVisible((visible) => !visible)
                              }
                            >
                              {archivePasswordVisible ? <EyeOff /> : <Eye />}
                            </InputGroupButton>
                          </ButtonGroup>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  </FieldGroup>

                  {canEditProject ? null : (
                    <div className="rounded-xl border border-dashed border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                      {copy.project.readOnly}
                    </div>
                  )}

                  {!phone && (
                    <div className="flex justify-start pt-1">
                      <Button
                        type="button"
                        disabled={
                          !canRunArchiveWorkflow ||
                          (!archiveJobVisible &&
                            (archivePending || archiveCheckRunning))
                        }
                        onClick={startArchiveReview}
                      >
                        <FileCheck2 data-icon="inline-start" />
                        {archiveJobRunning
                          ? archivingProjectLabel
                          : archiveCheckRunning
                            ? checkingFilesLabel
                            : archiveProjectLabel}
                      </Button>
                    </div>
                  )}
                </form>

                <Separator
                  orientation="vertical"
                  className="hidden w-px self-stretch bg-border/60 lg:block"
                />

                <section
                  className={cn(
                    "flex h-full min-h-0 min-w-0 flex-col gap-4",
                    archiveStyles.checks
                  )}
                >
                  {archiveCheckDialogOpen ? (
                    <ArchiveCheckPanel
                      job={archiveCheckJobSnapshot}
                      locale={locale}
                      checkFailed={Boolean(
                        archiveCheckStart.error ||
                        archiveCheckJobQuery.error ||
                        archiveCheckJobSnapshot?.status === "failed"
                      )}
                      onRetry={startArchiveReview}
                      retryDisabled={
                        !canRunArchiveWorkflow ||
                        archivePending ||
                        archiveCheckRunning
                      }
                      report={archiveCheckReport}
                      project={project.data ?? null}
                      copy={dictionary.workbench.archiveCheck}
                      projectCopy={dictionary.projects}
                      archivePending={archivePending}
                      archiveJob={archiveJob ?? null}
                      archiveProjectLabel={projectActionLabel}
                      archivingProjectLabel={archivingProjectLabel}
                      reopenProjectLabel={dictionary.projects.reopenProject}
                      onClose={() => setArchiveCheckDialogOpen(false)}
                      onLocateWorkingPaper={onLocateWorkingPaper}
                      onOpenArchiveCheckNavigator={onOpenArchiveCheckNavigator}
                      onArchiveProject={onArchiveProject}
                      onReopenProject={
                        isFinalArchiveReview ? onReopenProject : undefined
                      }
                    />
                  ) : phone ? (
                    <div className={archiveStyles.idle}>
                      <FileCheck2 aria-hidden />
                      <div>
                        <h3>{dictionary.workbench.archiveCheck.title}</h3>
                        <p>
                          {archiveCheckRunning
                            ? dictionary.workbench.archiveCheck.checking
                            : archiveMobileCopy.idleHint}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">
                          {dictionary.workbench.archiveCheck.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dictionary.workbench.archiveCheck.checking}
                        </p>
                      </div>
                    </div>
                  )}
                  {phone && !archiveCheckDialogOpen && (
                    <MobileButton
                      type="button"
                      variant="primary"
                      className={archiveStyles.start}
                      disabled={
                        !canRunArchiveWorkflow ||
                        (!archiveJobVisible &&
                          (archivePending || archiveCheckRunning))
                      }
                      onClick={startArchiveReview}
                    >
                      <FileCheck2 aria-hidden />
                      {archiveJobVisible
                        ? archiveMobileCopy.viewProgress
                        : archiveCheckRunning
                          ? checkingFilesLabel
                          : archiveProjectLabel}
                    </MobileButton>
                  )}
                  <div className="flex shrink-0 flex-wrap justify-start gap-2">
                    {project.data?.status === "ARCHIVED" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={archiveDownload.isPending}
                        onClick={() => archiveDownload.mutate()}
                      >
                        <Download data-icon="inline-start" />
                        {archiveDownload.isPending
                          ? dictionary.workbench.archiveCheck.actions
                              .downloading
                          : dictionary.workbench.archiveCheck.actions
                              .downloadArchive}
                      </Button>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>

            {canDeleteProject ? (
              <section
                className={cn(
                  "border-t border-destructive/25 pt-4",
                  archiveStyles.danger
                )}
              >
                <div className="flex flex-col gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-destructive">
                      {copy.project.dangerZone}
                    </h3>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {copy.project.dangerZoneDescription}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={
                      !canDeleteProject ||
                      archivePending ||
                      archiveCheckRunning ||
                      deleteProject.isPending
                    }
                    onClick={() => setDeleteProjectDialogOpen(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    {deleteProject.isPending
                      ? deletingProjectLabel
                      : deleteProjectLabel}
                  </Button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </section>
      <Dialog
        open={deleteProjectDialogOpen}
        onOpenChange={setDeleteProjectDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteProjectLabel}</DialogTitle>
            <DialogDescription>
              {copy.project.deleteProjectDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteProjectDialogOpen(false)}
              >
                {dictionary.common.cancel}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canDeleteProject || deleteProject.isPending}
                onClick={() => deleteProject.mutate()}
              >
                <Trash2 data-icon="inline-start" />
                {deleteProject.isPending
                  ? deletingProjectLabel
                  : deleteProjectLabel}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArchiveCheckPanel({
  job,
  locale,
  checkFailed,
  onRetry,
  retryDisabled,
  report,
  project,
  copy,
  projectCopy,
  archivePending,
  archiveJob,
  archiveProjectLabel,
  archivingProjectLabel,
  reopenProjectLabel,
  onClose,
  onLocateWorkingPaper,
  onOpenArchiveCheckNavigator,
  onArchiveProject,
  onReopenProject,
}: {
  job: ArchiveCheckJobSnapshot | null;
  locale: string;
  checkFailed: boolean;
  onRetry: () => void;
  retryDisabled: boolean;
  report: ArchiveCheckReport | null;
  project: Project | null;
  copy: ArchiveCheckCopy;
  projectCopy: Dictionary["projects"];
  archivePending: boolean;
  archiveJob?: ArchiveJobSnapshot | null;
  archiveProjectLabel: string;
  archivingProjectLabel: string;
  reopenProjectLabel?: string;
  onClose: () => void;
  onLocateWorkingPaper?: LocateWorkingPaperHandler;
  onOpenArchiveCheckNavigator?: OpenArchiveCheckNavigatorHandler;
  onArchiveProject: () => void;
  onReopenProject?: () => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const phone = useCompactViewport(767.98);
  const mobileCopy = getArchiveMobileCopy(locale);
  const [mobileGroupId, setMobileGroupId] =
    useState<ArchiveCheckGroupId | null>(null);
  const archiveJobActive = Boolean(archiveJob);
  const groups = report ? buildArchiveCheckGroups(report, copy) : [];
  const initialGroup =
    groups.find((group) => group.status !== "passed")?.id ??
    groups[0]?.id ??
    "signoffs";
  const mobileGroup =
    groups.find((group) => group.id === mobileGroupId) ??
    groups.find((group) => group.id === initialGroup);
  const exportCheck = useMutation({
    mutationFn: () =>
      report
        ? api.exportArchiveCheck(report.project.id)
        : Promise.reject(new Error(copy.checking)),
    onSuccess: (blob) => {
      if (!report) {
        return;
      }
      downloadBlob(
        blob,
        `${sanitizeFileName(report.project.projectCode)}-file-check.pdf`
      );
    },
  });

  useEffect(() => {
    setConfirmArchive(false);
    setMobileGroupId(null);
  }, [report?.generatedAt]);

  return (
    <section
      aria-labelledby="archive-check-title"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4",
        archiveStyles.checkPanel
      )}
    >
      <div className="shrink-0">
        <h3
          id="archive-check-title"
          className="text-sm font-medium text-foreground"
        >
          {copy.title}
        </h3>
        {report || (phone && checkFailed) ? null : (
          <p className="mt-1 text-sm text-muted-foreground">
            {job?.currentLabel
              ? formatCopy(copy.progress.current, {
                  label: job.currentLabel,
                })
              : copy.checking}
          </p>
        )}
      </div>

      {phone && checkFailed && !archiveJobActive ? (
        <div role="alert" className={archiveStyles.error}>
          <strong>{mobileCopy.failed}</strong>
          <p>{mobileCopy.retryHint}</p>
          <MobileButton
            variant="outline"
            onClick={onRetry}
            disabled={retryDisabled}
          >
            {mobileCopy.retry}
          </MobileButton>
        </div>
      ) : archiveJobActive ? (
        <ArchiveJobProgress copy={copy} job={archiveJob} />
      ) : report && confirmArchive ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto",
            archiveStyles.report
          )}
        >
          <div className="rounded-md border border-primary/25 bg-primary/5 px-4 py-4">
            <div className="text-sm font-medium text-foreground">
              {copy.confirmArchiveTitle}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {copy.confirmArchiveDescription}
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <ArchiveConfirmItem
              label={projectCopy.name}
              value={project?.name ?? report.project.name}
            />
            <ArchiveConfirmItem
              label={projectCopy.projectCode}
              value={project?.projectCode ?? report.project.projectCode}
            />
            <ArchiveConfirmItem
              label={projectCopy.reportDate}
              value={
                project?.reportDate
                  ? formatArchiveCheckDate(project.reportDate)
                  : copy.emptyValue
              }
            />
            <ArchiveConfirmItem
              label={projectCopy.archiveDeadline}
              value={
                project?.archiveDeadline
                  ? formatArchiveCheckDate(project.archiveDeadline)
                  : copy.emptyValue
              }
            />
            <ArchiveConfirmItem
              label={copy.metrics.workpapers}
              value={String(report.summary.attachments)}
            />
            <ArchiveConfirmItem
              label={copy.metrics.blockers}
              value={String(report.summary.blockers)}
            />
            <ArchiveConfirmItem
              label={copy.metrics.warnings}
              value={String(report.summary.warnings)}
            />
            <ArchiveConfirmItem
              label={copy.archivePackage}
              value={copy.confirmArchiveDescription}
            />
          </div>
        </div>
      ) : report ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto",
            archiveStyles.report
          )}
        >
          <div
            className={cn("grid gap-2 sm:grid-cols-4", archiveStyles.metrics)}
          >
            <ArchiveCheckMetric
              label={copy.metrics.workpapers}
              value={report.summary.attachments}
            />
            <ArchiveCheckMetric
              label={copy.metrics.blockers}
              value={report.summary.blockers}
              tone={report.summary.blockers ? "destructive" : "default"}
            />
            <ArchiveCheckMetric
              label={copy.metrics.warnings}
              value={report.summary.warnings}
              tone={report.summary.warnings ? "warning" : "default"}
            />
            <ArchiveCheckMetric
              label={copy.metrics.lockedFiles}
              value={report.summary.lockedAttachments}
              tone={
                report.summary.lockedAttachments ? "destructive" : "default"
              }
            />
          </div>

          <ArchiveCheckProgress
            copy={copy}
            progress={job?.progress}
            fallbackCompleted={ARCHIVE_CHECK_GROUPS.length}
            fallbackTotal={ARCHIVE_CHECK_GROUPS.length}
          />

          {phone && mobileGroup ? (
            <div className={archiveStyles.groups}>
              <ViewSwitcher
                label={mobileCopy.group}
                value={mobileGroup.id}
                mobilePresentation="sheet"
                options={groups.map((group) => ({
                  value: group.id,
                  label: `${group.title} · ${copy.groupStatusLabels[group.status]}`,
                  count: group.issues.length,
                }))}
                onValueChange={(value) =>
                  setMobileGroupId(value as ArchiveCheckGroupId)
                }
              />
              <ArchiveCheckGroupSection
                group={mobileGroup}
                copy={copy}
                onNavigateIssue={
                  onLocateWorkingPaper
                    ? (issue, paperId, attachmentId) => {
                        onOpenArchiveCheckNavigator?.({
                          report,
                          activeIssueKey: issue.rowKey,
                        });
                        onLocateWorkingPaper(paperId, attachmentId);
                        onClose();
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <Tabs
              defaultValue={initialGroup}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList
                variant="line"
                className="flex min-h-10 w-full max-w-full flex-wrap content-start items-center justify-start gap-1 overflow-visible rounded-md border border-border/80 bg-card p-1 shadow-sm shadow-foreground/5 group-data-[orientation=horizontal]/tabs:h-auto"
              >
                {groups.map((group) => (
                  <TabsTrigger
                    key={group.id}
                    value={group.id}
                    className="h-8 flex-none rounded-md px-2.5 text-xs data-active:bg-background group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
                  >
                    {group.title}
                    <Badge
                      className={cn(
                        "ml-1 h-5 px-1.5 text-[10px]",
                        group.status === "warnings" &&
                          ARCHIVE_WARNING_BADGE_CLASSNAME
                      )}
                      variant={
                        group.status === "blockers"
                          ? "destructive"
                          : group.status === "warnings"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {group.issues.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              {groups.map((group) => (
                <TabsContent
                  key={group.id}
                  value={group.id}
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  <ArchiveCheckGroupSection
                    group={group}
                    copy={copy}
                    onNavigateIssue={
                      onLocateWorkingPaper
                        ? (issue, paperId, attachmentId) => {
                            onOpenArchiveCheckNavigator?.({
                              report,
                              activeIssueKey: issue.rowKey,
                            });
                            onLocateWorkingPaper(paperId, attachmentId);
                            onClose();
                          }
                        : undefined
                    }
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}

          {report.ready ? (
            <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-3 text-sm text-foreground">
              <div className="font-medium">{copy.confirmArchiveTitle}</div>
              <div className="mt-1 text-muted-foreground">
                {copy.confirmArchiveDescription}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <ArchiveCheckProgress
            copy={copy}
            currentLabel={job?.currentLabel}
            progress={job?.progress}
          />
        </div>
      )}

      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-2",
          archiveStyles.checkActions
        )}
      >
        {report ? (
          <Button
            type="button"
            variant="outline"
            disabled={exportCheck.isPending}
            onClick={() => exportCheck.mutate()}
          >
            {exportCheck.isPending
              ? copy.actions.downloading
              : copy.actions.exportWord}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onClose}>
          {copy.close}
        </Button>
        {report && !report.ready && onReopenProject ? (
          <Button
            type="button"
            variant="outline"
            disabled={archivePending}
            onClick={() => {
              onClose();
              onReopenProject();
            }}
          >
            {reopenProjectLabel ?? projectCopy.reopenProject}
          </Button>
        ) : null}
        {report?.ready && !archiveJobActive ? (
          <Button
            type="button"
            disabled={archivePending}
            onClick={() => {
              if (!confirmArchive) {
                setConfirmArchive(true);
                return;
              }
              onArchiveProject();
            }}
          >
            {archivePending ? archivingProjectLabel : archiveProjectLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

type ArchiveCheckIssue = ArchiveCheckReport["issues"][number];
type ArchiveCheckGroupId =
  | "signoffs"
  | "reviewQuestions"
  | "workpaperFiles"
  | "smartForms"
  | "officeFiles"
  | "excelHints";
type ArchiveCheckGroupStatus = "passed" | "blockers" | "warnings";
type ArchiveCheckIssueType = ArchiveCheckIssue["type"];
const ARCHIVE_WARNING_BADGE_CLASSNAME =
  "border-warning/35 bg-warning/10 text-warning";
type ArchiveCheckIssueRollup = {
  rowKey: string;
  targetKey: string;
  actionIssue?: ArchiveCheckIssue;
  fileNames: string[];
  issueTypes: ArchiveCheckIssueType[];
  issues: ArchiveCheckIssue[];
  severity: ArchiveCheckIssue["severity"];
  workingPaper?: ArchiveCheckIssue["workingPaper"];
};
type ArchiveCheckGroup = {
  id: ArchiveCheckGroupId;
  title: string;
  status: ArchiveCheckGroupStatus;
  issues: ArchiveCheckIssueRollup[];
};

const ARCHIVE_CHECK_GROUPS: {
  id: ArchiveCheckGroupId;
  issueTypes: ArchiveCheckIssueType[];
}[] = [
  {
    id: "signoffs",
    issueTypes: [
      "MISSING_PREPARER_SIGNOFF",
      "MISSING_REVIEWER_SIGNOFF",
      "REVIEW_SIGNOFF_BEFORE_PREPARER",
      "SELF_REVIEWED_WORKING_PAPER",
    ],
  },
  { id: "reviewQuestions", issueTypes: ["OPEN_REVIEW_QUESTION"] },
  {
    id: "workpaperFiles",
    issueTypes: ["LOCKED_ATTACHMENT"],
  },
  { id: "smartForms", issueTypes: ["SMART_FORM_INCOMPLETE"] },
  {
    id: "officeFiles",
    issueTypes: [
      "DOCX_TRACK_CHANGES",
      "DOCX_UNRESOLVED_COMMENT",
      "XLSX_UNRESOLVED_COMMENT",
      "OFFICE_FILE_CHECK_FAILED",
    ],
  },
  { id: "excelHints", issueTypes: ["XLSX_ERROR_VALUE"] },
];

type ArchiveCheckNavigatorFilter = "all" | "blockers" | "warnings";

export function ArchiveCheckNavigator({
  snapshot,
  minimized,
  onMinimizedChange,
  onClose,
  onSelectIssue,
  onLocateWorkingPaper,
  onDragPointerDown,
}: {
  snapshot: ArchiveCheckNavigatorSnapshot;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  onClose: () => void;
  onSelectIssue: (issueKey: string) => void;
  onLocateWorkingPaper: LocateWorkingPaperHandler;
  onDragPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { dictionary } = useI18n();
  const copy = dictionary.workbench.archiveCheck;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArchiveCheckNavigatorFilter>("all");
  const issueListRef = useRef<HTMLDivElement | null>(null);
  const groups = useMemo(
    () => buildArchiveCheckGroups(snapshot.report, copy),
    [copy, snapshot.report]
  );
  const issues = useMemo(
    () =>
      groups.flatMap((group) =>
        group.issues.map((issue) => ({
          groupTitle: group.title,
          issue,
        }))
      ),
    [groups]
  );
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const visibleIssues = useMemo(
    () =>
      issues.filter(({ groupTitle, issue }) => {
        if (filter === "blockers" && issue.severity !== "BLOCKER") {
          return false;
        }
        if (filter === "warnings" && issue.severity !== "WARNING") {
          return false;
        }
        if (!deferredQuery) {
          return true;
        }
        const searchable = [
          groupTitle,
          formatArchiveRollupIssueTypes(issue, copy),
          formatArchiveRollupFiles(issue, copy),
          formatArchiveRollupLocation(issue, copy),
          formatArchiveRollupDetail(issue, copy),
          issue.workingPaper?.code,
          issue.workingPaper?.title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return searchable.includes(deferredQuery);
      }),
    [copy, deferredQuery, filter, issues]
  );
  const activeIndex = visibleIssues.findIndex(
    ({ issue }) => issue.rowKey === snapshot.activeIssueKey
  );
  const resolvedActiveIndex =
    activeIndex === -1 && visibleIssues.length ? 0 : activeIndex;
  const selectedRowKey =
    visibleIssues[resolvedActiveIndex]?.issue.rowKey ?? undefined;
  const fallbackRowKey =
    activeIndex === -1 ? visibleIssues[0]?.issue.rowKey : undefined;

  useEffect(() => {
    if (!fallbackRowKey) {
      return;
    }
    onSelectIssue(fallbackRowKey);
  }, [fallbackRowKey, onSelectIssue]);

  useEffect(() => {
    if (minimized) {
      return;
    }
    const currentIssue = issueListRef.current?.querySelector<HTMLElement>(
      '[data-current="true"]'
    );
    currentIssue?.scrollIntoView?.({ block: "nearest" });
  }, [minimized, selectedRowKey]);

  function locateIssue(issue: ArchiveCheckIssueRollup) {
    const target = resolveArchiveIssueTarget(issue);
    if (!target) {
      return;
    }
    onSelectIssue(issue.rowKey);
    onLocateWorkingPaper(target.paperId, target.attachmentId);
  }

  function moveSelection(offset: -1 | 1) {
    if (visibleIssues.length === 0) {
      return;
    }
    const nextIndex =
      resolvedActiveIndex < 0
        ? offset > 0
          ? 0
          : visibleIssues.length - 1
        : Math.min(
            visibleIssues.length - 1,
            Math.max(0, resolvedActiveIndex + offset)
          );
    locateIssue(visibleIssues[nextIndex].issue);
  }

  if (minimized) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full bg-background/95 px-3 shadow-md backdrop-blur"
        aria-label={copy.navigator.restore}
        onClick={() => onMinimizedChange(false)}
      >
        <FileCheck2 data-icon="inline-start" />
        {copy.navigator.title}
        <Badge variant="secondary">{issues.length}</Badge>
      </Button>
    );
  }

  return (
    <Card className="flex max-h-[min(68dvh,42rem)] w-[min(29rem,calc(100vw-2rem))] flex-col overflow-hidden border-border/80 bg-background/97 shadow-xl shadow-foreground/15 backdrop-blur">
      <div
        data-archive-check-drag-handle=""
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2.5",
          onDragPointerDown &&
            "cursor-grab touch-none select-none active:cursor-grabbing"
        )}
        onPointerDown={onDragPointerDown}
      >
        <FileCheck2 className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {copy.navigator.title}
            </h3>
            <Badge variant="secondary">{issues.length}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {snapshot.report.project.projectCode} ·{" "}
            {snapshot.report.project.name}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={copy.navigator.minimize}
          title={copy.navigator.minimize}
          onClick={() => onMinimizedChange(true)}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={copy.navigator.close}
          title={copy.navigator.close}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="grid shrink-0 gap-2 border-b border-border/70 px-3 py-2.5">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            aria-label={copy.navigator.searchPlaceholder}
            placeholder={copy.navigator.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={copy.navigator.clearSearch}
                title={copy.navigator.clearSearch}
                onClick={() => setQuery("")}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <div className="grid grid-cols-3 rounded-md bg-muted/55 p-1">
          {(["all", "blockers", "warnings"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "outline" : "ghost"}
              className={cn(
                "h-8 min-w-0 px-2",
                filter === value && "bg-background shadow-sm",
                value === "warnings" && "text-warning"
              )}
              onClick={() => setFilter(value)}
            >
              {copy.navigator[value]}
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  value === "warnings" && "text-warning"
                )}
              >
                {value === "all"
                  ? issues.length
                  : issues.filter(({ issue }) =>
                      value === "blockers"
                        ? issue.severity === "BLOCKER"
                        : issue.severity === "WARNING"
                    ).length}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div ref={issueListRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {visibleIssues.length > 0 ? (
          <div className="grid gap-1.5">
            {visibleIssues.map(({ groupTitle, issue }) => {
              const current = issue.rowKey === selectedRowKey;
              const target = resolveArchiveIssueTarget(issue);
              return (
                <Button
                  key={issue.rowKey}
                  type="button"
                  variant="ghost"
                  data-current={current ? "true" : undefined}
                  disabled={!target}
                  className={cn(
                    "grid h-auto w-full justify-stretch gap-1 rounded-md border border-transparent px-3 py-2.5 text-left whitespace-normal transition-colors hover:border-border hover:bg-muted/45 disabled:cursor-default disabled:opacity-60",
                    current && "border-primary/35 bg-primary/8"
                  )}
                  onClick={() => locateIssue(issue)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge
                      className={
                        issue.severity === "WARNING"
                          ? ARCHIVE_WARNING_BADGE_CLASSNAME
                          : undefined
                      }
                      variant={
                        issue.severity === "BLOCKER" ? "destructive" : "outline"
                      }
                    >
                      {copy.severityLabels[issue.severity]}
                    </Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      {groupTitle}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-sm font-medium text-foreground">
                    {formatArchiveRollupIssueTypes(issue, copy)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatArchiveRollupFiles(issue, copy)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatArchiveRollupLocation(issue, copy)}
                  </span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {copy.navigator.noMatches}
          </div>
        )}
      </div>

      <CardFooter className="flex shrink-0 items-center justify-between gap-2 border-t border-border/70 px-3 py-2.5">
        <span className="text-xs text-muted-foreground">
          {visibleIssues.length > 0
            ? formatCopy(copy.navigator.position, {
                current: resolvedActiveIndex + 1,
                total: visibleIssues.length,
              })
            : copy.navigator.noMatches}
        </span>
        <ButtonGroup>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!visibleIssues.length || resolvedActiveIndex === 0}
            onClick={() => moveSelection(-1)}
          >
            <ChevronLeft data-icon="inline-start" />
            {copy.navigator.previous}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              !visibleIssues.length ||
              resolvedActiveIndex === visibleIssues.length - 1
            }
            onClick={() => moveSelection(1)}
          >
            {copy.navigator.next}
            <ChevronRight data-icon="inline-end" />
          </Button>
        </ButtonGroup>
      </CardFooter>
    </Card>
  );
}

function resolveArchiveIssueTarget(issue: ArchiveCheckIssueRollup) {
  const { actionIssue } = issue;
  const paperId = actionIssue?.action?.workingPaperId;
  if (!paperId) {
    return null;
  }
  return {
    paperId,
    attachmentId:
      actionIssue.action?.attachmentId ??
      actionIssue.location?.attachmentId ??
      actionIssue.attachment?.id,
  };
}

function ArchiveCheckProgress({
  copy,
  currentLabel,
  fallbackCompleted,
  fallbackTotal,
  progress,
}: {
  copy: ArchiveCheckCopy;
  currentLabel?: string;
  fallbackCompleted?: number;
  fallbackTotal?: number;
  progress?: ArchiveCheckJobSnapshot["progress"];
}) {
  const completed = progress?.completedUnits ?? fallbackCompleted ?? null;
  const total = progress?.totalUnits ?? fallbackTotal ?? 0;
  const isDeterminate = completed !== null && total > 0;
  const percentage =
    isDeterminate && total > 0 ? Math.round((completed / total) * 100) : null;
  return (
    <div className="mx-auto w-full max-w-3xl rounded-md border border-border/80 bg-card px-3 py-3 shadow-sm shadow-foreground/5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">
          {copy.progress.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {completed === null || total === 0
            ? copy.checking
            : formatCopy(copy.progress.complete, { completed, total })}
        </span>
      </div>
      <Progress
        value={percentage}
        label={copy.progress.label}
        className="mt-2 h-2"
      >
        <ProgressTrack className="bg-border/50">
          <ProgressIndicator className="bg-primary" />
        </ProgressTrack>
      </Progress>
      {currentLabel ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {formatCopy(copy.progress.current, { label: currentLabel })}
        </div>
      ) : null}
    </div>
  );
}

function ArchiveJobProgress({
  copy,
  job,
}: {
  copy: ArchiveCheckCopy;
  job?: ArchiveJobSnapshot | null;
}) {
  if (!job) {
    return null;
  }
  const phases = ["fileCheck", "packaging", "uploading", "finalizing"] as const;
  const completed = job.progress.completedUnits;
  const total = job.progress.totalUnits;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : null;
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";
  const title = isCompleted
    ? copy.archiveCompleteTitle
    : isFailed
      ? copy.confirmArchiveFailed
      : copy.archiveProgressTitle;
  const description = isCompleted
    ? copy.archiveCompleteDescription
    : isFailed
      ? copy.confirmArchiveFailed
      : copy.archiveProgressDescription;
  const currentIndex = phases.indexOf(job.currentPhase);

  return (
    <div className="grid max-h-[calc(100vh-12rem)] gap-4 overflow-auto">
      <div
        className={cn(
          "rounded-md border border-border/80 bg-card px-4 py-4 shadow-sm shadow-foreground/5",
          isFailed && "border-destructive/30 bg-destructive/5"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {description}
            </div>
          </div>
          <Badge variant={isFailed ? "destructive" : "secondary"}>
            {completed}/{total}
          </Badge>
        </div>
        <Progress
          value={percentage}
          label={copy.archiveProgressTitle}
          className="mt-4 h-2"
        >
          <ProgressTrack className="bg-border/50">
            <ProgressIndicator
              className={isFailed ? "bg-destructive" : "bg-primary"}
            />
          </ProgressTrack>
        </Progress>
      </div>
      <div className="grid gap-2">
        {phases.map((phase, index) => {
          const phaseCompleted = isCompleted || index < currentIndex;
          const phaseCurrent =
            !isCompleted && !isFailed && phase === job.currentPhase;
          return (
            <div
              key={phase}
              className={cn(
                "flex items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2 text-sm",
                phaseCurrent && "border-primary/35 bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full bg-muted-foreground/40",
                  (phaseCompleted || phaseCurrent) && "bg-primary"
                )}
              />
              <span
                className={cn(
                  "text-muted-foreground",
                  (phaseCompleted || phaseCurrent) && "text-foreground"
                )}
              >
                {copy.archiveJobPhases[phase]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchiveCheckGroupSection({
  copy,
  group,
  onNavigateIssue,
}: {
  copy: ArchiveCheckCopy;
  group: ArchiveCheckGroup;
  onNavigateIssue?: (
    issue: ArchiveCheckIssueRollup,
    paperId: string,
    attachmentId?: string
  ) => void;
}) {
  const tone =
    group.status === "blockers"
      ? "destructive"
      : group.status === "warnings"
        ? "outline"
        : "secondary";
  const sectionToneClassName =
    group.status === "blockers"
      ? "border-destructive/30 bg-destructive/5"
      : group.status === "warnings"
        ? "border-warning/30 bg-warning/5"
        : "border-primary/20 bg-primary/5";
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border bg-background shadow-sm shadow-foreground/5",
        sectionToneClassName
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/75 px-3 py-2 backdrop-blur">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                group.status === "blockers"
                  ? "bg-destructive"
                  : group.status === "warnings"
                    ? "bg-warning"
                    : "bg-primary"
              )}
            />
            <h4 className="truncate text-sm font-semibold text-foreground">
              {group.title}
            </h4>
          </div>
        </div>
        <Badge
          className={
            group.status === "warnings"
              ? ARCHIVE_WARNING_BADGE_CLASSNAME
              : undefined
          }
          variant={tone}
        >
          {copy.groupStatusLabels[group.status]}
        </Badge>
      </div>
      {group.issues.length > 0 ? (
        <div className="grid divide-y divide-border">
          {group.issues.map((issue) => (
            <ArchiveIssueCard
              key={issue.rowKey}
              issue={issue}
              copy={copy}
              onNavigateIssue={onNavigateIssue}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-sm text-muted-foreground">
          {copy.noIssues}
        </div>
      )}
    </section>
  );
}

function ArchiveIssueCard({
  copy,
  issue,
  onNavigateIssue,
}: {
  copy: ArchiveCheckCopy;
  issue: ArchiveCheckIssueRollup;
  onNavigateIssue?: (
    issue: ArchiveCheckIssueRollup,
    paperId: string,
    attachmentId?: string
  ) => void;
}) {
  const { actionIssue } = issue;
  const workingPaperId = actionIssue?.action?.workingPaperId;
  const attachmentId =
    actionIssue?.action?.attachmentId ??
    actionIssue?.location?.attachmentId ??
    actionIssue?.attachment?.id;

  return (
    <div className="grid gap-3 bg-background/85 px-3 py-3 text-sm transition-colors hover:bg-background md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              issue.severity === "WARNING"
                ? ARCHIVE_WARNING_BADGE_CLASSNAME
                : undefined
            }
            variant={issue.severity === "BLOCKER" ? "destructive" : "outline"}
          >
            {copy.severityLabels[issue.severity]}
          </Badge>
          <span className="font-medium text-foreground">
            {formatArchiveRollupIssueTypes(issue, copy)}
          </span>
        </div>
        <div className="text-muted-foreground">
          {issue.workingPaper
            ? `${issue.workingPaper.code} ${issue.workingPaper.title}`
            : copy.emptyValue}
        </div>
        <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-3">
          <span className="rounded-md bg-muted/40 px-2 py-1">
            {copy.table.file}:{" "}
            <span>{formatArchiveRollupFiles(issue, copy)}</span>
          </span>
          <span className="rounded-md bg-muted/40 px-2 py-1">
            {copy.table.location}:{" "}
            <span>{formatArchiveRollupLocation(issue, copy)}</span>
          </span>
          <span className="rounded-md bg-muted/40 px-2 py-1">
            {copy.table.detail}:{" "}
            <span>{formatArchiveRollupDetail(issue, copy)}</span>
          </span>
        </div>
      </div>
      <div className="flex items-start justify-end">
        {workingPaperId ? (
          onNavigateIssue ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onNavigateIssue(issue, workingPaperId, attachmentId)
              }
            >
              {copy.actions.goTo}
            </Button>
          ) : (
            <a
              className={cn(
                buttonVariants({
                  variant: "outline",
                  size: "sm",
                })
              )}
              href={buildArchiveIssueActionHref(actionIssue)}
            >
              {copy.actions.goTo}
            </a>
          )
        ) : (
          <span className="text-muted-foreground">{copy.emptyValue}</span>
        )}
      </div>
    </div>
  );
}

function buildArchiveCheckGroups(
  report: ArchiveCheckReport,
  copy: ArchiveCheckCopy
): ArchiveCheckGroup[] {
  return ARCHIVE_CHECK_GROUPS.map((definition) => {
    const issues = report.issues.filter((issue) =>
      definition.issueTypes.includes(issue.type)
    );
    const blockers = issues.some((issue) => issue.severity === "BLOCKER");
    const warnings = issues.some((issue) => issue.severity === "WARNING");
    return {
      id: definition.id,
      title: copy.groupTitles[definition.id],
      status: blockers ? "blockers" : warnings ? "warnings" : "passed",
      issues: buildArchiveIssueRollups(
        issues,
        definition.issueTypes,
        definition.id
      ),
    };
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(value: string) {
  return value.replaceAll(/[\\/:*?"<>|]+/g, "-");
}

function buildArchiveIssueRollups(
  issues: ArchiveCheckIssue[],
  orderedTypes: ArchiveCheckIssueType[],
  groupId: ArchiveCheckGroupId
): ArchiveCheckIssueRollup[] {
  const byTarget = new Map<string, ArchiveCheckIssue[]>();
  for (const [issueIndex, issue] of issues.entries()) {
    const key = getArchiveIssueRollupKey(issue, issueIndex);
    const existing = byTarget.get(key);
    if (existing) {
      existing.push(issue);
    } else {
      byTarget.set(key, [issue]);
    }
  }
  return [...byTarget.entries()].map(([targetKey, groupedIssues]) => {
    const presentTypes = new Set(groupedIssues.map((issue) => issue.type));
    const issueTypes = orderedTypes.filter((type) => presentTypes.has(type));
    const fileNames = uniqueDefined(groupedIssues.map(getArchiveIssueFileName));
    return {
      rowKey: `${groupId}:${targetKey}`,
      targetKey,
      actionIssue: groupedIssues.find((issue) => issue.action?.workingPaperId),
      fileNames,
      issueTypes,
      issues: groupedIssues,
      severity: groupedIssues.some((issue) => issue.severity === "BLOCKER")
        ? "BLOCKER"
        : "WARNING",
      workingPaper: groupedIssues.find((issue) => issue.workingPaper)
        ?.workingPaper,
    };
  });
}

function getArchiveIssueRollupKey(
  issue: ArchiveCheckIssue,
  issueIndex: number
) {
  const attachmentId =
    issue.location?.attachmentId ??
    issue.attachment?.id ??
    issue.action?.attachmentId;
  if (attachmentId) {
    return `attachment:${attachmentId}`;
  }
  const reviewQuestionId =
    issue.reviewQuestion?.id ?? issue.action?.reviewQuestionId;
  if (reviewQuestionId) {
    return `review-question:${reviewQuestionId}`;
  }
  return `issue:${issueIndex}:${issue.type}`;
}

function getArchiveIssueFileName(issue: ArchiveCheckIssue) {
  return issue.location?.attachmentName ?? issue.attachment?.name;
}

function uniqueDefined(values: (string | undefined)[]) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function ArchiveCheckMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "destructive" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background px-3 py-2",
        tone === "destructive" && "border-destructive/30 bg-destructive/5",
        tone === "warning" && "border-warning/35 bg-warning/10"
      )}
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold text-foreground",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ArchiveConfirmItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium break-words text-foreground">
        {value}
      </div>
    </div>
  );
}

function formatArchiveIssueType(
  type: ArchiveCheckReport["issues"][number]["type"],
  copy: ArchiveCheckCopy
) {
  return copy.issueTypes[type];
}

function formatArchiveRollupIssueTypes(
  issue: ArchiveCheckIssueRollup,
  copy: ArchiveCheckCopy
) {
  return issue.issueTypes
    .map((type) => formatArchiveIssueType(type, copy))
    .join(" / ");
}

function formatArchiveRollupFiles(
  issue: ArchiveCheckIssueRollup,
  copy: ArchiveCheckCopy
) {
  if (issue.fileNames.length === 0) {
    return copy.emptyValue;
  }
  const code = issue.workingPaper?.code.trim();
  return issue.fileNames
    .map((fileName) => {
      if (
        !code ||
        fileName.toLocaleLowerCase().startsWith(code.toLocaleLowerCase())
      ) {
        return fileName;
      }
      return `${code} ${fileName}`;
    })
    .join(" / ");
}

function formatArchiveRollupLocation(
  issue: ArchiveCheckIssueRollup,
  copy: ArchiveCheckCopy
) {
  return (
    issue.issues.find((item) => item.location?.projectPath)?.location
      ?.projectPath ??
    issue.workingPaper?.code ??
    copy.emptyValue
  );
}

const SUMMARY_ONLY_ISSUE_TYPES = new Set<ArchiveCheckIssueType>([
  "DOCX_TRACK_CHANGES",
  "DOCX_UNRESOLVED_COMMENT",
  "XLSX_UNRESOLVED_COMMENT",
  "XLSX_ERROR_VALUE",
  "OFFICE_FILE_CHECK_FAILED",
]);

function formatArchiveRollupDetail(
  issue: ArchiveCheckIssueRollup,
  copy: ArchiveCheckCopy
) {
  if (issue.issueTypes.every((type) => SUMMARY_ONLY_ISSUE_TYPES.has(type))) {
    return copy.emptyValue;
  }
  return uniqueDefined(
    issue.issues.map((item) => formatArchiveIssueDetail(item, copy))
  ).join(" / ");
}

function formatArchiveIssueDetail(
  issue: ArchiveCheckReport["issues"][number],
  copy: ArchiveCheckCopy
) {
  if (issue.type === "MISSING_PREPARER_SIGNOFF" && issue.workingPaper) {
    return formatCopy(copy.details.missingPreparer, {
      code: issue.workingPaper.code,
    });
  }
  if (issue.type === "MISSING_REVIEWER_SIGNOFF" && issue.workingPaper) {
    return formatCopy(copy.details.missingReviewer, {
      code: issue.workingPaper.code,
    });
  }
  if (issue.type === "REVIEW_SIGNOFF_BEFORE_PREPARER") {
    return issue.location?.excerpt ?? issue.message;
  }
  if (
    issue.type === "DOCX_TRACK_CHANGES" ||
    issue.type === "DOCX_UNRESOLVED_COMMENT" ||
    issue.type === "XLSX_UNRESOLVED_COMMENT" ||
    issue.type === "XLSX_ERROR_VALUE" ||
    issue.type === "OFFICE_FILE_CHECK_FAILED"
  ) {
    return issue.location?.excerpt ?? issue.location?.value ?? issue.message;
  }
  if (issue.type === "SMART_FORM_INCOMPLETE" && issue.attachment) {
    return formatCopy(copy.details.incompleteSmartForm, {
      file: issue.attachment.name,
    });
  }
  if (issue.attachment) {
    return formatCopy(copy.details.lockedAttachment, {
      file: issue.attachment.name,
      holder: issue.attachment.lockedBy?.name ?? copy.details.unknownHolder,
    });
  }
  if (issue.reviewQuestion) {
    const assignee = issue.reviewQuestion.assignedTo?.name;
    const status =
      copy.reviewQuestionStatusLabels[issue.reviewQuestion.status] ??
      issue.reviewQuestion.status;
    return formatCopy(
      assignee
        ? copy.details.openReviewQuestionWithAssignee
        : copy.details.openReviewQuestion,
      {
        status,
        assignee: assignee ?? "",
      }
    );
  }
  if (issue.member) {
    return formatCopy(copy.details.selfReviewed, {
      member: issue.member.name,
    });
  }
  return issue.message;
}

function _unused_formatArchiveIssueLocation(
  issue: ArchiveCheckReport["issues"][number],
  copy: ArchiveCheckCopy
) {
  const { location } = issue;
  if (!location) {
    return copy.emptyValue;
  }
  if (location.projectPath) {
    return location.projectPath;
  }
  const parts = [
    location.sheetName,
    location.cellAddress,
    location.part,
    location.commentAuthor
      ? formatCopy(copy.details.commentAuthor, {
          author: location.commentAuthor,
        })
      : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : copy.emptyValue;
}

function buildArchiveIssueActionHref(
  issue: ArchiveCheckReport["issues"][number]
) {
  if (!issue.action?.workingPaperId || typeof window === "undefined") {
    return "#";
  }
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "overview");
  url.searchParams.set("locatePaperId", issue.action.workingPaperId);
  const attachmentId =
    issue.action.attachmentId ??
    issue.location?.attachmentId ??
    issue.attachment?.id;
  if (attachmentId) {
    url.searchParams.set("attachmentId", attachmentId);
    url.searchParams.set("focus", "attachment");
  } else {
    url.searchParams.delete("attachmentId");
    url.searchParams.delete("focus");
  }
  url.searchParams.delete("workingPaperId");
  url.searchParams.delete("reviewQuestionId");
  url.searchParams.delete("sheetName");
  url.searchParams.delete("cellAddress");
  url.searchParams.delete("smartFormPreview");
  url.searchParams.delete("smartFormNodeId");
  url.searchParams.delete("smartFormRowId");
  url.searchParams.delete("smartFormTargetLabel");
  return `${url.pathname}${url.search}`;
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function formatArchiveCheckDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

function addDaysIsoDate(value: string, days: number) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type CalendarDateControlProps = {
  cancelLabel?: string;
  className?: string;
  confirmLabel?: string;
  disabled?: boolean;
  id: string;
  isDirty?: boolean;
  locale: Locale;
  onChange: (value: string) => void;
  onCancel?: () => void;
  open: boolean;
  placeholder: string;
  setOpen: (open: boolean) => void;
  todayLabel: string;
  value: string;
};

function renderCalendarDateControl(props: CalendarDateControlProps) {
  return <CalendarDateControl {...props} />;
}

function useCalendarOutsideDismissal(
  open: boolean,
  setOpen: (open: boolean) => void,
  contentRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideInteraction = (event: MouseEvent | PointerEvent) => {
      const { target } = event;
      if (!(target instanceof Node)) {
        return;
      }
      if (contentRef.current?.contains(target)) {
        return;
      }
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest('[data-slot="select-content"]')
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction, true);
    document.addEventListener("click", closeOnOutsideInteraction, true);

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsideInteraction,
        true
      );
      document.removeEventListener("click", closeOnOutsideInteraction, true);
    };
  }, [contentRef, open, setOpen, triggerRef]);
}

function CalendarDateControl({
  cancelLabel,
  className,
  confirmLabel,
  disabled,
  id,
  isDirty = false,
  locale,
  onChange,
  onCancel,
  open,
  placeholder,
  setOpen,
  todayLabel,
  value,
}: CalendarDateControlProps) {
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const calendarLocale = getCalendarLocale(locale);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedDateTime = selectedDate?.getTime() ?? null;
  const [displayMonth, setDisplayMonth] = useState(
    () => selectedDate ?? new Date()
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setDisplayMonth(selectedDate ?? new Date());
  }, [open, selectedDate, selectedDateTime]);

  const commitDate = (date: Date | undefined) => {
    if (!date) {
      return;
    }
    setDisplayMonth(date);
    onChange(formatIsoDate(date));
  };
  const showCommitActions =
    isDirty && Boolean(confirmLabel && cancelLabel && onCancel);
  useCalendarOutsideDismissal(open, setOpen, contentRef, triggerRef);

  return (
    <InputGroup className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              ref={triggerRef}
              type="button"
              variant="ghost"
              disabled={disabled}
              data-empty={!selectedDate}
              data-slot="input-group-control"
              className={cn(
                "h-full flex-1 justify-start rounded-none border-0 bg-transparent px-3 text-left font-normal shadow-none hover:bg-transparent  data-[empty=true]:text-muted-foreground"
              )}
            />
          }
        >
          <CalendarDays data-icon="inline-start" />
          {selectedDate
            ? formatCalendarDate(selectedDate, locale)
            : placeholder}
        </PopoverTrigger>
        {open ? (
          <PopoverContent
            side="bottom"
            align="start"
            collisionAvoidance={{
              side: "flip",
              align: "shift",
            }}
            className="max-h-[calc(100vh-2rem)] w-auto overflow-y-auto p-0"
            data-testid={`${id}-calendar`}
          >
            <Card
              ref={contentRef}
              size="sm"
              className="w-fit max-w-[300px]"
              data-slot="calendar-preset-surface"
            >
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  month={displayMonth}
                  onMonthChange={setDisplayMonth}
                  locale={calendarLocale}
                  captionLayout="dropdown"
                  startMonth={CALENDAR_START_MONTH}
                  endMonth={CALENDAR_END_MONTH}
                  fixedWeeks
                  className="p-0 [--cell-size:--spacing(9.5)]"
                  onSelect={commitDate}
                />
              </CardContent>
              <CardFooter
                data-slot="calendar-preset-footer"
                className="flex flex-wrap gap-2 border-t border-border/40 bg-card"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-card"
                  onClick={() => commitDate(new Date())}
                >
                  {todayLabel}
                </Button>
              </CardFooter>
            </Card>
          </PopoverContent>
        ) : null}
      </Popover>
      {showCommitActions ? (
        <InputGroupAddon align="inline-end" className="gap-0">
          <ButtonGroup className="gap-0.5">
            <InputGroupButton
              type="submit"
              size="icon-xs"
              className={SETTINGS_CONFIRM_BUTTON_CLASS}
              tooltip={confirmLabel}
              disabled={disabled}
            >
              <Check />
            </InputGroupButton>
            <InputGroupButton
              type="button"
              size="icon-xs"
              className={SETTINGS_CANCEL_BUTTON_CLASS}
              tooltip={cancelLabel}
              disabled={disabled}
              onClick={() => {
                onCancel?.();
                setOpen(false);
              }}
            >
              <X />
            </InputGroupButton>
          </ButtonGroup>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
