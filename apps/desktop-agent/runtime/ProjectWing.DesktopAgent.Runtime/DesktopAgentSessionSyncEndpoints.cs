using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentSessionSyncEndpoints
{
    public static void MapDesktopAgentSessionSyncEndpoints(this WebApplication app)
    {
        app.MapPost("/sessions/{sessionId}/check-in", CheckIn);
        app.MapPost("/sessions/{sessionId}/release", Release);
        app.MapPost("/sessions/{sessionId}/end-tracking", EndTracking);
    }

    private static async Task<IResult> EndTracking(HttpContext context,
        DesktopAgentSessionSyncService service, DesktopAgentDeviceAuthSession auth,
        CancellationToken cancellationToken)
    {
        if (auth.ReadAuthorization() is null)
            return Results.Json(new DesktopAgentError(false, "DEVICE_AUTH_REQUIRED", "Connect your account before resolving a record."), statusCode: 401);
        var input = await ReadAsync<EndTrackingRequest>(context, cancellationToken);
        if (input?.Confirmed != true) return Invalid("Explicit confirmation is required.");
        try { return Results.Ok(await service.EndTrackingAsync(ReadSessionId(context), cancellationToken)); }
        catch (DesktopAgentRuntimeException error) { return RuntimeError(error); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        { return Results.Json(new DesktopAgentError(false, "RECOVERY_COPY_FAILED", "Could not preserve the local copies. Close the file and retry; the record is retained."), statusCode: 409); }
    }

    private sealed record EndTrackingRequest(bool Confirmed);

    private static async Task<IResult> CheckIn(
        HttpContext context,
        DesktopAgentSessionSyncService service,
        CancellationToken cancellationToken
    )
    {
        var request = await ReadAsync<DesktopAgentCheckInRequest>(context, cancellationToken);
        if (request is null)
        {
            return Invalid("Check-in request is invalid.");
        }
        try
        {
            var result = await service.CheckInAsync(
                ReadSessionId(context),
                request,
                cancellationToken
            );
            return Results.Ok(result);
        }
        catch (DesktopAgentRuntimeException error)
        {
            return RuntimeError(error);
        }
    }

    private static async Task<IResult> Release(
        HttpContext context,
        DesktopAgentSessionSyncService service,
        CancellationToken cancellationToken
    )
    {
        var request = await ReadAsync<DesktopAgentReleaseRequest>(context, cancellationToken);
        if (request is null)
        {
            return Invalid("Release request is invalid.");
        }
        try
        {
            var result = await service.ReleaseAsync(
                ReadSessionId(context),
                request,
                cancellationToken
            );
            return Results.Ok(result);
        }
        catch (DesktopAgentRuntimeException error)
        {
            return RuntimeError(error);
        }
    }

    private static async Task<T?> ReadAsync<T>(
        HttpContext context,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await context.Request.ReadFromJsonAsync<T>(cancellationToken);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static string ReadSessionId(HttpContext context)
    {
        return Convert.ToString(context.Request.RouteValues["sessionId"]) ?? string.Empty;
    }

    private static IResult Invalid(string message)
    {
        return Results.BadRequest(new DesktopAgentError(
            false,
            "VALIDATION_FAILED",
            message
        ));
    }

    private static IResult RuntimeError(DesktopAgentRuntimeException error)
    {
        return Results.Json(
            new DesktopAgentError(false, error.Code, error.Message),
            statusCode: error.StatusCode
        );
    }
}
