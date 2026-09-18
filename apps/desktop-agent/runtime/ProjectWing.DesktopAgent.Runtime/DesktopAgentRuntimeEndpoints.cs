namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentRuntimeEndpoints
{
    public static void MapDesktopAgentRuntimeEndpoints(this WebApplication app)
    {
        app.MapDesktopAgentSessionSyncEndpoints();
        app.MapDesktopAgentSessionEventEndpoints();
        app.MapDesktopAgentPrintEndpoints();
        app.MapDesktopAgentUpdateEndpoints();
        app.MapDesktopAgentCacheEndpoints();
        app.MapGet("/health", ReadHealth);
        app.MapGet("/auth/status", ReadAuthStatus);
        app.MapGet("/diagnostics/office", ReadOfficeDiagnostics);
        app.MapPost("/auth/pair", StartDevicePair);
        app.MapPost("/open", OpenFile);
        app.MapGet("/sessions", ReadSessions);
        app.MapFallback(() => Results.Json(
            new DesktopAgentError(false, "NOT_FOUND", "Desktop Agent route was not found."),
            statusCode: StatusCodes.Status404NotFound
        ));
    }

    private static async Task<IResult> ReadHealth(
        DesktopAgentHealthService healthService,
        CancellationToken cancellationToken
    )
    {
        return Results.Ok(await healthService.ReadAsync(cancellationToken));
    }

    private static IResult ReadAuthStatus(DesktopAgentDeviceAuthSession authSession)
    {
        return Results.Ok(authSession.ReadStatus());
    }

    private static IResult ReadOfficeDiagnostics(DesktopAgentOfficeDiagnostics diagnostics)
    {
        return Results.Ok(diagnostics.Read());
    }


    private static async Task<IResult> StartDevicePair(
        HttpRequest request,
        DesktopAgentDeviceAuthSession authSession,
        CancellationToken cancellationToken
    )
    {
        DesktopAgentPairRequest? input;
        try
        {
            input = await request.ReadFromJsonAsync<DesktopAgentPairRequest>(cancellationToken);
        }
        catch (System.Text.Json.JsonException)
        {
            return InvalidPairRequest();
        }

        if (input is null || !authSession.TryStartPair(input))
        {
            return InvalidPairRequest();
        }

        return Results.Json(
            new DesktopAgentAuthStatus
            {
                Ok = true,
                Authenticated = false,
                Pairing = true,
            },
            statusCode: StatusCodes.Status202Accepted
        );
    }

    private static IResult InvalidPairRequest()
    {
        return Results.BadRequest(new DesktopAgentError(
            false,
            "VALIDATION_FAILED",
            "Device pairing request is invalid."
        ));
    }

    private static async Task<IResult> OpenFile(
        HttpRequest request,
        DesktopAgentDeviceAuthSession authSession,
        DesktopAgentFileService fileService,
        CancellationToken cancellationToken
    )
    {
        var authorization = authSession.ReadAuthorization();
        if (authorization is null)
        {
            return Results.Json(
                new DesktopAgentError(
                    false,
                    "DEVICE_AUTH_REQUIRED",
                    "Pair this Desktop Agent before opening files."
                ),
                statusCode: StatusCodes.Status401Unauthorized
            );
        }
        try
        {
            var input = await ReadOpenRequest(request, cancellationToken);
            return Results.Ok(await fileService.OpenAsync(input, authorization, cancellationToken));
        }
        catch (DesktopAgentRuntimeException error)
        {
            return Results.Json(
                new DesktopAgentError(false, error.Code, error.Message),
                statusCode: error.StatusCode
            );
        }
    }

    private static async Task<DesktopAgentOpenRequest> ReadOpenRequest(
        HttpRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await request.ReadFromJsonAsync<DesktopAgentOpenRequest>(cancellationToken)
                ?? throw InvalidOpenRequest();
        }
        catch (Exception error) when (
            error is System.Text.Json.JsonException
                or BadHttpRequestException
                or NotSupportedException
        )
        {
            throw InvalidOpenRequest();
        }
    }

    private static DesktopAgentRuntimeException InvalidOpenRequest()
    {
        return new DesktopAgentRuntimeException(
            "VALIDATION_FAILED",
            "Open request is invalid.",
            StatusCodes.Status400BadRequest
        );
    }

    private static async Task<IResult> ReadSessions(
        DesktopAgentSessionReconciler reconciler,
        DesktopAgentRuntimeState state,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var sessions = await reconciler.RefreshAsync(cancellationToken);
            var recentSessions = await state.ReadRecentSessionsAsync(cancellationToken);
            return Results.Ok(new DesktopAgentSessions(
                true,
                sessions.Select(SanitizeSession).ToArray(),
                recentSessions
            ));
        }
        catch (Exception error) when (
            error is IOException
                or UnauthorizedAccessException
                or System.Text.Json.JsonException
        )
        {
            return Results.Json(
                new DesktopAgentError(
                    false,
                    "SESSION_REFRESH_FAILED",
                    "Could not refresh Desktop Agent sessions."
                ),
                statusCode: StatusCodes.Status500InternalServerError
            );
        }
    }

    private static System.Text.Json.JsonElement SanitizeSession(
        System.Text.Json.JsonElement session
    )
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(session.GetRawText())!.AsObject();
        node.Remove("grantSecret");
        node.Remove("snapshotPath");
        node.Remove("snapshotHash");
        node.Remove("snapshotCrc64");
        node.Remove("uploadId");
        node.Remove("uploadAttemptId");
        return System.Text.Json.JsonSerializer.SerializeToElement(node);
    }

}
