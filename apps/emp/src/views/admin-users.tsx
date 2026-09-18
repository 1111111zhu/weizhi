"use client";

import { getStandardHourlyRate } from "@project-wing/shared";
import type { GlobalRole, UpdateUserInput } from "@project-wing/shared";
import {
  CollectionState,
  DataGridColumnHeader,
  ProjectWingMasterDataGrid,
  ProjectWingTopBar,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  BookOpenCheck,
  ClipboardList,
  LayoutGrid,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api } from "../api/client";
import type { User } from "../api/client";
import { LabeledField as Field } from "../components/labeled-field";
import {
  EmpPortalAction,
  EmpTopBarControls,
} from "../components/project-wing-top-bar-controls";
import { StatusBadge as Badge } from "../components/status-badge";
import { useToast } from "../components/toast";
import { adminUsersGridCopy } from "../i18n/admin-users-grid-copy";
import { useI18n } from "../i18n/client";
import { firmRankLabels } from "../lib/member-role-labels";

const EMPTY_USERS: User[] = [];

type UserForm = {
  email: string;
  name: string;
  password: string;
  globalRole: GlobalRole;
};

type UserStatus = NonNullable<User["status"]>;
type UserFilters = {
  q: string;
  globalRole: GlobalRole | "";
  status: UserStatus | "";
};

const globalRoleLabels: Record<GlobalRole, string> = firmRankLabels;
const editableGlobalRoleOptions = [
  "CONFIRMATION_OFFICER",
  "PARTNER",
  "PRINCIPAL",
  "MANAGER",
  "SENIOR",
  "STAFF",
  "ASSISTANT",
  "TAX_EXPERT",
] as const satisfies readonly GlobalRole[];
const filterGlobalRoleOptions = [
  "SUPER_ADMIN",
  ...editableGlobalRoleOptions,
] as const satisfies readonly GlobalRole[];
const globalRoleSelectValues: Record<GlobalRole, GlobalRole> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR: "HR",
  CONFIRMATION_OFFICER: "CONFIRMATION_OFFICER",
  PARTNER: "PARTNER",
  PRINCIPAL: "PRINCIPAL",
  MANAGER: "MANAGER",
  SENIOR: "SENIOR",
  STAFF: "STAFF",
  ASSISTANT: "ASSISTANT",
  EQCR: "EQCR",
  TAX_EXPERT: "TAX_EXPERT",
};

