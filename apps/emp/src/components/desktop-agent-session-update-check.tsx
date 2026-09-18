"use client";

import { projectWingToast as sonnerToast } from "@project-wing/ui";
import { useEffect } from "react";

import {
  clearDesktopAgentReleaseManifestCache,
  getDesktopAgentReleaseManifest,
  getDesktopAgentStatus,
} from "../api/desktop-agent";
import { useI18n } from "../i18n/client";

const SESSION_CHECK_KEY = "project-wing-desktop-agent-release-checked";

export function DesktopAgentSessionUpdateCheck({
  enabled,
}: {
  enabled: boolean;
}) {
  const { dictionary } = useI18n();
  const copy = dictionary.workbench?.settingsPanel?.desktopAgentManagement;

  useEffect(() => {
    if (
      !enabled ||
      !copy ||
      !navigator.userAgent.toLowerCase().includes("windows")
    ) {
      return;
    }
    const checkedVersion = window.sessionStorage.getItem(SESSION_CHECK_KEY);
    if (checkedVersion === "checking") {
      return;
    }
    window.sessionStorage.setItem(SESSION_CHECK_KEY, "checking");
    void Promise.all([
      getDesktopAgentStatus(),
      getDesktopAgentReleaseManifest(),
    ])
      .then(([status, release]) => {
        window.sessionStorage.setItem(SESSION_CHECK_KEY, release.version);
        if (checkedVersion === release.version) {
          return;
        }
        const currentVersion = status.health?.version;
        if (
          !currentVersion ||
          compareVersions(currentVersion, release.version) >= 0
        ) {
          return;
        }
        const required =
          compareVersions(currentVersion, release.minimumSupportedVersion) < 0;
        const options = {
          description: `${copy.version}: ${currentVersion} -> ${copy.latest}: ${release.version}`,
        };
        if (required) {
          sonnerToast.error(copy.updateRequired, options);
        } else {
          sonnerToast.info(copy.updateAvailable, options);
        }
      })
      .catch(() => window.sessionStorage.removeItem(SESSION_CHECK_KEY));
  }, [copy, enabled]);

  return null;
}

export function resetDesktopAgentSessionUpdateCheck() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_CHECK_KEY);
    clearDesktopAgentReleaseManifestCache();
  }
}

export function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[.+-]/, 3).map(Number);
  const rightParts = right.split(/[.+-]/, 3).map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
