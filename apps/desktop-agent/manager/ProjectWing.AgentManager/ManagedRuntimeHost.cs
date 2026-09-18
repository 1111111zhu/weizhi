using System.Diagnostics;
using System.Net;
using static ProjectWing.AgentManager.AgentManagerOptions;

namespace ProjectWing.AgentManager;

internal static class ManagedRuntimeHost
{
    public static int Run(string[] args, string statusPath)
    {
        var config = ReadConfig(args, statusPath);
        using var ownership = ProjectWing.NativeRuntime.RuntimeOwnershipLease.Acquire(config.StateRoot, "manager");
        Directory.CreateDirectory(config.StateRoot);
        var runtimeStatusPath = Path.Combine(config.StateRoot, "update-status.json");
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://127.0.0.1:{config.RuntimePort}/");
        listener.Start();
        Console.WriteLine($"Project Wing AgentManager listening on 127.0.0.1:{config.RuntimePort}");
        return RunSupervisedWorker(listener, config, runtimeStatusPath);
    }

    public static void StopListener(HttpListener listener)
    {
        try
        {
            if (listener.IsListening) listener.Stop();
        }
        catch
        {
            // Worker cleanup is the important bounded shutdown action.
        }
    }

    private static int RunSupervisedWorker(
        HttpListener listener,
        RuntimeConfig config,
        string statusPath
    )
    {
        using var workerSupervisor = new WorkerSupervisor(config, StartWorker);
        workerSupervisor.Start();
        EventHandler processExit = (_, _) => workerSupervisor.Dispose();
        ConsoleCancelEventHandler cancel = (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            StopListener(listener);
            workerSupervisor.Dispose();
        };
        AppDomain.CurrentDomain.ProcessExit += processExit;
        Console.CancelKeyPress += cancel;
        try
        {
            Listen(listener, config, workerSupervisor, statusPath);
            return 0;
        }
        finally
        {
            Console.CancelKeyPress -= cancel;
            AppDomain.CurrentDomain.ProcessExit -= processExit;
            StopListener(listener);
        }
    }

    private static void Listen(
        HttpListener listener,
        RuntimeConfig config,
        WorkerSupervisor workerSupervisor,
        string statusPath
    )
    {
        while (listener.IsListening)
        {
            HttpListenerContext context;
            try
            {
                context = listener.GetContext();
            }
            catch (HttpListenerException) when (!listener.IsListening)
            {
                break;
            }
            catch (InvalidOperationException) when (!listener.IsListening)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }
            _ = Task.Run(() =>
                RuntimeRequestHandler.HandleAsync(
                    context,
                    config,
                    workerSupervisor,
                    statusPath,
                    listener
                )
            );
        }
    }

    private static RuntimeConfig ReadConfig(string[] args, string statusPath)
    {
        var appDirectory = RequireOption(args, "--app-directory");
        var stateRoot = ReadOption(args, "--state-root")
            ?? Path.GetDirectoryName(statusPath)
            ?? throw new InvalidOperationException("State root is unavailable.");
        return new RuntimeConfig(
            AppDirectory: appDirectory,
            AgentVersion: RequireOption(args, "--agent-version"),
            StateRoot: stateRoot,
            ApiBaseUrl: ReadOption(args, "--api-base-url") ?? "https://emp.superfx.cn/api",
            AuthBaseUrl: ReadOption(args, "--auth-base-url") ?? "https://auth.superfx.cn",
            AllowedDownloadOrigins: ReadOption(args, "--allowed-download-origins")
                ?? "https://emp.superfx.cn,https://emp.wzcpa.hk,https://wing.superfx.cn,http://localhost:3000,http://127.0.0.1:3000",
            AllowedWebOrigins: ReadOption(args, "--allowed-web-origins")
                ?? "https://emp.superfx.cn,https://emp.wzcpa.hk,https://wing.superfx.cn,http://localhost:3001,http://127.0.0.1:3001",
            AllowedAuthOrigins: ReadOption(args, "--allowed-auth-origins")
                ?? "https://auth.superfx.cn,https://auth.wzcpa.hk,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3020,http://127.0.0.1:3020",
            WatcherPath: ReadOption(args, "--watcher-path")
                ?? Path.Combine(appDirectory, "managed", GetWatcherFileName()),
            ManagerPath: ReadOption(args, "--manager-path")
                ?? Path.Combine(appDirectory, "managed", GetManagerFileName()),
            RuntimePath: ReadOption(args, "--runtime-path")
                ?? Path.Combine(appDirectory, "managed", GetRuntimeFileName()),
            RuntimePort: ReadIntOption(args, "--runtime-port", 17_862),
            WorkerPort: ReadIntOption(args, "--worker-port", 17_863)
        );
    }

    private static Process StartWorker(RuntimeConfig config)
    {
        var isDll = config.RuntimePath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase);
        var startInfo = new ProcessStartInfo
        {
            FileName = isDll ? "dotnet" : config.RuntimePath,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        if (isDll) startInfo.ArgumentList.Add(config.RuntimePath);
        startInfo.ArgumentList.Add("--urls");
        startInfo.ArgumentList.Add($"http://127.0.0.1:{config.WorkerPort}");
        ApplyWorkerEnvironment(startInfo, config);
        return Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not start Desktop Agent worker.");
    }

    private static void ApplyWorkerEnvironment(ProcessStartInfo startInfo, RuntimeConfig config)
    {
        startInfo.Environment["PROJECT_WING_AGENT_MANAGER_PID"] = Environment.ProcessId.ToString();
        startInfo.Environment["PROJECT_WING_AGENT_MANAGER_START_TICKS"] = Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString();
        startInfo.Environment["PROJECT_WING_AGENT_MANAGER_PROCESS_IDENTITY"] = ProjectWing.NativeRuntime.ProcessGenerationIdentity.CaptureCurrent();
        startInfo.Environment["PROJECT_WING_AGENT_VERSION"] = config.AgentVersion;
        startInfo.Environment["PROJECT_WING_AGENT_API_BASE_URL"] = config.ApiBaseUrl;
        startInfo.Environment["PROJECT_WING_AGENT_AUTH_BASE_URL"] = config.AuthBaseUrl;
        startInfo.Environment["PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS"] = config.AllowedDownloadOrigins;
        startInfo.Environment["PROJECT_WING_AGENT_ALLOWED_WEB_ORIGINS"] = config.AllowedWebOrigins;
        startInfo.Environment["PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS"] = config.AllowedAuthOrigins;
        startInfo.Environment["PROJECT_WING_EXCEL_WATCHER_EXE_PATH"] = config.WatcherPath;
        startInfo.Environment["PROJECT_WING_AGENT_MANAGER_EXE_PATH"] = config.ManagerPath;
        startInfo.Environment["PROJECT_WING_AGENT_STATE_ROOT"] = config.StateRoot;
        startInfo.Environment["PROJECT_WING_AGENT_BASE_URL"] = $"http://127.0.0.1:{config.RuntimePort}";
    }

    internal static void TerminateWorker(Process worker)
    {
        try
        {
            if (worker.HasExited) return;
            worker.Kill();
            if (!worker.WaitForExit(5_000))
            {
                Console.Error.WriteLine("Desktop Agent worker did not exit within 5 seconds.");
            }
        }
        catch (InvalidOperationException)
        {
            // Worker exited between HasExited and Kill.
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"Could not stop Desktop Agent worker: {error.Message}");
        }
    }
}
