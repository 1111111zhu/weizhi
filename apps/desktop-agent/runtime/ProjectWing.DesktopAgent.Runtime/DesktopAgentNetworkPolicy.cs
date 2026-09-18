using System.Net;

namespace ProjectWing.DesktopAgent.Runtime;

public enum DesktopAgentNetworkMode
{
    Direct,
    System,
    Explicit,
}

public static class DesktopAgentNetworkPolicy
{
    public static HttpClient CreateHttpClient(DesktopAgentRuntimeOptions options)
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            UseProxy = options.NetworkMode is not DesktopAgentNetworkMode.Direct,
        };
        if (options.NetworkMode is DesktopAgentNetworkMode.Explicit)
        {
            handler.Proxy = new WebProxy(
                options.ExplicitProxyUri
                    ?? throw new InvalidOperationException(
                        "Explicit proxy mode requires a proxy URL."
                    )
            );
        }
        return new HttpClient(handler);
    }
}
