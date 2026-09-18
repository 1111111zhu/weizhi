using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

namespace ProjectWing.ExcelWatcher;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        var parseResult = WatcherOptions.TryParse(args);
        if (parseResult.Error is not null)
        {
            Console.Error.WriteLine(parseResult.Error);
            return 64;
        }

        using var logger = new TimelineLogger(
            parseResult.Options!.TimelineLogPath,
            parseResult.Options.DiagnosticLogLevel
        );
        return new ExcelWatcher(parseResult.Options, logger).Run();
    }
}

internal sealed class ExcelWatcher
{
    private const int ShellOpenFallbackTimeoutMs = 20_000;
    private const int ProbeIntervalMs = 200;
    private const int CloseConfirmationCount = 3;
    private static readonly TimeSpan ComRecoveryGrace = TimeSpan.FromSeconds(8);
    private static readonly TimeSpan DegradedCloseFallbackDelay = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan ProbeErrorLogInterval = TimeSpan.FromSeconds(30);

    private readonly WatcherOptions _options;
    private readonly TimelineLogger _logger;
    private readonly Dictionary<string, ProbeErrorLogState> _probeErrorLogs = new();
    private readonly HttpClient _httpClient = new()
    {
        // A timeout means that the Runtime may still have committed the event.
        // Session event endpoints are idempotent, so retries are safe.
        Timeout = TimeSpan.FromSeconds(10),
    };
    private object? _application;
    private object? _document;
    private int? _applicationProcessId;
    private nint? _applicationWindowHandle;

    internal ExcelWatcher(WatcherOptions options, TimelineLogger logger)
    {
        _options = options;
        _logger = logger;
    }

    internal int Run()
    {
        _logger.Write("WatcherStarted", $"pid={Environment.ProcessId}");

        try
        {
            _logger.Write("ComInitialize", $"creating {GetApplicationProgId()}");
            try
            {
                _application = CreateOfficeApplication();
            }
            catch (Exception error)
            {
                _logger.Write("ComCreateFailed", error.ToString());
                return FailLaunchWithFallback(error, "COM_CREATE_FAILED", 1);
            }

            TrySetExcelOption(
                "InitialVisibility",
                application => ComSet(application, "Visible", false)
            );
            TrySetExcelOption(
                "DisplayAlerts",
                application => ComSet(application, "DisplayAlerts", true)
            );

            _logger.Write("WorkbookOpenStarted", _options.TargetPath);
            try
            {
                _document = OpenTargetDocument();
            }
            catch (Exception error)
            {
                _logger.Write("ComOpenFailed", error.ToString());
                return FailLaunchWithFallback(error, "COM_OPEN_FAILED", 1);
            }

            _logger.Write("WorkbookOpenConfirmed", FullNameOrUnknown(_document));

            try
            {
                ComSet(_application, "Visible", true);
                TryActivateDocument();
                CaptureApplicationIdentity();
                _logger.Write("WorkbookVisible", FullNameOrUnknown(_document));
            }
            catch (Exception error)
            {
                _logger.Write("VisibilityFailed", error.Message);
                return FailLaunchWithFallback(error, "VISIBILITY_FAILED", 3);
            }

            if (!SendOpenObserved())
            {
                _logger.Write("OpenObservedPostFailed");
                CloseHiddenWorkbook();
                SendLaunchFailed(
                    "OPEN_OBSERVED_POST_FAILED",
                    "Open observation could not be posted."
                );
                return 2;
            }

            var closeObservation = WaitForClose();
            SendClosed();
            QuitExcelIfNoWorkbooksRemain(closeObservation.UsedDegradedFallback);
            return 0;
        }
        catch (Exception error)
        {
            _logger.Write("ComOpenFailed", error.ToString());
            return FailLaunchWithFallback(error, "COM_OPEN_FAILED", 1);
        }
        finally
        {
            ReleaseComObjects();
            _httpClient.Dispose();
            _logger.Write("WatcherExited");
        }
    }

