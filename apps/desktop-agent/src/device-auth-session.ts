import type { DesktopAgentStartDevicePair } from "@project-wing/shared/desktop";

type DeviceAuthFetcher = (
  url: string,
  init: RequestInit
) => Promise<Pick<Response, "ok" | "json">>;

export type DesktopAgentDeviceAuthStatus = {
  authenticated: boolean;
  pairing: boolean;
  lastError?: "DEVICE_AUTHORIZATION_FAILED";
};

export type StartDesktopAgentDevicePairInput = DesktopAgentStartDevicePair;

export type DesktopAgentDeviceAuthSession = {
  status: () => DesktopAgentDeviceAuthStatus;
  getAuthorization: () => string | null;
  startPair: (input: StartDesktopAgentDevicePairInput) => Promise<void>;
};

type DeviceAuthSessionOptions = {
  fetcher?: DeviceAuthFetcher;
  now?: () => Date;
  wait?: (milliseconds: number) => Promise<void>;
};

type DeviceTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
};

const MAX_DEVICE_PAIR_SECONDS = 30 * 60;

export function createDeviceAuthSession(options: DeviceAuthSessionOptions) {
  return new DeviceAuthSession(options);
}

class DeviceAuthSession {
  private accessToken: string | null = null;
  private expiresAt: Date | null = null;
  private pairing = false;
  private pairingPromise: Promise<void> | null = null;
  private lastError: DesktopAgentDeviceAuthStatus["lastError"];

  constructor(private readonly options: DeviceAuthSessionOptions) {}

  status(): DesktopAgentDeviceAuthStatus {
    this.clearExpiredSession();
    return {
      authenticated: Boolean(this.accessToken),
      pairing: this.pairing,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  getAuthorization() {
    this.clearExpiredSession();
    return this.accessToken ? `Bearer ${this.accessToken}` : null;
  }

  startPair(input: StartDesktopAgentDevicePairInput) {
    if (this.pairingPromise) {
      return this.pairingPromise;
    }
    this.accessToken = null;
    this.expiresAt = null;
    this.lastError = undefined;
    this.pairing = true;
    const pairingPromise = this.pollForDeviceToken(input);
    this.pairingPromise = pairingPromise;
    return pairingPromise.finally(() => this.finishPairing(pairingPromise));
  }

  private finishPairing(pairingPromise: Promise<void>) {
    if (this.pairingPromise !== pairingPromise) {
      return;
    }
    this.pairing = false;
    this.pairingPromise = null;
  }

  private async pollForDeviceToken(input: StartDesktopAgentDevicePairInput) {
    const expiresAt = new Date(
      this.now().getTime() + clampPairLifetime(input.expiresInSeconds) * 1000
    );
    let intervalSeconds = clampPollingInterval(input.intervalSeconds);

    while (this.now() < expiresAt) {
      const response = await this.requestToken(input);
      if (response.accessToken) {
        this.storeAccessToken(response.accessToken, response.expiresInSeconds);
        return;
      }
      if (
        response.error !== "authorization_pending" &&
        response.error !== "slow_down"
      ) {
        this.lastError = "DEVICE_AUTHORIZATION_FAILED";
        return;
      }
      if (response.error === "slow_down") {
        intervalSeconds += 5;
      }
      await this.wait(intervalSeconds * 1000);
    }
    this.lastError = "DEVICE_AUTHORIZATION_FAILED";
  }

  private async requestToken(input: StartDesktopAgentDevicePairInput) {
    try {
      const response = await (this.options.fetcher ?? fetch)(
        `${normalizeBaseUrl(input.authBaseUrl)}/auth/device/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: input.deviceCode,
            client_id: input.clientId,
          }),
        }
      );
      const body = (await response
        .json()
        .catch(() => null)) as DeviceTokenResponse | null;
      return parseDeviceTokenResponse(response.ok, body);
    } catch {
      return { error: "network_error" };
    }
  }

  private storeAccessToken(accessToken: string, expiresInSeconds: number) {
    this.accessToken = accessToken;
    this.expiresAt = new Date(this.now().getTime() + expiresInSeconds * 1000);
  }

  private clearExpiredSession() {
    if (this.expiresAt && this.expiresAt <= this.now()) {
      this.accessToken = null;
      this.expiresAt = null;
    }
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }

  private wait(milliseconds: number) {
    return this.options.wait?.(milliseconds) ?? wait(milliseconds);
  }
}

function parseDeviceTokenResponse(
  ok: boolean,
  body: DeviceTokenResponse | null
) {
  if (ok && typeof body?.access_token === "string" && body.access_token) {
    return {
      accessToken: body.access_token,
      expiresInSeconds: toPositiveInteger(body.expires_in, 60 * 60),
    };
  }
  return { error: typeof body?.error === "string" ? body.error : "unknown" };
}

function clampPairLifetime(value: number) {
  return Math.min(
    Math.max(toPositiveInteger(value, MAX_DEVICE_PAIR_SECONDS), 1),
    MAX_DEVICE_PAIR_SECONDS
  );
}

function clampPollingInterval(value: number) {
  return Math.max(toPositiveInteger(value, 5), 1);
}

function toPositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
