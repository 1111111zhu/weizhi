import {
  Badge,
  IconButton,
  ProjectWingTopBarAvatar,
  SettingsDialogShell,
  Spinner,
} from "@project-wing/ui";
import {
  AlertCircleIcon,
  FilesIcon,
  HardDriveIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

import brandIcon from "../../../emp/public/brand/icon-white-green.svg";
import { CachePage } from "./cache-page";
import { useDesktopAgentI18n } from "./i18n";
import { SessionPage } from "./session-pages";
import { SettingsPage, useAgentAppearance } from "./settings-page";
import { useDesktopAgentSnapshot } from "./use-desktop-agent";
import { issueStates, workspaceCopy } from "./workspace-copy";

const TrayAccountPopover = lazy(() => import("./tray-account-popover"));
type Section = "current" | "issues" | "cache" | "settings";

export function App() {
  const agent = useDesktopAgentSnapshot();
  const { locale, copy: base } = useDesktopAgentI18n();
  const copy = workspaceCopy(locale);
  const appearance = useAgentAppearance();
  const [section, setSection] = useState<Section>("current");
  const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null);
  useEffect(
    () => window.desktopAgent.onOpenSettings(() => setSection("settings")),
    []
  );
  const user = agent.snapshot?.user;
  const count = Math.max(
    agent.snapshot?.sessions.filter((session) =>
      issueStates.has(session.lifecycleState ?? session.status)
    ).length ?? 0,
    agent.snapshot?.recoveryRequired ? agent.snapshot.attentionCount : 0
  );
  const refresh = () => {
    void agent.run(() => window.desktopAgent.refresh());
  };
  return (
    <div className="agent-workspace bg-background text-foreground flex h-full min-h-0 flex-col">
      <header className="border-border/60 bg-popover flex h-16 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-3">
          <img alt="" src={brandIcon} className="size-8" />
          <span className="text-base font-medium">Desktop Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            {user && !agent.snapshot?.stale
              ? copy.connected
              : copy.disconnected}
          </span>
          <IconButton
            icon={agent.busy ? <Spinner /> : <RefreshCwIcon />}
            label={base.refresh}
            disabled={agent.busy}
            size="icon-sm"
            variant="quiet"
            onClick={refresh}
          />
          {user ? (
            <Suspense
              fallback={
                <ProjectWingTopBarAvatar
                  name={user.name}
                  label={base.accountMenu}
                  size="sm"
                />
              }
            >
              <TrayAccountPopover
                {...user}
                onSignOut={() =>
                  void agent.run(() => window.desktopAgent.signOut())
                }
              />
            </Suspense>
          ) : (
            <ProjectWingTopBarAvatar
              name={base.guest}
              label={base.accountMenu}
              size="sm"
            />
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <SettingsDialogShell
          headerActions={
            <div ref={setHeaderHost} className="flex items-center gap-3" />
          }
          activeId={section}
          onActiveIdChange={setSection}
          breadcrumbRoot="Desktop Agent"
          navigationLabel={copy.navigation}
          items={[
            { id: "current", icon: FilesIcon, label: copy.current },
            {
              id: "issues",
              icon: AlertCircleIcon,
              label: copy.issues,
              badge:
                count > 0 ? (
                  <Badge size="xs" radius="full" variant="secondary">
                    {count}
                  </Badge>
                ) : undefined,
            },
            { id: "cache", icon: HardDriveIcon, label: copy.cache },
            { id: "settings", icon: SettingsIcon, label: copy.settings },
          ]}
        >
          {agent.actionError ? (
            <p role="alert" className="text-destructive text-sm">
              {agent.actionError}
            </p>
          ) : null}
          {section === "current" || section === "issues" ? (
            <SessionPage
              headerHost={headerHost}
              key={section}
              snapshot={agent.snapshot}
              issues={section === "issues"}
              refresh={refresh}
            />
          ) : null}
          {section === "cache" ? <CachePage headerHost={headerHost} /> : null}
          {section === "settings" ? (
            <SettingsPage appearance={appearance} />
          ) : null}
        </SettingsDialogShell>
      </div>
    </div>
  );
}