    private int FailLaunchWithFallback(Exception error, string reason, int exitCode)
    {
        if (TryShellOpenFallback(error, reason, out var fallbackFailureReason))
        {
            return 0;
        }

        SendLaunchFailed(
            fallbackFailureReason ?? reason,
            fallbackFailureReason is null ? error.Message : $"{reason}: {error.Message}"
        );
        CloseHiddenWorkbook();
        return exitCode;
    }

    private object OpenTargetDocument()
    {
        var documents = ComGetObject(_application!, GetDocumentCollectionName());
        try
        {
            return ComInvokeObject(
                documents,
                "Open",
                _options.OfficeApp switch
                {
                    OfficeApp.Word => BuildWordOpenArguments(),
                    OfficeApp.PowerPoint => BuildPowerPointOpenArguments(),
                    _ => BuildExcelOpenArguments(),
                }
            );
        }
        finally
        {
            ReleaseComObject(documents);
        }
    }

    private object?[] BuildExcelOpenArguments()
    {
        return new object?[]
        {
            _options.TargetPath,
            0,
            false,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            true,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
        };
    }

    private object?[] BuildPowerPointOpenArguments()
    {
        return new object?[]
        {
            _options.TargetPath,
            0,
            0,
            -1,
        };
    }

    private object?[] BuildWordOpenArguments()
    {
        return new object?[]
        {
            _options.TargetPath,
            false,
            false,
            false,
            Missing.Value,
            Missing.Value,
            false,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            true,
            Missing.Value,
            Missing.Value,
            Missing.Value,
            Missing.Value,
        };
    }

    private void TryActivateDocument()
    {
        try
        {
            if (_document is not null)
            {
                ComInvoke(_document, "Activate");
            }
        }
        catch (Exception error)
        {
            _logger.Write("DocumentActivateFailed", error.Message);
        }
    }

    private bool TryShellOpenFallback(
        Exception triggerError,
        string triggerReason,
        out string? fallbackFailureReason
    )
    {
        fallbackFailureReason = null;
        _logger.Write(
            "ShellOpenFallbackStarted",
            $"reason={triggerReason}; message={triggerError.Message}"
        );
        CloseHiddenWorkbook();

        if (!StartShellOpen())
        {
            fallbackFailureReason = "SHELL_OPEN_FAILED";
            return false;
        }

        if (!WaitForFileLock(ShellOpenFallbackTimeoutMs))
        {
            _logger.Write(
                "ShellOpenFallbackOpenNotObserved",
                $"timeoutMs={ShellOpenFallbackTimeoutMs}"
            );
            fallbackFailureReason = "SHELL_OPEN_NOT_OBSERVED";
            return false;
        }

        _logger.Write("ShellOpenFallbackOpenObserved", _options.TargetPath);
        if (!SendOpenObserved("WATCHER_FILE_LOCK"))
        {
            _logger.Write("ShellOpenFallbackOpenObservedPostFailed");
        }

        WaitForFileUnlockAfterObservedLock();
        SendClosed();
        return true;
    }

