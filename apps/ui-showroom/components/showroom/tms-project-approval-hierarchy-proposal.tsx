"use client";

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@project-wing/ui";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  FolderKanban,
  ListFilter,
  Search,
  ShieldCheck,
  Undo2,
  UserCog,
  Users,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

type EmployeeApproval = {
  id: string;
  name: string;
  normalByDay: number[];
  overtimeByDay: number[];
  half: string;
  status: "待审批" | "已批准";
};

type ApprovalProject = {
  id: string;
  code: string;
  name: string;
  employees: EmployeeApproval[];
  hours: number;
  state: "ready" | "blocked" | "approved";
  issue?: string;
};

const approvalDays = [
  [1, "Tue", false],
  [2, "Wed", false],
  [3, "Thu", false],
  [4, "Fri", false],
  [5, "Sat", true],
  [6, "Sun", true],
  [7, "Mon", false],
  [8, "Tue", false],
  [9, "Wed", false],
  [10, "Thu", false],
  [11, "Fri", false],
  [12, "Sat", true],
  [13, "Sun", true],
  [14, "Mon", false],
  [15, "Tue", false],
] as const;

function dayHours(entries: Record<number, number>) {
  return approvalDays.map(([day]) => entries[day] ?? 0);
}

function totalHours(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

const engagements: {
  id: string;
  code: string;
  name: string;
  client: string;
  pic: string;
  mic: string;
  projects: ApprovalProject[];
}[] = [
  {
    id: "engagement-orchid",
    code: "AUD-2026-0001",
    name: "Orchid Holdings 2026 Audit",
    client: "Orchid Technology Limited",
    pic: "Jony Ma",
    mic: "Eden Chan",
    projects: [
      {
        id: "project-group-audit",
        code: "AUD-PROJECT-01",
        name: "集团审计",
        hours: 72,
        state: "ready",
        employees: [
          {
            id: "jony",
            name: "Jony Ma",
            normalByDay: dayHours({ 1: 8, 2: 8, 3: 8, 4: 6 }),
            overtimeByDay: dayHours({ 4: 2 }),
            half: "上半月",
            status: "待审批",
          },
          {
            id: "eden",
            name: "Eden Chan",
            normalByDay: dayHours({ 1: 8, 2: 8, 3: 8 }),
            overtimeByDay: dayHours({}),
            half: "上半月",
            status: "待审批",
          },
          {
            id: "leo",
            name: "Leo Li",
            normalByDay: dayHours({ 1: 8, 2: 6 }),
            overtimeByDay: dayHours({ 2: 2 }),
            half: "上半月",
            status: "待审批",
          },
        ],
      },
      {
        id: "project-subsidiary",
        code: "AUD-PROJECT-02",
        name: "子公司审计",
        hours: 40.5,
        state: "ready",
        employees: [
          {
            id: "mia",
            name: "Mia Wong",
            normalByDay: dayHours({ 1: 8, 2: 8, 3: 6.5 }),
            overtimeByDay: dayHours({}),
            half: "上半月",
            status: "待审批",
          },
          {
            id: "noah",
            name: "Noah Yu",
            normalByDay: dayHours({ 1: 8, 2: 8 }),
            overtimeByDay: dayHours({ 2: 2 }),
            half: "上半月",
            status: "待审批",
          },
        ],
      },
      {
        id: "project-component",
        code: "AUD-PROJECT-03",
        name: "组成部分审计",
        hours: 24,
        state: "blocked",
        issue: "1 名员工仍有未填工作日",
        employees: [
          {
            id: "ava",
            name: "Ava Lam",
            normalByDay: dayHours({ 1: 8, 2: 8, 3: 8 }),
            overtimeByDay: dayHours({}),
            half: "上半月",
            status: "待审批",
          },
        ],
      },
      {
        id: "project-tax",
        code: "AUD-PROJECT-04",
        name: "税务支持",
        hours: 16,
        state: "approved",
        employees: [
          {
            id: "ryan",
            name: "Ryan Ho",
            normalByDay: dayHours({ 1: 8, 2: 8 }),
            overtimeByDay: dayHours({}),
            half: "上半月",
            status: "已批准",
          },
        ],
      },
    ],
  },
  {
    id: "engagement-harbour",
    code: "AUD-2026-0002",
    name: "Harbour Trading 2026 Audit",
    client: "Harbour Trading Limited",
    pic: "Jony Ma",
    mic: "Leo Li",
    projects: [
      {
        id: "project-harbour",
        code: "HBR-PROJECT-01",
        name: "年度审计",
        hours: 36,
        state: "ready",
        employees: [
          {
            id: "ivy",
            name: "Ivy Cheng",
            normalByDay: dayHours({ 1: 8, 2: 8, 3: 8, 4: 8, 7: 4 }),
            overtimeByDay: dayHours({}),
            half: "上半月",
            status: "待审批",
          },
        ],
      },
    ],
  },
];

type ProjectApprovalState = "ready" | "partial" | "blocked" | "approved";
type EmployeeApprovalState = "待审批" | "已批准" | "已退回";

function projectStatus(
  project: ApprovalProject,
  approvedIds: Set<string>,
  employeeStates: Record<string, EmployeeApprovalState>
): ProjectApprovalState {
  if (project.state === "blocked") {
    return "blocked";
  }
  if (project.state === "approved" || approvedIds.has(project.id)) {
    return "approved" as const;
  }
  const states = project.employees.map(
    (employee) => employeeStates[employee.id] ?? employee.status
  );
  if (states.every((state) => state === "已批准")) {
    return "approved";
  }
  if (states.some((state) => state !== "待审批")) {
    return "partial";
  }
  return "ready";
}

function isProjectActionable(state: ProjectApprovalState) {
  return state === "ready" || state === "partial";
}

export function TmsProjectApprovalHierarchyProposal() {
  const [activeEngagementId, setActiveEngagementId] =
    useState("engagement-orchid");
  const [expandedProjects, setExpandedProjects] = useState(
    () => new Set(["project-group-audit"])
  );
  const [selectedProjects, setSelectedProjects] = useState(
    () => new Set<string>()
  );
  const [approvedIds, setApprovedIds] = useState(() => new Set<string>());
  const [employeeStates, setEmployeeStates] = useState<
    Record<string, EmployeeApprovalState>
  >({});
  const [approvalYear, setApprovalYear] = useState("2026");
  const [approvalMonth, setApprovalMonth] = useState("9");
  const [approvalPeriod, setApprovalPeriod] = useState("first-half");
  const activeEngagement =
    engagements.find((engagement) => engagement.id === activeEngagementId) ??
    engagements[0];
  const activeEligibleProjects = activeEngagement.projects.filter((project) =>
    isProjectActionable(projectStatus(project, approvedIds, employeeStates))
  );

  const selectedSummary = useMemo(
    () =>
      activeEngagement.projects.reduce(
        (summary, project) => {
          if (!selectedProjects.has(project.id)) {
            return summary;
          }
          return {
            projects: summary.projects + 1,
            employees: summary.employees + project.employees.length,
            hours: summary.hours + project.hours,
          };
        },
        { projects: 0, employees: 0, hours: 0 }
      ),
    [activeEngagement, selectedProjects]
  );

  function toggleValue(source: Set<string>, value: string, checked: boolean) {
    const next = new Set(source);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    return next;
  }

  function selectEngagement(engagementId: string) {
    setActiveEngagementId(engagementId);
    setSelectedProjects(new Set());
  }

  function toggleProject(projectId: string) {
    setExpandedProjects((current) =>
      toggleValue(current, projectId, !current.has(projectId))
    );
  }

  function selectProject(projectId: string, checked: boolean) {
    setSelectedProjects((current) => toggleValue(current, projectId, checked));
  }

  function approveCurrentScope() {
    const projectIds =
      selectedProjects.size > 0
        ? selectedProjects
        : new Set(activeEligibleProjects.map((project) => project.id));
    setApprovedIds((current) => new Set([...current, ...projectIds]));
    setSelectedProjects(new Set());
  }

  function setEmployeeState(
    projectId: string,
    employeeId: string,
    state: EmployeeApprovalState
  ) {
    setApprovedIds((current) => {
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
    setEmployeeStates((current) => ({ ...current, [employeeId]: state }));
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              我负责的业务
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              一次只处理一个 CMP Engagement
            </p>
          </div>
          <Badge variant="secondary">{engagements.length}</Badge>
        </div>
        <div className="flex gap-2 border-b border-border bg-muted/15 p-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜索业务、客户或编码"
              className="h-8 pl-8 text-xs"
              placeholder="搜索业务、客户或编码"
            />
          </div>
          <Button
            aria-label="筛选审批业务"
            className="shrink-0"
            size="icon-sm"
            title="筛选审批业务"
            variant="outline"
          >
            <ListFilter />
          </Button>
        </div>
        <nav
          aria-label="CMP Engagement 审批业务"
          className="m-2 divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70"
        >
          {engagements.map((engagement) => {
            const active = engagement.id === activeEngagement.id;
            return (
              <Button
                aria-current={active ? "page" : undefined}
                className={`relative h-auto w-full items-center justify-start overflow-hidden rounded-none border-0 px-3 py-2.5 text-left whitespace-normal shadow-none ${
                  active
                    ? "bg-success/5 hover:bg-success/10 text-foreground"
                    : "text-foreground hover:bg-muted/50"
                }`}
                key={engagement.id}
                onClick={() => selectEngagement(engagement.id)}
                variant="ghost"
              >
                {active ? (
                  <span className="bg-success absolute inset-y-2 left-0 w-0.5 rounded-full" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {engagement.code}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                    {engagement.client}
                  </span>
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/15 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 pb-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-foreground">
                {activeEngagement.code}
              </p>
              <span className="text-success inline-flex items-center gap-1 text-xs">
                <CheckCircle2 className="size-3.5" />
                已保存
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span
                aria-label={`客户 ${activeEngagement.client}`}
                className="inline-flex min-w-0 items-center gap-1"
                title="客户"
              >
                <Building2 className="size-3.5 shrink-0" />
                <span className="truncate">{activeEngagement.client}</span>
              </span>
              <span
                aria-label={`PIC ${activeEngagement.pic}`}
                className="inline-flex items-center gap-1"
                title="PIC"
              >
                <ShieldCheck className="size-3.5 shrink-0" />
                {activeEngagement.pic}
              </span>
              <span
                aria-label={`MIC ${activeEngagement.mic}`}
                className="inline-flex items-center gap-1"
                title="MIC"
              >
                <UserCog className="size-3.5 shrink-0" />
                {activeEngagement.mic}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1 text-[11px] text-muted-foreground">
              <span>年份</span>
              <Select
                value={approvalYear}
                onValueChange={(value) => value && setApprovalYear(value)}
              >
                <SelectTrigger className="w-20" size="sm" aria-label="审批年份">
                  <SelectValue>{approvalYear}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 text-[11px] text-muted-foreground">
              <span>月份</span>
              <Select
                value={approvalMonth}
                onValueChange={(value) => value && setApprovalMonth(value)}
              >
                <SelectTrigger className="w-20" size="sm" aria-label="审批月份">
                  <SelectValue>{approvalMonth} 月</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 月</SelectItem>
                  <SelectItem value="9">9 月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 text-[11px] text-muted-foreground">
              <span>期间</span>
              <Select
                value={approvalPeriod}
                onValueChange={(value) => value && setApprovalPeriod(value)}
              >
                <SelectTrigger className="w-24" size="sm" aria-label="审批期间">
                  <SelectValue>
                    {approvalPeriod === "first-half" ? "上半月" : "下半月"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first-half">上半月</SelectItem>
                  <SelectItem value="second-half">下半月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={activeEligibleProjects.length === 0}
              onClick={approveCurrentScope}
              size="sm"
            >
              <Check />
              {selectedSummary.projects > 0
                ? `批准所选（${selectedSummary.projects}）`
                : "全部批准"}
            </Button>
            <Button disabled size="sm" variant="outline">
              修改
            </Button>
          </div>
        </div>

        <div>
          {[activeEngagement].map((engagement) => (
            <section key={engagement.id}>
              <div className="bg-muted/15 px-3 py-2 sm:px-5">
                <div className="space-y-2 border-l border-border pl-3 sm:pl-5">
                  {engagement.projects.map((project) => {
                    const state = projectStatus(
                      project,
                      approvedIds,
                      employeeStates
                    );
                    const projectOpen = expandedProjects.has(project.id);
                    const actionable = isProjectActionable(state);
                    return (
                      <article
                        className="overflow-hidden rounded-lg border border-border bg-background"
                        key={project.id}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <Checkbox
                            aria-label={`选择项目 ${project.name}`}
                            checked={selectedProjects.has(project.id)}
                            disabled={!actionable}
                            onCheckedChange={(checked) =>
                              selectProject(project.id, Boolean(checked))
                            }
                          />
                          <Button
                            aria-expanded={projectOpen}
                            aria-label={`${projectOpen ? "收起" : "展开"}项目 ${project.name}`}
                            onClick={() => toggleProject(project.id)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            {projectOpen ? <ChevronDown /> : <ChevronRight />}
                          </Button>
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <FolderKanban className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {project.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {project.code}
                            </p>
                          </div>
                          <div className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                            <Users className="size-3.5" />
                            {project.employees.length} 人
                          </div>
                        </div>

                        {project.issue ? (
                          <div className="border-warning/20 bg-warning/5 text-warning-foreground flex items-center gap-2 border-t px-3 py-2 text-xs">
                            <AlertTriangle className="text-warning size-3.5 shrink-0" />
                            {project.issue}，解决后才可选择该项目。
                          </div>
                        ) : null}

                        {projectOpen ? (
                          <div className="border-t border-border bg-muted/10">
                            <div className="overflow-x-auto">
                              <table
                                aria-label={`${project.name}每日工时明细`}
                                className="w-full min-w-[80rem] border-collapse text-xs"
                              >
                                <thead className="text-muted-foreground">
                                  <tr className="border-b border-border bg-muted/35">
                                    <th className="sticky left-0 z-20 w-28 min-w-28 bg-muted px-3 py-2 text-left font-medium">
                                      员工
                                    </th>
                                    <th className="sticky left-28 z-20 w-24 min-w-24 bg-muted px-2 py-2 text-center font-medium">
                                      操作
                                    </th>
                                    <th className="sticky left-[13rem] z-20 w-20 min-w-20 bg-muted px-2 py-2 text-center font-medium">
                                      状态
                                    </th>
                                    <th className="sticky left-[18rem] z-20 w-16 min-w-16 border-r border-border bg-muted px-2 py-2 text-left font-medium">
                                      类型
                                    </th>
                                    {approvalDays.map(
                                      ([day, weekday, weekend]) => (
                                        <th
                                          className={
                                            weekend
                                              ? "w-11 min-w-11 border-r border-border bg-muted/70 px-1 py-1 text-center font-medium"
                                              : "w-11 min-w-11 border-r border-border px-1 py-1 text-center font-medium"
                                          }
                                          key={day}
                                        >
                                          <span className="block text-foreground">
                                            {day}
                                          </span>
                                          <span className="block text-[10px] font-normal">
                                            {weekday}
                                          </span>
                                        </th>
                                      )
                                    )}
                                    <th className="w-16 min-w-16 border-r border-border px-2 py-2 text-right font-medium">
                                      合计
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/70">
                                  {project.employees.map((employee) => {
                                    const employeeState =
                                      state === "approved"
                                        ? "已批准"
                                        : (employeeStates[employee.id] ??
                                          employee.status);
                                    return (
                                      <Fragment key={employee.id}>
                                        <tr className="hover:bg-muted/25">
                                          <th
                                            className="sticky left-0 z-10 w-28 min-w-28 border-r border-border bg-background px-3 py-2 text-left font-medium text-foreground"
                                            rowSpan={2}
                                            scope="rowgroup"
                                          >
                                            <span className="block truncate">
                                              {employee.name}
                                            </span>
                                            <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                                              {employee.half}
                                            </span>
                                          </th>
                                          <td
                                            className="sticky left-28 z-10 w-24 min-w-24 bg-background px-1 py-1.5 text-center"
                                            rowSpan={2}
                                          >
                                            <span className="inline-flex items-center justify-center gap-0.5">
                                              {employeeState === "已批准" ? (
                                                <Button
                                                  aria-label={`撤销批准 ${employee.name}`}
                                                  onClick={() =>
                                                    setEmployeeState(
                                                      project.id,
                                                      employee.id,
                                                      "待审批"
                                                    )
                                                  }
                                                  size="icon-sm"
                                                  title={`撤销批准 ${employee.name}`}
                                                  variant="ghost"
                                                >
                                                  <Undo2 />
                                                </Button>
                                              ) : (
                                                <>
                                                  <Button
                                                    aria-label={`批准 ${employee.name}`}
                                                    disabled={!actionable}
                                                    onClick={() =>
                                                      setEmployeeState(
                                                        project.id,
                                                        employee.id,
                                                        "已批准"
                                                      )
                                                    }
                                                    size="icon-sm"
                                                    title={`批准 ${employee.name}`}
                                                    variant="ghost"
                                                  >
                                                    <Check className="text-success" />
                                                  </Button>
                                                  <Button
                                                    aria-label={`退回 ${employee.name}`}
                                                    disabled={!actionable}
                                                    onClick={() =>
                                                      setEmployeeState(
                                                        project.id,
                                                        employee.id,
                                                        "已退回"
                                                      )
                                                    }
                                                    size="icon-sm"
                                                    title={`退回 ${employee.name}`}
                                                    variant="ghost"
                                                  >
                                                    <CornerDownLeft className="text-warning" />
                                                  </Button>
                                                </>
                                              )}
                                            </span>
                                          </td>
                                          <td
                                            className="sticky left-[13rem] z-10 w-20 min-w-20 bg-background px-2 py-1.5 text-center"
                                            rowSpan={2}
                                          >
                                            <Badge
                                              size="sm"
                                              variant={
                                                employeeState === "已批准"
                                                  ? "success-light"
                                                  : employeeState === "已退回"
                                                    ? "warning-light"
                                                    : "primary-light"
                                              }
                                            >
                                              {employeeState}
                                            </Badge>
                                          </td>
                                          <th
                                            className="text-success sticky left-[18rem] z-10 w-16 min-w-16 border-r border-border bg-background px-2 py-1.5 text-left font-medium"
                                            scope="row"
                                          >
                                            正常
                                          </th>
                                          {employee.normalByDay.map(
                                            (hours, index) => (
                                              <td
                                                className={
                                                  approvalDays[index]?.[2]
                                                    ? "border-r border-border bg-muted/45 px-1 py-1.5 text-center text-muted-foreground tabular-nums"
                                                    : "border-r border-border px-1 py-1.5 text-center text-foreground tabular-nums"
                                                }
                                                key={approvalDays[index]?.[0]}
                                              >
                                                {hours > 0
                                                  ? hours.toFixed(1)
                                                  : "—"}
                                              </td>
                                            )
                                          )}
                                          <td className="border-r border-border px-2 py-1.5 text-right font-medium text-foreground tabular-nums">
                                            {totalHours(
                                              employee.normalByDay
                                            ).toFixed(1)}
                                            h
                                          </td>
                                        </tr>
                                        <tr className="hover:bg-muted/25">
                                          <th
                                            className="text-info sticky left-[18rem] z-10 w-16 min-w-16 border-r border-border bg-background px-2 py-1.5 text-left font-medium"
                                            scope="row"
                                          >
                                            加班
                                          </th>
                                          {employee.overtimeByDay.map(
                                            (hours, index) => (
                                              <td
                                                className={
                                                  approvalDays[index]?.[2]
                                                    ? "border-r border-border bg-muted/45 px-1 py-1.5 text-center text-muted-foreground tabular-nums"
                                                    : "border-r border-border px-1 py-1.5 text-center text-foreground tabular-nums"
                                                }
                                                key={approvalDays[index]?.[0]}
                                              >
                                                {hours > 0
                                                  ? hours.toFixed(1)
                                                  : "—"}
                                              </td>
                                            )
                                          )}
                                          <td className="border-r border-border px-2 py-1.5 text-right font-medium text-foreground tabular-nums">
                                            {totalHours(
                                              employee.overtimeByDay
                                            ).toFixed(1)}
                                            h
                                          </td>
                                        </tr>
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground sm:hidden">
                              横向滑动可查看全部每日工时、合计和状态。
                            </p>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
