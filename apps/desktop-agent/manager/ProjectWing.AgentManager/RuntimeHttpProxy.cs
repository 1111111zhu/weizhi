using System.Diagnostics;
using System.Net;
using static ProjectWing.AgentManager.RuntimeHttpResponses;

namespace ProjectWing.AgentManager;

internal static class RuntimeHttpProxy
{
    public static async Task ProxyAsync(
        HttpListenerContext context,
        RuntimeConfig config,
        Process worker
    )
    {
        if (worker.HasExited)
        {
            await WriteJsonAsync(context, 502, new
            {
                ok = false,
                code = "WORKER_EXITED",
                message = "Desktop Agent worker is not running.",
            });
            return;
        }
        using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
        var targetUrl = $"http://127.0.0.1:{config.WorkerPort}{context.Request.RawUrl ?? "/"}";
        using var request = CreateRequest(context.Request, targetUrl);
        try
        {
            using var timeout = new CancellationTokenSource(
                GetWorkerProxyTimeout(context.Request.Url?.AbsolutePath ?? "/")
            );
            using var response = await http.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                timeout.Token
            );
            await CopyResponseAsync(response, context.Response);
        }
        catch (Exception error) when (
            error is HttpRequestException or IOException or TaskCanceledException
        )
        {
            await WriteJsonAsync(context, 502, new
            {
                ok = false,
                code = "WORKER_PROXY_FAILED",
                message = "Could not reach the Desktop Agent worker.",
                detail = error.Message,
            });
        }
    }

    private static HttpRequestMessage CreateRequest(HttpListenerRequest source, string targetUrl)
    {
        var request = new HttpRequestMessage(new HttpMethod(source.HttpMethod), targetUrl);
        if (source.HasEntityBody) request.Content = new StreamContent(source.InputStream);
        CopyRequestHeaders(source, request);
        return request;
    }

    private static async Task CopyResponseAsync(
        HttpResponseMessage source,
        HttpListenerResponse target
    )
    {
        target.StatusCode = (int)source.StatusCode;
        target.StatusDescription = source.ReasonPhrase ?? string.Empty;
        CopyResponseHeaders(source, target);
        target.ContentType = source.Content.Headers.ContentType?.ToString()
            ?? "application/json; charset=utf-8";
        if (source.Content.Headers.ContentLength is long contentLength)
        {
            target.ContentLength64 = contentLength;
        }
        else
        {
            target.SendChunked = true;
        }
        try
        {
            await source.Content.CopyToAsync(target.OutputStream);
        }
        finally
        {
            target.Close();
        }
    }

    private static TimeSpan GetWorkerProxyTimeout(string path)
    {
        if (
            string.Equals(path, "/open", StringComparison.Ordinal)
            || path.EndsWith("/check-in", StringComparison.Ordinal)
            || path.EndsWith("/release", StringComparison.Ordinal)
        )
        {
            return TimeSpan.FromMinutes(35);
        }
        return TimeSpan.FromMinutes(2);
    }

    private static void CopyRequestHeaders(
        HttpListenerRequest source,
        HttpRequestMessage target
    )
    {
        foreach (var name in source.Headers.AllKeys)
        {
            if (string.IsNullOrWhiteSpace(name) || ShouldSkipRequestHeader(name)) continue;
            var values = source.Headers.GetValues(name);
            if (values is null) continue;
            if (!target.Headers.TryAddWithoutValidation(name, values))
            {
                target.Content?.Headers.TryAddWithoutValidation(name, values);
            }
        }
    }

    private static void CopyResponseHeaders(
        HttpResponseMessage source,
        HttpListenerResponse target
    )
    {
        foreach (var header in source.Headers) AddResponseHeader(target, header.Key, header.Value);
        foreach (var header in source.Content.Headers)
        {
            AddResponseHeader(target, header.Key, header.Value);
        }
    }

    private static void AddResponseHeader(
        HttpListenerResponse response,
        string name,
        IEnumerable<string> values
    )
    {
        if (ShouldSkipResponseHeader(name)) return;
        try
        {
            if (string.Equals(name, "Set-Cookie", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var value in values) response.Headers.Add(name, value);
                return;
            }
            response.Headers[name] = string.Join(", ", values);
        }
        catch
        {
            // Platform-managed and hop-by-hop headers may be restricted.
        }
    }

    private static bool ShouldSkipRequestHeader(string name)
    {
        return string.Equals(name, "Host", StringComparison.OrdinalIgnoreCase)
            || string.Equals(name, "Content-Length", StringComparison.OrdinalIgnoreCase)
            || IsHopByHop(name);
    }

    private static bool ShouldSkipResponseHeader(string name)
    {
        return string.Equals(name, "Content-Length", StringComparison.OrdinalIgnoreCase)
            || string.Equals(name, "Content-Type", StringComparison.OrdinalIgnoreCase)
            || IsHopByHop(name);
    }

    private static bool IsHopByHop(string name)
    {
        return name.Equals("Connection", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Keep-Alive", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Proxy-Authenticate", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Proxy-Authorization", StringComparison.OrdinalIgnoreCase)
            || name.Equals("TE", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Trailer", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Upgrade", StringComparison.OrdinalIgnoreCase);
    }
}
