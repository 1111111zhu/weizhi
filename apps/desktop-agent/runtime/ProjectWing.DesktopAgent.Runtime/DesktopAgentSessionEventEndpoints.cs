using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentSessionEventEndpoints
{
    public static void MapDesktopAgentSessionEventEndpoints(this WebApplication app)
    {
        app.MapPost("/sessions/{sessionId}/open-observed", RecordOpenObserved);
        app.MapPost("/sessions/{sessionId}/launch-failed", RecordLaunchFailed);
        app.MapPost(
            "/sessions/{sessionId}/recover-launch-failed-release",
            RecoverLaunchFailedRelease
        );
        app.MapPost("/sessions/{sessionId}/closed", RecordClosed);
    }

    private static async Task<IResult> RecordOpenObserved(
        HttpContext context,
        DesktopAgentSessionEvents events,
        CancellationToken cancellationToken
    )
    {
        var input = await ReadEventRequest<DesktopAgentOpenObservedRequest>(
            context.Request,
            cancellationToken
        );
        if (input is null) return Invalid("Open observation payload is invalid.");
        var result = await events.RecordOpenObservedAsync(
            ReadSessionId(context),
            input,
            cancellationToken
        );
        return Results.Json(result.Response, statusCode: result.StatusCode);
    }

    private static async Task<IResult> RecordLaunchFailed(
        HttpContext context,
        DesktopAgentSessionEvents events,
        CancellationToken cancellationToken
    )
    {
        var input = await ReadEventRequest<DesktopAgentLaunchFailedRequest>(
            context.Request,
            cancellationToken
        );
        if (input is null) return Invalid("Launch failure payload is invalid.");
        var result = await events.RecordLaunchFailedAsync(
            ReadSessionId(context),
            input,
            cancellationToken
        );
        return Results.Json(result.Response, statusCode: result.StatusCode);
    }

    private static async Task<IResult> RecordClosed(
        HttpContext context,
        DesktopAgentSessionEventServices services,
        DesktopAgentBackgroundSyncService backgroundSync,
        CancellationToken cancellationToken
    )
    {
        var input = await ReadEventRequest<DesktopAgentClosedRequest>(
            context.Request,
            cancellationToken
        );
        if (input is null) return Invalid("Close detection payload is invalid.");
        var result = await services.Events.RecordClosedAsync(
            ReadSessionId(context),
            input,
            cancellationToken
        );
        if (result.StatusCode != StatusCodes.Status200OK || result.Response.Session is null)
        {
            return Results.Json(result.Response, statusCode: result.StatusCode);
        }
        backgroundSync.Enqueue(result.Response.Session.Value);
        return Results.Ok(result.Response);
    }

    private static async Task<IResult> RecoverLaunchFailedRelease(
        HttpContext context,
        DesktopAgentLaunchRecoveryService recovery,
        CancellationToken cancellationToken
    )
    {
        var input = await ReadEventRequest<DesktopAgentLaunchAbortReleaseRequest>(
            context.Request,
            cancellationToken
        );
        if (input is null) return Invalid("Launch-abort release payload is invalid.");
        var result = await recovery.RecoverAsync(
            ReadSessionId(context),
            input,
            cancellationToken
        );
        return Results.Json(result.Response, statusCode: result.StatusCode);
    }

    private static async Task<T?> ReadEventRequest<T>(
        HttpRequest request,
        CancellationToken cancellationToken
    ) where T : class
    {
        try
        {
            return await request.ReadFromJsonAsync<T>(cancellationToken);
        }
        catch (Exception error) when (
            error is JsonException or BadHttpRequestException or NotSupportedException
        )
        {
            return null;
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
}
