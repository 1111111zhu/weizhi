using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Xml.Linq;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentTransferDiagnosticLog
{
    private const long MaxLogBytes = 2L * 1024 * 1024;
    private readonly object sync = new();
    private readonly string logPath;
    private readonly string rotatedLogPath;

    public DesktopAgentTransferDiagnosticLog(DesktopAgentRuntimeOptions options)
    {
        logPath = Path.Combine(options.StateRoot, "transfer-diagnostics.jsonl");
        rotatedLogPath = $"{logPath}.1";
    }

    public void RecordHttpFailure(Uri downloadUri, HttpResponseMessage response)
    {
        Write(new TransferDiagnosticEntry(
            Timestamp: DateTimeOffset.UtcNow,
            Event: "DOWNLOAD_HTTP_FAILURE",
            Origin: ReadOrigin(downloadUri),
            TargetOrigin: null,
            StatusCode: (int)response.StatusCode,
            ReasonPhrase: response.ReasonPhrase,
            ExceptionType: null,
            SocketError: null
        ));
    }

    public void RecordTransportFailure(Uri? downloadUri, HttpRequestException error)
    {
        var socketError = FindSocketException(error)?.SocketErrorCode.ToString();
        Write(new TransferDiagnosticEntry(
            Timestamp: DateTimeOffset.UtcNow,
            Event: "DOWNLOAD_TRANSPORT_FAILURE",
            Origin: ReadOrigin(downloadUri),
            TargetOrigin: null,
            StatusCode: null,
            ReasonPhrase: null,
            ExceptionType: error.GetType().Name,
            SocketError: socketError
        ));
    }

    public void RecordRedirect(Uri sourceUri, Uri targetUri, HttpStatusCode statusCode)
    {
        Write(new TransferDiagnosticEntry(
            Timestamp: DateTimeOffset.UtcNow,
            Event: "DOWNLOAD_REDIRECT",
            Origin: ReadOrigin(sourceUri),
            TargetOrigin: ReadOrigin(targetUri),
            StatusCode: (int)statusCode,
            ReasonPhrase: null,
            ExceptionType: null,
            SocketError: null
        ));
    }

    public void RecordSyncFailure(
        string stage,
        DesktopAgentRuntimeException error
    )
    {
        Write(new TransferDiagnosticEntry(
            Timestamp: DateTimeOffset.UtcNow,
            Event: "SESSION_SYNC_FAILURE",
            Origin: "local-runtime",
            TargetOrigin: null,
            StatusCode: null,
            ReasonPhrase: stage,
            ExceptionType: nameof(DesktopAgentRuntimeException),
            SocketError: null,
            ErrorCode: error.Code
        ));
    }

    public async Task<string?> RecordObjectStorageFailureAsync(
        string stage,
        HttpResponseMessage response,
        CancellationToken cancellationToken
    )
    {
        var errorCode = await ReadOssErrorCodeAsync(response, cancellationToken);
        Write(new TransferDiagnosticEntry(
            Timestamp: DateTimeOffset.UtcNow,
            Event: "OBJECT_STORAGE_FAILURE",
            Origin: ReadOrigin(response.RequestMessage?.RequestUri),
            TargetOrigin: null,
            StatusCode: (int)response.StatusCode,
            ReasonPhrase: stage,
            ExceptionType: null,
            SocketError: null,
            ErrorCode: errorCode
        ));
        return errorCode;
    }

    private void Write(TransferDiagnosticEntry entry)
    {
        try
        {
            lock (sync)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
                RotateIfNeeded();
                File.AppendAllText(
                    logPath,
                    $"{JsonSerializer.Serialize(entry)}{Environment.NewLine}"
                );
            }
        }
        catch (Exception error) when (
            error is IOException
                or UnauthorizedAccessException
                or NotSupportedException
        )
        {
            // Diagnostics must never make a transfer fail.
        }
    }

    private void RotateIfNeeded()
    {
        var current = new FileInfo(logPath);
        if (!current.Exists || current.Length < MaxLogBytes)
        {
            return;
        }
        File.Move(logPath, rotatedLogPath, overwrite: true);
    }

    private static SocketException? FindSocketException(Exception error)
    {
        for (Exception? current = error; current is not null; current = current.InnerException)
        {
            if (current is SocketException socketException)
            {
                return socketException;
            }
        }
        return null;
    }

    private static async Task<string?> ReadOssErrorCodeAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (body.Length > 64 * 1024) return null;
            return XDocument.Parse(body).Root?.Element("Code")?.Value;
        }
        catch (Exception error) when (
            error is IOException
                or System.Xml.XmlException
                or InvalidOperationException
        )
        {
            return null;
        }
    }

    private static string ReadOrigin(Uri? uri)
    {
        return uri?.GetLeftPart(UriPartial.Authority) ?? "unknown origin";
    }

    private sealed record TransferDiagnosticEntry(
        DateTimeOffset Timestamp,
        string Event,
        string Origin,
        string? TargetOrigin,
        int? StatusCode,
        string? ReasonPhrase,
        string? ExceptionType,
        string? SocketError,
        string? ErrorCode = null
    );
}
