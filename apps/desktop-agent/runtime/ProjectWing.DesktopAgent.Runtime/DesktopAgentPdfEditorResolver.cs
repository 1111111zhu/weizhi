using System.Runtime.Versioning;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentPdfEditorResolver
{
    private static readonly IReadOnlySet<string> TrustedExecutableNames =
        new HashSet<string>(
            [
                "acrobat.exe",
                "acrord32.exe",
                "acrord64.exe",
                "pdfxedit.exe",
                "pdfxcview.exe",
                "pxceditor.exe",
                "foxitpdfeditor.exe",
                "foxitphantompdf.exe",
                "pdfill.exe",
                "masterpdf.exe",
                "masterpdfeditor.exe",
            ],
            StringComparer.OrdinalIgnoreCase
        );

    private static readonly string[] AppPathNames =
    [
        "Acrobat.exe",
        "AcroRd32.exe",
        "AcroRd64.exe",
        "PDFXEdit.exe",
        "PDFXCview.exe",
        "PXCEditor.exe",
        "FoxitPDFEditor.exe",
        "FoxitPhantomPDF.exe",
        "PDFill.exe",
        "masterpdf.exe",
        "MasterPDFEditor.exe",
    ];

    private static readonly string[] CommonRelativePaths =
    [
        @"Adobe\Acrobat DC\Acrobat\Acrobat.exe",
        @"Adobe\Acrobat Reader DC\Reader\AcroRd32.exe",
        @"Adobe\Acrobat Reader\Reader\AcroRd32.exe",
        @"Adobe\Acrobat\Acrobat\Acrobat.exe",
        @"Tracker Software\PDF Editor\PDFXEdit.exe",
        @"Tracker Software\PDF Viewer\PDFXCview.exe",
        @"PDF-XChange\PDF Editor\PXCEditor.exe",
        @"Foxit Software\Foxit PDF Editor\FoxitPDFEditor.exe",
        @"Foxit Software\Foxit PhantomPDF\FoxitPhantomPDF.exe",
        @"PlotSoft\PDFill\PDFill.exe",
        @"PDFill\PDFill.exe",
        @"Code Industry\Master PDF Editor 6\masterpdf.exe",
        @"Code Industry\Master PDF Editor 6\MasterPDFEditor.exe",
        @"Code Industry\Master PDF Editor 5\masterpdf.exe",
        @"Code Industry\Master PDF Editor 5\MasterPDFEditor.exe",
        @"Master PDF Editor\masterpdf.exe",
        @"Master PDF Editor\MasterPDFEditor.exe",
    ];

    private readonly object sync = new();
    private string? cachedPath;

    public string? Resolve()
    {
        if (!OperatingSystem.IsWindows()) return null;
        lock (sync)
        {
            if (IsTrustedExistingPath(cachedPath)) return cachedPath;
            cachedPath = ResolveWindows();
            return cachedPath;
        }
    }

    public static bool IsTrustedExistingPath(string? path)
    {
        return !string.IsNullOrWhiteSpace(path)
            && File.Exists(path)
            && TrustedExecutableNames.Contains(Path.GetFileName(path));
    }

    [SupportedOSPlatform("windows")]
    private static string? ResolveWindows()
    {
        var configured = Environment.GetEnvironmentVariable(
            "PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH"
        );
        if (IsTrustedExistingPath(configured))
        {
            return Path.GetFullPath(configured!);
        }

        foreach (var candidate in ReadAppPathCandidates()
            .Concat(ReadUninstallCandidates())
            .Concat(ReadDefaultAssociationCandidates())
            .Concat(ReadCommonPathCandidates()))
        {
            if (IsTrustedExistingPath(candidate))
            {
                return Path.GetFullPath(candidate);
            }
        }
        return null;
    }

    [SupportedOSPlatform("windows")]
    private static IEnumerable<string> ReadUninstallCandidates()
    {
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                using var uninstall = baseKey.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Uninstall"
                );
                foreach (var name in uninstall?.GetSubKeyNames() ?? [])
                {
                    using var entry = uninstall?.OpenSubKey(name);
                    var icon = ExtractExecutablePath(
                        Convert.ToString(entry?.GetValue("DisplayIcon"))
                    );
                    if (icon is not null) yield return icon;
                    var location = Convert.ToString(entry?.GetValue("InstallLocation"));
                    if (string.IsNullOrWhiteSpace(location)
                        || !Directory.Exists(location))
                    {
                        continue;
                    }
                    foreach (var executableName in TrustedExecutableNames)
                    {
                        yield return Path.Combine(location, executableName);
                    }
                    foreach (var relativePath in CommonRelativePaths)
                    {
                        yield return Path.Combine(location, Path.GetFileName(relativePath));
                    }
                }
            }
        }
    }

    [SupportedOSPlatform("windows")]
    private static IEnumerable<string> ReadAppPathCandidates()
    {
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                foreach (var appName in AppPathNames)
                {
                    using var key = baseKey.OpenSubKey(
                        $@"Software\Microsoft\Windows\CurrentVersion\App Paths\{appName}"
                    );
                    var value = Convert.ToString(key?.GetValue(null));
                    var candidate = ExtractExecutablePath(value);
                    if (candidate is not null) yield return candidate;
                }
            }
        }
    }

    [SupportedOSPlatform("windows")]
    private static IEnumerable<string> ReadDefaultAssociationCandidates()
    {
        using var userChoice = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\UserChoice"
        );
        var progId = Convert.ToString(userChoice?.GetValue("ProgId"));
        if (string.IsNullOrWhiteSpace(progId)) yield break;

        using var userCommand = Registry.CurrentUser.OpenSubKey(
            $@"Software\Classes\{progId}\shell\open\command"
        );
        var command = Convert.ToString(userCommand?.GetValue(null));
        if (string.IsNullOrWhiteSpace(command))
        {
            using var machineCommand = Registry.LocalMachine.OpenSubKey(
                $@"Software\Classes\{progId}\shell\open\command"
            );
            command = Convert.ToString(machineCommand?.GetValue(null));
        }
        var candidate = ExtractExecutablePath(command);
        if (candidate is not null) yield return candidate;
    }

    private static IEnumerable<string> ReadCommonPathCandidates()
    {
        var roots = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        };
        return roots
            .Where(root => !string.IsNullOrWhiteSpace(root))
            .SelectMany(root => CommonRelativePaths.Select(relative => Path.Combine(root, relative)));
    }

    private static string? ExtractExecutablePath(string? command)
    {
        if (string.IsNullOrWhiteSpace(command)) return null;
        var expanded = Environment.ExpandEnvironmentVariables(command.Trim());
        var match = Regex.Match(
            expanded,
            "^\\s*(?:\"(?<path>[^\"]+\\.exe)\"|(?<path>.+?\\.exe))(?:\\s|,|$)",
            RegexOptions.IgnoreCase
        );
        return match.Success ? match.Groups["path"].Value : expanded.Trim('"');
    }
}
