using System.Diagnostics;
using System.Net;
using System.Reflection;
using System.Text.Json;
using static ProjectWing.AgentManager.ManagerStatusStore;
using static ProjectWing.AgentManager.RuntimeHttpResponses;

namespace ProjectWing.AgentManager;

internal static class RuntimeRequestHandler
{
    public static async Task HandleAsync(
        HttpListenerContext context,
        RuntimeConfig config,
        WorkerSupervisor workerSupervisor,
        string statusPath,
        HttpListener listener
    )
    {
        try
        {
            WriteCorsHeaders(context.Request, context.Response, config.AllowedWebOrigins);
            if (!IsAllowedRuntimeOrigin(context.Request, config.AllowedWebOrigins))
            {
                await WriteJsonAsync(context, 403, new
                {
                    ok = false,
                    code = "ORIGIN_NOT_ALLOWED",
                    message = "This web origin is not allowed to access Desktop Agent.",
                });
                return;
            }
            if (context.Request.HttpMethod == "OPTIONS")
            {
                WriteEmpty(context, 204);
                return;
            }
            var path = context.Request.Url?.AbsolutePath ?? "/";
            if (context.Request.HttpMethod == "GET" && path == "/control/identity")
            {
                if (!string.IsNullOrEmpty(context.Request.Headers["Origin"])
                    || !string.IsNullOrEmpty(context.Request.Headers["Sec-Fetch-Site"])
                    || context.Request.Headers["X-Project-Wing-Agent"] != "1")
                {
                    await WriteJsonAsync(context, 403, new { ok = false, code = "NATIVE_CONTROL_REQUIRED" });
                    return;
                }
                // Identity/control discovery must not await any worker IO or supervisor gate.
                await WriteJsonAsync(context, 200, new
                {
                    ok = true,
                    app = "project-wing-desktop-runtime",
                    version = config.AgentVersion,
                    managerInstanceId = workerSupervisor.InstanceId,
                    managerPid = Environment.ProcessId,
                    managerStartTimeUtcTicks = Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString(),
                    managerProcessIdentity = ProjectWing.NativeRuntime.ProcessGenerationIdentity.CaptureCurrent(),
                    appDirectory = Path.GetFullPath(config.AppDirectory),
                    stateRoot = Path.GetFullPath(config.StateRoot),
                    managerExecutablePath = Environment.ProcessPath,
                    runtimePath = Path.GetFullPath(config.RuntimePath),
                    maintenanceState = RecoveryMaintenancePolicy.GetState(config.StateRoot),
                    recoverySupported = true,
                });
                return;
            }
            if (context.Request.HttpMethod == "GET" && path == "/health")
            {
                await WriteHealthAsync(context, config, workerSupervisor);
                return;
            }
            if (context.Request.HttpMethod == "GET" && path == "/update/status")
            {
                await WriteUpdateStatusAsync(context, config, workerSupervisor, statusPath);
                return;
            }
            if (context.Request.HttpMethod == "POST" && path == "/control/shutdown")
            {
                await HandleShutdownAsync(context, config, workerSupervisor, listener);
                return;
            }
            if (context.Request.HttpMethod == "POST" && path == "/control/recover")
            {
                await HandleRecoveryAsync(context, config, workerSupervisor, statusPath);
                return;
            }
            var snapshot = workerSupervisor.GetSnapshot();
            if (snapshot.Worker is null)
            {
                await WriteJsonAsync(context, 503, new
                {
                    ok = false,
                    code = "WORKER_RECOVERING",
                    message = "Desktop Agent worker is recovering.",
                    agentState = snapshot.State,
                    detail = snapshot.FailureReason,
                });
                return;
            }
            await RuntimeHttpProxy.ProxyAsync(context, config, snapshot.Worker);
        }
        catch (Exception error)
        {
            await TryWriteErrorAsync(
                context,
                500,
                "RUNTIME_REQUEST_FAILED",
                "Desktop runtime request failed.",
                error
            );
        }
    }

