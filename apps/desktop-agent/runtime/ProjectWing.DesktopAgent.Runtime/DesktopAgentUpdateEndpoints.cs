using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentUpdateEndpoints
{
    public static void MapDesktopAgentUpdateEndpoints(this WebApplication app)
    {
        app.MapPost("/update", StartUpdate);
        app.MapGet("/update/status", ReadStatus);
    }

    private static async Task<IResult> StartUpdate(
        HttpContext context,
        DesktopAgentUpdateOrchestrator orchestrator,
        CancellationToken cancellationToken
    )
    {
        var request = await ReadRequestAsync(context, cancellationToken);
        if (request is null)
        {
            return InvalidRequest();
        }
        try
        {
            var result = await orchestrator.StartAsync(request, cancellationToken);
            return Results.Json(
                result,
                statusCode: result.Status == "READY"
                    ? StatusCodes.Status200OK
                    : StatusCodes.Status202Accepted
            );
        }
        catch (DesktopAgentRuntimeException error)
        {
            return Results.Json(
                new DesktopAgentError(false, error.Code, error.Message),
                statusCode: error.StatusCode
            );
        }
    }

    private static async Task<IResult> ReadStatus(
        DesktopAgentUpdateStatusReader statusReader,
        CancellationToken cancellationToken
    )
    {
        return Results.Ok(await statusReader.ReadAsync(cancellationToken));
    }

    private static async Task<DesktopAgentUpdateRequest?> ReadRequestAsync(
        HttpContext context,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await context.Request.ReadFromJsonAsync<DesktopAgentUpdateRequest>(
                cancellationToken
            ) ?? new DesktopAgentUpdateRequest();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static IResult InvalidRequest()
    {
        return Results.BadRequest(new DesktopAgentError(
            false,
            "VALIDATION_FAILED",
            "Update request is invalid."
        ));
    }
}
