using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentLaunchRecoveryService(DesktopAgentRuntimeState state)
{
    public async Task<DesktopAgentSessionEventResult> RecoverAsync(
        string sessionId,
        DesktopAgentLaunchAbortReleaseRequest request,
        CancellationToken cancellationToken
    )
    {
        if (request.Generation <= 0
            || string.IsNullOrWhiteSpace(request.CloseSignalToken)
            || !request.ConfirmNoUserVisibleWorkbook)
        {
            return Failure(
                StatusCodes.Status400BadRequest,
                "VALIDATION_FAILED",
                "Launch-abort release payload is invalid."
            );
        }
        var value = await state.ReadSessionAsync(sessionId, cancellationToken);
        if (value is null)
        {
            return Failure(
                StatusCodes.Status404NotFound,
                "SESSION_NOT_FOUND",
                "Tracked file session was not found."
            );
        }
        var validation = ValidateSession(value.Value, request);
        if (validation is not null)
        {
            return validation;
        }
        var safety = await ValidateFileAsync(value.Value, cancellationToken);
        if (safety is not null)
        {
            return safety;
        }
        var updated = await state.MutateSessionAsync(
            sessionId,
            BuildMutation(request),
            cancellationToken
        );
        return updated is null
            ? Failure(
                StatusCodes.Status409Conflict,
                "SESSION_STATE_CHANGED",
                "Tracked file session state changed."
            )
            : new DesktopAgentSessionEventResult(
                StatusCodes.Status200OK,
                new DesktopAgentSessionEventResponse { Ok = true, Session = updated }
            );
    }

    private static DesktopAgentSessionEventResult? ValidateSession(
        JsonElement session,
        DesktopAgentLaunchAbortReleaseRequest request
    )
    {
        if (ReadInt(session, "generation") != request.Generation
            || ReadString(session, "closeSignalToken") != request.CloseSignalToken)
        {
            return Failure(
                StatusCodes.Status409Conflict,
                "CLOSE_SIGNAL_MISMATCH",
                "Close signal token does not match the tracked session."
            );
        }
        if (ReadString(session, "lifecycleState") != "LAUNCH_FAILED")
        {
            return Failure(
                StatusCodes.Status409Conflict,
                "SESSION_STATE_MISMATCH",
                "Only failed launches can use this recovery action."
            );
        }
        if (ReadString(session, "openObservedAt") is not null
            && ReadString(session, "launchFailedReason") != "VISIBILITY_FAILED")
        {
            return Failure(
                StatusCodes.Status409Conflict,
                "CONFLICT_RISK",
                "Launch failure safety cannot be proven for this session."
            );
        }
        return null;
    }

    private static async Task<DesktopAgentSessionEventResult?> ValidateFileAsync(
        JsonElement session,
        CancellationToken cancellationToken
    )
    {
        var localPath = ReadString(session, "localPath")!;
        if (!File.Exists(localPath))
        {
            return MissingFile();
        }
        try
        {
            using (File.Open(localPath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
            {
                // Exclusive open is a bounded best-effort busy check.
            }
            var hash = await DesktopAgentFileTransfer.HashFileAsync(localPath, cancellationToken);
            if (hash != ReadString(session, "originalHash"))
            {
                return Failure(
                    StatusCodes.Status409Conflict,
                    "DIRTY_LOCAL_FILE",
                    "Dirty launch-failed sessions cannot be released automatically."
                );
            }
            return null;
        }
        catch (FileNotFoundException)
        {
            return MissingFile();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return Failure(
                StatusCodes.Status409Conflict,
                "LOCAL_FILE_BUSY",
                "The tracked local file is still open."
            );
        }
    }

    private static DesktopAgentSessionMutation BuildMutation(
        DesktopAgentLaunchAbortReleaseRequest request
    )
    {
        return new DesktopAgentSessionMutation(
            node => ReadInt(node, "generation") == request.Generation
                && ReadString(node, "closeSignalToken") == request.CloseSignalToken
                && ReadString(node, "lifecycleState") == "LAUNCH_FAILED"
                && (node["openObservedAt"] is null
                    || ReadString(node, "launchFailedReason") == "VISIBILITY_FAILED")
                && node["closeDetectedAt"] is null,
            node =>
            {
                node["lifecycleState"] = "RELEASE_PENDING";
                node["contentState"] = "UNCHANGED";
                node["status"] = "RELEASE_PENDING";
                node["pendingReleaseReason"] = "UNCHANGED_RELEASE";
                node["pendingReleaseHash"] = ReadString(node, "originalHash");
                node.Remove("lastError");
            }
        );
    }

    private static DesktopAgentSessionEventResult MissingFile()
    {
        return Failure(
            StatusCodes.Status409Conflict,
            "LOCAL_FILE_MISSING",
            "The tracked local file is no longer in the controlled cache."
        );
    }

    private static DesktopAgentSessionEventResult Failure(
        int statusCode,
        string code,
        string message
    )
    {
        return new DesktopAgentSessionEventResult(
            statusCode,
            new DesktopAgentSessionEventResponse
            {
                Ok = false,
                Code = code,
                Message = message,
            }
        );
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static int? ReadInt(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out var result)
            ? result
            : null;
    }

    private static string? ReadString(JsonObject value, string name)
    {
        return value[name]?.GetValue<string>();
    }

    private static int? ReadInt(JsonObject value, string name)
    {
        return value[name]?.GetValue<int>();
    }
}