    private static async Task WriteHealthAsync(
        HttpListenerContext context,
        RuntimeConfig config,
        WorkerSupervisor workerSupervisor
    )
    {
        var maintenanceState = RecoveryMaintenancePolicy.GetState(config.StateRoot);
        var snapshot = workerSupervisor.GetSnapshot();
        var health = snapshot.Worker is null
            ? WorkerHealthProbeService.Unavailable(snapshot.State)
            : await WorkerHealthProbeService.ProbeAsync(config, snapshot.Worker);
        await WriteJsonAsync(context, 200, new
        {
            ok = true,
            app = "project-wing-desktop-runtime",
            version = config.AgentVersion,
            managerVersion = GetManagerVersion(),
            agentVersion = health.AgentVersion ?? config.AgentVersion,
            managerState = snapshot.State,
            managerInstanceId = workerSupervisor.InstanceId,
            managerPid = Environment.ProcessId,
            managerStartTimeUtcTicks = Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString(),
            managerProcessIdentity = ProjectWing.NativeRuntime.ProcessGenerationIdentity.CaptureCurrent(),
            appDirectory = Path.GetFullPath(config.AppDirectory),
            stateRoot = Path.GetFullPath(config.StateRoot),
            managerExecutablePath = Environment.ProcessPath,
            runtimePath = Path.GetFullPath(config.RuntimePath),
            recoverySupported = true,
            failureReason = maintenanceState == "REVIEW_REQUIRED" ? "PREVIOUS_UPDATE_NEEDS_REVIEW" : snapshot.FailureReason,
            maintenanceState,
            workerPid = snapshot.Worker?.Id,
            restartCount = snapshot.RestartCount,
            agentState = maintenanceState == "REVIEW_REQUIRED" ? "DEGRADED_NEEDS_ATTENTION" : maintenanceState == "ACTIVE" ? "UPDATING" : snapshot.State == "DEGRADED_NEEDS_ATTENTION"
                ? snapshot.State
                : health.AgentState,
            updateState = health.UpdateState,
            restoreState = health.RestoreState,
            attentionCount = health.AttentionCount,
            quarantineCount = health.QuarantineCount,
        });
    }

    private static async Task WriteUpdateStatusAsync(
        HttpListenerContext context,
        RuntimeConfig config,
        WorkerSupervisor workerSupervisor,
        string statusPath
    )
    {
        if (!File.Exists(statusPath))
        {
            await WriteJsonAsync(context, 200, new
            {
                ok = true,
                status = "READY",
                stage = "READY",
                message = "Desktop runtime is ready.",
            });
            return;
        }
        var statusJson = await File.ReadAllTextAsync(statusPath);
        statusJson = await RecoverHealthTimeoutAsync(
            statusJson,
            statusPath,
            config,
            workerSupervisor
        );
        await WriteRawJsonAsync(context, 200, statusJson);
    }

    private static async Task<string> RecoverHealthTimeoutAsync(
        string statusJson,
        string statusPath,
        RuntimeConfig config,
        WorkerSupervisor workerSupervisor
    )
    {
        if (!WorkerHealthProbeService.IsHealthTimeoutFailure(statusJson)) return statusJson;
        var snapshot = workerSupervisor.GetSnapshot();
        if (snapshot.Worker is null) return statusJson;
        var health = await WorkerHealthProbeService.ProbeAsync(config, snapshot.Worker);
        if (!WorkerHealthProbeService.TryCreateRecoveredReadyStatus(
            statusJson,
            health,
            out var recoveredStatus
        )) return statusJson;
        WriteStatus(statusPath, recoveredStatus);
        return await File.ReadAllTextAsync(statusPath);
    }

