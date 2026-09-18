const DEFAULT_MINIMUM_DESKTOP_AGENT_SELF_UPDATE_VERSION = "0.1.10";
const DEFAULT_MINIMUM_DESKTOP_AGENT_VERSION = "0.2.0";
const DESKTOP_AGENT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+].*)?$/;

export type DesktopAgentVersionPolicy = {
  minimumSupportedVersion: string;
  minimumSelfUpdateVersion: string;
};

export function getDesktopAgentVersionPolicy(): DesktopAgentVersionPolicy {
  return {
    minimumSupportedVersion: normalizeConfiguredDesktopAgentVersion(
      process.env.NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION,
      DEFAULT_MINIMUM_DESKTOP_AGENT_VERSION
    ),
    minimumSelfUpdateVersion: normalizeConfiguredDesktopAgentVersion(
      process.env.NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION,
      DEFAULT_MINIMUM_DESKTOP_AGENT_SELF_UPDATE_VERSION
    ),
  };
}

function normalizeConfiguredDesktopAgentVersion(
  value: string | undefined,
  fallback: string
): string {
  const normalized = value?.trim();
  return normalized && DESKTOP_AGENT_VERSION_PATTERN.test(normalized)
    ? normalized
    : fallback;
}