export function AdminUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const { dictionary, locale, localizedPath } = useI18n();
  const gridCopy = adminUsersGridCopy[locale];
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [filters, setFilters] = useState<UserFilters>({
    q: "",
    globalRole: "",
    status: "",
  });
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const users = useQuery({
    queryKey: ["users", filters],
    queryFn: () => api.users(filters),
  });
  const form = useForm<UserForm>({
    defaultValues: {
      email: "",
      name: "",
      password: "User12345!",
      globalRole: "STAFF",
    },
  });
  const create = useMutation({
    mutationFn: api.createUser,
    onSuccess: async () => {
      form.reset({
        email: "",
        name: "",
        password: "User12345!",
        globalRole: "STAFF",
      });
      setCreateUserOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const reset = useMutation({
    mutationFn: api.resetPassword,
    onSuccess: () =>
      toast({ title: gridCopy.passwordResetSuccess, variant: "success" }),
  });
  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateUserInput;
    }) => {
      if (input.globalRole) {
        const impact = await api.userRoleImpact(id, input.globalRole);
        if (impact.projects.length) {
          const copy = dictionary.projects.leadership;
          const approved = await confirm({
            title: copy.roleImpactTitle,
            description: `${copy.roleImpactDescription}\n${impact.projects.map((project) => `${project.projectCode} ${project.projectName}`).join("\n")}`,
            confirmLabel: copy.save,
            cancelLabel: copy.cancel,
          });
          if (!approved) {
            return null;
          }
          return api.updateUser(id, {
            ...input,
            projectAuthorizationImpactToken: impact.token,
          });
        }
      }
      return api.updateUser(id, input);
    },
    onError: (error) =>
      toast({
        title: dictionary.projects.leadership.roleChangeFailed,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user-directory"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const userRows = users.data ?? EMPTY_USERS;
  const activeCount = userRows.filter(
    (user) => (user.status ?? "ACTIVE") === "ACTIVE"
  ).length;
  const disabledCount = userRows.filter(
    (user) => (user.status ?? "ACTIVE") === "DISABLED"
  ).length;
  const defaultStaffNoById = useMemo(
    () =>
      new Map(
        userRows.map((user, index) => [
          user.id,
          getDefaultStaffNo(index, userRows.length),
        ])
      ),
    [userRows]
  );
  const userColumns = useMemo<ProjectWingMasterDataGridProps<User>["columns"]>(
    () => [
      {
        id: "user",
        accessorFn: (user) => user.name,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={gridCopy.user} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === me.data?.id;
          return (
            <div className="min-w-0 py-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-foreground">
                  {user.name}
                </span>
                {isSelf ? (
                  <Badge tone="sky">{gridCopy.currentAccount}</Badge>
                ) : null}
              </div>
              <div className="mt-1 truncate text-muted-foreground">
                {user.email}
              </div>
            </div>
          );
        },
        meta: { autoSize: true, headerTitle: gridCopy.user },
        minSize: 240,
        size: 320,
      },
      {
        id: "globalRole",
        accessorFn: (user) => user.globalRole,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={gridCopy.globalRole} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === me.data?.id;
          return (
            <AdminSelect
              ariaLabel={`${user.name} global role`}
              className="w-full max-w-56"
              value={globalRoleSelectValues[user.globalRole]}
              disabled={isSelf || update.isPending}
              onValueChange={(value) =>
                update.mutate({
                  id: user.id,
                  input: { globalRole: value as GlobalRole },
                })
              }
              options={(user.globalRole === "SUPER_ADMIN"
                ? filterGlobalRoleOptions
                : editableGlobalRoleOptions
              ).map((role) => ({
                label: globalRoleLabels[role],
                value: role,
              }))}
            />
          );
        },
        meta: { autoSize: true, headerTitle: gridCopy.globalRole },
        minSize: 220,
        size: 260,
      },
      {
        id: "staffNo",
        accessorFn: (user) =>
          resolveStaffNo(user, defaultStaffNoById.get(user.id) ?? "000"),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={gridCopy.staffNo} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const staffNo = resolveStaffNo(
            user,
            defaultStaffNoById.get(user.id) ?? "000"
          );
          return (
            <output
              aria-label={`${user.name} Staff No`}
              className="block px-1 font-mono text-sm text-foreground tabular-nums"
            >
              {staffNo}
            </output>
          );
        },
        sortingFn: (rowA, rowB) =>
          Number(rowA.getValue("staffNo")) - Number(rowB.getValue("staffNo")),
        meta: { autoSize: true, headerTitle: gridCopy.staffNo },
        minSize: 108,
        size: 128,
      },
      {
        id: "rate",
        accessorFn: (user) =>
          getStandardHourlyRate(user.globalRole) ?? user.hourlyRate ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={gridCopy.rate} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const hourlyRate =
            getStandardHourlyRate(user.globalRole) ?? user.hourlyRate;
          return (
            <output
              aria-label={`${user.name} Rate`}
              className="block px-1 text-sm text-foreground tabular-nums"
            >
              {formatHourlyRate(hourlyRate)}
            </output>
          );
        },
        meta: { autoSize: true, headerTitle: gridCopy.rate },
        minSize: 112,
        size: 132,
      },
      {
        id: "status",
        accessorFn: (user) => user.status ?? "ACTIVE",
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={gridCopy.accountStatus}
          />
        ),
        cell: ({ row }) => {
          const status = row.original.status ?? "ACTIVE";
          return (
            <Badge tone={status === "ACTIVE" ? "green" : "amber"}>
              {status === "ACTIVE"
                ? gridCopy.activeUsers
                : gridCopy.disabledUsers}
            </Badge>
          );
        },
        meta: { autoSize: true, headerTitle: gridCopy.accountStatus },
        size: 160,
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={gridCopy.actions} />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const status = user.status ?? "ACTIVE";
          const isSelf = user.id === me.data?.id;
          const nextStatus: UserStatus =
            status === "ACTIVE" ? "DISABLED" : "ACTIVE";
          return (
            <ButtonGroup className="whitespace-nowrap">
              <Button
                variant="outline"
                size="sm"
                type="button"
                aria-label={`${user.name} ${status === "ACTIVE" ? gridCopy.disable : gridCopy.enable}`}
                disabled={isSelf || update.isPending}
                onClick={() =>
                  update.mutate({
                    id: user.id,
                    input: { status: nextStatus },
                  })
                }
              >
                {status === "ACTIVE" ? (
                  <Ban size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {status === "ACTIVE" ? gridCopy.disable : gridCopy.enable}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={reset.isPending}
                onClick={() => reset.mutate(user.id)}
              >
                <RotateCcw size={14} />
                {gridCopy.resetPassword}
              </Button>
            </ButtonGroup>
          );
        },
        enableSorting: false,
        minSize: locale === "zh-CN" ? 200 : 280,
        meta: {
          cellClassName: "!px-2",
          headerTitle: gridCopy.actions,
        },
        size: locale === "zh-CN" ? 200 : 280,
      },
    ],
    [defaultStaffNoById, gridCopy, locale, me.data?.id, reset, update]
  );
  const userGridActions = (
    <div
      role="group"
      aria-label={gridCopy.filters}
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
    >
      <AdminSelect
        ariaLabel={gridCopy.globalRole}
        className="w-52"
        value={filters.globalRole}
        onValueChange={(value) =>
          setFilters((current) => ({
            ...current,
            globalRole: value as GlobalRole | "",
          }))
        }
        options={[
          { label: gridCopy.allRoles, value: "" },
          ...filterGlobalRoleOptions.map((role) => ({
            label: globalRoleLabels[role],
            value: role,
          })),
        ]}
      />
      <AdminSelect
        ariaLabel={gridCopy.accountStatus}
        className="w-44"
        value={filters.status}
        onValueChange={(value) =>
          setFilters((current) => ({
            ...current,
            status: value as UserStatus | "",
          }))
        }
        options={[
          { label: gridCopy.allStatuses, value: "" },
          { label: gridCopy.activeUsers, value: "ACTIVE" },
          { label: gridCopy.disabledUsers, value: "DISABLED" },
        ]}
      />
      {filters.q || filters.globalRole || filters.status ? (
        <Button
          variant="outline"
          type="button"
          className="whitespace-nowrap"
          onClick={() => setFilters({ q: "", globalRole: "", status: "" })}
        >
          <X size={16} />
          {gridCopy.clearFilters}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <ProjectWingTopBar
        centerPriority
        centerOnMobile
        leading={
          <>
            <ProjectWingTopBarBrand />
            <ProjectWingTopBarReturnAction
              label={`${dictionary.common?.backTo ?? "Back to"} ${dictionary.desktop.apps.home}`}
              onClick={() => router.push(localizedPath("/engagement"))}
            />
            <EmpPortalAction />
          </>
        }
        center={
          <div className="relative w-full min-w-0 justify-self-center">
            <div
              className="project-wing-top-bar-search relative z-10"
              role="search"
            >
              <span
                aria-hidden="true"
                className="project-wing-top-bar-search-icon"
              >
                <Search />
              </span>
              <Input
                aria-label={gridCopy.findUsers}
                label={gridCopy.findUsers}
                className="h-full min-w-0 flex-1 rounded-full border-0 bg-transparent px-2.5 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
                value={filters.q}
                placeholder={gridCopy.findUsers}
                onChange={(event) => {
                  const q = event.currentTarget.value;
                  setFilters((current) => ({
                    ...current,
                    q,
                  }));
                }}
              />
            </div>
          </div>
        }
        actions={
          <EmpTopBarControls
            actionItems={[
              {
                id: "projects",
                label: dictionary.desktop.apps.home,
                icon: <LayoutGrid />,
                onClick: () => router.push(localizedPath("/engagement")),
              },
              {
                id: "confirmation-center",
                label:
                  dictionary.confirmationCenter?.intranet?.shortcut ??
                  dictionary.confirmations?.shortcutLabel ??
                  "Confirmation",
                icon: <Truck />,
                onClick: () => router.push(localizedPath("/confirmations")),
              },
              {
                id: "project-templates",
                label: dictionary.desktop.apps.templates ?? "Template library",
                icon: <BookOpenCheck />,
                onClick: () =>
                  router.push(
                    `${localizedPath("/engagement")}?templateLibrary=1`
                  ),
              },
              {
                id: "smart-forms",
                label: dictionary.desktop.apps.smartForms ?? "Smart Forms",
                icon: <ClipboardList />,
                onClick: () =>
                  router.push(`${localizedPath("/engagement")}?smartForms=1`),
              },
              {
                id: "user-management",
                label: dictionary.common?.userManagement ?? "User management",
                icon: <UserCog />,
                active: true,
                onClick: () => {},
              },
            ]}
            className="justify-self-end"
          />
        }
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-muted/20">
        <section
          aria-labelledby="user-management-title"
          className="grid w-full max-w-none min-w-0 gap-4 p-3 lg:p-4"
        >
          <header className="flex flex-col gap-4 px-1 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="size-5" />
              </span>
              <div className="min-w-0">
                <h1
                  id="user-management-title"
                  className="text-lg font-semibold text-foreground"
                >
                  {gridCopy.pageTitle}
                </h1>
                <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
                  {gridCopy.pageDescription}
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 text-center text-sm lg:w-72">
              <div className="px-3 py-2">
                <div className="font-semibold text-foreground">
                  {userRows.length}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {gridCopy.allUsers}
                </div>
              </div>
              <div className="border-l border-border px-3 py-2">
                <div className="font-semibold text-success">{activeCount}</div>
                <div className="text-[11px] text-muted-foreground">
                  {gridCopy.activeUsers}
                </div>
              </div>
              <div className="border-l border-border px-3 py-2">
                <div className="font-semibold text-muted-foreground">
                  {disabledCount}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {gridCopy.disabledUsers}
                </div>
              </div>
            </div>
          </header>

          <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{gridCopy.createUser}</DialogTitle>
                <DialogDescription>
                  {gridCopy.createUserDescription}
                </DialogDescription>
              </DialogHeader>
              <form
                id="create-user-form"
                className="grid gap-4 py-2 sm:grid-cols-2"
                onSubmit={form.handleSubmit((values) => create.mutate(values))}
              >
                <Field label={gridCopy.email}>
                  <Input {...form.register("email", { required: true })} />
                </Field>
                <Field label={gridCopy.name}>
                  <Input {...form.register("name", { required: true })} />
                </Field>
                <Field label={gridCopy.initialPassword}>
                  <Input {...form.register("password", { required: true })} />
                </Field>
                <Field label={gridCopy.globalRole}>
                  <AdminSelect
                    ariaLabel={gridCopy.globalRole}
                    value={form.watch("globalRole")}
                    onValueChange={(value) =>
                      form.setValue("globalRole", value as GlobalRole, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={editableGlobalRoleOptions.map((role) => ({
                      label: globalRoleLabels[role],
                      value: role,
                    }))}
                  />
                </Field>
                <Field label={gridCopy.staffNo}>
                  <output
                    aria-label="Staff No"
                    className="flex h-9 items-center rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground"
                  >
                    {gridCopy.autoAssigned}
                  </output>
                </Field>
                <Field label={gridCopy.rateStandard}>
                  <output
                    aria-label="Rate standard"
                    className="flex h-9 items-center rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground"
                  >
                    {formatHourlyRate(
                      getStandardHourlyRate(form.watch("globalRole"))
                    )}
                  </output>
                </Field>
              </form>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateUserOpen(false)}
                >
                  {gridCopy.cancel}
                </Button>
                <Button
                  type="submit"
                  form="create-user-form"
                  disabled={create.isPending}
                >
                  <UserPlus size={16} />
                  {gridCopy.createUser}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="min-h-[32rem] min-w-0 overflow-hidden">
            <ProjectWingMasterDataGrid
              locale={locale}
              primaryAction={
                <Button type="button" onClick={() => setCreateUserOpen(true)}>
                  <UserPlus />
                  {gridCopy.createUser}
                </Button>
              }
              actions={userGridActions}
              columns={userColumns}
              data={userRows}
              showRecordCount={!users.isLoading && !users.isError}
              content={
                users.isLoading ? (
                  <CollectionState kind="loading" locale={locale} />
                ) : users.isError ? (
                  <CollectionState
                    kind="error"
                    locale={locale}
                    onRetry={() => {
                      void users.refetch();
                    }}
                  />
                ) : userRows.length === 0 ? (
                  <CollectionState
                    kind={
                      filters.q || filters.status || filters.globalRole
                        ? "filtered"
                        : "empty"
                    }
                    locale={locale}
                    action={
                      filters.q || filters.status || filters.globalRole
                        ? {
                            label: gridCopy.clearFilters,
                            onClick: () =>
                              setFilters({ q: "", status: "", globalRole: "" }),
                          }
                        : undefined
                    }
                  />
                ) : undefined
              }
              emptyMessage={gridCopy.noUsers}
              getRowId={(user) => user.id}
              tableLabel="User list"
              testId="admin-users-data-grid"
              title={gridCopy.userList}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function formatHourlyRate(rate: number | string | null | undefined) {
  if (rate === null || rate === undefined || rate === "") {
    return "—";
  }
  const value = typeof rate === "number" ? rate : Number(rate);
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function resolveStaffNo(user: User, fallback: string) {
  const persistedStaffNo = user.staffNo?.trim() ?? "";
  return /^\d{3}$/.test(persistedStaffNo) ? persistedStaffNo : fallback;
}

function getDefaultStaffNo(index: number, total: number) {
  return String(total - index - 1).padStart(3, "0");
}

function AdminSelect({
  ariaLabel,
  className = "w-full",
  disabled,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
      disabled={disabled}
    >
      <SelectTrigger label={ariaLabel} className={className}>
        <SelectValue>{selectedOption?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem
            key={option.value || "__empty"}
            value={option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
