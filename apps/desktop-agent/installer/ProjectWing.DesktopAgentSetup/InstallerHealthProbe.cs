using System.Text.Json;

namespace ProjectWing.DesktopAgentSetup;

internal static class InstallerHealthProbe
{
    private const string HealthUrl = "http://127.0.0.1:17862/health";

    public static bool WaitForReady(
        TimeSpan timeout,
        string expectedVersion,
        out string? currentVersion
    )
    {
        currentVersion = null;
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        var deadline = DateTimeOffset.UtcNow + timeout;
        while (DateTimeOffset.UtcNow < deadline)
        {
            if (IsExpectedVersionReady(http, expectedVersion, out currentVersion)) return true;
            Thread.Sleep(500);
        }
        return false;
    }

    private static bool IsExpectedVersionReady(
        HttpClient http,
        string expectedVersion,
        out string? currentVersion
    )
    {
        currentVersion = null;
        try
        {
            var json = http.GetStringAsync(HealthUrl).GetAwaiter().GetResult();
            using var document = JsonDocument.Parse(json);
            currentVersion = ReadString(document.RootElement, "version");
            var agentState = ReadString(document.RootElement, "agentState");
            var runtimeReady = agentState is null
                or "READY"
                or "READY_WITH_ATTENTION"
                or "UPDATING";
            return runtimeReady
                && string.Equals(currentVersion, expectedVersion, StringComparison.Ordinal);
        }
        catch
        {
            currentVersion = null;
            return false;
        }
    }

    private static string? ReadString(JsonElement root, string name)
    {
        return root.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }
}
