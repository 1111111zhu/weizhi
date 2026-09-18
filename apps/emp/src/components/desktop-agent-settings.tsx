"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  MonitorCog,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

import {
  clearDesktopAgentReleaseManifestCache,
  getDesktopAgentAuthStatus,
  getDesktopAgentReleaseManifest,
  getDesktopAgentStatus,
  getDesktopAgentUpdateStatus,
  pairDesktopAgentWithBetterAuth,
} from "../api/desktop-agent";
import { getDesktopAgentVersionPolicy } from "../config/desktop-agent";
import { useI18n } from "../i18n/client";
import { defaultDesktopAgentManagementCopy } from "../i18n/dictionaries";
import {
  desktopAgentNeedsFileAttention,
  DesktopAgentRecoveryError,
  launchDesktopAgentRecovery,
  waitForDesktopAgentRecovery,
} from "./desktop-agent-recovery";
import { compareVersions } from "./desktop-agent-session-update-check";
import { resolveAgentSettingsState } from "./desktop-agent-settings-state";
import type { AgentServiceState } from "./desktop-agent-settings-state";
import { useToast } from "./toast";

const AGENT_STATUS_QUERY_KEY = ["desktop-agent-status"] as const;
const AGENT_MANIFEST_QUERY_KEY = [
  "desktop-agent-release-manifest",
  "windows",
] as const;
const AGENT_UPDATE_QUERY_KEY = ["desktop-agent-update-status"] as const;
const AGENT_AUTH_QUERY_KEY = ["desktop-agent-auth-status"] as const;
export function DesktopAgentSettings() {
  const { dictionary } = useI18n();
  const copy =
    dictionary.workbench.settingsPanel.desktopAgentManagement ??
    defaultDesktopAgentManagementCopy;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const recoveryAbort = useRef<AbortController | null>(null);
  const recoveryActive = useRef(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [launchIntent, setLaunchIntent] = useState<"open" | "recover">("open");
  const [hasResponded, setHasResponded] = useState(false);
  const [updateRestartGrace, setUpdateRestartGrace] = useState(false);
  useEffect(() => () => recoveryAbort.current?.abort(), []);
  const isWindows =
    typeof navigator === "undefined" ||
    navigator.userAgent.toLowerCase().includes("windows");
  const statusQuery = useQuery({
    queryKey: AGENT_STATUS_QUERY_KEY,
    queryFn: () => getDesktopAgentStatus(),
    retry: false,
    refetchInterval: 5000,
  });
  const manifestQuery = useQuery({
    queryKey: AGENT_MANIFEST_QUERY_KEY,
    queryFn: () => getDesktopAgentReleaseManifest(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const updateStatusQuery = useQuery({
    queryKey: AGENT_UPDATE_QUERY_KEY,
    queryFn: () => getDesktopAgentUpdateStatus(),
    enabled: Boolean(statusQuery.data?.isInstalled),
    retry: false,
    refetchInterval: 5000,
  });
  const authQuery = useQuery({
    queryKey: AGENT_AUTH_QUERY_KEY,
    queryFn: () => getDesktopAgentAuthStatus(),
    enabled: Boolean(statusQuery.data?.isInstalled),
    retry: false,
    refetchInterval: 5000,
  });
  const health = statusQuery.isError ? null : statusQuery.data?.health;
  const currentVersion = health?.version;
  const reachable = Boolean(health);
  const updateObserved =
    health?.app === "project-wing-desktop-runtime" &&
    health.agentState === "UPDATING";
  useEffect(() => {
    if (reachable) {
      setHasResponded(true);
    }
  }, [reachable]);
  useEffect(() => {
    if (updateObserved) {
      setUpdateRestartGrace(true);
      return;
    }
    if (reachable) {
      setUpdateRestartGrace(false);
      return;
    }
    if (!updateRestartGrace) {
      return;
    }
    const timer = window.setTimeout(() => setUpdateRestartGrace(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [updateObserved, reachable, updateRestartGrace]);
  const fileAttention = health
    ? desktopAgentNeedsFileAttention(statusQuery.data)
    : false;
  const serviceAttention =
    health?.app === "project-wing-desktop-runtime" &&
    health.agentState === "READY_WITH_ATTENTION";
  const latestVersion = manifestQuery.data?.version;
  const updateAvailable = Boolean(
    currentVersion &&
    latestVersion &&
    compareVersions(currentVersion, latestVersion) < 0
  );
  const diagnostics = useMemo(
    () =>
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          health: statusQuery.data?.health ?? null,
          auth: authQuery.data ?? null,
          release: manifestQuery.data ?? null,
          update: updateStatusQuery.data ?? null,
        },
        null,
        2
      ),
    [
      authQuery.data,
      manifestQuery.data,
      statusQuery.data?.health,
      updateStatusQuery.data,
    ]
  );
  const pairingMutation = useMutation({
    mutationFn: () => pairDesktopAgentWithBetterAuth(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AGENT_AUTH_QUERY_KEY });
      toast({ title: copy.pairSuccess, variant: "success" });
    },
    onError: () => toast({ title: copy.actionFailed, variant: "destructive" }),
  });
  const configuredMinimum =
    getDesktopAgentVersionPolicy().minimumSupportedVersion;
  const publishedMinimum = manifestQuery.data?.minimumSupportedVersion;
  const minimumVersion =
    publishedMinimum && compareVersions(publishedMinimum, configuredMinimum) > 0
      ? publishedMinimum
      : configuredMinimum;
  const viewState = resolveAgentSettingsState({
    status: statusQuery.data,
    statusFailed: statusQuery.isError,
    checking: statusQuery.isLoading,
    auth: authQuery.isError ? null : authQuery.data,
    authChecking: authQuery.isLoading,
    pairing: pairingMutation.isPending,
    minimumVersion,
    latestVersion,
    waitingForUpdateRestart: updateRestartGrace,
  });
  const serviceReady = viewState.service === "ready";
  const serviceUpdating =
    viewState.service === "updating" ||
    viewState.service === "update-reconnecting";
  const pairingRequired = viewState.account === "disconnected";
  const minimumSelfUpdate =
    manifestQuery.data?.minimumSelfUpdateVersion ??
    getDesktopAgentVersionPolicy().minimumSelfUpdateVersion;
  const needsInstallerUpdate =
    viewState.action === "update" &&
    Boolean(
      currentVersion && compareVersions(currentVersion, minimumSelfUpdate) < 0
    );
  const recoveryMutation = useMutation({
    mutationFn: () => {
      const controller = new AbortController();
      recoveryAbort.current = controller;
      return waitForDesktopAgentRecovery(controller.signal);
    },
    onSuccess: async (outcome) => {
      if (recoveryAbort.current?.signal.aborted) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: AGENT_STATUS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: AGENT_AUTH_QUERY_KEY });
      const attentionMessage =
        outcome === "attention"
          ? copy.fileAttention
          : outcome === "service_attention"
            ? copy.serviceAttention
            : null;
      setRecoveryMessage(attentionMessage);
      toast({
        title: attentionMessage ?? copy.recoveryConfirmed,
        variant: attentionMessage ? "info" : "success",
      });
    },
    onError: (error) => {
      if (recoveryAbort.current?.signal.aborted) {
        return;
      }
      const message =
        error instanceof DesktopAgentRecoveryError
          ? error.reason === "updating"
            ? copy.recoveryUpdating
            : error.reason === "update_required"
              ? copy.recoveryUpdateRequired
              : error.reason === "not_ready"
                ? copy.recoveryNeedsAttention
                : copy.recoveryUnconfirmed
          : copy.recoveryUnconfirmed;
      setRecoveryMessage(message);
    },
    onSettled: () => {
      recoveryActive.current = false;
    },
  });

  if (!isWindows) {
    return (
      <Alert>
        <MonitorCog />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.unsupported}</AlertDescription>
      </Alert>
    );
  }

  const checking = viewState.service === "checking";
  const unavailable = viewState.service === "unreachable";
  const serviceTitles: Record<AgentServiceState, string> = {
    checking: copy.checking,
    unreachable: hasResponded ? copy.connectionLost : copy.notRunning,
    starting: copy.startingService,
    recovering: copy.recovering,
    updating: copy.updating,
    "update-reconnecting": copy.updateReconnecting,
    unavailable: copy.needsAttention,
    ready: copy.connected,
  };
  let heading = serviceTitles[viewState.service];
  if (serviceReady) {
    heading =
      viewState.version === "required"
        ? copy.updateRequired
        : viewState.account === "connecting"
          ? copy.pairing
          : authQuery.isLoading
            ? copy.checkingAccount
            : viewState.account === "unknown"
              ? copy.accountUnconfirmed
              : pairingRequired
                ? copy.accountRequired
                : copy.ready;
  } else if (recoveryMutation.isPending && !serviceUpdating) {
    heading = launchIntent === "open" ? copy.waitingForApp : copy.recovering;
  }
  let help = copy.readyHelp;
  if (viewState.service === "update-reconnecting") {
    help = copy.updateReconnectingHelp;
  } else if (serviceUpdating) {
    help = copy.recoveryUpdating;
  } else if (recoveryMutation.isPending && !serviceReady) {
    help = copy.allowBrowserOpen;
  } else if (unavailable) {
    help = copy.unavailableHelp;
  } else if (
    viewState.service === "starting" ||
    viewState.service === "recovering"
  ) {
    help = copy.serviceStartingHelp;
  } else if (!serviceReady) {
    help = copy.notReadyHelp;
  } else if (viewState.version === "required") {
    help = copy.updateHelp;
  } else if (viewState.account === "connecting") {
    help = copy.pairingHelp;
  } else if (viewState.account === "unknown") {
    help = copy.accountRetryHelp;
  } else if (pairingRequired) {
    help = copy.pairHelp;
  } else if (fileAttention) {
    help = copy.fileHelp;
  } else if (serviceAttention) {
    help = copy.serviceHelp;
  }
  const refresh = () => {
    clearDesktopAgentReleaseManifestCache();
    void Promise.all([
      manifestQuery.refetch(),
      statusQuery.refetch(),
      authQuery.refetch(),
      updateStatusQuery.refetch(),
    ]);
  };
  const download = () => {
    const downloadUrl = manifestQuery.data?.downloadUrl;
    if (!downloadUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `desktop-agent-win-x64-${latestVersion}.exe`;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const requestApplication = (intent: "open" | "recover") => {
    if (recoveryActive.current) {
      return;
    }
    recoveryActive.current = true;
    setLaunchIntent(intent);
    setRecoveryMessage(null);
    launchDesktopAgentRecovery(intent);
    recoveryMutation.mutate();
  };
  const primaryLabel = serviceUpdating
    ? heading
    : recoveryMutation.isPending
      ? launchIntent === "open"
        ? copy.waitingForApp
        : copy.recovering
      : viewState.action === "recover"
        ? copy.recover
        : viewState.action === "check"
          ? copy.recheck
          : viewState.action === "connect"
            ? copy.connectAccount
            : viewState.action === "update"
              ? needsInstallerUpdate
                ? copy.downloadVersion.replace("{version}", latestVersion ?? "")
                : copy.updateInApp
              : viewState.action === "wait"
                ? heading
                : copy.openAgent;
  const primaryAction = () => {
    if (viewState.action === "recover") {
      requestApplication("recover");
    } else if (viewState.action === "check") {
      refresh();
    } else if (viewState.action === "connect") {
      pairingMutation.mutate();
    } else if (needsInstallerUpdate) {
      download();
    } else if (viewState.action === "open" && unavailable) {
      requestApplication("open");
    } else if (viewState.action === "open" || viewState.action === "update") {
      launchDesktopAgentRecovery("open");
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="flex items-center gap-2">
            {checking ? (
              <Skeleton className="size-5 rounded-full" />
            ) : serviceReady ? (
              <Check className="size-5 text-primary" />
            ) : (
              <ShieldAlert className="size-5 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">
              {checking ? copy.checking : heading}
            </h2>
          </div>
          {!checking && (
            <p className="mt-2 text-sm text-muted-foreground">{help}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.recheck}
          disabled={
            manifestQuery.isFetching ||
            statusQuery.isFetching ||
            serviceUpdating
          }
          onClick={refresh}
        >
          <RefreshCcw
            className={statusQuery.isFetching ? "animate-spin" : undefined}
          />
        </Button>
      </div>

      <dl className="divide-y divide-border rounded-lg bg-muted/40 px-4">
        <div className="flex flex-wrap justify-between gap-3 py-3">
          <dt className="text-sm text-muted-foreground">{copy.connection}</dt>
          <dd className="text-sm">
            {unavailable ? copy.notDetected : serviceTitles[viewState.service]}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-3 py-3">
          <dt className="text-sm text-muted-foreground">{copy.account}</dt>
          <dd className="text-sm">
            {viewState.account === "unknown"
              ? copy.accountUnknown
              : viewState.account === "connecting"
                ? copy.pairing
                : viewState.account === "connected"
                  ? copy.accountConnected
                  : copy.accountRequired}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-3 py-3">
          <dt className="text-sm text-muted-foreground">{copy.version}</dt>
          <dd className="text-sm">
            {currentVersion ?? copy.unknownVersion}
            {latestVersion && updateAvailable ? (
              <span className="ml-3 text-muted-foreground">
                {copy.latest} {latestVersion}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col items-start gap-3">
        {unavailable && !recoveryMutation.isPending ? (
          <p className="text-sm text-muted-foreground">
            {copy.alreadyInstalled}
          </p>
        ) : null}
        <Button
          className="h-auto min-h-8 max-w-full whitespace-normal"
          disabled={
            viewState.action === "wait" ||
            recoveryMutation.isPending ||
            serviceUpdating ||
            pairingMutation.isPending ||
            authQuery.data?.pairing === true ||
            (needsInstallerUpdate && !manifestQuery.data)
          }
          onClick={primaryAction}
        >
          {viewState.action === "recover" || recoveryMutation.isPending ? (
            <RefreshCcw
              className={
                recoveryMutation.isPending ? "animate-spin" : undefined
              }
            />
          ) : (
            <MonitorCog />
          )}
          {primaryLabel}
        </Button>
        {recoveryMessage && !serviceReady && !serviceUpdating ? (
          <output className="text-sm text-muted-foreground">
            {recoveryMessage}
          </output>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {manifestQuery.isError
            ? copy.releaseUnavailable
            : unavailable
              ? copy.notInstalledHelp
              : copy.downloadHelp}
        </p>
        {manifestQuery.data && !needsInstallerUpdate ? (
          <Button
            variant="outline"
            onClick={download}
            disabled={serviceUpdating || recoveryMutation.isPending}
          >
            <Download />
            {copy.downloadVersion.replace("{version}", latestVersion ?? "")}
          </Button>
        ) : null}
      </div>

      <Collapsible>
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
          {copy.moreActions}
          <ChevronDown />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {unavailable && !recoveryMessage && !recoveryMutation.isPending ? (
            <p className="mb-3 text-sm text-muted-foreground">
              {copy.recoveryUnconfirmed}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {viewState.service === "unavailable" ||
            viewState.service === "starting" ||
            viewState.service === "recovering" ? (
              <Button
                variant="outline"
                onClick={() => launchDesktopAgentRecovery("open")}
              >
                <MonitorCog />
                {copy.openAgent}
              </Button>
            ) : null}
            {serviceReady && (
              <Button
                variant="outline"
                disabled={recoveryMutation.isPending || serviceUpdating}
                onClick={() => requestApplication("recover")}
              >
                <RefreshCcw />
                {copy.recover}
              </Button>
            )}
            {serviceReady && !pairingRequired && (
              <Button
                variant="outline"
                disabled={
                  pairingMutation.isPending || authQuery.data?.pairing === true
                }
                onClick={() => pairingMutation.mutate()}
              >
                {copy.pair}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(diagnostics);
                  toast({ title: copy.copied, variant: "success" });
                } catch {
                  toast({ title: copy.actionFailed, variant: "destructive" });
                }
              }}
            >
              <Clipboard />
              {copy.diagnostics}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

export {
  DesktopAgentSessionUpdateCheck,
  resetDesktopAgentSessionUpdateCheck,
} from "./desktop-agent-session-update-check";
