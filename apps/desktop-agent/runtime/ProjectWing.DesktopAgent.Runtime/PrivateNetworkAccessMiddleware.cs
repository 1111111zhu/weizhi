namespace ProjectWing.DesktopAgent.Runtime;

public sealed class PrivateNetworkAccessMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (string.Equals(
            context.Request.Headers["Access-Control-Request-Private-Network"],
            "true",
            StringComparison.Ordinal
        ))
        {
            context.Response.OnStarting(() =>
            {
                context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
                return Task.CompletedTask;
            });
        }

        await next(context);
    }
}