    private static async Task HandleRecoveryAsync(
        HttpListenerContext context,
        RuntimeConfig config,
        WorkerSupervisor supervisor,
        string statusPath
    )
    {
        if (!string.IsNullOrEmpty(context.Request.Headers["Origin"])
            || !string.IsNullOrEmpty(context.Request.Headers["Sec-Fetch-Site"])
            || context.Request.Headers["X-Project-Wing-Agent"] != "1")
        {
            await WriteJsonAsync(context, 403, new { ok = false, code = "NATIVE_CONTROL_REQUIRED" });
            return;
        }
        if (context.Request.ContentLength64 is < 1 or > 1024)
        {
            await WriteJsonAsync(context, 400, new { ok = false, code = "INVALID_RECOVERY_REQUEST" });
            return;
        }
        try
        {
            using var requestDeadline = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            using var body = await JsonDocument.ParseAsync(context.Request.InputStream, cancellationToken: requestDeadline.Token);
            if (body.RootElement.ValueKind != JsonValueKind.Object
                || !body.RootElement.TryGetProperty("managerInstanceId", out var instance)
                || instance.ValueKind != JsonValueKind.String
                || instance.GetString() != supervisor.InstanceId)
            {
                await WriteJsonAsync(context, 409, new { ok = false, code = "MANAGER_INSTANCE_CHANGED" });
                return;
            }
            using var maintenance = ProjectWing.NativeRuntime.RuntimeOwnershipLease.TryAcquire(config.StateRoot, "maintenance");
            var maintenanceState = maintenance is null ? "ACTIVE" : RecoveryMaintenancePolicy.GetStateWhileOwned(config.StateRoot);
            if (maintenanceState != "IDLE")
            {
                await WriteJsonAsync(context, 409, new { ok = false, code = maintenanceState == "REVIEW_REQUIRED" ? "PREVIOUS_UPDATE_NEEDS_REVIEW" : "UPDATE_IN_PROGRESS" });
                return;
            }
            var snapshot = supervisor.GetSnapshot();
            var health = snapshot.Worker is null ? null : await WorkerHealthProbeService.ProbeAsync(config, snapshot.Worker);
            if (health?.AgentState is "READY" or "READY_WITH_ATTENTION")
            {
                await WriteJsonAsync(context, 200, new { ok = true, status = "ALREADY_RUNNING" });
                return;
            }
            if (health?.AgentState == "UPDATING")
            {
                await WriteJsonAsync(context, 409, new { ok = false, code = "UPDATE_IN_PROGRESS" });
                return;
            }
            var accepted = supervisor.TryRecover(snapshot.Worker?.Id);
            await WriteJsonAsync(context, accepted ? 202 : 409, new
            {
                ok = accepted,
                status = accepted ? "RECOVERING" : "RECOVERY_BUSY",
            });
        }
        catch (OperationCanceledException)
        {
            await WriteJsonAsync(context, 408, new { ok = false, code = "RECOVERY_REQUEST_TIMEOUT" });
        }
        catch (JsonException)
        {
            await WriteJsonAsync(context, 409, new { ok = false, code = "RECOVERY_STATE_UNREADABLE" });
        }
    }

    private static async Task HandleShutdownAsync(
        HttpListenerContext context,
        RuntimeConfig config,
        WorkerSupervisor supervisor,
        HttpListener listener
    )
    {
        if (!string.IsNullOrWhiteSpace(context.Request.Headers["Origin"])
            || !string.IsNullOrWhiteSpace(context.Request.Headers["Sec-Fetch-Site"]))
        {
            await WriteJsonAsync(context, 403, new
            {
                ok = false,
                errorCode = "NATIVE_CONTROL_REQUIRED",
                message = "Desktop Agent shutdown is only available to the native tray host.",
            });
            return;
        }
        // Older native installers do not send this header. Current hosts bind
        // shutdown to the observed generation so a stale host cannot stop a replacement.
        var expectedInstance = context.Request.Headers["X-Project-Wing-Manager-Instance"];
        if (expectedInstance is not null && expectedInstance != supervisor.InstanceId)
        {
            await WriteJsonAsync(context, 409, new { ok = false, code = "MANAGER_INSTANCE_CHANGED" });
            return;
        }
        var shutdownFlag = Path.Combine(config.StateRoot, "shutdown.flag");
        await File.WriteAllTextAsync(shutdownFlag, DateTimeOffset.UtcNow.ToString("O"));
        // Do not leave a reusable connection that listener.Stop would reset
        // before the native host can observe the shutdown acknowledgement.
        context.Response.KeepAlive = false;
        await WriteJsonAsync(context, 202, new { ok = true, status = "SHUTTING_DOWN" });
        _ = Task.Run(() => ManagedRuntimeHost.StopListener(listener));
    }

    private static void WriteCorsHeaders(
        HttpListenerRequest request,
        HttpListenerResponse response,
        string allowedWebOrigins
    )
    {
        var origin = request.Headers["Origin"];
        if (IsAllowedOrigin(origin, allowedWebOrigins))
        {
            response.Headers["Access-Control-Allow-Origin"] = origin;
        }
        response.Headers["Vary"] = "Origin";
        response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
        response.Headers["Access-Control-Allow-Headers"] =
            "Content-Type, X-Project-Wing-Agent";
        if (request.Headers["Access-Control-Request-Private-Network"] == "true")
        {
            response.Headers["Access-Control-Allow-Private-Network"] = "true";
        }
    }

    private static bool IsAllowedRuntimeOrigin(
        HttpListenerRequest request,
        string allowedWebOrigins
    )
    {
        var origin = request.Headers["Origin"];
        return string.IsNullOrWhiteSpace(origin) || IsAllowedOrigin(origin, allowedWebOrigins);
    }

    private static bool IsAllowedOrigin(string? origin, string allowedWebOrigins)
    {
        return !string.IsNullOrWhiteSpace(origin)
            && allowedWebOrigins
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(allowed => string.Equals(allowed, origin, StringComparison.Ordinal));
    }

    private static string GetManagerVersion()
    {
        return Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.2.1";
    }
}
