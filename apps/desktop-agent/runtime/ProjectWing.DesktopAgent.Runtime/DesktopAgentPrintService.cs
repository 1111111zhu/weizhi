using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentPrintService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentPrinterDiscovery discovery,
    DesktopAgentFileTransfer transfer
)
{
    private static readonly TimeSpan PrintTimeout = TimeSpan.FromSeconds(30);

    public async Task<DesktopAgentPrintResponse> PrintAsync(
        DesktopAgentPrintRequest request,
        string authorization,
        CancellationToken cancellationToken
    )
    {
        var validated = Validate(request);
        var printers = await discovery.ListAsync(cancellationToken);
        var printer = printers.FirstOrDefault(item => item.Name == validated.PrinterName)
            ?? throw new DesktopAgentRuntimeException(
                "PRINTER_NOT_FOUND",
                "The selected printer is no longer available on this computer.",
                StatusCodes.Status404NotFound
            );
        if (printer.IsOffline)
        {
            throw new DesktopAgentRuntimeException(
                "PRINTER_OFFLINE",
                "The selected printer is offline.",
                StatusCodes.Status409Conflict
            );
        }
        var printed = await PrintDocumentsAsync(
            new DesktopAgentPrintOperation
            {
                Request = validated,
                Authorization = authorization,
            },
            cancellationToken
        );
        return new DesktopAgentPrintResponse
        {
            Ok = true,
            PrinterName = printer.Name,
            Printed = printed,
        };
    }

    private async Task<IReadOnlyList<DesktopAgentPrintedDocument>> PrintDocumentsAsync(
        DesktopAgentPrintOperation operation,
        CancellationToken cancellationToken
    )
    {
        var directory = Path.Combine(options.CacheRoot, "print-jobs", Guid.NewGuid().ToString("N"));
        var printed = new List<DesktopAgentPrintedDocument>();
        foreach (var document in operation.Request.Documents)
        {
            var fileName = BuildFileName(document);
            var localPath = Path.Combine(directory, fileName);
            await transfer.DownloadAsync(
                document.DownloadUri,
                localPath,
                operation.Authorization,
                makeReadOnly: true,
                cancellationToken
            );
            await SubmitAsync(localPath, operation.Request.PrinterName, cancellationToken);
            printed.Add(new DesktopAgentPrintedDocument(document.Id, fileName));
        }
        return printed;
    }

    private async Task SubmitAsync(
        string localPath,
        string printerName,
        CancellationToken cancellationToken
    )
    {
        if (options.DisableFileLaunch)
        {
            return;
        }
        var startInfo = OperatingSystem.IsWindows()
            ? BuildWindowsStartInfo(localPath, printerName)
            : BuildCupsStartInfo(localPath, printerName);
        try
        {
            using var process = Process.Start(startInfo) ?? throw PrintFailed();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(PrintTimeout);
            await process.WaitForExitAsync(timeout.Token);
            if (process.ExitCode != 0)
            {
                throw PrintFailed();
            }
        }
        catch (Exception error) when (
            error is System.ComponentModel.Win32Exception or FileNotFoundException
        )
        {
            throw PrintUnsupported();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw PrintFailed();
        }
    }

    private static ProcessStartInfo BuildWindowsStartInfo(
        string localPath,
        string printerName
    )
    {
        const string script = "$ErrorActionPreference='Stop'; "
            + "Start-Process -FilePath $env:PROJECT_WING_PRINT_FILE -Verb PrintTo "
            + "-ArgumentList $env:PROJECT_WING_PRINT_PRINTER -WindowStyle Hidden -Wait";
        var startInfo = BuildStartInfo(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command", script]
        );
        startInfo.Environment["PROJECT_WING_PRINT_FILE"] = localPath;
        startInfo.Environment["PROJECT_WING_PRINT_PRINTER"] = printerName;
        return startInfo;
    }

    private static ProcessStartInfo BuildCupsStartInfo(
        string localPath,
        string printerName
    )
    {
        var command = File.Exists("/usr/bin/lp") ? "/usr/bin/lp" : "lp";
        return BuildStartInfo(command, ["-d", printerName, localPath]);
    }

    private static ProcessStartInfo BuildStartInfo(
        string fileName,
        IReadOnlyList<string> arguments
    )
    {
        var startInfo = new ProcessStartInfo(fileName)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }
        return startInfo;
    }

    private DesktopAgentValidatedPrintRequest Validate(DesktopAgentPrintRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PrinterName)
            || request.Documents is not { Count: > 0 and <= 100 })
        {
            throw InvalidRequest();
        }
        var documents = request.Documents.Select(ValidateDocument).ToArray();
        return new DesktopAgentValidatedPrintRequest
        {
            PrinterName = request.PrinterName.Trim(),
            Documents = documents,
        };
    }

    private DesktopAgentValidatedPrintDocument ValidateDocument(
        DesktopAgentPrintDocument document
    )
    {
        if (string.IsNullOrWhiteSpace(document.Id)
            || string.IsNullOrWhiteSpace(document.FileName)
            || !Path.GetExtension(document.FileName).Equals(".pdf", StringComparison.OrdinalIgnoreCase)
            || !Uri.TryCreate(document.DownloadUrl, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https"))
        {
            throw InvalidRequest();
        }
        if (!options.AllowedDownloadOrigins.Contains(uri.GetLeftPart(UriPartial.Authority)))
        {
            throw new DesktopAgentRuntimeException(
                "ORIGIN_NOT_ALLOWED",
                "The print document URL is not an approved Project Wing origin.",
                StatusCodes.Status403Forbidden
            );
        }
        return new DesktopAgentValidatedPrintDocument
        {
            Id = document.Id.Trim(),
            FileName = document.FileName.Trim(),
            DownloadUri = uri,
        };
    }

    private static string BuildFileName(DesktopAgentValidatedPrintDocument document)
    {
        var baseName = Path.GetFileNameWithoutExtension(document.FileName);
        var safeName = string.Concat(baseName.Select(character =>
            char.IsLetterOrDigit(character) || character is '.' or '-' or '_' ? character : '_'
        ));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(document.Id)))
            [..8]
            .ToLowerInvariant();
        return $"{(string.IsNullOrWhiteSpace(safeName) ? "document" : safeName)}-{hash}.pdf";
    }

    private static DesktopAgentRuntimeException InvalidRequest()
    {
        return new DesktopAgentRuntimeException(
            "VALIDATION_FAILED",
            "Print request is invalid.",
            StatusCodes.Status400BadRequest
        );
    }

    private static DesktopAgentRuntimeException PrintUnsupported()
    {
        return new DesktopAgentRuntimeException(
            "PRINT_UNSUPPORTED",
            "Direct printer access is unavailable on this computer.",
            StatusCodes.Status501NotImplemented
        );
    }

    private static DesktopAgentRuntimeException PrintFailed()
    {
        return new DesktopAgentRuntimeException(
            "PRINT_FAILED",
            "The document could not be submitted to the selected printer.",
            StatusCodes.Status500InternalServerError
        );
    }
}

public sealed record DesktopAgentValidatedPrintRequest
{
    public required string PrinterName { get; init; }
    public required IReadOnlyList<DesktopAgentValidatedPrintDocument> Documents { get; init; }
}

public sealed record DesktopAgentValidatedPrintDocument
{
    public required string Id { get; init; }
    public required string FileName { get; init; }
    public required Uri DownloadUri { get; init; }
}

public sealed record DesktopAgentPrintOperation
{
    public required DesktopAgentValidatedPrintRequest Request { get; init; }
    public required string Authorization { get; init; }
}
