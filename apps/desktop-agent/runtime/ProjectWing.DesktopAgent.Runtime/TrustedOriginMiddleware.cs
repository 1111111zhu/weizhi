namespace ProjectWing.DesktopAgent.Runtime;

public sealed class TrustedOriginMiddleware(
    RequestDelegate next,
    DesktopAgentRuntimeOptions options
)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var origin = context.Request.Headers.Origin.ToString();
        if (string.IsNullOrWhiteSpace(origin))
        {
            await next(context);
            return;
        }
        if (!options.AllowedWebOrigins.Contains(origin))
        {
            await RejectAsync(context, "This web origin is not allowed.");
            return;
        }
        if (
            context.Request.Method is not ("GET" or "HEAD" or "OPTIONS")
            && context.Request.Headers["X-Project-Wing-Agent"] != "1"
        )
        {
            await RejectAsync(context, "The Desktop Agent request header is required.");
            return;
        }
        await next(context);
    }

    private static async Task RejectAsync(HttpContext context, string message)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new DesktopAgentError(
            false,
            "ORIGIN_NOT_ALLOWED",
            message
        ));
    }
}
