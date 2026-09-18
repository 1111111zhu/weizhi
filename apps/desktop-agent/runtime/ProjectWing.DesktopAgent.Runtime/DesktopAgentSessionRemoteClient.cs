using System.Net.Http.Json;
using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentSessionRemoteClient(
    HttpClient httpClient,
    DesktopAgentTransferDiagnosticLog diagnosticLog
)
{
    private const long MaxProxyBytes = 32L * 1024 * 1024;

    public async Task UploadAsync(
        DesktopAgentUploadContext context,
        CancellationToken cancellationToken
    )
    {
        var fileSize = new FileInfo(context.LocalPath).Length;
        if (context.DirectUploadSupported is not false)
        {
            var direct = await TryDirectUploadAsync(context, fileSize, cancellationToken);
            if (direct) return;
        }
        if (fileSize > MaxProxyBytes)
        {
            throw new DesktopAgentRuntimeException(
                "DIRECT_UPLOAD_RETRY_REQUIRED",
                "Large files require direct object-storage upload.",
                StatusCodes.Status502BadGateway
            );
        }
        using var request = new HttpRequestMessage(HttpMethod.Post, context.Url);
        request.Content = CreateUploadContent(context);
        await SendAsync(request, "UPLOAD_FAILED", cancellationToken);
    }

    public async Task ReleaseAsync(
        DesktopAgentReleaseContext context,
        CancellationToken cancellationToken
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, context.Url)
        {
            Content = JsonContent.Create(CreateReleasePayload(context)),
        };
        await SendAsync(request, "RELEASE_FAILED", cancellationToken);
    }

    public async Task HeartbeatAsync(
        DesktopAgentSyncSession session,
        Uri heartbeatUrl,
        CancellationToken cancellationToken
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, heartbeatUrl)
        {
            Content = JsonContent.Create(CreateHeartbeatPayload(session)),
        };
        await SendAsync(request, "HEARTBEAT_FAILED", cancellationToken);
    }

    public async Task EndTrackingAsync(DesktopAgentReleaseContext context, CancellationToken cancellationToken)
    {
        if (!context.Url.AbsolutePath.EndsWith("/release", StringComparison.Ordinal) || context.Url.Query.Length > 0)
            throw new DesktopAgentRuntimeException("RECOVERY_URL_UNSUPPORTED", "The old session needs project support to confirm its release endpoint.", 409);
        var endpoint = new Uri(context.Url.AbsoluteUri[..^"release".Length] + "end-tracking");
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        { Content = JsonContent.Create(CreateReleasePayload(context)) };
        using var response = await SendForResponseAsync(request, "RELEASE_FAILED", cancellationToken);
        if (!response.IsSuccessStatusCode) await ThrowRemoteAsync(response, "RELEASE_FAILED", cancellationToken);
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        if (!result.RootElement.TryGetProperty("recoveryEnded", out var ended) || ended.ValueKind != JsonValueKind.True)
            throw new DesktopAgentRuntimeException("RECOVERY_SERVER_UPDATE_REQUIRED", "The server has not confirmed ending this old session. Update the server or ask project support; the local record is retained.", 409);
    }

    private async Task<bool> TryDirectUploadAsync(
        DesktopAgentUploadContext context,
        long fileSize,
        CancellationToken cancellationToken
    )
    {
        var uploadAttemptId = context.UploadAttemptId ?? Guid.NewGuid().ToString("N");
        var resumeUploadId = context.ResumeUploadId;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            using var prepareRequest = new HttpRequestMessage(
                HttpMethod.Post,
                new Uri($"{context.Url.AbsoluteUri.TrimEnd('/')}/prepare")
            )
            {
                Content = JsonContent.Create(
                    CreateMetadata(
                        context,
                        fileSize,
                        uploadAttemptId,
                        resumeUploadId
                    )
                ),
            };
            using var prepareResponse = await SendForResponseAsync(
                prepareRequest,
                "UPLOAD_PREPARE_FAILED",
                cancellationToken
            );
            if (
                prepareResponse.StatusCode is System.Net.HttpStatusCode.NotFound
                    or System.Net.HttpStatusCode.MethodNotAllowed
            )
            {
                return false;
            }
            if (!prepareResponse.IsSuccessStatusCode)
            {
                await ThrowRemoteAsync(prepareResponse, "UPLOAD_PREPARE_FAILED", cancellationToken);
            }
            using var grant = JsonDocument.Parse(
                await prepareResponse.Content.ReadAsStringAsync(cancellationToken)
            );
            var root = grant.RootElement;
            if (
                !root.TryGetProperty("mode", out var modeProperty)
                || modeProperty.ValueKind != JsonValueKind.String
            )
            {
                if (context.DirectUploadSupported is null) return false;
                throw new DesktopAgentRuntimeException(
                    "UPLOAD_PREPARE_FAILED",
                    "Direct upload grant is invalid.",
                    StatusCodes.Status502BadGateway
                );
            }
            var mode = ReadRequiredString(root, "mode");
            if (mode == "PROXY") return false;
            var objectKey = ReadRequiredString(root, "objectKey");
            var checkpointUploadId = mode == "DIRECT_MULTIPART"
                ? ReadRequiredString(root, "uploadId")
                : null;
            resumeUploadId = checkpointUploadId;
            if (context.SaveCheckpointAsync is not null)
            {
                await context.SaveCheckpointAsync(uploadAttemptId, checkpointUploadId);
            }
            try
            {
                if (mode == "DIRECT_PUT")
                {
                    await PutWholeFileAsync(context.LocalPath, root, cancellationToken);
                }
                else if (mode == "DIRECT_MULTIPART")
                {
                    await PutMultipartAsync(
                        context,
                        fileSize,
                        uploadAttemptId,
                        root,
                        cancellationToken
                    );
                }
                else if (mode != "ALREADY_UPLOADED")
                {
                    throw new InvalidDataException("Unknown direct upload mode.");
                }
                if (
                    context.VerifySnapshotAsync is not null
                    && !await context.VerifySnapshotAsync()
                )
                {
                    throw new DesktopAgentRuntimeException(
                        "LOCAL_FILE_CHANGED_DURING_CHECKIN",
                        "The immutable upload snapshot changed during transfer.",
                        StatusCodes.Status409Conflict
                    );
                }
                await CommitDirectUploadAsync(
                    context,
                    fileSize,
                    uploadAttemptId,
                    objectKey,
                    cancellationToken
                );
                return true;
            }
            catch (DesktopAgentRuntimeException error) when (
                attempt < 2 && IsRetryableDirectCode(error.Code)
            )
            {
                if (RotatesUploadAttempt(error.Code))
                {
                    uploadAttemptId = Guid.NewGuid().ToString("N");
                    resumeUploadId = null;
                    if (context.SaveCheckpointAsync is not null)
                    {
                        await context.SaveCheckpointAsync(uploadAttemptId, null);
                    }
                }
            }
            catch (Exception error) when (
                attempt < 2
                && !cancellationToken.IsCancellationRequested
                && error is HttpRequestException or IOException or TaskCanceledException
            )
            {
                // Re-prepare signed URLs and continue from OSS-authoritative uploaded parts.
            }
        }
        throw new DesktopAgentRuntimeException(
            "DIRECT_UPLOAD_RETRY_REQUIRED",
            "Direct object-storage upload could not be completed after retry.",
            StatusCodes.Status502BadGateway
        );
    }

    private async Task PutWholeFileAsync(
        string localPath,
        JsonElement grant,
        CancellationToken cancellationToken
    )
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Put,
            ReadRequiredString(grant, "uploadUrl")
        );
        request.Content = new StreamContent(File.OpenRead(localPath));
        if (grant.TryGetProperty("headers", out var headers))
        {
            foreach (var header in headers.EnumerateObject())
            {
                if (!request.Headers.TryAddWithoutValidation(header.Name, header.Value.GetString()))
                {
                    request.Content.Headers.TryAddWithoutValidation(
                        header.Name,
                        header.Value.GetString()
                    );
                }
            }
        }
        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken
        );
        if (!response.IsSuccessStatusCode)
        {
            var ossErrorCode = await diagnosticLog.RecordObjectStorageFailureAsync(
                "DIRECT_PUT",
                response,
                cancellationToken
            );
            throw new DesktopAgentRuntimeException(
                ossErrorCode == "FileAlreadyExists"
                    ? "DIRECT_UPLOAD_FILE_ALREADY_EXISTS"
                    : "DIRECT_UPLOAD_FAILED",
                "Object storage rejected the direct upload.",
                StatusCodes.Status502BadGateway
            );
        }
    }

    private async Task PutMultipartAsync(
        DesktopAgentUploadContext context,
        long fileSize,
        string uploadAttemptId,
        JsonElement grant,
        CancellationToken cancellationToken
    )
    {
        var uploadId = ReadRequiredString(grant, "uploadId");
        var partSize = grant.GetProperty("partSize").GetInt64();
        var completed = grant.GetProperty("uploadedParts")
            .EnumerateArray()
            .ToDictionary(
                part => part.GetProperty("partNumber").GetInt32(),
                part => ReadRequiredString(part, "etag")
            );
        await using var source = new FileStream(
            context.LocalPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            1024 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan
        );
        foreach (var part in grant.GetProperty("parts").EnumerateArray())
        {
            var number = part.GetProperty("partNumber").GetInt32();
            if (completed.ContainsKey(number)) continue;
            var offset = (number - 1L) * partSize;
            var length = Math.Min(partSize, fileSize - offset);
            source.Position = offset;
            var buffer = new byte[checked((int)length)];
            await source.ReadExactlyAsync(buffer, cancellationToken);
            using var request = new HttpRequestMessage(
                HttpMethod.Put,
                ReadRequiredString(part, "uploadUrl")
            )
            { Content = new ByteArrayContent(buffer) };
            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                await diagnosticLog.RecordObjectStorageFailureAsync(
                    "MULTIPART_PART",
                    response,
                    cancellationToken
                );
                throw new DesktopAgentRuntimeException(
                    "DIRECT_UPLOAD_FAILED",
                    $"Object storage rejected upload part {number}.",
                    StatusCodes.Status502BadGateway
                );
            }
            completed[number] = response.Headers.ETag?.Tag
                ?? throw new DesktopAgentRuntimeException(
                    "UPLOAD_PART_ETAG_MISSING",
                    "Object storage did not return a part ETag.",
                    StatusCodes.Status502BadGateway
                );
        }
        using var completeRequest = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri($"{context.Url.AbsoluteUri.TrimEnd('/')}/complete")
        )
        {
            Content = JsonContent.Create(new
            {
                projectId = context.ProjectId,
                attachmentId = context.AttachmentId,
                grantSecret = context.GrantSecret,
                baseVersion = context.BaseVersion,
                localContentHash = context.LocalContentHash,
                localContentCrc64 = context.LocalContentCrc64,
                idempotencyKey = context.IdempotencyKey,
                fileName = context.FileName,
                mimeType = context.MimeType,
                fileSize,
                uploadAttemptId,
                uploadId,
                objectKey = ReadRequiredString(grant, "objectKey"),
                parts = completed.OrderBy(item => item.Key)
                    .Select(item => new { partNumber = item.Key, etag = item.Value }),
            }),
        };
        await SendAsync(completeRequest, "UPLOAD_COMPLETE_FAILED", cancellationToken);
    }

    private async Task CommitDirectUploadAsync(
        DesktopAgentUploadContext context,
        long fileSize,
        string uploadAttemptId,
        string objectKey,
        CancellationToken cancellationToken
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, context.Url)
        {
            Content = JsonContent.Create(
                CreateCommitPayload(
                    context,
                    fileSize,
                    uploadAttemptId,
                    objectKey
                )
            ),
        };
        await SendAsync(request, "UPLOAD_FAILED", cancellationToken);
    }

    private static object CreateMetadata(
        DesktopAgentUploadContext context,
        long fileSize,
        string uploadAttemptId,
        string? resumeUploadId = null
    ) => new
    {
        projectId = context.ProjectId,
        attachmentId = context.AttachmentId,
        grantSecret = context.GrantSecret,
        baseVersion = context.BaseVersion,
        baseVersionId = context.BaseVersionId,
        lockEpoch = context.LockEpoch,
        localContentHash = context.LocalContentHash,
        localContentCrc64 = context.LocalContentCrc64,
        idempotencyKey = context.IdempotencyKey,
        fileName = context.FileName,
        mimeType = context.MimeType,
        fileSize,
        uploadAttemptId,
        resumeUploadId,
    };

    private static Dictionary<string, object?> CreateReleasePayload(
        DesktopAgentReleaseContext context
    )
    {
        var payload = new Dictionary<string, object?>
        {
            ["projectId"] = context.ProjectId,
            ["attachmentId"] = context.AttachmentId,
            ["grantSecret"] = context.GrantSecret,
            ["reason"] = context.Reason,
        };
        AddCompatibleInteger(payload, "lockEpoch", context.LockEpoch);
        return payload;
    }

    private static Dictionary<string, object?> CreateHeartbeatPayload(
        DesktopAgentSyncSession session
    )
    {
        var payload = new Dictionary<string, object?>
        {
            ["projectId"] = session.ProjectId,
            ["attachmentId"] = session.AttachmentId,
            ["grantSecret"] = session.GrantSecret,
        };
        AddCompatibleInteger(payload, "lockEpoch", session.LockEpoch);
        return payload;
    }

    private static Dictionary<string, object?> CreateCommitPayload(
        DesktopAgentUploadContext context,
        long fileSize,
        string uploadAttemptId,
        string objectKey
    )
    {
        var payload = new Dictionary<string, object?>
        {
            ["projectId"] = context.ProjectId,
            ["attachmentId"] = context.AttachmentId,
            ["grantSecret"] = context.GrantSecret,
            ["baseVersion"] = CompatibleInteger(context.BaseVersion),
            ["baseVersionId"] = context.BaseVersionId,
            ["localContentHash"] = context.LocalContentHash,
            ["localContentCrc64"] = context.LocalContentCrc64,
            ["idempotencyKey"] = context.IdempotencyKey,
            ["fileName"] = context.FileName,
            ["mimeType"] = context.MimeType,
            ["fileSize"] = fileSize,
            ["uploadAttemptId"] = uploadAttemptId,
            ["objectKey"] = objectKey,
        };
        AddCompatibleInteger(payload, "lockEpoch", context.LockEpoch);
        return payload;
    }

    private static void AddCompatibleInteger(
        IDictionary<string, object?> payload,
        string name,
        int? value
    )
    {
        if (value.HasValue)
        {
            payload[name] = CompatibleInteger(value.Value);
        }
    }

    private static string CompatibleInteger(int value) =>
        value.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private async Task<HttpResponseMessage> SendForResponseAsync(
        HttpRequestMessage request,
        string fallbackCode,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken
            );
        }
        catch (Exception error) when (
            !cancellationToken.IsCancellationRequested
            && error is HttpRequestException or TaskCanceledException
        )
        {
            throw RemoteFailure(fallbackCode, null);
        }
    }

    private static string ReadRequiredString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(property.GetString())
            ? property.GetString()!
            : throw new InvalidDataException($"Direct upload grant omitted {name}.");
    }

    private static bool IsRetryableDirectCode(string code) =>
        code is "DIRECT_UPLOAD_FAILED"
            or "DIRECT_UPLOAD_GRANT_EXPIRED"
            or "DIRECT_UPLOAD_TRANSIENT_FAILURE"
            or "DIRECT_UPLOAD_NOT_FOUND"
            or "DIRECT_UPLOAD_SIZE_MISMATCH"
            or "DIRECT_UPLOAD_HASH_MISMATCH"
            or "DIRECT_UPLOAD_CRC64_MISMATCH"
            or "DIRECT_UPLOAD_VERIFY_UNAVAILABLE"
            or "DIRECT_UPLOAD_FILE_ALREADY_EXISTS"
            or "UPLOAD_SESSION_EXPIRED";

    private static bool RotatesUploadAttempt(string code) =>
        code is "DIRECT_UPLOAD_NOT_FOUND"
            or "DIRECT_UPLOAD_SIZE_MISMATCH"
            or "DIRECT_UPLOAD_HASH_MISMATCH"
            or "DIRECT_UPLOAD_CRC64_MISMATCH"
            or "DIRECT_UPLOAD_FILE_ALREADY_EXISTS"
            or "UPLOAD_SESSION_EXPIRED";

    private static MultipartFormDataContent CreateUploadContent(
        DesktopAgentUploadContext context
    )
    {
        var form = new MultipartFormDataContent();
        form.Add(new StringContent(context.ProjectId), "projectId");
        form.Add(new StringContent(context.AttachmentId), "attachmentId");
        form.Add(new StringContent(context.BaseVersion.ToString()), "baseVersion");
        form.Add(new StringContent(context.LocalContentHash), "localContentHash");
        form.Add(new StringContent(context.IdempotencyKey), "idempotencyKey");
        if (context.GrantSecret is not null)
        {
            form.Add(new StringContent(context.GrantSecret), "grantSecret");
        }
        var file = new StreamContent(File.OpenRead(context.LocalPath));
        file.Headers.ContentType = new("application/octet-stream");
        form.Add(file, "file", context.FileName);
        return form;
    }

    private async Task SendAsync(
        HttpRequestMessage request,
        string fallbackCode,
        CancellationToken cancellationToken
    )
    {
        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, cancellationToken);
        }
        catch (Exception error) when (
            !cancellationToken.IsCancellationRequested
            && error is HttpRequestException or TaskCanceledException
        )
        {
            throw RemoteFailure(fallbackCode, null);
        }
        using (response)
        {
            if (response.IsSuccessStatusCode)
            {
                return;
            }
            var failure = await ReadFailureAsync(response, cancellationToken);
            throw RemoteFailure(failure.Code ?? fallbackCode, failure.Message);
        }
    }

    private async Task ThrowRemoteAsync(
        HttpResponseMessage response,
        string fallbackCode,
        CancellationToken cancellationToken
    )
    {
        var failure = await ReadFailureAsync(response, cancellationToken);
        throw RemoteFailure(failure.Code ?? fallbackCode, failure.Message);
    }

    private static async Task<DesktopAgentRemoteFailure> ReadFailureAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<DesktopAgentRemoteFailure>(
                cancellationToken
            ) ?? new DesktopAgentRemoteFailure();
        }
        catch (Exception error) when (error is JsonException or IOException)
        {
            return new DesktopAgentRemoteFailure();
        }
    }

    private static DesktopAgentRuntimeException RemoteFailure(
        string code,
        string? message
    )
    {
        var statusCode = code is
            "CONFLICT_RISK" or "LOCK_REVOKED" or "LOCK_SESSION_MISMATCH" or "SERVER_FILE_REMOVED"
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status502BadGateway;
        return new DesktopAgentRuntimeException(
            code,
            message ?? DefaultMessage(code),
            statusCode
        );
    }

    private static string DefaultMessage(string code)
    {
        return code == "UPLOAD_FAILED"
            ? "Could not upload the tracked file."
            : "Could not release Master.";
    }
}

public sealed record DesktopAgentUploadContext
{
    public required Uri Url { get; init; }
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required int BaseVersion { get; init; }
    public string? BaseVersionId { get; init; }
    public int? LockEpoch { get; init; }
    public required string LocalContentHash { get; init; }
    public string? LocalContentCrc64 { get; init; }
    public required string IdempotencyKey { get; init; }
    public required string LocalPath { get; init; }
    public required string FileName { get; init; }
    public required string MimeType { get; init; }
    public bool? DirectUploadSupported { get; init; }
    public string? UploadAttemptId { get; init; }
    public string? ResumeUploadId { get; init; }
    public Func<string, string?, Task>? SaveCheckpointAsync { get; init; }
    public Func<Task<bool>>? VerifySnapshotAsync { get; init; }
    public string? GrantSecret { get; init; }
}

public sealed record DesktopAgentReleaseContext
{
    public required Uri Url { get; init; }
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required string Reason { get; init; }
    public string? GrantSecret { get; init; }
    public int? LockEpoch { get; init; }
}

public sealed record DesktopAgentRemoteFailure
{
    public string? Code { get; init; }
    public string? Message { get; init; }
}
