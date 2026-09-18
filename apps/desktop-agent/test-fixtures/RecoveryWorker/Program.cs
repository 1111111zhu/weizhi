var root = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_STATE_ROOT")
    ?? throw new InvalidOperationException("Fixture state root required");
if (!Path.GetFileName(root).StartsWith("project-wing-manager-", StringComparison.Ordinal))
    throw new InvalidOperationException("Refusing to run outside the isolated manager fixture");
var marker = Path.Combine(root, "hung-worker-started");
var hang = !File.Exists(marker);
File.WriteAllText(marker, "fixture");
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/health", async (HttpContext context) =>
{
    if (hang) await Task.Delay(Timeout.InfiniteTimeSpan, context.RequestAborted);
    return Results.Json(new { app = "project-wing-desktop-runtime", version = "0.2.0-test", agentState = "READY", updateState = "READY", restoreState = "READY" });
});
app.Run();
