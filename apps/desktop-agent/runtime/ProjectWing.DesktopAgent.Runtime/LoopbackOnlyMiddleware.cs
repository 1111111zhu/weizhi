using System.Net;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class LoopbackOnlyMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var remoteAddress = context.Connection.RemoteIpAddress;
        if (remoteAddress is null || !IPAddress.IsLoopback(remoteAddress))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new DesktopAgentError(
                false,
                "ORIGIN_NOT_ALLOWED",
                "Only localhost requests are allowed."
            ));
            return;
        }

        await next(context);
    }
}
