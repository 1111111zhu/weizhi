namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentOpenRequestValidator(DesktopAgentRuntimeOptions options)
{
    public DesktopAgentValidatedOpenRequest Validate(DesktopAgentOpenRequest input)
    {
        if (
            input.Mode is not ("READ_ONLY" or "MASTER")
            || string.IsNullOrWhiteSpace(input.ProjectId)
            || string.IsNullOrWhiteSpace(input.AttachmentId)
            || string.IsNullOrWhiteSpace(input.FileName)
            || !DesktopAgentPathPolicy.IsSupportedFileName(input.FileName)
            || !TryReadHttpUri(input.DownloadUrl, out var downloadUri)
            || !IsOptionalHttpUrl(input.CheckInUrl)
            || !IsOptionalHttpUrl(input.ReleaseUrl)
            || (input.RequestId is not null && (
                string.IsNullOrWhiteSpace(input.RequestId)
                || input.RequestId.Trim().Length > 128
            ))
            || input.FileSize is < 0
            || !IsOptionalSha256(input.ContentHash)
        )
        {
            throw InvalidRequest();
        }
        if (input.Mode == "MASTER" && (
            string.IsNullOrWhiteSpace(input.LockSessionId)
            || input.BaseVersion is null or <= 0
            || string.IsNullOrWhiteSpace(input.GrantSecret)
        ))
        {
            throw InvalidRequest();
        }
        var origin = downloadUri.GetLeftPart(UriPartial.Authority);
        if (!options.AllowedDownloadOrigins.Contains(origin))
        {
            throw new DesktopAgentRuntimeException(
                "ORIGIN_NOT_ALLOWED",
                "Download URL origin is not allowed.",
                StatusCodes.Status403Forbidden
            );
        }
        var lockSessionId = input.LockSessionId?.Trim();
        var checkInUrl = NormalizeOptionalUrl(input.CheckInUrl);
        var releaseUrl = NormalizeOptionalUrl(input.ReleaseUrl);
        if (input.Mode == "MASTER" && lockSessionId is not null)
        {
            checkInUrl ??= DesktopAgentRemoteUrlPolicy.BuildMasterSessionUrl(
                options,
                lockSessionId,
                "check-in"
            );
            releaseUrl ??= DesktopAgentRemoteUrlPolicy.BuildMasterSessionUrl(
                options,
                lockSessionId,
                "release"
            );
        }
        return new DesktopAgentValidatedOpenRequest
        {
            RequestId = NormalizeOptional(input.RequestId) ?? Guid.NewGuid().ToString("N"),
            Mode = input.Mode,
            ProjectId = input.ProjectId.Trim(),
            AttachmentId = input.AttachmentId.Trim(),
            FileName = input.FileName.Trim(),
            DownloadUri = downloadUri,
            CheckInUrl = checkInUrl,
            ReleaseUrl = releaseUrl,
            LockSessionId = lockSessionId,
            BaseVersion = input.BaseVersion,
            BaseVersionId = input.BaseVersionId?.Trim(),
            LockEpoch = input.LockEpoch,
            CacheVersionId = NormalizeOptional(input.CacheVersionId),
            CacheOwnerId = NormalizeOptional(input.CacheOwnerId),
            FileSize = input.FileSize,
            ContentToken = NormalizeOptional(input.ContentToken),
            ContentHash = NormalizeOptional(input.ContentHash)?.ToLowerInvariant(),
            GrantSecret = input.GrantSecret?.Trim(),
            DirectUploadSupported = input.DirectUploadSupported,
            MimeType = input.MimeType?.Trim(),
        };
    }

    private static bool TryReadHttpUri(string? value, out Uri uri)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out uri!)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    private static bool IsOptionalHttpUrl(string? value)
    {
        return string.IsNullOrWhiteSpace(value) || TryReadHttpUri(value, out _);
    }

    private static string? NormalizeOptionalUrl(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static bool IsOptionalSha256(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            || (
                value.Trim().Length == 64
                && value.Trim().All(character =>
                    character is >= '0' and <= '9'
                        or >= 'a' and <= 'f'
                        or >= 'A' and <= 'F'
                )
            );
    }

    private static DesktopAgentRuntimeException InvalidRequest()
    {
        return new DesktopAgentRuntimeException(
            "VALIDATION_FAILED",
            "Open request is invalid.",
            StatusCodes.Status400BadRequest
        );
    }
}

public sealed record DesktopAgentValidatedOpenRequest
{
    public required string RequestId { get; init; }
    public required string Mode { get; init; }
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required string FileName { get; init; }
    public required Uri DownloadUri { get; init; }
    public string? CheckInUrl { get; init; }
    public string? ReleaseUrl { get; init; }
    public string? LockSessionId { get; init; }
    public int? BaseVersion { get; init; }
    public string? BaseVersionId { get; init; }
    public int? LockEpoch { get; init; }
    public string? CacheVersionId { get; init; }
    public string? CacheOwnerId { get; init; }
    public long? FileSize { get; init; }
    public string? ContentToken { get; init; }
    public string? ContentHash { get; init; }
    public string? GrantSecret { get; init; }
    public bool? DirectUploadSupported { get; init; }
    public string? MimeType { get; init; }
}
