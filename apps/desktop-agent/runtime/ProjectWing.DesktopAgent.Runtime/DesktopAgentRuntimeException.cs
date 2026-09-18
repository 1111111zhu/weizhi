namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentRuntimeException(
    string code,
    string message,
    int statusCode
) : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
