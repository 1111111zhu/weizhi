using System.Diagnostics;
using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentPrinterDiscovery
{
    private static readonly TimeSpan DiscoveryTimeout = TimeSpan.FromSeconds(8);

    public async Task<IReadOnlyList<DesktopAgentPrinter>> ListAsync(
        CancellationToken cancellationToken
    )
    {
        if (OperatingSystem.IsWindows())
        {
            var output = await RunAsync(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline | ConvertTo-Json -Compress",
                ],
                cancellationToken
            );
            return ParseWindowsPrinters(output);
        }
        if (OperatingSystem.IsMacOS() || OperatingSystem.IsLinux())
        {
            var command = File.Exists("/usr/bin/lpstat") ? "/usr/bin/lpstat" : "lpstat";
            var output = await RunAsync(command, ["-p", "-d"], cancellationToken);
            return ParseCupsPrinters(output);
        }
        throw Unsupported();
    }

    private static async Task<string> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        CancellationToken cancellationToken
    )
    {
        var startInfo = new ProcessStartInfo(fileName)
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }
        try
        {
            using var process = Process.Start(startInfo) ?? throw Unsupported();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(DiscoveryTimeout);
            var output = await process.StandardOutput.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token);
            if (process.ExitCode != 0)
            {
                throw DiscoveryFailed();
            }
            return output;
        }
        catch (Exception error) when (
            error is System.ComponentModel.Win32Exception or FileNotFoundException
        )
        {
            throw Unsupported();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw DiscoveryFailed();
        }
    }

    private static IReadOnlyList<DesktopAgentPrinter> ParseWindowsPrinters(string output)
    {
        if (string.IsNullOrWhiteSpace(output))
        {
            return Array.Empty<DesktopAgentPrinter>();
        }
        try
        {
            using var document = JsonDocument.Parse(output);
            var records = document.RootElement.ValueKind == JsonValueKind.Array
                ? document.RootElement.EnumerateArray().ToArray()
                : [document.RootElement];
            return records.Select(ParseWindowsPrinter)
                .Where(printer => printer is not null)
                .Cast<DesktopAgentPrinter>()
                .ToArray();
        }
        catch (JsonException)
        {
            throw DiscoveryFailed();
        }
    }

    private static DesktopAgentPrinter? ParseWindowsPrinter(JsonElement value)
    {
        if (!value.TryGetProperty("Name", out var nameValue)
            || nameValue.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(nameValue.GetString()))
        {
            return null;
        }
        return new DesktopAgentPrinter(
            nameValue.GetString()!.Trim(),
            ReadBoolean(value, "Default"),
            ReadBoolean(value, "WorkOffline")
        );
    }

    private static IReadOnlyList<DesktopAgentPrinter> ParseCupsPrinters(string output)
    {
        var lines = output.Split('\n', StringSplitOptions.TrimEntries);
        var defaultPrefix = "system default destination: ";
        var defaultName = lines.FirstOrDefault(line => line.StartsWith(defaultPrefix))?
            [defaultPrefix.Length..];
        return lines.Where(line => line.StartsWith("printer ", StringComparison.Ordinal))
            .Select(line => line["printer ".Length..].Split(' ', 2)[0])
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.Ordinal)
            .Select(name => new DesktopAgentPrinter(
                name,
                name == defaultName,
                false
            ))
            .ToArray();
    }

    private static bool ReadBoolean(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.True;
    }

    private static DesktopAgentRuntimeException Unsupported()
    {
        return new DesktopAgentRuntimeException(
            "PRINT_UNSUPPORTED",
            "Direct printer access is unavailable on this computer.",
            StatusCodes.Status501NotImplemented
        );
    }

    private static DesktopAgentRuntimeException DiscoveryFailed()
    {
        return new DesktopAgentRuntimeException(
            "PRINTER_DISCOVERY_FAILED",
            "Could not read the local printer list.",
            StatusCodes.Status500InternalServerError
        );
    }
}
