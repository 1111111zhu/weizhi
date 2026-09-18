using System.Net;
using System.Text;
using System.Text.Json;
using static ProjectWing.AgentManager.ManagerStatusStore;

namespace ProjectWing.AgentManager;

internal static class RuntimeHttpResponses
{
    public static async Task WriteJsonAsync(
        HttpListenerContext context,
        int statusCode,
        object body
    )
    {
        await WriteRawJsonAsync(
            context,
            statusCode,
            JsonSerializer.Serialize(body, CreateJsonOptions())
        );
    }

    public static async Task WriteRawJsonAsync(
        HttpListenerContext context,
        int statusCode,
        string json
    )
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.ContentLength64 = bytes.Length;
        try
        {
            await context.Response.OutputStream.WriteAsync(bytes);
        }
        finally
        {
            context.Response.Close();
        }
    }

    public static async Task TryWriteErrorAsync(
        HttpListenerContext context,
        int statusCode,
        string errorCode,
        string message,
        Exception error
    )
    {
        try
        {
            await WriteJsonAsync(context, statusCode, new
            {
                ok = false,
                code = errorCode,
                message,
                detail = error.Message,
            });
        }
        catch
        {
            TryClose(context.Response);
        }
    }

    public static void WriteEmpty(HttpListenerContext context, int statusCode)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentLength64 = 0;
        context.Response.Close();
    }

    private static void TryClose(HttpListenerResponse response)
    {
        try
        {
            response.Close();
        }
        catch
        {
            // The original exception is the useful diagnostic.
        }
    }
}
