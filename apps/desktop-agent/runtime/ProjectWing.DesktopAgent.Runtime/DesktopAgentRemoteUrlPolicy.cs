namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentRemoteUrlPolicy
{
    public static string BuildMasterSessionUrl(
        DesktopAgentRuntimeOptions options,
        string lockSessionId,
        string action
    )
    {
        var encodedSessionId = Uri.EscapeDataString(lockSessionId);
        return $"{options.ApiBaseUrl}/desktop/master-sessions/{encodedSessionId}/{action}";
    }
}
