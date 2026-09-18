using System.Diagnostics;
using System.Text.Json;
using static ProjectWing.AgentManager.ManagerStatusStore;

namespace ProjectWing.AgentManager;

internal static class AgentInstallerRunner
{
    private const string HealthUrl = "http://127.0.0.1:17862/health";

    public static void Download(string downloadUrl, string installerPath)
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(5));
        using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
        using var response = http.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, deadline.Token)
            .GetAwaiter()
            .GetResult();
        response.EnsureSuccessStatusCode();
        using var input = response.Content.ReadAsStreamAsync(deadline.Token).GetAwaiter().GetResult();
        var temporary = installerPath + $".{Guid.NewGuid():N}.download";
        try
        {
            using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                input.CopyToAsync(output, deadline.Token).GetAwaiter().GetResult();
            File.Move(temporary, installerPath, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    public static int Run(string statusPath, string installerPath, string? expectedVersion)
    {
        var startInfo = CreateStartInfo(installerPath);
        startInfo.Environment["PROJECT_WING_AGENT_UPDATE_LOCK_HELD"] = "1";
        startInfo.Environment["PROJECT_WING_AGENT_STATE_ROOT"] = Path.GetDirectoryName(statusPath)!;
        Process? process;
        try
        {
            process = Process.Start(startInfo);
        }
        catch (Exception error)
        {
            return Fail(statusPath, "INSTALLER_START_FAILED", error.Message);
        }
        if (process is null)
        {
            return Fail(
                statusPath,
                "INSTALLER_START_FAILED",
                "Could not start Desktop Agent installer."
            );
        }
        process.WaitForExit();
        return process.ExitCode == 0
            ? VerifyHealth(statusPath, expectedVersion)
            : HandleInstallerFailure(statusPath, process.ExitCode);
    }

    public static DesktopAgentHealthSnapshot ReadDesktopAgentHealth(HttpClient? client = null)
    {
        try
        {
            using var ownedHttp = client is null
                ? new HttpClient { Timeout = TimeSpan.FromSeconds(2) }
                : null;
            var json = (client ?? ownedHttp!).GetStringAsync(HealthUrl).GetAwaiter().GetResult();
            using var document = JsonDocument.Parse(json);
            return ParseHealth(document.RootElement);
        }
        catch
        {
            return new DesktopAgentHealthSnapshot(null, false);
        }
    }

    private static int HandleInstallerFailure(string statusPath, int exitCode)
    {
        if (ExistingStatusIsFailedWithErrorCode(statusPath)) return 1;
        return exitCode == 2
            ? Fail(
                statusPath,
                "HEALTH_TIMEOUT",
                "Installer exited with code 2 after the Desktop Agent health check timed out."
            )
            : Fail(statusPath, "INSTALLER_START_FAILED", $"Installer exited with code {exitCode}.");
    }

    private static ProcessStartInfo CreateStartInfo(string installerPath)
    {
        if (!OperatingSystem.IsMacOS())
        {
            return new ProcessStartInfo
            {
                FileName = installerPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
        }
        var startInfo = new ProcessStartInfo("/usr/bin/osascript")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        var pathLiteral = $"\"{installerPath.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"";
        startInfo.ArgumentList.Add("-e");
        startInfo.ArgumentList.Add(
            "do shell script \"/usr/sbin/installer -pkg \" & quoted form of "
                + pathLiteral
                + " & \" -target /\" with administrator privileges"
        );
        return startInfo;
    }

    private static int VerifyHealth(string statusPath, string? expectedVersion)
    {
        WriteStatus(statusPath, new UpdateStatus("VERIFYING_HEALTH")
        {
            ExpectedVersion = expectedVersion,
            Message = "Waiting for Desktop Agent health.",
        });
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTimeOffset.UtcNow.AddSeconds(45);
        while (DateTimeOffset.UtcNow < deadline)
        {
            var health = ReadDesktopAgentHealth(http);
            if (health.IsReady && (expectedVersion is null || health.Version == expectedVersion))
            {
                WriteReadyStatus(statusPath, expectedVersion, health.Version);
                return 0;
            }
            Thread.Sleep(500);
        }
        return Fail(
            statusPath,
            "HEALTH_TIMEOUT",
            "Desktop Agent did not report the expected version."
        );
    }

    private static DesktopAgentHealthSnapshot ParseHealth(JsonElement root)
    {
        var version = ReadString(root, "version");
        var app = ReadString(root, "app");
        if (app != "project-wing-desktop-runtime")
        {
            return new DesktopAgentHealthSnapshot(version, version is not null);
        }
        var state = ReadString(root, "agentState");
        return new DesktopAgentHealthSnapshot(
            version,
            version is not null && state is "READY" or "READY_WITH_ATTENTION"
        );
    }

    private static string? ReadString(JsonElement root, string name)
    {
        return root.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static void WriteReadyStatus(
        string statusPath,
        string? expectedVersion,
        string? currentVersion
    )
    {
        WriteStatus(statusPath, new UpdateStatus("READY")
        {
            ExpectedVersion = expectedVersion,
            CurrentVersion = currentVersion,
            Message = "Desktop Agent update is ready.",
        });
    }
}