    private bool StartShellOpen()
    {
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = _options.TargetPath,
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(_options.TargetPath) ?? string.Empty,
            };
            Process.Start(startInfo);
            _logger.Write("ShellOpenFallbackLaunched", _options.TargetPath);
            return true;
        }
        catch (Exception error)
        {
            _logger.Write("ShellOpenFallbackLaunchFailed", error.Message);
            return false;
        }
    }

    private bool WaitForFileLock(int timeoutMs)
    {
        var deadline = DateTimeOffset.Now.AddMilliseconds(timeoutMs);
        var lastProbeDetails = string.Empty;
        while (DateTimeOffset.Now < deadline)
        {
            Application.DoEvents();
            Thread.Sleep(ProbeIntervalMs);

            var lockState = GetFileLockState();
            var probeDetails = $"lockState={lockState}";
            if (!string.Equals(probeDetails, lastProbeDetails, StringComparison.Ordinal))
            {
                _logger.WriteDebug("ShellOpenFallbackOpenProbe", probeDetails);
                lastProbeDetails = probeDetails;
            }

            if (lockState == FileLockState.Locked)
            {
                return true;
            }

            if (lockState == FileLockState.Missing)
            {
                return false;
            }
        }

        return false;
    }

    private void WaitForFileUnlockAfterObservedLock()
    {
        var closedConfirmations = 0;
        var lastProbeDetails = string.Empty;
        var lastProbeLogAt = DateTimeOffset.MinValue;
        while (closedConfirmations < 2)
        {
            Application.DoEvents();
            Thread.Sleep(ProbeIntervalMs);

            var lockState = GetFileLockState();
            var probeDetails = $"lockState={lockState}";
            var now = DateTimeOffset.Now;
            if (
                !string.Equals(probeDetails, lastProbeDetails, StringComparison.Ordinal)
                || now - lastProbeLogAt >= TimeSpan.FromSeconds(5)
            )
            {
                _logger.WriteDebug("ShellOpenFallbackCloseProbe", probeDetails);
                lastProbeDetails = probeDetails;
                lastProbeLogAt = now;
            }

            if (lockState != FileLockState.Unlocked)
            {
                closedConfirmations = 0;
                continue;
            }

            closedConfirmations += 1;
        }

        _logger.Write("ShellOpenFallbackClosedObserved");
    }

    private void TrySetExcelOption(string optionName, Action<object> configure)
    {
        if (_application is null)
        {
            return;
        }

        try
        {
            configure(_application);
        }
        catch (Exception error)
        {
            _logger.Write($"{optionName}SetFailed", error.Message);
        }
    }

    private CloseObservationResult WaitForClose()
    {
        var closedConfirmations = 0;
        var sawLockedFile = false;
        var usedDegradedFallback = false;
        DateTimeOffset? degradedSince = null;
        var degradedProbeCount = 0;
        var lastProbeDetails = string.Empty;
        var lastProbeLogAt = DateTimeOffset.MinValue;
        while (closedConfirmations < CloseConfirmationCount)
        {
            Application.DoEvents();
            Thread.Sleep(ProbeIntervalMs);

            var workbookPresence = GetTrackedWorkbookPresence();
            var lockState = GetFileLockState();
            if (lockState == FileLockState.Locked)
            {
                sawLockedFile = true;
            }

            var now = DateTimeOffset.Now;
            var processPresence = GetApplicationProcessPresence();
            var windowPresence = GetApplicationWindowPresence();
            var ownerFilePresence = GetOwnerFilePresence();
            var probeDetails =
                $"workbookPresence={workbookPresence}; lockState={lockState}; " +
                $"processPresence={processPresence}; windowPresence={windowPresence}; " +
                $"ownerFilePresence={ownerFilePresence}";
            if (
                !string.Equals(probeDetails, lastProbeDetails, StringComparison.Ordinal)
                || now - lastProbeLogAt >= TimeSpan.FromSeconds(5)
            )
            {
                _logger.WriteDebug("CloseProbe", probeDetails);
                lastProbeDetails = probeDetails;
                lastProbeLogAt = now;
            }

            if (lockState == FileLockState.Missing)
            {
                _logger.Write("TargetMissingBeforeCloseConfirmation");
                closedConfirmations = 0;
                continue;
            }

            if (workbookPresence != WorkbookPresence.Unknown)
            {
                if (degradedSince is not null)
                {
                    _logger.Write(
                        "OfficeObservationRecovered",
                        $"degradedForMs={(now - degradedSince.Value).TotalMilliseconds:0}"
                    );
                }
                degradedSince = null;
                degradedProbeCount = 0;
            }
            else
            {
                if (degradedSince is null)
                {
                    degradedSince = now;
                    _logger.Write("OfficeObservationDegraded", probeDetails);
                }

                degradedProbeCount += 1;
                var degradedFor = now - degradedSince.Value;
                _logger.WriteDebug(
                    "OfficeObservationFallbackProbe",
                    $"{probeDetails}; degradedForMs={degradedFor.TotalMilliseconds:0}; " +
                    $"retry={degradedProbeCount}"
                );
                if (degradedFor < ComRecoveryGrace)
                {
                    closedConfirmations = 0;
                    continue;
                }
            }

            var closedByComAndFile =
                workbookPresence == WorkbookPresence.Absent &&
                lockState == FileLockState.Unlocked;
            var degradedForFallback = degradedSince is null
                ? TimeSpan.Zero
                : now - degradedSince.Value;
            var applicationDefinitelyClosed =
                processPresence == ApplicationPresence.Absent ||
                (processPresence != ApplicationPresence.Present &&
                    windowPresence == ApplicationPresence.Absent);
            var applicationIdentityUnavailable =
                processPresence == ApplicationPresence.Unknown &&
                windowPresence == ApplicationPresence.Unknown;
            var closedByDegradedEvidence =
                sawLockedFile &&
                workbookPresence == WorkbookPresence.Unknown &&
                lockState == FileLockState.Unlocked &&
                ownerFilePresence == ApplicationPresence.Absent &&
                (applicationDefinitelyClosed ||
                    (applicationIdentityUnavailable &&
                        degradedForFallback >= DegradedCloseFallbackDelay));

            if (!closedByComAndFile && !closedByDegradedEvidence)
            {
                closedConfirmations = 0;
                continue;
            }

            if (closedByDegradedEvidence)
            {
                usedDegradedFallback = true;
            }
            closedConfirmations += 1;
        }

        if (usedDegradedFallback)
        {
            _logger.Write("OfficeObservationFallbackCloseConfirmed", lastProbeDetails);
        }
        else
        {
            _logger.Write("WorkbookClosedObserved");
        }
        return new CloseObservationResult(usedDegradedFallback);
    }

    private WorkbookPresence GetTrackedWorkbookPresence()
    {
        if (_document is not null)
        {
            try
            {
                var documentPath = Path.GetFullPath(
                    Convert.ToString(ComGet(_document, "FullName")) ?? string.Empty
                );
                if (string.Equals(
                        documentPath,
                        _options.TargetPath,
                        StringComparison.OrdinalIgnoreCase
                    ))
                {
                    return WorkbookPresence.Open;
                }
            }
            catch (Exception error)
            {
                WriteProbeError("TrackedDocumentProbeUnavailable", error.Message);
            }
        }

        if (_application is null)
        {
            return WorkbookPresence.Unknown;
        }

        var sawProbeError = false;
        try
        {
            var workbooks = ComGetObject(_application, GetDocumentCollectionName());
            try
            {
                var workbookCount = Convert.ToInt32(ComGet(workbooks, "Count"));
                for (var index = 1; index <= workbookCount; index++)
                {
                    object? workbook = null;
                    try
                    {
                        workbook = ComInvokeObject(workbooks, "Item", new object?[] { index });
                        var workbookPath = Path.GetFullPath(
                            Convert.ToString(ComGet(workbook, "FullName")) ?? string.Empty
                        );
                        if (string.Equals(
                                workbookPath,
                                _options.TargetPath,
                                StringComparison.OrdinalIgnoreCase
                            ))
                        {
                            return WorkbookPresence.Open;
                        }
                    }
                    catch (Exception error)
                    {
                        sawProbeError = true;
                        WriteProbeError("WorkbookCollectionProbeFailed", error.Message);
                    }
                    finally
                    {
                        ReleaseComObject(workbook);
                    }
                }
            }
            finally
            {
                ReleaseComObject(workbooks);
            }

            return sawProbeError ? WorkbookPresence.Unknown : WorkbookPresence.Absent;
        }
        catch (Exception error)
        {
            WriteProbeError("WorkbookCollectionUnavailable", error.Message);
            return WorkbookPresence.Unknown;
        }
    }

    private void CaptureApplicationIdentity()
    {
        if (_application is null)
        {
            return;
        }

        try
        {
            object? rawHandle;
            try
            {
                rawHandle = ComGet(_application, "Hwnd");
            }
            catch
            {
                rawHandle = ComGet(_application, "HWND");
            }

            var handle = new nint(Convert.ToInt64(rawHandle));
            if (handle == nint.Zero)
            {
                return;
            }

            _applicationWindowHandle = handle;
            _ = GetWindowThreadProcessId(handle, out var processId);
            if (processId > 0)
            {
                _applicationProcessId = checked((int)processId);
            }
            _logger.WriteDebug(
                "ApplicationIdentityCaptured",
                $"processId={_applicationProcessId?.ToString() ?? "unknown"}; hwnd={handle}"
            );
        }
        catch (Exception error)
        {
            _logger.Write("ApplicationIdentityUnavailable", error.Message);
        }
    }

    private ApplicationPresence GetApplicationProcessPresence()
    {
        if (_applicationProcessId is null)
        {
            return ApplicationPresence.Unknown;
        }

        try
        {
            using var process = Process.GetProcessById(_applicationProcessId.Value);
            return process.HasExited
                ? ApplicationPresence.Absent
                : ApplicationPresence.Present;
        }
        catch (ArgumentException)
        {
            return ApplicationPresence.Absent;
        }
        catch (Exception error)
        {
            WriteProbeError("ApplicationProcessProbeUnavailable", error.Message);
            return ApplicationPresence.Unknown;
        }
    }

    private ApplicationPresence GetApplicationWindowPresence()
    {
        if (_applicationWindowHandle is null)
        {
            return ApplicationPresence.Unknown;
        }

        try
        {
            return IsWindow(_applicationWindowHandle.Value)
                ? ApplicationPresence.Present
                : ApplicationPresence.Absent;
        }
        catch (Exception error)
        {
            WriteProbeError("ApplicationWindowProbeUnavailable", error.Message);
            return ApplicationPresence.Unknown;
        }
    }

    private ApplicationPresence GetOwnerFilePresence()
    {
        try
        {
            var directory = Path.GetDirectoryName(_options.TargetPath);
            var fileName = Path.GetFileName(_options.TargetPath);
            if (string.IsNullOrWhiteSpace(directory) || fileName.Length < 3)
            {
                return ApplicationPresence.Unknown;
            }

            var replacementName = $"~${fileName[2..]}";
            var prefixedName = $"~${fileName}";
            return File.Exists(Path.Combine(directory, replacementName)) ||
                File.Exists(Path.Combine(directory, prefixedName))
                ? ApplicationPresence.Present
                : ApplicationPresence.Absent;
        }
        catch (Exception error)
        {
            WriteProbeError("OwnerFileProbeUnavailable", error.Message);
            return ApplicationPresence.Unknown;
        }
    }

    private FileLockState GetFileLockState()
    {
        try
        {
            using var stream = File.Open(
                _options.TargetPath,
                FileMode.Open,
                FileAccess.ReadWrite,
                FileShare.None
            );
            return FileLockState.Unlocked;
        }
        catch (FileNotFoundException)
        {
            return FileLockState.Missing;
        }
        catch (IOException error) when (IsWindowsLockViolation(error))
        {
            return FileLockState.Locked;
        }
        catch (Exception error)
        {
            WriteProbeError("FileLockProbeError", error.Message);
            return FileLockState.Error;
        }
    }

    private static bool IsWindowsLockViolation(IOException error)
    {
        var code = error.HResult & 0xFFFF;
        return code is 32 or 33;
    }

    private void WriteProbeError(string eventName, string details)
    {
        var now = DateTimeOffset.Now;
        if (
            !_probeErrorLogs.TryGetValue(eventName, out var lastLog)
            || !string.Equals(lastLog.Details, details, StringComparison.Ordinal)
            || now - lastLog.WrittenAt >= ProbeErrorLogInterval
        )
        {
            _logger.Write(eventName, details);
            _probeErrorLogs[eventName] = new ProbeErrorLogState(details, now);
        }
    }

    private bool SendOpenObserved(string source = "WATCHER_COM")
    {
        return PostWithRetry(
            $"sessions/{Uri.EscapeDataString(_options.SessionId)}/open-observed",
            new
            {
                generation = _options.Generation,
                openSignalToken = _options.OpenSignalToken,
                source,
            },
            "OpenObserved",
            attempts: 40,
            delayMs: 250
        );
    }

    private bool SendLaunchFailed(string reason, string message)
    {
        return PostWithRetry(
            $"sessions/{Uri.EscapeDataString(_options.SessionId)}/launch-failed",
            new
            {
                generation = _options.Generation,
                openSignalToken = _options.OpenSignalToken,
                reason,
                message = Truncate(message, 500),
            },
            "LaunchFailed",
            attempts: 8,
            delayMs: 250
        );
    }

    private bool SendClosed()
    {
        return PostWithRetry(
            $"sessions/{Uri.EscapeDataString(_options.SessionId)}/closed",
            new
            {
                generation = _options.Generation,
                closeSignalToken = _options.CloseSignalToken,
                source = "WATCHER",
            },
            "Closed",
            attempts: 60,
            delayMs: 500
        );
    }

    private bool PostWithRetry(string path, object body, string eventName, int attempts, int delayMs)
    {
        var url = $"{_options.AgentBaseUrl.TrimEnd('/')}/{path}";
        var json = JsonSerializer.Serialize(body);

        for (var attempt = 0; attempt < attempts; attempt++)
        {
            try
            {
                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var response = _httpClient.PostAsync(url, content).GetAwaiter().GetResult();
                if (response.IsSuccessStatusCode)
                {
                    _logger.Write($"{eventName}Posted");
                    return true;
                }

                _logger.Write($"{eventName}PostRejected", $"{(int)response.StatusCode} {response.ReasonPhrase}");
            }
            catch (Exception error)
            {
                _logger.Write($"{eventName}PostFailed", $"attempt={attempt}; message={error.Message}");
            }

            Thread.Sleep(delayMs);
        }

        return false;
    }

    private void CloseHiddenWorkbook()
    {
        try
        {
            if (_document is not null)
            {
                ComInvoke(
                    _document,
                    "Close",
                    _options.OfficeApp == OfficeApp.PowerPoint
                        ? null
                        : new object?[] { false }
                );
            }
        }
        catch (Exception error)
        {
            _logger.Write("HiddenWorkbookCloseFailed", error.Message);
        }

        try
        {
            if (_application is not null)
            {
                ComInvoke(_application, "Quit");
            }
        }
        catch (Exception error)
        {
            _logger.Write("ExcelQuitFailed", error.Message);
        }
    }

    private void QuitExcelIfNoWorkbooksRemain(bool usedDegradedFallback)
    {
        if (usedDegradedFallback)
        {
            _logger.Write("ApplicationQuitSkippedAfterDegradedObservation");
            return;
        }

        try
        {
            if (_application is null)
            {
                return;
            }

            var workbooks = ComGetObject(_application, GetDocumentCollectionName());
            try
            {
                if (Convert.ToInt32(ComGet(workbooks, "Count")) != 0)
                {
                    return;
                }

                _logger.Write("ApplicationQuitAfterClose");
                ComInvoke(_application, "Quit");
            }
            finally
            {
                ReleaseComObject(workbooks);
            }
        }
        catch (Exception error)
        {
            _logger.Write("ApplicationQuitAfterCloseFailed", error.Message);
        }
    }

    private void ReleaseComObjects()
    {
        ReleaseComObject(_document);
        ReleaseComObject(_application);
        _document = null;
        _application = null;
    }

    private static void ReleaseComObject(object? value)
    {
        if (value is null)
        {
            return;
        }

        try
        {
            if (Marshal.IsComObject(value))
            {
                Marshal.ReleaseComObject(value);
            }
        }
        catch
        {
            // Process exit will reclaim the COM proxy if explicit release fails.
        }
    }

    private static string FullNameOrUnknown(object? workbook)
    {
        try
        {
            return workbook is null
                ? "(none)"
                : Convert.ToString(ComGet(workbook, "FullName")) ?? "(none)";
        }
        catch
        {
            return "(unavailable)";
        }
    }

    private string GetApplicationProgId()
    {
        return _options.OfficeApp switch
        {
            OfficeApp.Word => "Word.Application",
            OfficeApp.PowerPoint => "PowerPoint.Application",
            _ => "Excel.Application",
        };
    }

    private string GetDocumentCollectionName()
    {
        return _options.OfficeApp switch
        {
            OfficeApp.Word => "Documents",
            OfficeApp.PowerPoint => "Presentations",
            _ => "Workbooks",
        };
    }

    private object CreateOfficeApplication()
    {
        var progId = GetApplicationProgId();
        var appType = Type.GetTypeFromProgID(progId, throwOnError: true)!;
        return Activator.CreateInstance(appType)
            ?? throw new InvalidOperationException($"{progId} could not be created.");
    }

    private static object? ComGet(object target, string propertyName)
    {
        return target.GetType().InvokeMember(
            propertyName,
            BindingFlags.GetProperty,
            binder: null,
            target,
            args: null
        );
    }

    private static object ComGetObject(object target, string propertyName)
    {
        return ComGet(target, propertyName)
            ?? throw new InvalidOperationException(
                $"COM property '{propertyName}' returned null."
            );
    }

    private static void ComSet(object target, string propertyName, object? value)
    {
        target.GetType().InvokeMember(
            propertyName,
            BindingFlags.SetProperty,
            binder: null,
            target,
            args: new[] { value }
        );
    }

    private static object? ComInvoke(object target, string methodName, object?[]? args = null)
    {
        return target.GetType().InvokeMember(
            methodName,
            BindingFlags.InvokeMethod,
            binder: null,
            target,
            args
        );
    }

    private static object ComInvokeObject(
        object target,
        string methodName,
        object?[]? args = null
    )
    {
        return ComInvoke(target, methodName, args)
            ?? throw new InvalidOperationException(
                $"COM method '{methodName}' returned null."
            );
    }

    private static string Truncate(string value, int maxLength)
    {
        return value.Length <= maxLength ? value : value[..maxLength];
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(nint hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(nint hWnd, out uint processId);
}

internal sealed record WatcherOptions(
    OfficeApp OfficeApp,
    string TargetPath,
    string SessionId,
    int Generation,
    string OpenSignalToken,
    string CloseSignalToken,
    string AgentBaseUrl,
    string TimelineLogPath,
    DiagnosticLogLevel DiagnosticLogLevel
)
{
    internal static ParseResult TryParse(string[] args)
    {
        try
        {
            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var index = 0; index < args.Length; index += 2)
            {
                if (!args[index].StartsWith("--", StringComparison.Ordinal))
                {
                    return ParseResult.Failed($"Unexpected argument '{args[index]}'.");
                }

                if (index + 1 >= args.Length)
                {
                    return ParseResult.Failed($"Missing value for '{args[index]}'.");
                }

                values[args[index][2..]] = args[index + 1];
            }

            var timelineLogPath = GetOptional(
                values,
                "timeline-log-path",
                Environment.GetEnvironmentVariable("PROJECT_WING_EXCEL_WATCHER_LOG_PATH")
            );
            if (!int.TryParse(GetRequired(values, "generation"), out var generation) || generation <= 0)
            {
                return ParseResult.Failed("generation must be a positive integer.");
            }
            if (!TryParseOfficeApp(GetOptional(values, "office-app", "excel"), out var officeApp))
            {
                return ParseResult.Failed("office-app must be one of 'excel', 'word', or 'powerpoint'.");
            }
            if (
                !TryParseDiagnosticLogLevel(
                    GetOptional(
                        values,
                        "diagnostic-log-level",
                        Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL")
                            ?? "normal"
                    ),
                    out var diagnosticLogLevel
                )
            )
            {
                return ParseResult.Failed("diagnostic-log-level must be either 'normal' or 'debug'.");
            }

            return ParseResult.Success(
                new WatcherOptions(
                    officeApp,
                    Path.GetFullPath(GetRequired(values, "target-path")),
                    GetRequired(values, "session-id"),
                    generation,
                    GetRequired(values, "open-signal-token"),
                    GetRequired(values, "close-signal-token"),
                    GetRequired(values, "agent-base-url"),
                    Path.GetFullPath(timelineLogPath),
                    diagnosticLogLevel
                )
            );
        }
        catch (Exception error)
        {
            return ParseResult.Failed(error.Message);
        }
    }

    private static string GetRequired(IReadOnlyDictionary<string, string> values, string key)
    {
        if (!values.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"Missing required argument --{key}.");
        }

        return value;
    }

    private static string GetOptional(
        IReadOnlyDictionary<string, string> values,
        string key,
        string? fallback
    )
    {
        if (values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (!string.IsNullOrWhiteSpace(fallback))
        {
            return fallback;
        }

        throw new ArgumentException($"Missing required argument --{key}.");
    }

    private static bool TryParseOfficeApp(string value, out OfficeApp officeApp)
    {
        if (string.Equals(value, "word", StringComparison.OrdinalIgnoreCase))
        {
            officeApp = OfficeApp.Word;
            return true;
        }
        if (string.Equals(value, "powerpoint", StringComparison.OrdinalIgnoreCase))
        {
            officeApp = OfficeApp.PowerPoint;
            return true;
        }
        if (string.Equals(value, "excel", StringComparison.OrdinalIgnoreCase))
        {
            officeApp = OfficeApp.Excel;
            return true;
        }

        officeApp = OfficeApp.Excel;
        return false;
    }

    private static bool TryParseDiagnosticLogLevel(
        string value,
        out DiagnosticLogLevel diagnosticLogLevel
    )
    {
        if (string.Equals(value, "debug", StringComparison.OrdinalIgnoreCase))
        {
            diagnosticLogLevel = DiagnosticLogLevel.Debug;
            return true;
        }
        if (string.Equals(value, "normal", StringComparison.OrdinalIgnoreCase))
        {
            diagnosticLogLevel = DiagnosticLogLevel.Normal;
            return true;
        }

        diagnosticLogLevel = DiagnosticLogLevel.Normal;
        return false;
    }
}

