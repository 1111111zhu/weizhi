var state = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_STATE_ROOT");
var cache = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_CACHE_ROOT");
if (state is null || cache is null || !Path.GetFileName(state).StartsWith("project-wing-process-audit-") || !cache.StartsWith(state))
    throw new InvalidOperationException("Synthetic fixture requires isolated state and cache.");
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var firstStart = !File.Exists(Path.Combine(state, "partial-worker-started"));
File.WriteAllText(Path.Combine(state, "partial-worker-started"), "synthetic fixture");
var started = DateTimeOffset.UtcNow;
_ = Task.Run(async () => { await Task.Delay(45000); app.Lifetime.StopApplication(); });
app.MapGet("/health", async (HttpContext context) =>
{
    if (!firstStart || DateTimeOffset.UtcNow - started < TimeSpan.FromSeconds(2))
    {
        await context.Response.WriteAsJsonAsync(new { app = "project-wing-desktop-runtime", version = "process-audit", agentState = "READY" });
        return;
    }
    context.Response.ContentType = "application/json";
    context.Response.ContentLength = 100;
    await context.Response.WriteAsync("{");
    await context.Response.Body.FlushAsync();
    await Task.Delay(Timeout.InfiniteTimeSpan, context.RequestAborted);
});
app.Run();
