using System.Diagnostics;
using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentLocalFileProbe
{
    public async Task<DesktopAgentLocalFileProbeResult> ProbeAsync(
        JsonElement session,
        CancellationToken cancellationToken
    )
    {
        var localPath = ReadString(session, "localPath");
        if (string.IsNullOrWhiteSpace(localPath) || !File.Exists(localPath))
        {
            return new DesktopAgentLocalFileProbeResult("MISSING", false, null);
        }

        var observerKind = ReadString(session, "observerKind");
        var observerProcessId = ReadInt(session, "observerProcessId")
            ?? ReadInt(session, "excelHelperProcessId");
        if (
            observerProcessId is not null
            && IsExpectedProcessRunning(
                observerProcessId.Value,
                ReadString(session, "observerExecutablePath")
            )
        )
        {
            if (observerKind != "PDF_EDITOR")
            {
                return new DesktopAgentLocalFileProbeResult(
                    "WATCHER_ACTIVE",
                    true,
                    null
                );
            }
            var processBinding = await ProbeEditorProcessBindingAsync(
                observerProcessId.Value,
                localPath,
                cancellationToken
            );
            if (processBinding is not null && processBinding.State != "CLOSED")
            {
                return processBinding;
            }
        }

        if (!OperatingSystem.IsWindows())
        {
            return ProbeError(
                "A native lifecycle observer is required on this platform."
            );
        }

        try
        {
            using (File.Open(
                localPath,
                FileMode.Open,
                FileAccess.ReadWrite,
                FileShare.None
            ))
            {
                // Exclusive access is the conservative fallback after a helper exits.
            }
            var officeProbe = await ProbeOfficeDocumentAsync(
                localPath,
                cancellationToken
            );
            return officeProbe
                ?? new DesktopAgentLocalFileProbeResult("CLOSED", false, null);
        }
        catch (FileNotFoundException)
        {
            return new DesktopAgentLocalFileProbeResult("MISSING", false, null);
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            return new DesktopAgentLocalFileProbeResult(
                "FILE_LOCKED",
                true,
                "MONITOR_FILE_LOCK"
            );
        }
        catch (Exception error)
        {
            return new DesktopAgentLocalFileProbeResult(
                "PROBE_ERROR",
                true,
                null,
                error.Message
            );
        }
    }

    private static async Task<DesktopAgentLocalFileProbeResult?>
        ProbeEditorProcessBindingAsync(
            int processId,
            string localPath,
            CancellationToken cancellationToken
        )
    {
        if (!OperatingSystem.IsWindows()) return null;
        const string script = """
            try {
              $process = Get-CimInstance Win32_Process -Filter "ProcessId = $env:PROJECT_WING_EDITOR_PROCESS_ID"
              if (-not $process) { exit 1 }
              $commandLine = [string]$process.CommandLine
              if ($commandLine -and $commandLine.IndexOf($env:PROJECT_WING_TARGET_PATH, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                exit 0
              }
              exit 1
            } catch {
              exit 2
            }
            """;
        var exitCode = await RunPowerShellProbeAsync(
            script,
            new Dictionary<string, string>
            {
                ["PROJECT_WING_EDITOR_PROCESS_ID"] = processId.ToString(),
                ["PROJECT_WING_TARGET_PATH"] = Path.GetFullPath(localPath),
            },
            cancellationToken
        );
        return exitCode switch
        {
            0 => new DesktopAgentLocalFileProbeResult(
                "EDITOR_PROCESS_OPEN",
                true,
                "MONITOR_PROCESS"
            ),
            1 => new DesktopAgentLocalFileProbeResult("CLOSED", false, null),
            null => ProbeError("PDF editor process probe timed out."),
            _ => ProbeError("PDF editor process probe failed."),
        };
    }

    private static async Task<DesktopAgentLocalFileProbeResult?>
        ProbeOfficeDocumentAsync(
            string localPath,
            CancellationToken cancellationToken
        )
    {
        if (!OperatingSystem.IsWindows()) return null;
        var target = Path.GetExtension(localPath).ToLowerInvariant() switch
        {
            ".csv" or ".xls" or ".xlsb" or ".xlsm" or ".xlsx"
                => ("Excel.Application", "Workbooks"),
            ".doc" or ".docx" => ("Word.Application", "Documents"),
            ".ppt" or ".pptx" => ("PowerPoint.Application", "Presentations"),
            _ => default,
        };
        if (target == default) return null;
        const string script = """
            $targetPath = [System.IO.Path]::GetFullPath($env:PROJECT_WING_TARGET_PATH)
            try {
              try {
                $application = [Runtime.InteropServices.Marshal]::GetActiveObject($env:PROJECT_WING_OFFICE_PROG_ID)
              } catch {
                exit 1
              }
              $documents = $application.($env:PROJECT_WING_OFFICE_COLLECTION_NAME)
              foreach ($document in @($documents)) {
                try {
                  $documentPath = [System.IO.Path]::GetFullPath([string]$document.FullName)
                  if ([string]::Equals($documentPath, $targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                    exit 0
                  }
                } catch {}
              }
              exit 1
            } catch {
              exit 2
            }
            """;
        try
        {
            var exitCode = await RunPowerShellProbeAsync(
                script,
                new Dictionary<string, string>
                {
                    ["PROJECT_WING_TARGET_PATH"] = localPath,
                    ["PROJECT_WING_OFFICE_PROG_ID"] = target.Item1,
                    ["PROJECT_WING_OFFICE_COLLECTION_NAME"] = target.Item2,
                },
                cancellationToken
            );
            return exitCode switch
            {
                0 => new DesktopAgentLocalFileProbeResult(
                    "DOCUMENT_OPEN",
                    true,
                    "MONITOR_COM"
                ),
                1 => new DesktopAgentLocalFileProbeResult("CLOSED", false, null),
                null => ProbeError("Office COM probe timed out."),
                _ => ProbeError("Office COM probe failed."),
            };
        }
        catch (Exception error) when (
            error is InvalidOperationException
                or System.ComponentModel.Win32Exception
                or IOException
        )
        {
            return ProbeError(error.Message);
        }
    }

    private static async Task<int?> RunPowerShellProbeAsync(
        string script,
        IReadOnlyDictionary<string, string> environment,
        CancellationToken cancellationToken
    )
    {
        var startInfo = new ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        startInfo.ArgumentList.Add("-NoProfile");
        startInfo.ArgumentList.Add("-NonInteractive");
        startInfo.ArgumentList.Add("-ExecutionPolicy");
        startInfo.ArgumentList.Add("Bypass");
        startInfo.ArgumentList.Add("-Command");
        startInfo.ArgumentList.Add(script);
        foreach (var (name, value) in environment)
        {
            startInfo.Environment[name] = value;
        }
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("PowerShell probe did not start.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken
        );
        timeout.CancelAfter(TimeSpan.FromSeconds(3));
        try
        {
            await process.WaitForExitAsync(timeout.Token);
            return process.ExitCode;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            return null;
        }
    }

    private static DesktopAgentLocalFileProbeResult ProbeError(string message)
    {
        return new DesktopAgentLocalFileProbeResult(
            "PROBE_ERROR",
            true,
            null,
            message
        );
    }

    private static bool IsExpectedProcessRunning(int processId, string? expectedPath)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            if (process.HasExited) return false;
            if (string.IsNullOrWhiteSpace(expectedPath)) return true;
            try
            {
                var actualPath = process.MainModule?.FileName;
                return string.IsNullOrWhiteSpace(actualPath)
                    || string.Equals(
                        Path.GetFullPath(actualPath),
                        Path.GetFullPath(expectedPath),
                        StringComparison.OrdinalIgnoreCase
                    );
            }
            catch (Exception error) when (
                error is System.ComponentModel.Win32Exception
                    or InvalidOperationException
                    or NotSupportedException
            )
            {
                // Inability to inspect a live process must be treated as busy.
                return true;
            }
        }
        catch (Exception error) when (
            error is ArgumentException or InvalidOperationException
        )
        {
            return false;
        }
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static int? ReadInt(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out var result)
            ? result
            : null;
    }
}

public sealed record DesktopAgentLocalFileProbeResult(
    string State,
    bool Busy,
    string? OpenObservedSource,
    string? Error = null
);