internal sealed record ParseResult(WatcherOptions? Options, string? Error)
{
    internal static ParseResult Success(WatcherOptions options) => new(options, null);
    internal static ParseResult Failed(string error) => new(null, error);
}

internal sealed class TimelineLogger : IDisposable
{
    private readonly string _path;
    private readonly DiagnosticLogLevel _level;
    private readonly object _lock = new();

    internal TimelineLogger(string path, DiagnosticLogLevel level)
    {
        _path = path;
        _level = level;
        var directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }
    }

    internal void Write(string eventName, string? details = null)
    {
        var line = $"{DateTimeOffset.Now:O} {eventName}";
        if (!string.IsNullOrWhiteSpace(details))
        {
            line += $" {details}";
        }

        lock (_lock)
        {
            File.AppendAllText(_path, line + Environment.NewLine, Encoding.UTF8);
        }
    }

    internal void WriteDebug(string eventName, string? details = null)
    {
        if (_level != DiagnosticLogLevel.Debug)
        {
            return;
        }

        Write(eventName, details);
    }

    public void Dispose()
    {
    }
}

internal sealed record ProbeErrorLogState(string Details, DateTimeOffset WrittenAt);

internal sealed record CloseObservationResult(bool UsedDegradedFallback);

internal enum DiagnosticLogLevel
{
    Normal,
    Debug,
}

internal enum FileLockState
{
    Unlocked,
    Locked,
    Missing,
    Error,
}

internal enum WorkbookPresence
{
    Open,
    Absent,
    Unknown,
}

internal enum ApplicationPresence
{
    Present,
    Absent,
    Unknown,
}

internal enum OfficeApp
{
    Excel,
    Word,
    PowerPoint,
}
