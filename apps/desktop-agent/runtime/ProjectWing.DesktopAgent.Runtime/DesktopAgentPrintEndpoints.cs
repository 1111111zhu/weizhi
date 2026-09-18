using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentPrintEndpoints
{
    public static void MapDesktopAgentPrintEndpoints(this WebApplication app)
    {
        app.MapGet("/printers", ReadPrinters);
        app.MapPost("/print", Print);
    }

    private static async Task<IResult> ReadPrinters(
        DesktopAgentPrinterDiscovery discovery,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return Results.Ok(new DesktopAgentPrinters(
                true,
                await discovery.ListAsync(cancellationToken)
            ));
        }
        catch (DesktopAgentRuntimeException error)
        {
            return RuntimeError(error);
        }
    }

    private static async Task<IResult> Print(
        HttpContext context,
        DesktopAgentPrintEndpointServices services,
        CancellationToken cancellationToken
    )
    {
        var authorization = services.AuthSession.ReadAuthorization();
        if (authorization is null)
        {
            return Results.Json(
                new DesktopAgentError(
                    false,
                    "DEVICE_AUTH_REQUIRED",
                    "Pair this Desktop Agent before printing files."
                ),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        var request = await ReadRequestAsync(context, cancellationToken);
        if (request is null)
        {
            return Results.BadRequest(new DesktopAgentError(
                false,
                "VALIDATION_FAILED",
                "Print request is invalid."
            ));
        }
        try
        {
            return Results.Ok(await services.PrintService.PrintAsync(
                request,
                authorization,
                cancellationToken
            ));
        }
        catch (DesktopAgentRuntimeException error)
        {
            return RuntimeError(error);
        }
    }

    private static async Task<DesktopAgentPrintRequest?> ReadRequestAsync(
        HttpContext context,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await context.Request.ReadFromJsonAsync<DesktopAgentPrintRequest>(
                cancellationToken
            );
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static IResult RuntimeError(DesktopAgentRuntimeException error)
    {
        return Results.Json(
            new DesktopAgentError(false, error.Code, error.Message),
            statusCode: error.StatusCode
        );
    }
}

public sealed class DesktopAgentPrintEndpointServices(
    DesktopAgentDeviceAuthSession authSession,
    DesktopAgentPrintService printService
)
{
    public DesktopAgentDeviceAuthSession AuthSession { get; } = authSession;
    public DesktopAgentPrintService PrintService { get; } = printService;
}
