"use client";

import { Button, CollectionState, MobileListItem } from "@project-wing/ui";
import {
  Check,
  ClipboardList,
  Monitor,
  Moon,
  Settings2,
  Sun,
  UserRound,
  Recycle,
  PlugZap,
  MonitorCog,
} from "lucide-react";

import {
  mobileAccountFixture,
  mobileAccountRank,
} from "./mobile-account-model";
import { canViewMobileSettingsPage } from "./mobile-settings-model";
import {
  MobileRecycleBin,
  MobileServiceSettings,
} from "./mobile-settings-services";
import { initialMobileRoute, mobileRouteHref } from "./mobile-workspace-model";
import type { MobileDemoState } from "./mobile-workspace-model";
import { updateMobileState } from "./mobile-workspace-state";
import type { MobileWorkspaceContext } from "./mobile-workspace-state";

export const settingsRoute = (section = "") => ({
  ...initialMobileRoute,
  screen: "settings" as const,
  section,
});

export function MobileAccount({
  workspace,
}: {
  workspace: MobileWorkspaceContext;
}) {
  const { follow } = workspace;
  const profile = settingsRoute("profile");
  const settings = settingsRoute();
  const empWorkItems = {
    ...initialMobileRoute,
    screen: "emp-work-items" as const,
  };
  return (
    <div className="grid auto-rows-fr">
      <MobileListItem
        title={mobileAccountFixture.name}
        description={mobileAccountFixture.email}
        href={mobileRouteHref(profile)}
        onNavigate={follow(profile)}
        icon={<UserRound />}
      />
      <MobileListItem
        title="设置"
        href={mobileRouteHref(settings)}
        onNavigate={follow(settings)}
        icon={<Settings2 />}
      />
      <MobileListItem
        title="EMP待办"
        href={mobileRouteHref(empWorkItems)}
        onNavigate={follow(empWorkItems)}
        icon={<ClipboardList />}
      />
    </div>
  );
}

export function MobileSettings({
  workspace,
}: {
  workspace: MobileWorkspaceContext;
}) {
  const { route, state, follow } = workspace;
  const prefs = state.preferences;
  // This isolated fixture is an ordinary account, never an administrator.
  if (!canViewMobileSettingsPage(route.section, false)) {
    return (
      <CollectionState
        kind="error"
        locale="zh-CN"
        title="无权访问此设置"
        description=""
        action={{
          label: "返回设置",
          onClick: () => workspace.navigate(settingsRoute(), true),
        }}
      />
    );
  }
  if (route.section === "recycleBin") {
    return <MobileRecycleBin />;
  }
  if (
    ["desktopAgent", "agentCache", "integrations", "mail"].includes(
      route.section
    )
  ) {
    return <MobileServiceSettings workspace={workspace} />;
  }
  const setPreference = (patch: Partial<MobileDemoState["preferences"]>) =>
    updateMobileState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }));
  if (route.section === "profile") {
    return (
      <dl className="divide-y divide-border">
        <div className="grid gap-1 py-3">
          <dt className="text-sm text-muted-foreground">姓名</dt>
          <dd>{mobileAccountFixture.name}</dd>
        </div>
        <div className="grid gap-1 py-3">
          <dt className="text-sm text-muted-foreground">邮箱</dt>
          <dd className="break-all">{mobileAccountFixture.email}</dd>
        </div>
        <div className="grid gap-1 py-3">
          <dt className="text-sm text-muted-foreground">职级</dt>
          <dd>{mobileAccountRank(mobileAccountFixture.globalRole)}</dd>
        </div>
      </dl>
    );
  }
  if (route.section !== "appearance") {
    return (
      <div className="grid">
        <MobileListItem
          title="个性化"
          description={`${prefs.theme === "system" ? "跟随系统" : prefs.theme === "dark" ? "深色" : "浅色"} / ${prefs.density === "compact" ? "紧凑" : "舒适"}`}
          href={mobileRouteHref(settingsRoute("appearance"))}
          onNavigate={follow(settingsRoute("appearance"))}
          icon={<Monitor />}
        />
        {[
          { section: "recycleBin", title: "回收站", icon: Recycle },
          { section: "desktopAgent", title: "Desktop Agent", icon: MonitorCog },
          { section: "integrations", title: "连接与集成", icon: PlugZap },
        ].map((item) => (
          <MobileListItem
            key={item.section}
            title={item.title}
            href={mobileRouteHref(settingsRoute(item.section))}
            onNavigate={follow(settingsRoute(item.section))}
            icon={<item.icon />}
          />
        ))}
        <MobileListItem
          title="账户资料"
          href={mobileRouteHref(settingsRoute("profile"))}
          onNavigate={follow(settingsRoute("profile"))}
          icon={<UserRound />}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-3 text-sm font-semibold">主题</legend>
        {(
          [
            { value: "system", label: "跟随系统", icon: Monitor },
            { value: "light", label: "浅色", icon: Sun },
            { value: "dark", label: "深色", icon: Moon },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            fullWidth
            variant={prefs.theme === value ? "secondary" : "outline"}
            aria-pressed={prefs.theme === value}
            onClick={() => setPreference({ theme: value })}
          >
            <Icon aria-hidden />
            {label}
            {prefs.theme === value ? <Check aria-hidden /> : null}
          </Button>
        ))}
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">列表密度</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "compact", label: "紧凑" },
              { value: "default", label: "舒适" },
            ] as const
          ).map(({ value, label }) => (
            <Button
              key={value}
              fullWidth
              variant={prefs.density === value ? "secondary" : "outline"}
              aria-pressed={prefs.density === value}
              onClick={() => setPreference({ density: value })}
            >
              {label}
              {prefs.density === value ? <Check aria-hidden /> : null}
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">文字大小</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "standard", label: "标准" },
              { value: "large", label: "大字" },
            ] as const
          ).map(({ value, label }) => (
            <Button
              key={value}
              fullWidth
              variant={prefs.textSize === value ? "secondary" : "outline"}
              aria-pressed={prefs.textSize === value}
              onClick={() => setPreference({ textSize: value })}
            >
              {label}
              {prefs.textSize === value ? <Check aria-hidden /> : null}
            </Button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
