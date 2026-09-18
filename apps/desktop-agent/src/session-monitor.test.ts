import type { DesktopAgentSession } from "@project-wing/shared/desktop";
import { getDesktopAgentCompatibilityStatus } from "@project-wing/shared/desktop";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopAgentError } from "./errors.js";
import type { LocalFileProbeResult } from "./file-busy.js";
import { startSessionMonitor } from "./session-monitor.js";

describe("desktop agent session monitor", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("refreshes persisted sessions immediately and on an interval", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue([]);
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(refresh).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1000);

    expect(refresh).toHaveBeenCalledTimes(2);

    monitor.stop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("continues polling after a refresh failure", async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary session write failure"))
      .mockResolvedValue([]);
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(refresh).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1000);

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Project Wing desktop agent session monitor failed:",
      expect.any(Error)
    );

    monitor.stop();
    consoleError.mockRestore();
  });

  it("heartbeats LAUNCHING sessions but does not retry release", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T01:55:10.000Z"));
    const session = makeSession({ lifecycleState: "LAUNCHING" });
    const refresh = vi.fn().mockResolvedValue([session]);
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const checkInDesktopSession = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      heartbeatDesktopSession,
      checkInDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(heartbeatDesktopSession).toHaveBeenCalledOnce();
    expect(checkInDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("sends the persisted fencing token with heartbeats", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T01:55:10.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      lockEpoch: 5,
    });
    const fetchHeartbeat = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchHeartbeat);

    const monitor = startSessionMonitor({
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([session]),
        updateIf: vi.fn().mockResolvedValue(session),
      },
      checkInDesktopSession: vi.fn(),
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchHeartbeat).toHaveBeenCalledWith(
      expect.stringContaining("/heartbeat"),
      expect.objectContaining({
        body: JSON.stringify({
          projectId: "project-1",
          attachmentId: "attachment-1",
          grantSecret: "grant-secret",
          lockEpoch: 5,
        }),
      })
    );

    monitor.stop();
  });

  it("heartbeats zip entry sessions through their custom callback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T01:55:10.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      checkInUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const checkInDesktopSession = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      heartbeatDesktopSession,
      checkInDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(heartbeatDesktopSession).toHaveBeenCalledWith(
      expect.objectContaining({
        heartbeatUrl:
          "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/heartbeat",
      })
    );
    expect(checkInDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it.each(["OPEN_NOT_OBSERVED", "LAUNCH_FAILED"] as const)(
    "does not heartbeat %s sessions because no user-visible workbook is proven",
    async (lifecycleState) => {
      vi.useFakeTimers();
      const session = makeSession({
        lifecycleState,
        openObservedAt: undefined,
      });
      const refresh = vi.fn().mockResolvedValue([session]);
      const heartbeatDesktopSession = vi.fn().mockResolvedValue();
      const monitor = startSessionMonitor({
        sessionStore: { refresh },
        heartbeatDesktopSession,
        localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
        hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
        apiBaseUrl: "http://localhost:3000",
        intervalMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(heartbeatDesktopSession).not.toHaveBeenCalled();

      monitor.stop();
    }
  );

  it("does not heartbeat stale LAUNCHING sessions that already passed the observation window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:03:00.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
      launchStartedAt: "2026-06-05T02:00:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf: vi.fn() },
      heartbeatDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      openObservationTimeoutMs: 120_000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(heartbeatDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("uses the shared 20 second open observation timeout by default", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:00:21.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
      launchStartedAt: "2026-06-05T02:00:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      heartbeatDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(heartbeatDesktopSession).not.toHaveBeenCalled();
    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "LAUNCH_FAILED",
        lastError:
          "Excel open was not observed before the launch observation timeout.",
      })
    );

    monitor.stop();
  });

  it("uses file-type-specific open observation timeout messages", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:00:46.000Z"));
    const session = makeSession({
      fileName: "support.pdf",
      localPath: "C:\\ProjectWing\\support.pdf",
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
      launchStartedAt: "2026-06-05T02:00:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "LAUNCH_FAILED",
        lastError:
          "PDF open was not observed before the launch observation timeout.",
      })
    );

    monitor.stop();
  });

  it("keeps launching PDF sessions active inside the PDF observation window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:00:21.000Z"));
    const session = makeSession({
      fileName: "support.pdf",
      localPath: "C:\\ProjectWing\\support.pdf",
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
      launchStartedAt: "2026-06-05T02:00:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      heartbeatDesktopSession: vi.fn().mockResolvedValue(),
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "LAUNCH_FAILED",
      })
    );

    monitor.stop();
  });

  it("does not heartbeat OPEN sessions unless open observation was recorded", async () => {
    vi.useFakeTimers();
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: undefined,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      heartbeatDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(heartbeatDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("does not hash an OPEN file on every monitor interval", async () => {
    vi.useFakeTimers();
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
      contentState: "UNCHANGED",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi
      .fn()
      .mockResolvedValue({ ...session, contentState: "DIRTY" });
    const checkInDesktopSession = vi.fn();
    const hashLocalFile = vi.fn().mockResolvedValue("hash-2");
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      checkInDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(openProbe()),
      hashLocalFile,
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(hashLocalFile).not.toHaveBeenCalled();
    expect(updateIf).not.toHaveBeenCalled();
    expect(checkInDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("does not record close from a single closed probe", async () => {
    vi.useFakeTimers();
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 2,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({ lifecycleState: "CLOSE_DETECTED" })
    );

    monitor.stop();
  });

  it("does not treat a probe error as open evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:01:00.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue({
        state: "PROBE_ERROR",
        busy: true,
        error: "probe failed",
      } satisfies LocalFileProbeResult),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({ lifecycleState: "OPEN" })
    );

    monitor.stop();
  });

  it("does not treat a file lock as open evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:01:00.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue({
        state: "FILE_LOCKED",
        busy: true,
        openObservedSource: "MONITOR_FILE_LOCK",
        comAvailable: false,
      } satisfies LocalFileProbeResult),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({ lifecycleState: "OPEN" })
    );

    monitor.stop();
  });

  it("records monitor open evidence with a stale-safe predicate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:01:00.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn().mockResolvedValue({
      ...session,
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue({
        state: "WORKBOOK_OPEN",
        busy: true,
        comAvailable: true,
      } satisfies LocalFileProbeResult),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    const openCall = updateIf.mock.calls.find(
      ([, _operation, patch]) => patch.lifecycleState === "OPEN"
    );
    const predicate = openCall?.[1] as
      | ((session: DesktopAgentSession) => boolean)
      | undefined;
    expect(openCall?.[2]).toStrictEqual(
      expect.objectContaining({
        lifecycleState: "OPEN",
        openObservedAt: "2026-06-05T02:01:00.000Z",
        openObservedSource: "MONITOR_COM",
      })
    );
    expect(
      predicate?.(
        makeSession({
          lifecycleState: "LAUNCHING",
          openObservedAt: undefined,
        })
      )
    ).toBeTruthy();
    expect(
      predicate?.(
        makeSession({
          generation: 2,
          lifecycleState: "LAUNCHING",
          openObservedAt: undefined,
        })
      )
    ).toBeFalsy();
    expect(
      predicate?.(
        makeSession({
          lifecycleState: "LAUNCHING",
          openObservedAt: undefined,
          openSignalToken: "other-open-token",
        })
      )
    ).toBeFalsy();

    monitor.stop();
  });

  it("records PDF editor process binding as monitor open evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:01:00.000Z"));
    const session = makeSession({
      fileName: "support.pdf",
      localPath: "C:\\ProjectWing\\support.pdf",
      lifecycleState: "LAUNCHING",
      openObservedAt: undefined,
      excelHelperProcessId: 7890,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn().mockResolvedValue({
      ...session,
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue({
        state: "EDITOR_PROCESS_OPEN",
        busy: true,
        openObservedSource: "MONITOR_PROCESS",
      } satisfies LocalFileProbeResult),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "OPEN",
        openObservedAt: "2026-06-05T02:01:00.000Z",
        openObservedSource: "MONITOR_PROCESS",
      })
    );

    monitor.stop();
  });

  it("does not mark an active workbook missing from a hash error when the probe shows it is open", async () => {
    vi.useFakeTimers();
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(openProbe()),
      hashLocalFile: vi.fn().mockRejectedValue(new Error("locked")),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({ lifecycleState: "LOCAL_FILE_MISSING" })
    );

    monitor.stop();
  });

  it("records close only after two closed probes following open observation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn().mockResolvedValue({
      ...session,
      lifecycleState: "CLOSE_DETECTED",
      closeDetectedAt: "2026-06-05T02:08:00.000Z",
    });
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 2,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({ lifecycleState: "CLOSE_DETECTED" })
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "CLOSE_DETECTED",
        closeDetectedAt: "2026-06-05T02:08:01.000Z",
        closeDetectedSource: "MONITOR",
        lastObservationAt: "2026-06-05T02:08:01.000Z",
      })
    );
    const closeCall = updateIf.mock.calls.find(
      ([, _operation, patch]) => patch.lifecycleState === "CLOSE_DETECTED"
    );
    const predicate = closeCall?.[1] as
      | ((session: DesktopAgentSession) => boolean)
      | undefined;
    expect(
      predicate?.(
        makeSession({
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:01:00.000Z",
        })
      )
    ).toBeTruthy();
    expect(
      predicate?.(
        makeSession({
          generation: 2,
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:01:00.000Z",
        })
      )
    ).toBeFalsy();
    expect(
      predicate?.(
        makeSession({
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:01:00.000Z",
          closeSignalToken: "other-close-token",
        })
      )
    ).toBeFalsy();

    monitor.stop();
  });

  it("records close for launcher-confirmed PDF sessions from closed probes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      fileName: "support.pdf",
      localPath: "C:\\ProjectWing\\support.pdf",
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
      openObservedSource: "LAUNCHER_PROCESS" as never,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 1,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "CLOSE_DETECTED",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
        closeDetectedSource: "MONITOR",
      })
    );

    monitor.stop();
  });

  it("records close for zip entry Master sessions with custom callbacks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      attachmentId: "zip-entry:entry-session-1",
      fileName: "support.docx",
      localPath: "C:\\ProjectWing\\support.docx",
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
      checkInUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 1,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "CLOSE_DETECTED",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
        closeDetectedSource: "MONITOR",
      })
    );

    monitor.stop();
  });

  it("checks in a launcher-confirmed zip PDF after monitor detects close", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    let storedSession = makeSession({
      attachmentId: "zip-entry:entry-session-1",
      fileName: "support.pdf",
      localPath: "C:\\ProjectWing\\support.pdf",
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
      openObservedSource: "LAUNCHER_PROCESS" as never,
      checkInUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
    });
    const refresh = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      return [storedSession];
    });
    const updateIf = vi
      .fn()
      .mockImplementation(
        async (
          _sessionId: string,
          predicate: (session: DesktopAgentSession) => boolean,
          patch: Partial<DesktopAgentSession>
        ) => {
          await Promise.resolve();
          if (!predicate(storedSession)) {
            return null;
          }
          storedSession = { ...storedSession, ...patch };
          return storedSession;
        }
      );
    const checkInDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      checkInDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(storedSession.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 1,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(storedSession.lifecycleState).toBe("CLOSE_DETECTED");
    expect(checkInDesktopSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(checkInDesktopSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
    });

    monitor.stop();
  });

  it("records degraded close diagnostics when COM is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi
        .fn()
        .mockResolvedValue(closedProbe({ comAvailable: false })),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 1,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "CLOSE_DETECTED",
        lastObservationDiagnostic:
          "Excel COM unavailable; used exclusive file close proof.",
      })
    );

    monitor.stop();
  });

  it("does not auto-close open-not-observed sessions from closed probes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      lifecycleState: "OPEN_NOT_OBSERVED",
      openObservedAt: undefined,
      launchStartedAt: "2026-06-05T02:00:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 2,
      openObservationTimeoutMs: 120_000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({ lifecycleState: "CLOSE_DETECTED" })
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(updateIf).not.toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "CLOSE_DETECTED",
      })
    );

    monitor.stop();
  });

  it.each(["LAUNCHING", "OPEN_NOT_OBSERVED"] as const)(
    "marks unobserved %s sessions as launch failed after the observation window",
    async (lifecycleState) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-05T02:03:00.000Z"));
      const session = makeSession({
        lifecycleState,
        launchStartedAt: "2026-06-05T02:00:00.000Z",
        openObservedAt: undefined,
      });
      const refresh = vi.fn().mockResolvedValue([session]);
      const updateIf = vi.fn();
      const monitor = startSessionMonitor({
        sessionStore: { refresh, updateIf },
        localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
        hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
        apiBaseUrl: "http://localhost:3000",
        intervalMs: 1000,
        openObservationTimeoutMs: 120_000,
        now: () => new Date(Date.now()),
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(updateIf).toHaveBeenCalledWith(
        "session-1",
        expect.any(Function),
        expect.objectContaining({
          lifecycleState: "LAUNCH_FAILED",
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError:
            "Excel open was not observed before the launch observation timeout.",
          lastObservationAt: "2026-06-05T02:03:00.000Z",
        })
      );

      monitor.stop();
    }
  );

  it.each([
    ["CLOSE_DETECTED", "UNCHANGED"],
    ["CLOSE_DETECTED", "DIRTY"],
    ["CHECKING_IN", "DIRTY"],
    ["RELEASE_PENDING", "UPLOADED"],
    ["CHECKIN_FAILED", "DIRTY"],
    ["RELEASE_FAILED", "UPLOADED"],
    ["CLEANUP_PENDING", "UPLOADED"],
    ["CLEANUP_FAILED", "UPLOADED"],
  ] as const)(
    "retries sync or cleanup for %s + %s",
    async (lifecycleState, contentState) => {
      vi.useFakeTimers();
      const session = makeSession({ lifecycleState, contentState });
      const refresh = vi.fn().mockResolvedValue([session]);
      const checkInDesktopSession = vi.fn().mockResolvedValue();
      const heartbeatDesktopSession = vi.fn().mockResolvedValue();
      const monitor = startSessionMonitor({
        sessionStore: { refresh },
        checkInDesktopSession,
        heartbeatDesktopSession,
        apiBaseUrl: "http://localhost:3000",
        intervalMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(checkInDesktopSession).toHaveBeenCalledWith({
        sessionId: "session-1",
        checkInUrl:
          "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
        releaseUrl:
          "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
      });
      expect(heartbeatDesktopSession).not.toHaveBeenCalled();

      monitor.stop();
    }
  );

  it("retries sync with custom Master callback URLs", async () => {
    vi.useFakeTimers();
    const session = makeSession({
      lifecycleState: "CLOSE_DETECTED",
      contentState: "DIRTY",
      checkInUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const checkInDesktopSession = vi.fn().mockResolvedValue();
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      checkInDesktopSession,
      heartbeatDesktopSession,
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(checkInDesktopSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
    });
    expect(heartbeatDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("continues heartbeats while a check-in retry remains in flight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:05:00.000Z"));
    const session = makeSession({
      lifecycleState: "CHECKING_IN",
      contentState: "DIRTY",
      heartbeatUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/heartbeat",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    let finishCheckIn!: () => void;
    const checkInDesktopSession = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCheckIn = resolve;
        })
    );
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      checkInDesktopSession,
      heartbeatDesktopSession,
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      heartbeatIntervalMs: 500,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(checkInDesktopSession).toHaveBeenCalledOnce();
    expect(heartbeatDesktopSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(checkInDesktopSession).toHaveBeenCalledOnce();
    expect(heartbeatDesktopSession).toHaveBeenCalledWith({
      session,
      heartbeatUrl:
        "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/heartbeat",
    });

    finishCheckIn();
    await Promise.resolve();
    monitor.stop();
  });

  it("recovers unchanged launch-failed sessions through the release retry path", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:05:00.000Z"));
    const session = makeSession({
      lifecycleState: "LAUNCH_FAILED",
      contentState: "UNCHANGED",
      openObservedAt: undefined,
      lastError: "Specified cast is not valid.",
    });
    const releasePending = makeSession({
      ...session,
      lifecycleState: "RELEASE_PENDING",
      status: "RELEASE_PENDING",
      pendingReleaseReason: "UNCHANGED_RELEASE",
      pendingReleaseHash: "hash-1",
      lastError: undefined,
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn().mockResolvedValue(releasePending);
    const checkInDesktopSession = vi.fn().mockResolvedValue();
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      checkInDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    const recoveryCall = updateIf.mock.calls.find(
      ([, _operation, patch]) => patch.lifecycleState === "RELEASE_PENDING"
    );
    const predicate = recoveryCall?.[1] as
      | ((candidate: DesktopAgentSession) => boolean)
      | undefined;
    expect(recoveryCall?.[2]).toStrictEqual(
      expect.objectContaining({
        lifecycleState: "RELEASE_PENDING",
        status: "RELEASE_PENDING",
        pendingReleaseReason: "UNCHANGED_RELEASE",
        pendingReleaseHash: "hash-1",
        lastError: undefined,
      })
    );
    expect(predicate?.(session)).toBeTruthy();
    expect(predicate?.(makeSession({ ...session, generation: 2 }))).toBeFalsy();
    expect(
      predicate?.(
        makeSession({
          ...session,
          contentState: "DIRTY",
          lastKnownHash: "hash-2",
        })
      )
    ).toBeFalsy();
    expect(
      predicate?.(
        makeSession({
          ...session,
          openObservedAt: "2026-06-05T02:00:10.000Z",
        })
      )
    ).toBeFalsy();
    expect(checkInDesktopSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    });

    monitor.stop();
  });

  it("keeps failed check-in and release sessions heartbeat eligible when retry is not due", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:00:05.000Z"));
    const sessions = [
      makeSession({
        sessionId: "checkin",
        lifecycleState: "CHECKIN_FAILED",
        contentState: "DIRTY",
        lastUploadAttemptAt: "2026-06-05T02:00:00.000Z",
        retryCount: 2,
      }),
      makeSession({
        sessionId: "release",
        lifecycleState: "RELEASE_FAILED",
        contentState: "UPLOADED",
        lastReleaseAttemptAt: "2026-06-05T02:00:00.000Z",
        retryCount: 2,
      }),
    ];
    const refresh = vi.fn().mockResolvedValue(sessions);
    const heartbeatDesktopSession = vi.fn().mockResolvedValue();
    const checkInDesktopSession = vi.fn();
    const monitor = startSessionMonitor({
      sessionStore: { refresh },
      heartbeatDesktopSession,
      checkInDesktopSession,
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      retryDelaysMs: [5000, 15_000],
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(heartbeatDesktopSession).toHaveBeenCalledTimes(2);
    expect(checkInDesktopSession).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("uses a stale-safe heartbeat predicate", async () => {
    vi.useFakeTimers();
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn();
    const heartbeatDesktopSession = vi
      .fn()
      .mockRejectedValue(new DesktopAgentError("LOCK_REVOKED", "revoked"));
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      heartbeatDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(openProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "LEASE_LOST",
        status: "LEASE_LOST",
        leaseLostAt: expect.any(String),
      })
    );
    const predicate = updateIf.mock.calls[0]?.[1] as
      | ((session: DesktopAgentSession) => boolean)
      | undefined;

    expect(
      predicate?.(
        makeSession({
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:01:00.000Z",
        })
      )
    ).toBeTruthy();
    expect(
      predicate?.(makeSession({ lifecycleState: "CLOSE_DETECTED" }))
    ).toBeFalsy();
    expect(
      predicate?.(makeSession({ lifecycleState: "RELEASING" }))
    ).toBeFalsy();
    expect(
      predicate?.(
        makeSession({ lifecycleState: "OPEN", lockSessionId: "other-lock" })
      )
    ).toBeFalsy();
    expect(predicate?.(makeSession({ generation: 2 }))).toBeFalsy();
    expect(
      predicate?.(makeSession({ openSignalToken: "other-open-token" }))
    ).toBeFalsy();
    expect(
      predicate?.(makeSession({ closeSignalToken: "other-close-token" }))
    ).toBeFalsy();

    monitor.stop();
  });

  it("records lost lease without overwriting an in-progress retry lifecycle", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      lifecycleState: "CHECKIN_FAILED",
      status: "CHECKIN_FAILED",
      contentState: "DIRTY",
      closeDetectedAt: "2026-06-05T02:06:00.000Z",
      lastUploadAttemptAt: "2026-06-05T02:07:59.000Z",
      retryCount: 2,
    });
    const refresh = vi
      .fn()
      .mockResolvedValueOnce([session])
      .mockResolvedValue([
        { ...session, leaseLostAt: "2026-06-05T02:08:00.000Z" },
      ]);
    const updateIf = vi.fn();
    const heartbeatDesktopSession = vi
      .fn()
      .mockRejectedValue(new DesktopAgentError("LOCK_REVOKED", "expired"));
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      heartbeatDesktopSession,
      checkInDesktopSession: vi.fn(),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      retryDelaysMs: [5000, 15_000],
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(updateIf).toHaveBeenCalledWith("session-1", expect.any(Function), {
      leaseLostAt: "2026-06-05T02:08:00.000Z",
      lastError: "expired",
    });
    expect(heartbeatDesktopSession).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(heartbeatDesktopSession).toHaveBeenCalledOnce();

    monitor.stop();
  });

  it("observes a lease-lost file until close and starts conflict-preserving check-in", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T02:08:00.000Z"));
    const session = makeSession({
      lifecycleState: "LEASE_LOST",
      status: "LEASE_LOST",
      contentState: "DIRTY",
      openObservedAt: "2026-06-05T02:01:00.000Z",
      lastKnownHash: "hash-2",
    });
    const closedSession = {
      ...session,
      lifecycleState: "CLOSE_DETECTED" as const,
      status: "DIRTY_PENDING_CHECKIN" as const,
      closeDetectedAt: "2026-06-05T02:08:00.000Z",
    };
    const refresh = vi
      .fn()
      .mockResolvedValueOnce([session])
      .mockResolvedValue([closedSession]);
    const updateIf = vi.fn().mockResolvedValue(closedSession);
    const heartbeatDesktopSession = vi.fn();
    const checkInDesktopSession = vi.fn().mockResolvedValue({
      ok: true,
      session: closedSession,
    });
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      heartbeatDesktopSession,
      checkInDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(closedProbe()),
      hashLocalFile: vi.fn().mockResolvedValue("hash-2"),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
      closeConfirmationCount: 1,
      now: () => new Date(Date.now()),
    });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(heartbeatDesktopSession).not.toHaveBeenCalled();
    expect(updateIf).toHaveBeenCalledWith(
      "session-1",
      expect.any(Function),
      expect.objectContaining({
        lifecycleState: "CLOSE_DETECTED",
        closeDetectedSource: "MONITOR",
      })
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(checkInDesktopSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    });

    monitor.stop();
  });

  it("contains heartbeat background failures when local state updates fail", async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:01:00.000Z",
    });
    const refresh = vi.fn().mockResolvedValue([session]);
    const updateIf = vi.fn().mockRejectedValue(new Error("state store locked"));
    const heartbeatDesktopSession = vi
      .fn()
      .mockRejectedValue(new DesktopAgentError("LOCK_REVOKED", "revoked"));
    const monitor = startSessionMonitor({
      sessionStore: { refresh, updateIf },
      heartbeatDesktopSession,
      localFileProbe: vi.fn().mockResolvedValue(openProbe()),
      hashLocalFile: vi.fn().mockResolvedValue(session.originalHash),
      apiBaseUrl: "http://localhost:3000",
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Project Wing desktop agent session monitor background task failed:",
        expect.any(Error)
      );
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);

    monitor.stop();
    consoleError.mockRestore();
  });
});

