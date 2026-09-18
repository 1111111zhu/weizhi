"use client";

import { getProjectInvitationEligibility } from "@project-wing/shared";
import type {
  CmpEngagement,
  CreateProjectInput,
  ProjectRole,
} from "@project-wing/shared";
import {
  ProjectWingTopBar,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  GuidedForm,
  GuidedFormIntro,
  GuidedFormEntryActions,
  GuidedFormChoices,
  GuidedFormField,
  GuidedFormSection,
  GuidedFormSelect,
  GuidedFormSummary,
  Button,
  Badge as StatusBadge,
  Input,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  FileClock,
  FilePlus2,
  FolderKanban,
  Plus,
  UserRoundPlus,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/components/ui/select";

import { api } from "../api/client";
import type { User } from "../api/client";
import { HeaderAvatar } from "../components/header-avatar";
import {
  EmpPortalAction,
  EmpTopBarControls,
} from "../components/project-wing-top-bar-controls";
import { useI18n } from "../i18n/client";
import type { Locale } from "../i18n/settings";
import {
  CALENDAR_END_MONTH,
  CALENDAR_START_MONTH,
  formatCalendarDate,
  formatIsoDate,
  getCalendarLocale,
  parseIsoDate,
} from "../lib/calendar-date";
import {
  getFirmRankLabel,
  getInvitationRoleLabel,
} from "../lib/member-role-labels";
import { PAGE_CONTENT_CLASS, PAGE_SHELL_CLASS } from "../lib/project-layout";

const ARCHIVE_DEADLINE_DAYS = 60;
const INVITATION_EXPIRY_DAYS = 7;
const NO_RANK_FILTER = "__no_rank_filter__";
const FIRM_RANKS = [
  "PARTNER",
  "PRINCIPAL",
  "MANAGER",
  "SENIOR",
  "STAFF",
  "ASSISTANT",
  "EQCR",
  "TAX_EXPERT",
] as const;

type Step = 1 | 2;
type ProjectSource = "CMP" | "QUICK";
type ProjectInitialization = "BLANK" | "TEMPLATE" | "ROLL_FORWARD";
type FormValues = {
  folderId: string;
  cmpClientId: string;
  cmpEngagementId: string;
  projectPicUserIds: string[];
  projectMicUserIds: string[];
  projectCode: string;
  name: string;
  language: "zh-CN" | "en-US";
  applicableAccountingStandard: string;
  projectTemplateId: string;
  yearEndDate: string;
  reportDate: string;
  archiveDeadline: string;
  rollForwardFromProjectId: string;
  inheritMembers: boolean;
};

function addDays(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ARCHIVE_DEADLINE_DAYS);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function addYear(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function getProjectRoleOptions(user: User) {
  return getProjectInvitationEligibility(user).assignableProjectRoles.map(
    (role) => ({
      value: role,
      label: getInvitationRoleLabel(user.globalRole, role),
    })
  );
}

function defaultRole(user: User): ProjectRole {
  const options = getProjectInvitationEligibility(user).assignableProjectRoles;
  const preferredRole: Partial<Record<User["globalRole"], ProjectRole>> = {
    PARTNER: "PARTNER",
    EQCR: "EQCR",
    TAX_EXPERT: "TAX_REVIEWER",
  };
  const preferred = preferredRole[user.globalRole] ?? "PREPARER";
  return options.includes(preferred) ? preferred : options[0];
}

export function NewProjectPage({ folderId }: { folderId?: string }) {
  const router = useRouter();
  const { dictionary, locale, localizedPath } = useI18n();
  const copy = dictionary.projects;
  const { wizard } = copy;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<ProjectSource>("QUICK");
  const [initialization, setInitialization] =
    useState<ProjectInitialization>("BLANK");
  const [engagementCode, setEngagementCode] = useState("");
  const [debouncedCode, setDebouncedCode] = useState("");
  const [selectedEngagement, setSelectedEngagement] =
    useState<CmpEngagement | null>(null);
  const [engagementError, setEngagementError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [pendingInvites, setPendingInvites] = useState<
    Record<string, ProjectRole>
  >({});
  const [inviteeSearch, setInviteeSearch] = useState("");
  const [inviteeRank, setInviteeRank] = useState(NO_RANK_FILTER);
  const [inviteePage, setInviteePage] = useState(1);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [pickerPurpose, setPickerPurpose] = useState<"INVITE" | "PIC" | "MIC">(
    "INVITE"
  );
  const form = useForm<FormValues>({
    defaultValues: {
      folderId: folderId ?? "",
      cmpClientId: "",
      cmpEngagementId: "",
      projectPicUserIds: [],
      projectMicUserIds: [],
      projectCode: "",
      name: "",
      language: "zh-CN",
      applicableAccountingStandard: "",
      projectTemplateId: "",
      yearEndDate: "",
      reportDate: "",
      archiveDeadline: "",
      rollForwardFromProjectId: "",
      inheritMembers: true,
    },
  });
  const values = form.watch();
  const projectsPath = localizedPath("/engagement");
  const projectsReturnPath = values.folderId
    ? `${projectsPath}?folderId=${encodeURIComponent(values.folderId)}`
    : projectsPath;
  const setValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    form.setValue(key, value as never, { shouldDirty: true });

  useEffect(() => {
    if (step === 2 && !reviewing) {
      document
        .querySelector<HTMLInputElement>("#project-name")
        ?.focus({ preventScroll: true });
    }
  }, [step, reviewing]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedCode(engagementCode.trim()),
      400
    );
    return () => window.clearTimeout(timeout);
  }, [engagementCode]);
  const engagementCandidates = useQuery({
    queryKey: ["cmp-engagement-project-candidates", debouncedCode],
    enabled: source === "CMP" && debouncedCode.length >= 2,
    queryFn: () =>
      api.cmpEngagements({
        q: debouncedCode,
        status: "ACTIVE",
        availableForProject: true,
      }),
  });
  const projects = useQuery({
    queryKey: ["projects", "roll-forward"],
    queryFn: api.projects,
    enabled: step === 2 && initialization === "ROLL_FORWARD",
  });
  const templates = useQuery({
    queryKey: ["projectTemplates"],
    queryFn: () => api.projectTemplates(),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const picDirectory = useQuery({
    queryKey: ["user-directory", "pic"],
    queryFn: api.userDirectory,
  });
  const rollForwardProject = (projects.data ?? []).find(
    (project) => project.id === values.rollForwardFromProjectId
  );
  const inheritedMemberIds =
    initialization === "ROLL_FORWARD" && values.inheritMembers
      ? (rollForwardProject?.members ?? [])
          .filter((member) => member.membershipStatus !== "INVITED")
          .map((member) => member.user.id)
      : [];
  const excludedInviteeIds = [
    ...new Set(
      [
        me.data?.id,
        ...values.projectMicUserIds,
        ...values.projectPicUserIds,
        ...inheritedMemberIds,
      ].filter((id): id is string => Boolean(id))
    ),
  ];
  const inviteeSearchReady = inviteeSearch.trim().length >= 2;
  const inviteeLookupEnabled =
    memberPickerOpen && inviteeSearchReady && pickerPurpose === "INVITE";
  const invitees = useQuery({
    queryKey: [
      "project-invitees",
      inviteeSearch,
      inviteeRank,
      inviteePage,
      excludedInviteeIds,
    ],
    queryFn: () =>
      api.projectInvitees({
        q: inviteeSearch.trim(),
        browseAll: false,
        globalRole:
          inviteeRank === NO_RANK_FILTER ? undefined : (inviteeRank as never),
        excludeUserIds: excludedInviteeIds,
        page: inviteePage,
        pageSize: 10,
      }),
    enabled: inviteeLookupEnabled,
  });

  function applyEngagement(resolved: CmpEngagement) {
    setSelectedEngagement(resolved);
    setEngagementCode(resolved.engagementCode);
    setValue("cmpClientId", resolved.clientId);
    setValue("cmpEngagementId", resolved.id);
    setValue(
      "projectPicUserIds",
      resolved.picUserId ? [resolved.picUserId] : []
    );
    setValue(
      "projectMicUserIds",
      resolved.micUserId ? [resolved.micUserId] : []
    );
    if (resolved.yearEndDate) {
      setValue("yearEndDate", resolved.yearEndDate);
    }
    if (resolved.reportDate) {
      setValue("reportDate", resolved.reportDate);
      setValue("archiveDeadline", addDays(resolved.reportDate));
    }
    const { picUserId } = resolved;
    if (picUserId) {
      setPendingInvites((current) => {
        if (!current[picUserId]) {
          return current;
        }
        const next = { ...current };
        Reflect.deleteProperty(next, picUserId);
        return next;
      });
    }
    setEngagementError("");
  }

  const visibleInvitees = (invitees.data?.users ?? []).filter(
    (user) =>
      !excludedInviteeIds.includes(user.id) &&
      getProjectInvitationEligibility(user).canReceiveInvitation
  );
  const searchMatchesCurrentUser = Boolean(
    me.data &&
    inviteeSearch.trim().length >= 2 &&
    [me.data.name, me.data.email].some((value) =>
      value
        .toLocaleLowerCase()
        .includes(inviteeSearch.trim().toLocaleLowerCase())
    )
  );
  const invitationInputs = Object.entries(pendingInvites)
    .filter(
      ([recipientUserId]) => !excludedInviteeIds.includes(recipientUserId)
    )
    .map(([recipientUserId, invitedRole]) => ({
      recipientUserId,
      invitedRole,
      expiresInDays: INVITATION_EXPIRY_DAYS,
    }));

  function clearEngagement() {
    setSelectedEngagement(null);
    setValue("cmpClientId", "");
    setValue("cmpEngagementId", "");
    setValue("projectPicUserIds", []);
    setValue("projectMicUserIds", []);
    setEngagementError("");
  }
  function chooseSource(nextSource: ProjectSource) {
    setSource(nextSource);
    setEngagementError("");
    if (nextSource !== "CMP") {
      clearEngagement();
      setEngagementCode("");
      setDebouncedCode("");
    }
  }
  function chooseInitialization(next: ProjectInitialization) {
    setInitialization(next);
    setReviewError("");
    if (next !== "ROLL_FORWARD") {
      setValue("rollForwardFromProjectId", "");
    }
    if (next !== "TEMPLATE") {
      setValue("projectTemplateId", "");
    }
  }
  function chooseRollForward(id: string) {
    const archivedProject = (projects.data ?? []).find(
      (project) => project.id === id
    );
    if (!id) {
      setValue("rollForwardFromProjectId", "");
      return;
    }
    if (!archivedProject) {
      return;
    }
    setValue("rollForwardFromProjectId", archivedProject.id);
    setValue("name", archivedProject.name);
    setValue("language", archivedProject.language ?? "zh-CN");
    setValue(
      "applicableAccountingStandard",
      archivedProject.applicableAccountingStandard ??
        archivedProject.frameworkTemplate?.name ??
        ""
    );
    setValue("yearEndDate", addYear(archivedProject.yearEndDate));
    setValue("reportDate", addYear(archivedProject.reportDate));
    setValue("archiveDeadline", addYear(archivedProject.archiveDeadline));
  }
  function toggleInvite(user: User) {
    setPendingInvites((current) => {
      const next = { ...current };
      if (next[user.id]) {
        Reflect.deleteProperty(next, user.id);
      } else {
        next[user.id] = defaultRole(user);
      }
      return next;
    });
  }
  function openMemberPicker(purpose: "INVITE" | "PIC" | "MIC" = "INVITE") {
    setPickerPurpose(purpose);
    setInviteeSearch("");
    setInviteeRank(NO_RANK_FILTER);
    setInviteePage(1);
    setMemberPickerOpen(true);
  }
  function selectProjectLead(userId: string) {
    const field =
      pickerPurpose === "MIC" ? "projectMicUserIds" : "projectPicUserIds";
    setValue(field, [...new Set([...values[field], userId])]);
    setPendingInvites((current) => {
      if (!current[userId]) {
        return current;
      }
      const next = { ...current };
      Reflect.deleteProperty(next, userId);
      return next;
    });
  }
  function beginReview() {
    if (!me.data) {
      setReviewError(wizard.loadFailed);
      return;
    }
    form.clearErrors();
    const missing: { field: keyof FormValues; label: string }[] = [];
    if (!values.name.trim()) {
      missing.push({ field: "name", label: copy.name });
    }
    if (!values.applicableAccountingStandard.trim()) {
      missing.push({
        field: "applicableAccountingStandard",
        label: wizard.accountingStandard,
      });
    }
    if (initialization === "TEMPLATE" && !values.projectTemplateId) {
      missing.push({ field: "projectTemplateId", label: copy.projectTemplate });
    }
    if (initialization === "ROLL_FORWARD" && !values.rollForwardFromProjectId) {
      missing.push({
        field: "rollForwardFromProjectId",
        label: wizard.archivedSourceProject,
      });
    }
    if (!values.yearEndDate) {
      missing.push({ field: "yearEndDate", label: copy.yearEndDate });
    }
    if (!values.reportDate) {
      missing.push({ field: "reportDate", label: copy.reportDate });
    }
    if (!values.archiveDeadline) {
      missing.push({ field: "archiveDeadline", label: copy.archiveDeadline });
    }
    if (selectedEngagement && !values.projectPicUserIds.length) {
      missing.push({ field: "projectPicUserIds", label: wizard.pic });
    }
    if (missing.length > 0) {
      for (const item of missing) {
        form.setError(item.field, { message: wizard.required });
      }
      setReviewError(
        `${wizard.required} ${missing.map((item) => item.label).join(" · ")}`
      );
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`#project-${missing[0].field}`)
          ?.focus();
      });
      return;
    }
    setReviewError("");
    setReviewing(true);
  }
  const create = useMutation({
    mutationFn: () =>
      api.createProject({
        folderId: values.folderId || undefined,
        name: values.name.trim(),
        ...(values.projectCode.trim()
          ? { projectCode: values.projectCode.trim() }
          : {}),
        language: values.language,
        applicableAccountingStandard:
          values.applicableAccountingStandard.trim(),
        projectTemplateId:
          initialization === "TEMPLATE" ? values.projectTemplateId : undefined,
        yearEndDate: values.yearEndDate,
        reportDate: values.reportDate,
        archiveDeadline: values.archiveDeadline,
        invitations: invitationInputs.length > 0 ? invitationInputs : undefined,
        projectPicUserIds: values.projectPicUserIds,
        projectMicUserIds: selectedEngagement
          ? undefined
          : values.projectMicUserIds,
        ...(values.cmpEngagementId
          ? {
              cmpClientId: values.cmpClientId,
              cmpEngagementId: values.cmpEngagementId,
            }
          : {}),
        ...(initialization === "ROLL_FORWARD" && values.rollForwardFromProjectId
          ? {
              rollForwardFromProjectId: values.rollForwardFromProjectId,
              inheritMembers: values.inheritMembers,
            }
          : {}),
      } satisfies CreateProjectInput),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["desktop"] }),
      ]);
      router.push(projectsReturnPath);
    },
  });
  const sourceLabel = selectedEngagement
    ? selectedEngagement.engagementCode
    : wizard.quickSourceLabel;
  const initializationLabel =
    initialization === "BLANK"
      ? wizard.blankInitializationTitle
      : initialization === "ROLL_FORWARD"
        ? rollForwardProject
          ? `${rollForwardProject.projectCode} · ${rollForwardProject.name}`
          : wizard.rollForwardInitializationTitle
        : ((templates.data ?? []).find(
            (template) => template.id === values.projectTemplateId
          )?.name ?? wizard.templateInitializationTitle);
  const selectedInvitees = Object.entries(pendingInvites).flatMap(
    ([userId, role]) => {
      if (excludedInviteeIds.includes(userId)) {
        return [];
      }
      const user = (picDirectory.data ?? []).find(
        (candidate) => candidate.id === userId
      );
      return user ? [{ user, role }] : [];
    }
  );
  const leadLabel = (id: string) =>
    (picDirectory.data ?? []).find((user) => user.id === id)?.name ?? id;
  const selectedPicLabel =
    values.projectPicUserIds.map(leadLabel).join(", ") || "-";
  const selectedMicLabel =
    values.projectMicUserIds.map(leadLabel).join(", ") || "-";
  const leadMatches = inviteeSearchReady
    ? (picDirectory.data ?? []).filter(
        (user) =>
          user.status === "ACTIVE" &&
          (pickerPurpose === "PIC"
            ? ["PARTNER", "PRINCIPAL"].includes(user.globalRole)
            : user.globalRole === "MANAGER") &&
          `${user.name} ${user.email}`
            .toLocaleLowerCase()
            .includes(inviteeSearch.trim().toLocaleLowerCase())
      )
    : [];
  const pickerReady = memberPickerOpen && inviteeSearchReady;
  const pickerPending =
    pickerPurpose === "INVITE" ? invitees.isPending : picDirectory.isPending;
  const pickerError =
    pickerPurpose === "INVITE" ? invitees.isError : picDirectory.isError;
  const pickerUsers =
    pickerPurpose === "INVITE"
      ? visibleInvitees
      : leadMatches.slice((inviteePage - 1) * 10, inviteePage * 10);
  const pickerTotal =
    pickerPurpose === "INVITE"
      ? (invitees.data?.total ?? 0)
      : leadMatches.length;
  const pickerTotalPages =
    pickerPurpose === "INVITE"
      ? (invitees.data?.totalPages ?? 0)
      : Math.ceil(leadMatches.length / 10);
  const setupComplete = Boolean(
    me.data &&
    values.name.trim() &&
    values.applicableAccountingStandard.trim() &&
    (initialization === "BLANK" ||
      (initialization === "TEMPLATE"
        ? values.projectTemplateId
        : values.rollForwardFromProjectId)) &&
    values.yearEndDate &&
    values.reportDate &&
    values.archiveDeadline &&
    (!selectedEngagement || values.projectPicUserIds.length)
  );
  return (
    <div className={PAGE_SHELL_CLASS}>
      <ProjectWingTopBar
        leading={
          <>
            <ProjectWingTopBarBrand />
            <ProjectWingTopBarReturnAction
              label={dictionary.workspaces.back}
              onClick={() => router.push(projectsReturnPath)}
            />
            <EmpPortalAction />
          </>
        }
        actions={<EmpTopBarControls />}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Enter in a lookup chooses a result, never progresses the wizard.
            if (
              step === 1 ||
              document.activeElement?.getAttribute("role") === "combobox" ||
              reviewing
            ) {
              return;
            }
            beginReview();
          }}
        >
          {step === 1 ? (
            <GuidedFormIntro
              title={
                me.data?.name?.trim()
                  ? wizard.introGreeting.replace("{name}", me.data.name.trim())
                  : wizard.introGreetingFallback
              }
              description={wizard.introDescription}
              choices={
                <div className="relative [&_.pw-guided-form-entry:disabled]:pointer-events-auto [&_.pw-guided-form-entry:disabled]:blur-[2px] [&_.pw-guided-form-entry:disabled]:transition-[filter] [&_.pw-guided-form-entry:disabled]:duration-200 [&_.pw-guided-form-entry:disabled]:ease-out [&_.pw-guided-form-entry:disabled:hover]:blur-none [&:has(.pw-guided-form-entry:disabled:hover)>span]:blur-none [&>span]:blur-[2px] [&>span]:transition-[filter] [&>span]:duration-200 [&>span]:ease-out">
                  <GuidedFormEntryActions
                    label={wizard.sourceModeLabel}
                    onAction={(next) => {
                      if (next === "QUICK") {
                        setSource("QUICK");
                        setStep(2);
                        setReviewError("");
                      }
                    }}
                    options={[
                      {
                        value: "CMP",
                        label: wizard.regularMode,
                        description: wizard.regularModeDescription,
                        icon: <BriefcaseBusiness />,
                        disabled: true,
                      },
                      {
                        value: "QUICK",
                        label: wizard.quickMode,
                        description: wizard.quickModeDescription,
                        icon: <Zap />,
                      },
                    ]}
                  />
                  <span className="pointer-events-none absolute top-5 right-5 text-xs text-muted-foreground sm:right-[calc(50%+1.75rem)]">
                    {wizard.comingSoon}
                  </span>
                </div>
              }
            >
              <div className="relative blur-[2px] transition-[filter] duration-200 ease-out hover:blur-none [&_input]:pr-52">
                <GuidedFormSelect
                  id="project-cmpEngagementId"
                  disabled
                  aria-label={`${wizard.engagementSearchPlaceholder} · ${wizard.comingSoon}`}
                  aria-describedby="project-cmp-coming-soon"
                  aria-invalid={Boolean(engagementError)}
                  value={values.cmpEngagementId}
                  selectedOption={
                    selectedEngagement
                      ? {
                          value: selectedEngagement.id,
                          label:
                            selectedEngagement.client.nameEn ||
                            selectedEngagement.client.nameZh,
                          code: selectedEngagement.engagementCode,
                        }
                      : undefined
                  }
                  onValueChange={(id) => {
                    if (!id) {
                      clearEngagement();
                      setEngagementCode("");
                      setDebouncedCode("");
                      return;
                    }
                    const candidate =
                      engagementCandidates.data?.engagements.find(
                        (item) => item.id === id
                      );
                    if (candidate) {
                      applyEngagement(candidate);
                      setSource("CMP");
                      setStep(2);
                      setReviewError("");
                    }
                  }}
                  options={
                    debouncedCode.length >= 2 &&
                    engagementCode.trim() === debouncedCode &&
                    !engagementCandidates.isFetching &&
                    !engagementCandidates.isError
                      ? (engagementCandidates.data?.engagements ?? []).map(
                          (candidate) => ({
                            value: candidate.id,
                            label:
                              candidate.client.nameEn ||
                              candidate.client.nameZh,
                            code: candidate.engagementCode,
                          })
                        )
                      : []
                  }
                  placeholder={wizard.engagementSearchPlaceholder}
                  icon={<BriefcaseBusiness />}
                  search={{
                    placeholder: wizard.engagementSearchPlaceholder,
                    groupLabel: copy.cmpEngagement,
                    showGroupLabel: false,
                    emptyLabel: wizard.noEngagementResults,
                    clearLabel: wizard.clearSelectionSearch,
                    clearSelectionLabel: wizard.clearSelectedRecord,
                    filter: "external",
                    onQueryChange: setEngagementCode,
                    status:
                      engagementCode.trim().length < 2 ? (
                        <AsyncStatus message={wizard.searchEngagementMinimum} />
                      ) : engagementCandidates.isError ? (
                        <AsyncError
                          title={wizard.loadFailed}
                          action={wizard.retry}
                          onRetry={() => engagementCandidates.refetch()}
                        />
                      ) : engagementCode.trim() !== debouncedCode ||
                        engagementCandidates.isFetching ? (
                        <AsyncStatus message={wizard.engagementChecking} />
                      ) : undefined,
                  }}
                />
                <span
                  id="project-cmp-coming-soon"
                  className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-sm text-muted-foreground"
                >
                  {wizard.comingSoon}
                </span>
              </div>
              {engagementError ? (
                <p
                  id="project-engagement-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {engagementError}
                </p>
              ) : null}
            </GuidedFormIntro>
          ) : (
            <GuidedForm
              label={copy.create}
              appearance="grouped"
              value={String(step)}
              steps={[
                {
                  id: "2",
                  label: wizard.projectSetupTitle,
                  disabled: create.isPending,
                },
              ]}
              onValueChange={(next) => {
                setReviewing(false);
                if (next === "1") {
                  chooseSource("CMP");
                }
                setStep(Number(next) as Step);
              }}
              aside={
                step === 2 && !reviewing ? (
                  <GuidedFormSummary
                    title={wizard.creationSummary}
                    status={
                      setupComplete ? (
                        <StatusBadge variant="success-light">
                          {wizard.configurationComplete}
                        </StatusBadge>
                      ) : (
                        wizard.pendingConfiguration
                      )
                    }
                    items={[
                      { label: wizard.reviewSource, value: sourceLabel },
                      ...(selectedEngagement
                        ? [
                            {
                              label: wizard.reviewClient,
                              value: `${selectedEngagement.client.clientCode} · ${selectedEngagement.client.nameEn || selectedEngagement.client.nameZh}`,
                            },
                          ]
                        : []),
                      {
                        label: wizard.initializationTitle,
                        value: initializationLabel,
                      },
                      {
                        label: copy.initialInvitations,
                        value: String(invitationInputs.length),
                      },
                    ]}
                  />
                ) : undefined
              }
              actions={
                reviewing ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={create.isPending}
                      onClick={() => setReviewing(false)}
                    >
                      {wizard.edit}
                    </Button>
                    <Button
                      type="button"
                      disabled={create.isPending}
                      onClick={() => create.mutate()}
                    >
                      {create.isPending
                        ? wizard.creatingProject
                        : wizard.createProject}
                    </Button>
                  </>
                ) : (
                  <>
                    {step === 2 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setStep(1);
                        }}
                      >
                        {wizard.back}
                      </Button>
                    ) : null}
                    <Button
                      type="submit"
                      variant="success"
                      disabled={step === 2 && !me.data}
                    >
                      {wizard.review}
                    </Button>
                  </>
                )
              }
            >
              {reviewing ? (
                <Review
                  data={values}
                  locale={locale}
                  source={source}
                  initialization={initialization}
                  sourceLabel={sourceLabel}
                  clientLabel={
                    selectedEngagement
                      ? `${selectedEngagement.client.clientCode} · ${selectedEngagement.client.nameEn || selectedEngagement.client.nameZh}`
                      : "-"
                  }
                  micLabel={selectedMicLabel}
                  picLabel={selectedPicLabel}
                  picUsers={values.projectPicUserIds.map((id) => ({
                    id,
                    name: leadLabel(id),
                  }))}
                  micUsers={values.projectMicUserIds.map((id) => ({
                    id,
                    name: leadLabel(id),
                  }))}
                  inheritMembers={values.inheritMembers}
                  requestOwnerId={me.data?.id ?? "request-owner"}
                  requestOwnerLabel={me.data?.name ?? wizard.reviewRequestOwner}
                  inheritedMembers={(rollForwardProject?.members ?? []).filter(
                    (member) => member.membershipStatus !== "INVITED"
                  )}
                  inviteCount={invitationInputs.length}
                  invitees={selectedInvitees}
                  projectCodeLabel={
                    values.projectCode || copy.projectCodeAutomatic
                  }
                  languageLabel={copy.languages[values.language]}
                  labels={{
                    name: copy.name,
                    projectCode: copy.projectCode,
                    yearEndDate: copy.yearEndDate,
                    reportDate: copy.reportDate,
                    archiveDeadline: copy.archiveDeadline,
                  }}
                  templateLabel={initializationLabel}
                  copy={wizard}
                />
              ) : (
                <>
                  <GuidedFormSection title={wizard.projectSetupTitle}>
                    <GuidedFormField
                      id="project-name"
                      label={copy.name}
                      required
                      error={form.formState.errors.name?.message}
                    >
                      {(control) => (
                        <Input
                          {...form.register("name", { required: true })}
                          {...control}
                        />
                      )}
                    </GuidedFormField>
                    <GuidedFormField
                      id="project-projectCode"
                      label={copy.projectCode}
                      error={form.formState.errors.projectCode?.message}
                    >
                      {(control) => (
                        <Input
                          {...form.register("projectCode")}
                          {...control}
                          maxLength={80}
                          placeholder={copy.projectCodeAutomatic}
                        />
                      )}
                    </GuidedFormField>
                    <GuidedFormField
                      id="project-language"
                      label={copy.language}
                    >
                      {(control) => (
                        <GuidedFormSelect
                          {...control}
                          value={values.language}
                          onValueChange={(next) =>
                            setValue("language", next as FormValues["language"])
                          }
                          placeholder={copy.language}
                          options={[
                            { value: "zh-CN", label: copy.languages["zh-CN"] },
                            { value: "en-US", label: copy.languages["en-US"] },
                          ]}
                        />
                      )}
                    </GuidedFormField>
                    <GuidedFormField
                      id="project-applicableAccountingStandard"
                      label={wizard.accountingStandard}
                      required
                      error={
                        form.formState.errors.applicableAccountingStandard
                          ?.message
                      }
                    >
                      {(control) => (
                        <Input
                          {...form.register("applicableAccountingStandard", {
                            required: true,
                          })}
                          {...control}
                          placeholder={wizard.accountingStandardPlaceholder}
                        />
                      )}
                    </GuidedFormField>
                  </GuidedFormSection>
                  <GuidedFormSection
                    title={wizard.initializationTitle}
                    columns={1}
                  >
                    <GuidedFormChoices
                      label={wizard.initializationTitle}
                      layout="inline"
                      value={initialization}
                      onValueChange={(next) =>
                        chooseInitialization(next as ProjectInitialization)
                      }
                      options={[
                        {
                          value: "BLANK",
                          label: wizard.blankInitializationTitle,
                          icon: <FilePlus2 />,
                        },
                        {
                          value: "TEMPLATE",
                          label: wizard.templateInitializationTitle,
                          icon: <FolderKanban />,
                        },
                        {
                          value: "ROLL_FORWARD",
                          label: wizard.rollForwardInitializationTitle,
                          icon: <FileClock />,
                        },
                      ]}
                    />
                    {initialization === "BLANK" ? (
                      <p className="text-sm text-muted-foreground">
                        {wizard.blankInitializationDescription}
                      </p>
                    ) : initialization === "TEMPLATE" ? (
                      <>
                        <GuidedFormField
                          id="project-projectTemplateId"
                          label={copy.projectTemplate}
                          description={
                            templates.isPending
                              ? wizard.loadingData
                              : !templates.isError && !templates.data?.length
                                ? wizard.noTemplates
                                : undefined
                          }
                          required
                          error={
                            form.formState.errors.projectTemplateId?.message
                          }
                        >
                          {(control) => (
                            <GuidedFormSelect
                              {...control}
                              value={values.projectTemplateId}
                              onValueChange={(next) =>
                                setValue("projectTemplateId", next)
                              }
                              options={(templates.data ?? []).map(
                                (template) => ({
                                  value: template.id,
                                  label: template.name,
                                  code: template.code,
                                })
                              )}
                              disabled={
                                templates.isPending || templates.isError
                              }
                              placeholder={wizard.selectTemplate}
                              icon={<FolderKanban />}
                              search={{
                                placeholder: wizard.searchProjectTemplates,
                                groupLabel: copy.projectTemplate,
                                emptyLabel: templates.data?.length
                                  ? wizard.noTemplateMatches
                                  : wizard.noTemplates,
                                clearLabel: wizard.clearSelectionSearch,
                                clearSelectionLabel: wizard.clearSelectedRecord,
                              }}
                            />
                          )}
                        </GuidedFormField>
                        {templates.isError ? (
                          <AsyncError
                            title={wizard.loadFailed}
                            action={wizard.retry}
                            onRetry={() => templates.refetch()}
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <GuidedFormField
                          id="project-rollForwardFromProjectId"
                          label={wizard.archivedSourceProject}
                          description={
                            projects.isPending
                              ? wizard.loadingData
                              : !projects.isError &&
                                  !(projects.data ?? []).some(
                                    (project) => project.status === "ARCHIVED"
                                  )
                                ? wizard.noArchivedProjects
                                : undefined
                          }
                          required
                          error={
                            form.formState.errors.rollForwardFromProjectId
                              ?.message
                          }
                        >
                          {(control) => (
                            <GuidedFormSelect
                              {...control}
                              value={values.rollForwardFromProjectId}
                              onValueChange={chooseRollForward}
                              options={(projects.data ?? [])
                                .filter(
                                  (project) => project.status === "ARCHIVED"
                                )
                                .map((project) => ({
                                  value: project.id,
                                  label: project.name,
                                  code: project.projectCode,
                                }))}
                              disabled={projects.isPending || projects.isError}
                              placeholder={wizard.selectArchivedProject}
                              icon={<FileClock />}
                              search={{
                                placeholder: wizard.searchArchivedProjects,
                                groupLabel: wizard.archivedSourceProject,
                                emptyLabel: wizard.noArchivedProjectMatches,
                                clearLabel: wizard.clearSelectionSearch,
                                clearSelectionLabel: wizard.clearSelectedRecord,
                              }}
                            />
                          )}
                        </GuidedFormField>
                        {projects.isError ? (
                          <AsyncError
                            title={wizard.loadFailed}
                            action={wizard.retry}
                            onRetry={() => projects.refetch()}
                          />
                        ) : null}
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={values.inheritMembers}
                            onCheckedChange={(checked) =>
                              setValue("inheritMembers", checked === true)
                            }
                            label={wizard.inheritMembersControl}
                          />
                          {wizard.inheritMembers}
                        </label>
                      </>
                    )}
                  </GuidedFormSection>
                  <GuidedFormSection title={wizard.reviewDates} columns={3}>
                    <GuidedFormField
                      id="project-yearEndDate"
                      label={copy.yearEndDate}
                      required
                      error={form.formState.errors.yearEndDate?.message}
                    >
                      {(control) => (
                        <ProjectDateField
                          {...control}
                          value={values.yearEndDate}
                          onChange={(next) => setValue("yearEndDate", next)}
                          locale={locale}
                          placeholder={copy.yearEndDate}
                          todayLabel={dictionary.common.datePicker.today}
                        />
                      )}
                    </GuidedFormField>
                    <GuidedFormField
                      id="project-reportDate"
                      label={copy.reportDate}
                      required
                      error={form.formState.errors.reportDate?.message}
                    >
                      {(control) => (
                        <ProjectDateField
                          {...control}
                          value={values.reportDate}
                          onChange={(next) => {
                            setValue("reportDate", next);
                            setValue("archiveDeadline", addDays(next));
                          }}
                          locale={locale}
                          placeholder={copy.reportDate}
                          todayLabel={dictionary.common.datePicker.today}
                        />
                      )}
                    </GuidedFormField>
                    <GuidedFormField
                      id="project-archiveDeadline"
                      label={copy.archiveDeadline}
                      required
                      error={form.formState.errors.archiveDeadline?.message}
                    >
                      {(control) => (
                        <ProjectDateField
                          {...control}
                          value={values.archiveDeadline}
                          onChange={(next) => setValue("archiveDeadline", next)}
                          locale={locale}
                          placeholder={copy.archiveDeadline}
                          todayLabel={dictionary.common.datePicker.today}
                        />
                      )}
                    </GuidedFormField>
                  </GuidedFormSection>
                  <GuidedFormSection title={wizard.projectLeadsTitle}>
                    {(["PIC", "MIC"] as const).map((lead) => {
                      const isPic = lead === "PIC";
                      const field = isPic
                        ? "projectPicUserIds"
                        : "projectMicUserIds";
                      const label = isPic ? wizard.selectPic : wizard.selectMic;
                      return (
                        <Fragment key={lead}>
                          <GuidedFormField id={`project-${field}`} label={lead}>
                            {(control) => (
                              <Button
                                {...control}
                                type="button"
                                variant="success"
                                size="md"
                                className="h-9! min-h-9! w-32! justify-self-end"
                                iconStart={<Plus />}
                                aria-label={label}
                                aria-labelledby={undefined}
                                disabled={!isPic && Boolean(selectedEngagement)}
                                onClick={() => openMemberPicker(lead)}
                              >
                                {label}
                              </Button>
                            )}
                          </GuidedFormField>
                          {values[field].map((userId) => {
                            const selectedUser = (picDirectory.data ?? []).find(
                              (user) => user.id === userId
                            );
                            const name = leadLabel(userId);
                            return (
                              <div
                                key={userId}
                                className="flex items-center gap-3"
                              >
                                <HeaderAvatar
                                  className="size-8 shadow-none"
                                  label={name}
                                  name={name}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {name}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {selectedUser
                                      ? getFirmRankLabel(
                                          selectedUser.globalRole
                                        )
                                      : lead}
                                  </span>
                                </span>
                                {isPic || !selectedEngagement ? (
                                  <Button
                                    type="button"
                                    variant="quiet"
                                    size="icon-sm"
                                    aria-label={`${wizard.clearLead} ${lead} ${name}`}
                                    onClick={() =>
                                      setValue(
                                        field,
                                        values[field].filter(
                                          (id) => id !== userId
                                        )
                                      )
                                    }
                                  >
                                    <X />
                                  </Button>
                                ) : null}
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </GuidedFormSection>
                  <GuidedFormSection
                    title={copy.initialInvitations}
                    columns={1}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {wizard.selectedMembersOnly}
                      </p>
                      <Button
                        type="button"
                        variant="success"
                        size="md"
                        className="h-9! w-32!"
                        iconStart={<UserRoundPlus />}
                        onClick={() => openMemberPicker()}
                      >
                        {wizard.inviteMember}
                      </Button>
                    </div>
                    {selectedInvitees.length ? (
                      selectedInvitees.map(({ user, role }) => (
                        <div
                          key={user.id}
                          className="flex flex-wrap items-center gap-3 border-b border-border py-2"
                        >
                          <HeaderAvatar
                            className="size-8 shadow-none"
                            label={user.name}
                            name={user.name}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {user.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {getFirmRankLabel(user.globalRole)}
                            </span>
                          </span>
                          <Badge variant="secondary">
                            {wizard.pendingInvitation}
                          </Badge>
                          <Picker
                            label={copy.initialInvitations}
                            value={role}
                            onChange={(next) =>
                              setPendingInvites((current) => ({
                                ...current,
                                [user.id]: next as ProjectRole,
                              }))
                            }
                            options={getProjectRoleOptions(user)}
                          />
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="quiet"
                            aria-label={wizard.cancelInvitation}
                            onClick={() => toggleInvite(user)}
                          >
                            <X />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {wizard.noMembersSelected}
                      </p>
                    )}
                  </GuidedFormSection>
                  {me.isPending ? (
                    <AsyncStatus message={wizard.loadingData} />
                  ) : null}
                  {me.isError ? (
                    <AsyncError
                      title={wizard.loadFailed}
                      action={wizard.retry}
                      onRetry={() => me.refetch()}
                    />
                  ) : null}
                  {reviewError ? (
                    <p
                      role="alert"
                      aria-live="assertive"
                      className="text-sm text-destructive"
                    >
                      {reviewError}
                    </p>
                  ) : null}
                </>
              )}
            </GuidedForm>
          )}
        </form>
      </div>
      <Dialog open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
        <DialogContent className="grid h-[min(44rem,calc(100dvh-2rem))] w-[min(48rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {pickerPurpose === "INVITE"
                ? wizard.inviteMember
                : pickerPurpose === "PIC"
                  ? wizard.selectPic
                  : wizard.selectMic}
            </DialogTitle>
          </DialogHeader>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
            <div
              className={
                pickerPurpose === "INVITE"
                  ? "grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]"
                  : "grid gap-2"
              }
            >
              <Input
                aria-label={wizard.searchEmployees}
                value={inviteeSearch}
                placeholder={wizard.searchEmployees}
                onChange={(event) => {
                  setInviteeSearch(event.currentTarget.value);
                  setInviteePage(1);
                }}
              />
              {pickerPurpose === "INVITE" ? (
                <div className="[&_[data-slot=select-trigger]]:w-full">
                  <Picker
                    label={dictionary.projects.rankColumn}
                    value={inviteeRank}
                    onChange={(value) => {
                      setInviteeRank(value);
                      setInviteePage(1);
                    }}
                    placeholder={dictionary.projects.rankColumn}
                    options={[
                      { value: NO_RANK_FILTER, label: wizard.noRankFilter },
                      ...FIRM_RANKS.map((rank) => ({
                        value: rank,
                        label: getFirmRankLabel(rank),
                      })),
                    ]}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid min-h-0 content-start gap-2 overflow-y-auto pr-1">
              {pickerReady ? null : (
                <AsyncStatus message={wizard.searchEmployeesMinimum} />
              )}
              {pickerReady && pickerPending ? (
                <AsyncStatus message={wizard.loadingData} />
              ) : null}
              {pickerReady && pickerError ? (
                <AsyncError
                  title={wizard.loadFailed}
                  action={wizard.retry}
                  onRetry={() =>
                    pickerPurpose === "INVITE"
                      ? invitees.refetch()
                      : picDirectory.refetch()
                  }
                />
              ) : null}
              {pickerReady &&
              !pickerPending &&
              !pickerError &&
              pickerUsers.length === 0 ? (
                <AsyncStatus
                  message={
                    pickerPurpose === "INVITE" && searchMatchesCurrentUser
                      ? wizard.currentUserAlreadyIncluded.replace(
                          "{name}",
                          me.data?.name ?? ""
                        )
                      : wizard.noInvitees
                  }
                />
              ) : null}
              {pickerReady && !pickerPending && !pickerError
                ? pickerUsers.map((user) => {
                    const activeRole =
                      pickerPurpose === "INVITE"
                        ? pendingInvites[user.id]
                        : undefined;
                    const selectedLead =
                      pickerPurpose !== "INVITE" &&
                      (pickerPurpose === "PIC"
                        ? values.projectPicUserIds
                        : values.projectMicUserIds
                      ).includes(user.id);
                    const isSelected = selectedLead || Boolean(activeRole);
                    return (
                      <div
                        key={user.id}
                        className="grid gap-2 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center"
                      >
                        <span className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2.5">
                          <HeaderAvatar
                            className="size-8 shadow-none"
                            label={user.name}
                            name={user.name}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {user.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {getFirmRankLabel(user.globalRole)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSelected}
                          variant="default"
                          onClick={() => {
                            if (pickerPurpose === "INVITE") {
                              toggleInvite(user);
                            } else {
                              selectProjectLead(user.id);
                            }
                          }}
                        >
                          {isSelected ? (
                            <Check className="size-4" />
                          ) : (
                            <Plus className="size-4" />
                          )}
                          {isSelected
                            ? wizard.leadSelected
                            : pickerPurpose === "INVITE"
                              ? wizard.addMemberAction
                              : wizard.selectLead}
                        </Button>
                      </div>
                    );
                  })
                : null}
            </div>
          </div>
          <DialogFooter>
            <span className="mr-auto self-center text-xs text-muted-foreground">
              {pickerReady
                ? wizard.employeesCount.replace("{count}", String(pickerTotal))
                : ""}
            </span>
            <ButtonGroup>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={inviteePage === 1}
                onClick={() => setInviteePage((page) => page - 1)}
              >
                {wizard.previousPage}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!pickerReady || inviteePage >= pickerTotalPages}
                onClick={() => setInviteePage((page) => page + 1)}
              >
                {wizard.nextPage}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDateField({
  value,
  onChange,
  locale,
  placeholder,
  todayLabel,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  placeholder: string;
  todayLabel: string;
  id?: string;
  "aria-labelledby"?: string;
  "aria-required"?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedDate = parseIsoDate(value);
  const [displayMonth, setDisplayMonth] = useState(
    () => selectedDate ?? new Date()
  );

  useEffect(() => {
    if (open) {
      setDisplayMonth(parseIsoDate(value) ?? new Date());
    }
  }, [open, value]);

  const chooseDate = (date: Date | undefined) => {
    if (!date) {
      return;
    }
    onChange(formatIsoDate(date));
    setDisplayMonth(date);
  };
  useCalendarOutsideDismissal(open, setOpen, contentRef, triggerRef);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            ref={triggerRef}
            id={id}
            aria-labelledby={ariaLabelledBy}
            aria-required={ariaRequired}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
          />
        }
      >
        <CalendarDays className="size-4" />
        {selectedDate ? formatCalendarDate(selectedDate, locale) : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Card
          ref={contentRef}
          size="sm"
          className="w-fit max-w-[300px]"
          data-slot="project-calendar-preset-surface"
        >
          <CardContent className="p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              onSelect={chooseDate}
              locale={getCalendarLocale(locale)}
              captionLayout="dropdown"
              startMonth={CALENDAR_START_MONTH}
              endMonth={CALENDAR_END_MONTH}
              fixedWeeks
              className="p-0 [--cell-size:--spacing(9.5)]"
            />
          </CardContent>
          <CardFooter
            data-slot="project-calendar-preset-footer"
            className="flex flex-wrap gap-2 border-t border-border/40 bg-card"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 bg-card"
              onClick={() => chooseDate(new Date())}
            >
              {todayLabel}
            </Button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  );
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

function Picker({
  value,
  onChange,
  options,
  placeholder,
  label,
  disabled,
  icon,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(nextValue) => nextValue && onChange(nextValue)}
    >
      <SelectTrigger
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        label={label}
      >
        {icon ? (
          <span className="shrink-0 text-muted-foreground">{icon}</span>
        ) : null}
        <span
          data-slot="select-value"
          className="min-w-0 flex-1 truncate text-left"
        >
          {selectedLabel ?? placeholder}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {icon ? (
              <span className="text-muted-foreground">{icon}</span>
            ) : null}
            <span className="truncate">{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function AsyncStatus({ message }: { message: string }) {
  return (
    <output className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      {message}
    </output>
  );
}
function AsyncError({
  title,
  action,
  onRetry,
}: {
  title: string;
  action: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onRetry}
        >
          {action}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <dl className="grid min-w-0 gap-2 @sm:grid-cols-2 @sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-base font-medium break-words whitespace-pre-wrap">
        {value}
      </dd>
    </dl>
  );
}
function Review({
  data,
  locale,
  source,
  initialization,
  sourceLabel,
  clientLabel,
  picLabel,
  picUsers,
  inheritMembers,
  requestOwnerId,
  requestOwnerLabel,
  inheritedMembers,
  micLabel,
  micUsers,
  inviteCount,
  invitees,
  templateLabel,
  projectCodeLabel,
  languageLabel,
  labels,
  copy,
}: {
  data: FormValues;
  locale: Locale;
  source: ProjectSource;
  initialization: ProjectInitialization;
  sourceLabel: string;
  clientLabel: string;
  picLabel: string;
  picUsers: { id: string; name: string }[];
  inheritMembers: boolean;
  requestOwnerId: string;
  requestOwnerLabel: string;
  inheritedMembers: { id: string; projectRole: ProjectRole; user: User }[];
  micLabel: string;
  micUsers: { id: string; name: string }[];
  inviteCount: number;
  invitees: { user: User; role: ProjectRole }[];
  templateLabel: string;
  projectCodeLabel: string;
  languageLabel: string;
  labels: {
    name: string;
    projectCode: string;
    yearEndDate: string;
    reportDate: string;
    archiveDeadline: string;
  };
  copy: {
    reviewTitle: string;
    reviewDescription: string;
    reviewSource: string;
    reviewClient: string;
    reviewEngagement: string;
    reviewAccountingStandard: string;
    reviewInitialization: string;
    reviewTemplate: string;
    reviewPic: string;
    reviewMic: string;
    reviewPendingInvitations: string;
    reviewProjectDetails: string;
    reviewSourceDetails: string;
    reviewDates: string;
    reviewTeam: string;
    reviewLanguage: string;
    reviewNotes: string;
    noNotes: string;
    reviewDirectMembers: string;
    reviewRequestOwner: string;
    reviewInheritedMembers: string;
    reviewInheritedMembersHint: string;
    directlyJoined: string;
    yes: string;
    no: string;
    notApplicable: string;
    unlinkedCmpEngagement: string;
    pendingInvitation: string;
    edit: string;
    createProject: string;
    creatingProject: string;
  };
}) {
  const displayDate = (value: string) => {
    const date = parseIsoDate(value);
    return date ? formatCalendarDate(date, locale) : copy.notApplicable;
  };
  const directMemberMap = new Map<
    string,
    { id: string; label: string; details: string[] }
  >();
  const addDirectMember = (id: string, label: string, detail: string) => {
    const existing = directMemberMap.get(id);
    if (existing) {
      if (!existing.details.includes(detail)) {
        existing.details.push(detail);
      }
      return;
    }
    directMemberMap.set(id, { id, label, details: [detail] });
  };
  addDirectMember(requestOwnerId, requestOwnerLabel, copy.reviewRequestOwner);
  picUsers.forEach((user) =>
    addDirectMember(user.id, user.name, copy.reviewPic)
  );
  micUsers.forEach((user) =>
    addDirectMember(user.id, user.name, copy.reviewMic)
  );
  if (initialization === "ROLL_FORWARD" && inheritMembers) {
    for (const member of inheritedMembers) {
      if (member.user.id === requestOwnerId) {
        continue;
      }
      addDirectMember(
        member.user.id,
        member.user.name,
        getInvitationRoleLabel(member.user.globalRole, member.projectRole)
      );
    }
  }
  const directMembers = [...directMemberMap.values()];
  return (
    <section className="@container py-6">
      <header className="mb-4">
        <h2 className="text-2xl font-semibold">{copy.reviewTitle}</h2>
        <p className="mt-2 text-base text-muted-foreground">
          {copy.reviewDescription}
        </p>
      </header>
      <div className="grid items-start gap-x-8 @3xl:grid-cols-2">
        <div className="min-w-0">
          <ReviewGroup title={copy.reviewProjectDetails}>
            <Summary label={labels.name} value={data.name} />
            <Summary label={labels.projectCode} value={projectCodeLabel} />
            <Summary label={copy.reviewLanguage} value={languageLabel} />
            <Summary
              label={copy.reviewAccountingStandard}
              value={data.applicableAccountingStandard}
            />
            <Summary
              label={
                initialization === "TEMPLATE"
                  ? copy.reviewTemplate
                  : copy.reviewInitialization
              }
              value={templateLabel}
            />
          </ReviewGroup>
          <ReviewGroup title={copy.reviewDates}>
            <Summary
              label={labels.yearEndDate}
              value={displayDate(data.yearEndDate)}
            />
            <Summary
              label={labels.reportDate}
              value={displayDate(data.reportDate)}
            />
            <Summary
              label={labels.archiveDeadline}
              value={displayDate(data.archiveDeadline)}
            />
          </ReviewGroup>
        </div>
        <div className="min-w-0">
          <ReviewGroup title={copy.reviewSourceDetails}>
            <Summary
              label={
                source === "CMP" ? copy.reviewEngagement : copy.reviewSource
              }
              value={sourceLabel}
            />
            {source === "CMP" ? (
              <Summary label={copy.reviewClient} value={clientLabel} />
            ) : null}
            <Summary label={copy.reviewPic} value={picLabel} />
            <Summary label={copy.reviewMic} value={micLabel} />
            {initialization === "ROLL_FORWARD" ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {copy.reviewInheritedMembers}
                  </span>
                  <Badge variant="secondary">
                    {inheritMembers ? copy.yes : copy.no}
                  </Badge>
                </div>
                {inheritMembers ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.reviewInheritedMembersHint}
                  </p>
                ) : null}
              </div>
            ) : null}
          </ReviewGroup>
          <ReviewGroup title={copy.reviewDirectMembers}>
            {directMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-3"
              >
                <HeaderAvatar
                  className="size-10 shrink-0 shadow-none"
                  label={member.label}
                  name={member.label}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium break-words">
                    {member.label}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {member.details.join(" · ")}
                  </span>
                </span>
                <Badge variant="secondary" className="text-primary">
                  {copy.directlyJoined}
                </Badge>
              </div>
            ))}
          </ReviewGroup>
          <ReviewGroup title={`${copy.reviewTeam} · ${inviteCount}`}>
            {invitees.length > 0 ? (
              invitees.map(({ user, role }) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center gap-3"
                >
                  <HeaderAvatar
                    className="size-10 shrink-0 shadow-none"
                    label={user.name}
                    name={user.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium break-words">
                      {user.name}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {getInvitationRoleLabel(user.globalRole, role)}
                    </span>
                  </span>
                  <Badge variant="secondary" className="text-primary">
                    {copy.pendingInvitation}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="col-span-full text-sm text-muted-foreground">
                {String(inviteCount)}
              </p>
            )}
          </ReviewGroup>
        </div>
      </div>
    </section>
  );
}
function ReviewGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GuidedFormSection title={title} columns={1}>
      {children}
    </GuidedFormSection>
  );
}
