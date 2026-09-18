using System.Security.Cryptography;
using System.Text;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentPathPolicy
{
    private const string FallbackName = "project-wing-file";
    private static readonly IReadOnlySet<string> SupportedExtensions =
        new HashSet<string>(
            [".xlsx", ".xls", ".xlsm", ".xlsb", ".csv", ".docx", ".doc", ".pptx", ".ppt", ".pdf"],
            StringComparer.OrdinalIgnoreCase
        );

    public static bool IsSupportedFileName(string fileName)
    {
        return SupportedExtensions.Contains(Path.GetExtension(fileName));
    }

    public static string BuildReadOnlyPath(string cacheRoot, DesktopAgentPathRequest request)
    {
        return BuildPath(cacheRoot, "read-only", request with { SessionSegment = "read-only" });
    }

    public static string BuildMasterPath(string cacheRoot, DesktopAgentPathRequest request)
    {
        return BuildPath(cacheRoot, "master", request);
    }

    public static string BuildContentCachePath(
        string cacheRoot,
        DesktopAgentPathRequest request,
        string contentIdentity
    )
    {
        return BuildPath(
            cacheRoot,
            ".content-cache",
            request with { SessionSegment = MakeHashedSegment(contentIdentity, "content") }
        );
    }

    public static string BuildLegacyVersionedMasterPath(
        string cacheRoot,
        DesktopAgentPathRequest request,
        string cacheVersionId
    )
    {
        return BuildPath(
            cacheRoot,
            "master",
            request with { SessionSegment = MakeHashedSegment(cacheVersionId, "version") }
        );
    }

    private static string BuildPath(
        string cacheRoot,
        string mode,
        DesktopAgentPathRequest request
    )
    {
        var root = Path.GetFullPath(cacheRoot);
        var localPath = Path.GetFullPath(Path.Combine(
            root,
            SanitizeSegment(request.ProjectId),
            SanitizeSegment(request.AttachmentId),
            mode,
            SanitizeSegment(request.SessionSegment),
            SanitizeFileName(request.FileName)
        ));
        var relative = Path.GetRelativePath(root, localPath);
        if (relative.StartsWith("..", StringComparison.Ordinal) || Path.IsPathRooted(relative))
        {
            throw new DesktopAgentRuntimeException(
                "FILE_WRITE_FAILED",
                "Generated cache path escaped the cache root.",
                StatusCodes.Status500InternalServerError
            );
        }
        return localPath;
    }

    private static string SanitizeSegment(string value)
    {
        return SanitizeFileName(value).Replace('.', '_');
    }

    private static string MakeHashedSegment(string value, string prefix)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return $"{prefix}-{Convert.ToHexString(hash)[..32].ToLowerInvariant()}";
    }

    private static string SanitizeFileName(string value)
    {
        var normalized = value.Replace('\\', '/');
        var fileName = Path.GetFileName(normalized);
        var sanitized = new string(fileName
            .Select(character => IsUnsafe(character) ? '_' : character)
            .ToArray())
            .Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? FallbackName : sanitized;
    }

    private static bool IsUnsafe(char value)
    {
        return char.IsControl(value) || "<>:\"/\\|?*".Contains(value, StringComparison.Ordinal);
    }
}

public sealed record DesktopAgentPathRequest
{
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required string FileName { get; init; }
    public required string SessionSegment { get; init; }
}
