using System.Net.Http.Headers;
using System.Security.Cryptography;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentFileTransfer(
    HttpClient httpClient,
    DesktopAgentCacheService cache,
    DesktopAgentContentCache contentCache,
    DesktopAgentTransferDiagnosticLog diagnosticLog,
    DesktopAgentRuntimeOptions options,
    ILogger<DesktopAgentFileTransfer> logger
)
{
    private const int FileBufferSize = 81920;
    private const int MaxRedirects = 5;

    public async Task<DesktopAgentOpenTransferResult> DownloadForOpenAsync(
        DesktopAgentValidatedOpenRequest request,
        string localPath,
        string authorization,
        bool makeReadOnly,
        CancellationToken cancellationToken,
        bool storeReusableCopy = true
    )
    {
        var restored = await TryRestoreFromCacheAsync(
            request,
            localPath,
            makeReadOnly,
            cancellationToken
        );
        if (restored is not null)
            return new DesktopAgentOpenTransferResult(restored.Sha256, true);

        var hash = await DownloadAsync(
            request.DownloadUri,
            localPath,
            authorization,
            makeReadOnly,
            cancellationToken
        );
        if (
            request.ContentHash is not null
            && !string.Equals(request.ContentHash, hash, StringComparison.OrdinalIgnoreCase)
        )
        {
            TryDeleteFile(localPath);
            await cache.RemoveAsync(localPath, cancellationToken);
            throw new DesktopAgentRuntimeException(
                "DOWNLOAD_INTEGRITY_FAILED",
                "The downloaded file did not match the server content hash.",
                StatusCodes.Status502BadGateway
            );
        }
        if (storeReusableCopy)
        {
            await TryStoreReusableCopyAsync(request, localPath, hash, cancellationToken);
        }
        return new DesktopAgentOpenTransferResult(hash, false);
    }

    public void StoreReusableCopyInBackground(
        DesktopAgentValidatedOpenRequest request,
        string localPath,
        string hash
    )
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await TryStoreReusableCopyAsync(request, localPath, hash, CancellationToken.None);
            }
            catch (Exception error)
            {
                logger.LogWarning(
                    error,
                    "Background cache storage failed for {AttachmentId}.",
                    request.AttachmentId
                );
            }
        });
    }

    private async Task TryStoreReusableCopyAsync(
        DesktopAgentValidatedOpenRequest request,
        string localPath,
        string hash,
        CancellationToken cancellationToken
    )
    {
        try
        {
            await contentCache.StoreAsync(request, localPath, hash, cancellationToken);
        }
        catch (Exception error) when (
            error is IOException
                or UnauthorizedAccessException
                or DesktopAgentRuntimeException { Code: "DISK_FULL" }
        )
        {
            logger.LogWarning(
                error,
                "Downloaded file {AttachmentId} could not be added to the reusable cache.",
                request.AttachmentId
            );
        }
    }

    private async Task<DesktopAgentCacheRestoreResult?> TryRestoreFromCacheAsync(
        DesktopAgentValidatedOpenRequest request,
        string localPath,
        bool makeReadOnly,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await contentCache.TryRestoreAsync(
                request,
                localPath,
                makeReadOnly,
                cancellationToken
            );
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            logger.LogWarning(
                error,
                "Cached content for {AttachmentId} could not be restored; downloading a fresh copy.",
                request.AttachmentId
            );
            return null;
        }
    }

    public async Task<string> DownloadAsync(
        Uri downloadUri,
        string localPath,
        string authorization,
        bool makeReadOnly,
        CancellationToken cancellationToken
    )
    {
        using var response = await SendAsync(
            downloadUri,
            authorization,
            cancellationToken
        );
        if (!response.IsSuccessStatusCode)
        {
            var origin = ReadOrigin(downloadUri);
            diagnosticLog.RecordHttpFailure(downloadUri, response);
            logger.LogWarning(
                "Desktop Agent download returned HTTP {StatusCode} ({ReasonPhrase}) from {Origin}.",
                (int)response.StatusCode,
                response.ReasonPhrase,
                origin
            );
            throw DownloadFailed(response.StatusCode, origin);
        }
        try
        {
            await cache.EnsureCapacityAsync(
                response.Content.Headers.ContentLength ?? 0,
                localPath,
                cancellationToken
            );
            var hash = await WriteResponseAsync(
                response,
                localPath,
                makeReadOnly,
                cancellationToken
            );
            await cache.RecordAsync(
                localPath,
                makeReadOnly ? "READ_ONLY" : "MASTER",
                cancellationToken
            );
            return hash;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new DesktopAgentRuntimeException(
                "FILE_WRITE_FAILED",
                "Could not write the selected file.",
                StatusCodes.Status500InternalServerError
            );
        }
    }

    public static async Task<string> HashFileAsync(
        string path,
        CancellationToken cancellationToken
    )
    {
        await using var stream = File.OpenRead(path);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task<HttpResponseMessage> SendAsync(
        Uri initialUri,
        string authorization,
        CancellationToken cancellationToken
    )
    {
        var currentUri = initialUri;
        var includeAuthorization = true;
        for (var redirectCount = 0; ; redirectCount++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, currentUri);
            if (includeAuthorization)
            {
                request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
            }
            HttpResponseMessage response;
            try
            {
                response = await httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken
                );
            }
            catch (HttpRequestException error)
            {
                var origin = ReadOrigin(currentUri);
                diagnosticLog.RecordTransportFailure(currentUri, error);
                logger.LogWarning(
                    error,
                    "Desktop Agent download transport failed for {Origin}.",
                    origin
                );
                throw DownloadFailed(error, origin);
            }

            if (!IsRedirect(response.StatusCode))
            {
                return response;
            }

            if (
                redirectCount >= MaxRedirects
                || !TryResolveAllowedRedirect(
                    currentUri,
                    response.Headers.Location,
                    out var targetUri
                )
            )
            {
                var origin = ReadOrigin(currentUri);
                response.Dispose();
                throw new DesktopAgentRuntimeException(
                    "DOWNLOAD_REDIRECT_REJECTED",
                    $"Could not download the selected file (unsafe or excessive redirect from {origin}).",
                    StatusCodes.Status502BadGateway
                );
            }

            diagnosticLog.RecordRedirect(currentUri, targetUri, response.StatusCode);
            includeAuthorization = includeAuthorization && SameOrigin(currentUri, targetUri);
            currentUri = targetUri;
            response.Dispose();
        }
    }

    private bool TryResolveAllowedRedirect(Uri sourceUri, Uri? location, out Uri targetUri)
    {
        targetUri = null!;
        if (location is null || !Uri.TryCreate(sourceUri, location, out var resolved))
        {
            return false;
        }
        var targetOrigin = ReadOrigin(resolved);
        if (
            resolved.Scheme is not ("https" or "http")
            || (
                resolved.Scheme == "http"
                && !options.AllowedDownloadOrigins.Contains(targetOrigin)
            )
            || (
                !options.AllowedDownloadOrigins.Contains(targetOrigin)
                && !options.AllowedDownloadRedirectOrigins.Contains(targetOrigin)
            )
        )
        {
            return false;
        }
        targetUri = resolved;
        return true;
    }

    private static bool IsRedirect(System.Net.HttpStatusCode statusCode)
    {
        return (int)statusCode is 301 or 302 or 303 or 307 or 308;
    }

    private static bool SameOrigin(Uri left, Uri right)
    {
        return string.Equals(
            ReadOrigin(left),
            ReadOrigin(right),
            StringComparison.OrdinalIgnoreCase
        );
    }

    private static async Task<string> WriteResponseAsync(
        HttpResponseMessage response,
        string localPath,
        bool makeReadOnly,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(Path.GetDirectoryName(localPath)!);
        var temporaryPath = $"{localPath}.{Guid.NewGuid():N}.tmp";
        try
        {
            await WriteContentAsync(response, temporaryPath, cancellationToken);
            var hash = await HashFileAsync(temporaryPath, cancellationToken);
            ReplaceFile(temporaryPath, localPath);
            if (makeReadOnly)
            {
                File.SetAttributes(
                    localPath,
                    File.GetAttributes(localPath) | FileAttributes.ReadOnly
                );
            }
            return hash;
        }
        catch
        {
            TryDeleteFile(temporaryPath);
            throw;
        }
    }

    private static async Task WriteContentAsync(
        HttpResponseMessage response,
        string temporaryPath,
        CancellationToken cancellationToken
    )
    {
        await using var output = new FileStream(
            temporaryPath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            FileBufferSize,
            FileOptions.Asynchronous | FileOptions.SequentialScan
        );
        await response.Content.CopyToAsync(output, cancellationToken);
        await output.FlushAsync(cancellationToken);
    }

    private static void ReplaceFile(string temporaryPath, string localPath)
    {
        if (File.Exists(localPath))
        {
            File.SetAttributes(localPath, FileAttributes.Normal);
        }
        File.Move(temporaryPath, localPath, overwrite: true);
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            // Preserve the original transfer error.
        }
    }

    private static string ReadOrigin(Uri? uri)
    {
        return uri?.GetLeftPart(UriPartial.Authority) ?? "unknown origin";
    }

    private static DesktopAgentRuntimeException DownloadFailed(
        System.Net.HttpStatusCode statusCode,
        string origin
    )
    {
        return new DesktopAgentRuntimeException(
            "DOWNLOAD_FAILED",
            $"Could not download the selected file (HTTP {(int)statusCode} from {origin}).",
            StatusCodes.Status502BadGateway
        );
    }

    private static DesktopAgentRuntimeException DownloadFailed(
        HttpRequestException error,
        string origin
    )
    {
        return new DesktopAgentRuntimeException(
            "DOWNLOAD_FAILED",
            $"Could not download the selected file ({error.GetType().Name} from {origin}).",
            StatusCodes.Status502BadGateway
        );
    }
}

public sealed record DesktopAgentOpenTransferResult(string Sha256, bool CacheHit);