function makeSession(
  input: Partial<DesktopAgentSession> = {}
): DesktopAgentSession {
  const lifecycleState = input.lifecycleState ?? "OPEN";
  const contentState = input.contentState ?? "UNCHANGED";
  return {
    sessionId: "session-1",
    generation: 1,
    lockSessionId: "lock-session-1",
    mode: "MASTER",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "cash.xlsx",
    localPath: "C:\\ProjectWing\\cash.xlsx",
    baseVersion: 2,
    originalHash: "hash-1",
    lastKnownHash: contentState === "DIRTY" ? "hash-2" : "hash-1",
    lastUploadedHash: contentState === "UPLOADED" ? "hash-2" : undefined,
    grantSecret: "grant-secret",
    openSignalToken: "open-token-1",
    closeSignalToken: "close-token-1",
    status: getDesktopAgentCompatibilityStatus({
      lifecycleState,
      contentState,
    }),
    lifecycleState,
    contentState,
    openedAt: "2026-06-05T01:55:00.000Z",
    launchStartedAt: "2026-06-05T01:55:00.000Z",
    lastSeenAt: "2026-06-05T02:00:00.000Z",
    retryCount: 0,
    ...input,
  };
}

function openProbe(): LocalFileProbeResult {
  return {
    state: "WORKBOOK_OPEN",
    busy: true,
    openObservedSource: "MONITOR_COM",
    comAvailable: true,
  };
}

function closedProbe(
  input: Partial<LocalFileProbeResult> = {}
): LocalFileProbeResult {
  return {
    state: "CLOSED",
    busy: false,
    comAvailable: true,
    ...input,
  };
}
