namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentOfficeDiagnostics(
    DesktopAgentPdfEditorResolver pdfEditorResolver
)
{
    private static readonly IReadOnlyList<DesktopAgentOfficeDefinition> OfficeApps =
    [
        new() { Key = "excel", Label = "Excel", ProgId = "Excel.Application", MacApplicationPath = "/Applications/Microsoft Excel.app" },
        new() { Key = "word", Label = "Word", ProgId = "Word.Application", MacApplicationPath = "/Applications/Microsoft Word.app" },
        new() { Key = "powerPoint", Label = "PowerPoint", ProgId = "PowerPoint.Application", MacApplicationPath = "/Applications/Microsoft PowerPoint.app" },
    ];

    public DesktopAgentHealthDiagnostics Read()
    {
        var checkedAt = DateTime.UtcNow.ToString("O");
        var results = OfficeApps.ToDictionary(
            definition => definition.Key,
            definition => ReadOfficeApp(definition, checkedAt)
        );
        return new DesktopAgentHealthDiagnostics
        {
            Excel = results["excel"],
            Word = results["word"],
            PowerPoint = results["powerPoint"],
            PdfEditor = ReadPdfEditor(checkedAt),
        };
    }

    public void EnsureMasterEditorAvailable(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (extension == ".pdf")
        {
            var pdf = ReadPdfEditor(DateTime.UtcNow.ToString("O"));
            if (pdf.Status == "MISSING" || pdf.Installed == false
                || pdf.TrustedEditor == false)
            {
                throw MissingEditor(
                    "PDF_EDITOR_NOT_INSTALLED",
                    "A supported PDF editor is required for PDF Master editing."
                );
            }
            return;
        }
        var definition = extension switch
        {
            ".doc" or ".docx" => OfficeApps[1],
            ".ppt" or ".pptx" => OfficeApps[2],
            ".csv" or ".xls" or ".xlsb" or ".xlsm" or ".xlsx" => OfficeApps[0],
            _ => null,
        };
        if (definition is null) return;
        var diagnostics = ReadOfficeApp(definition, DateTime.UtcNow.ToString("O"));
        if (diagnostics.Status == "MISSING" || diagnostics.Installed == false)
        {
            throw MissingEditor(
                $"{definition.Key.ToUpperInvariant()}_NOT_INSTALLED",
                $"Microsoft {definition.Label} is required for Master editing."
            );
        }
    }

    private static DesktopAgentOfficeAppDiagnostics ReadOfficeApp(
        DesktopAgentOfficeDefinition definition,
        string checkedAt
    )
    {
        if (OperatingSystem.IsWindows())
        {
            var installed = Type.GetTypeFromProgID(definition.ProgId) is not null;
            return BuildDetectedOfficeApp(new DesktopAgentOfficeDetection
            {
                Label = definition.Label,
                CheckedAt = checkedAt,
                Installed = installed,
                SupportsCom = true,
            });
        }
        if (OperatingSystem.IsMacOS())
        {
            var installed = Directory.Exists(definition.MacApplicationPath);
            return BuildDetectedOfficeApp(new DesktopAgentOfficeDetection
            {
                Label = definition.Label,
                CheckedAt = checkedAt,
                Installed = installed,
                SupportsCom = false,
            });
        }
        return new DesktopAgentOfficeAppDiagnostics
        {
            Status = "SKIPPED",
            CheckedAt = checkedAt,
            ComAutomation = "SKIPPED",
            HiddenAutomationProcessCount = 0,
            Message = $"{definition.Label} diagnostics are unavailable on this platform.",
        };
    }

    private static DesktopAgentOfficeAppDiagnostics BuildDetectedOfficeApp(
        DesktopAgentOfficeDetection detection
    )
    {
        return new DesktopAgentOfficeAppDiagnostics
        {
            Status = detection.Installed ? "OK" : "MISSING",
            Installed = detection.Installed,
            CheckedAt = detection.CheckedAt,
            ComAutomation = detection.SupportsCom
                ? detection.Installed ? "AVAILABLE" : "UNAVAILABLE"
                : "SKIPPED",
            HiddenAutomationProcessCount = 0,
            Message = detection.Installed
                ? null
                : $"Microsoft {detection.Label} is not installed or registered.",
            RecommendedAction = detection.Installed
                ? null
                : $"Install or repair Microsoft {detection.Label}, then run diagnostics again.",
        };
    }

    private DesktopAgentPdfEditorDiagnostics ReadPdfEditor(string checkedAt)
    {
        if (OperatingSystem.IsWindows())
        {
            var path = pdfEditorResolver.Resolve();
            return new DesktopAgentPdfEditorDiagnostics
            {
                Status = path is null ? "MISSING" : "OK",
                Installed = path is not null,
                TrustedEditor = path is not null,
                CheckedAt = checkedAt,
                EditorPath = path,
                Message = path is null
                    ? "A supported PDF editor was not found."
                    : null,
            };
        }
        if (OperatingSystem.IsMacOS())
        {
            var path = ReadFirstExistingPath(
                "/System/Applications/Preview.app",
                "/Applications/Adobe Acrobat.app"
            );
            return new DesktopAgentPdfEditorDiagnostics
            {
                Status = path is null ? "MISSING" : "OK",
                Installed = path is not null,
                TrustedEditor = path is not null,
                CheckedAt = checkedAt,
                EditorPath = path,
                Message = path is null ? "A supported PDF editor was not found." : null,
            };
        }
        return new DesktopAgentPdfEditorDiagnostics
        {
            Status = "SKIPPED",
            CheckedAt = checkedAt,
            Message = "PDF editor diagnostics are unavailable on this platform.",
        };
    }

    private static string? ReadFirstExistingPath(string first, string second)
    {
        if (Directory.Exists(first))
        {
            return first;
        }
        return Directory.Exists(second) ? second : null;
    }

    private static DesktopAgentRuntimeException MissingEditor(
        string code,
        string message
    )
    {
        return new DesktopAgentRuntimeException(
            code,
            $"{message} Install it, then retry Master.",
            StatusCodes.Status409Conflict
        );
    }
}

public sealed record DesktopAgentOfficeDefinition
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public required string ProgId { get; init; }
    public required string MacApplicationPath { get; init; }
}

public sealed record DesktopAgentOfficeDetection
{
    public required string Label { get; init; }
    public required string CheckedAt { get; init; }
    public required bool Installed { get; init; }
    public required bool SupportsCom { get; init; }
}

public sealed record DesktopAgentHealthDiagnostics
{
    public required DesktopAgentOfficeAppDiagnostics Excel { get; init; }
    public required DesktopAgentOfficeAppDiagnostics Word { get; init; }
    public required DesktopAgentOfficeAppDiagnostics PowerPoint { get; init; }
    public required DesktopAgentPdfEditorDiagnostics PdfEditor { get; init; }
}

public sealed record DesktopAgentOfficeAppDiagnostics
{
    public required string Status { get; init; }
    public bool? Installed { get; init; }
    public required string CheckedAt { get; init; }
    public required string ComAutomation { get; init; }
    public required int HiddenAutomationProcessCount { get; init; }
    public string? Message { get; init; }
    public string? RecommendedAction { get; init; }
}

public sealed record DesktopAgentPdfEditorDiagnostics
{
    public required string Status { get; init; }
    public bool? Installed { get; init; }
    public bool? TrustedEditor { get; init; }
    public required string CheckedAt { get; init; }
    public string? EditorPath { get; init; }
    public string? Message { get; init; }
}
