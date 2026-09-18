using System.Diagnostics;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentFileLauncher(
    DesktopAgentRuntimeOptions options,
    DesktopAgentPdfEditorResolver pdfEditorResolver
)
{
    public async Task LaunchReadOnlyAsync(
        string localPath,
        CancellationToken cancellationToken
    )
    {
        if (options.DisableFileLaunch)
        {
            return;
        }
        try
        {
            using var process = Process.Start(CreateShellLaunchInfo(localPath))
                ?? throw new InvalidOperationException("File launcher did not start.");
            await Task.Yield();
            cancellationToken.ThrowIfCancellationRequested();
        }
        catch (Exception error) when (
            error is InvalidOperationException or System.ComponentModel.Win32Exception
        )
        {
            throw new DesktopAgentRuntimeException(
                "OPEN_FAILED",
                "Could not open the selected file.",
                StatusCodes.Status500InternalServerError
            );
        }
    }

    public async Task<DesktopAgentMasterLaunchResult> LaunchMasterAsync(
        DesktopAgentMasterLaunchContext context,
        CancellationToken cancellationToken
    )
    {
        if (options.DisableFileLaunch || !OperatingSystem.IsWindows())
        {
            await LaunchReadOnlyAsync(context.LocalPath, cancellationToken);
            return new DesktopAgentMasterLaunchResult(true, null);
        }
        if (Path.GetExtension(context.LocalPath)
            .Equals(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return await LaunchPdfMasterAsync(context.LocalPath, cancellationToken);
        }
        if (!File.Exists(options.WatcherPath))
        {
            throw WatcherStartFailed();
        }
        try
        {
            using var process = Process.Start(CreateWatcherStartInfo(context))
                ?? throw new InvalidOperationException("Office watcher did not start.");
            await Task.Yield();
            cancellationToken.ThrowIfCancellationRequested();
            return new DesktopAgentMasterLaunchResult(
                false,
                process.Id,
                "OFFICE_WATCHER",
                options.WatcherPath
            );
        }
        catch (Exception error) when (
            error is InvalidOperationException or System.ComponentModel.Win32Exception
        )
        {
            throw WatcherStartFailed();
        }
    }

    private async Task<DesktopAgentMasterLaunchResult> LaunchPdfMasterAsync(
        string localPath,
        CancellationToken cancellationToken
    )
    {
        var editorPath = pdfEditorResolver.Resolve();
        if (editorPath is null)
        {
            throw new DesktopAgentRuntimeException(
                "PDF_EDITOR_UNAVAILABLE",
                "A supported PDF editor is required for PDF Master editing. Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, PDFill, or Master PDF Editor, then retry.",
                StatusCodes.Status409Conflict
            );
        }
        try
        {
            var startInfo = new ProcessStartInfo(editorPath)
            {
                UseShellExecute = false,
                WorkingDirectory = Path.GetDirectoryName(localPath) ?? string.Empty,
            };
            startInfo.ArgumentList.Add(localPath);
            using var process = Process.Start(startInfo)
                ?? throw new InvalidOperationException("PDF editor did not start.");
            await Task.Yield();
            cancellationToken.ThrowIfCancellationRequested();
            return new DesktopAgentMasterLaunchResult(
                true,
                process.Id,
                "PDF_EDITOR",
                editorPath
            );
        }
        catch (Exception error) when (
            error is InvalidOperationException or System.ComponentModel.Win32Exception
        )
        {
            throw new DesktopAgentRuntimeException(
                "OPEN_FAILED",
                "Could not start the supported PDF editor.",
                StatusCodes.Status500InternalServerError
            );
        }
    }

    private static ProcessStartInfo CreateShellLaunchInfo(string localPath)
    {
        if (OperatingSystem.IsWindows())
        {
            return new ProcessStartInfo(localPath) { UseShellExecute = true };
        }
        var startInfo = new ProcessStartInfo(
            OperatingSystem.IsMacOS() ? "/usr/bin/open" : "/usr/bin/xdg-open"
        )
        { UseShellExecute = false };
        startInfo.ArgumentList.Add(localPath);
        return startInfo;
    }

    private ProcessStartInfo CreateWatcherStartInfo(DesktopAgentMasterLaunchContext context)
    {
        var isDll = options.WatcherPath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase);
        var startInfo = new ProcessStartInfo(isDll ? "dotnet" : options.WatcherPath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        if (isDll) startInfo.ArgumentList.Add(options.WatcherPath);
        AddArgument(startInfo, "office-app", ReadOfficeApp(context.LocalPath));
        AddArgument(startInfo, "target-path", context.LocalPath);
        AddArgument(startInfo, "session-id", context.SessionId);
        AddArgument(startInfo, "generation", context.Generation.ToString());
        AddArgument(startInfo, "open-signal-token", context.OpenSignalToken);
        AddArgument(startInfo, "close-signal-token", context.CloseSignalToken);
        AddArgument(startInfo, "agent-base-url", options.AgentBaseUrl);
        AddArgument(startInfo, "timeline-log-path", BuildTimelineLogPath(context.SessionId));
        AddArgument(startInfo, "diagnostic-log-level", "normal");
        return startInfo;
    }

    private string BuildTimelineLogPath(string sessionId)
    {
        var safeId = string.Concat(sessionId.Select(character =>
            char.IsLetterOrDigit(character) || character is '-' or '_' ? character : '_'
        ));
        return Path.Combine(options.StateRoot, "logs", $"office-watcher-{safeId}.log");
    }

    private static void AddArgument(ProcessStartInfo startInfo, string name, string value)
    {
        startInfo.ArgumentList.Add($"--{name}");
        startInfo.ArgumentList.Add(value);
    }

    private static string ReadOfficeApp(string localPath)
    {
        return Path.GetExtension(localPath).ToLowerInvariant() switch
        {
            ".doc" or ".docx" => "word",
            ".ppt" or ".pptx" => "powerpoint",
            _ => "excel",
        };
    }

    private static DesktopAgentRuntimeException WatcherStartFailed()
    {
        return new DesktopAgentRuntimeException(
            "OPEN_FAILED",
            "Could not start the Office watcher.",
            StatusCodes.Status500InternalServerError
        );
    }
}

public sealed record DesktopAgentMasterLaunchContext
{
    public required string LocalPath { get; init; }
    public required string SessionId { get; init; }
    public required int Generation { get; init; }
    public required string OpenSignalToken { get; init; }
    public required string CloseSignalToken { get; init; }
}

public sealed record DesktopAgentMasterLaunchResult(
    bool OpenObservedOnLaunch,
    int? HelperProcessId,
    string? ObserverKind = null,
    string? ObserverExecutablePath = null
);
