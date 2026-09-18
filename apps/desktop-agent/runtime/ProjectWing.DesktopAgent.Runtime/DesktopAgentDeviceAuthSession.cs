using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentDeviceAuthSession(
    HttpClient httpClient,
    DesktopAgentRuntimeOptions options
) : IDisposable
{
    private const string ClientId = "project-wing-desktop-agent";
    private readonly object stateLock = new();
    private readonly CancellationTokenSource shutdown = new();
    private AuthState state = new(null, null, null, false, null);

    public DesktopAgentAuthStatus ReadStatus()
    {
        lock (stateLock)
        {
            ClearExpiredToken();
            return new DesktopAgentAuthStatus
            {
                Ok = true,
                Authenticated = state.AccessToken is not null,
                Pairing = state.Pairing,
                LastError = state.LastError,
                User = state.User,
            };
        }
    }

    public string? ReadAuthorization()
    {
        lock (stateLock)
        {
            ClearExpiredToken();
            return state.AccessToken is null ? null : $"Bearer {state.AccessToken}";
        }
    }

    public bool TryStartPair(DesktopAgentPairRequest input)
    {
        if (!TryValidate(input, out var validated))
        {
            return false;
        }

        lock (stateLock)
        {
            if (state.Pairing)
            {
                return true;
            }

            state = new AuthState(null, null, null, true, null);
        }

        _ = PollForTokenAsync(validated, shutdown.Token);
        return true;
    }

    public void Dispose()
    {
        shutdown.Cancel();
        shutdown.Dispose();
    }

    private async Task PollForTokenAsync(
        ValidatedPairRequest input,
        CancellationToken cancellationToken
    )
    {
        var expiresAt = DateTimeOffset.UtcNow.AddSeconds(input.ExpiresInSeconds);
        var interval = input.IntervalSeconds;
        try
        {
            while (DateTimeOffset.UtcNow < expiresAt)
            {
                var result = await RequestTokenAsync(input, cancellationToken);
                if (await TryStoreTokenAsync(result, input.AuthBaseUrl, cancellationToken))
                {
                    return;
                }
                if (result.Error is not ("authorization_pending" or "slow_down"))
                {
                    MarkFailed();
                    return;
                }
                interval += result.Error == "slow_down" ? 5 : 0;
                await Task.Delay(TimeSpan.FromSeconds(interval), cancellationToken);
            }
            MarkFailed();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            MarkPairingStopped();
        }
        catch (Exception)
        {
            MarkFailed();
        }
    }

    private async Task<DeviceTokenResponse> RequestTokenAsync(
        ValidatedPairRequest input,
        CancellationToken cancellationToken
    )
    {
        var body = new
        {
            grant_type = "urn:ietf:params:oauth:grant-type:device_code",
            device_code = input.DeviceCode,
            client_id = ClientId,
        };
        using var response = await httpClient.PostAsJsonAsync(
            $"{input.AuthBaseUrl}/auth/device/token",
            body,
            cancellationToken
        );
        var result = await response.Content.ReadFromJsonAsync<DeviceTokenResponse>(
            cancellationToken
        ) ?? new DeviceTokenResponse(null, null, "unknown");
        return response.IsSuccessStatusCode
            ? result
            : new DeviceTokenResponse(null, null, result.Error ?? "unknown");
    }

    private bool TryValidate(
        DesktopAgentPairRequest input,
        out ValidatedPairRequest validated
    )
    {
        validated = default!;
        if (
            input.ClientId != ClientId
            || string.IsNullOrWhiteSpace(input.DeviceCode)
            || input.DeviceCode.Trim().Length > 512
            || input.ExpiresInSeconds is < 1 or > 1800
            || input.IntervalSeconds is < 1 or > 60
            || !TryReadTrustedOrigin(input.AuthBaseUrl, out var authBaseUrl)
        )
        {
            return false;
        }

        validated = new ValidatedPairRequest(
            input.DeviceCode.Trim(),
            authBaseUrl,
            input.ExpiresInSeconds,
            input.IntervalSeconds
        );
        return true;
    }

    private bool TryReadTrustedOrigin(string? value, out string origin)
    {
        origin = string.Empty;
        if (
            !Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || uri.AbsolutePath != "/"
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment)
        )
        {
            return false;
        }

        origin = uri.GetLeftPart(UriPartial.Authority);
        return options.AllowedAuthOrigins.Contains(origin);
    }

    private async Task<bool> TryStoreTokenAsync(
        DeviceTokenResponse result,
        string authBaseUrl,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(result.AccessToken))
        {
            return false;
        }

        var user = await RequestUserAsync(authBaseUrl, result.AccessToken, cancellationToken);
        var lifetime = result.ExpiresIn is > 0 ? result.ExpiresIn.Value : 3600;
        lock (stateLock)
        {
            state = new AuthState(
                result.AccessToken,
                DateTimeOffset.UtcNow.AddSeconds(lifetime),
                user,
                false,
                null
            );
        }
        return true;
    }

    private async Task<DesktopAgentAuthUser?> RequestUserAsync(
        string authBaseUrl,
        string accessToken,
        CancellationToken cancellationToken
    )
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{authBaseUrl}/auth/get-session"
        );
        request.Headers.Authorization = new("Bearer", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }
        var session = await response.Content.ReadFromJsonAsync<AuthSessionResponse>(
            cancellationToken
        );
        return session?.User is { Id.Length: > 0, Email.Length: > 0, Name.Length: > 0 }
            ? session.User
            : null;
    }

    private void MarkFailed()
    {
        lock (stateLock)
        {
            state = state with
            {
                Pairing = false,
                LastError = "DEVICE_AUTHORIZATION_FAILED",
            };
        }
    }

    private void MarkPairingStopped()
    {
        lock (stateLock)
        {
            state = state with { Pairing = false };
        }
    }

    private void ClearExpiredToken()
    {
        if (state.ExpiresAt is not null && state.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            state = state with { AccessToken = null, ExpiresAt = null, User = null };
        }
    }

    private sealed record AuthState(
        string? AccessToken,
        DateTimeOffset? ExpiresAt,
        DesktopAgentAuthUser? User,
        bool Pairing,
        string? LastError
    );

    private sealed record ValidatedPairRequest(
        string DeviceCode,
        string AuthBaseUrl,
        int ExpiresInSeconds,
        int IntervalSeconds
    );

    private sealed record DeviceTokenResponse(
        [property: JsonPropertyName("access_token")] string? AccessToken,
        [property: JsonPropertyName("expires_in")] int? ExpiresIn,
        [property: JsonPropertyName("error")] string? Error
    );

    private sealed record AuthSessionResponse(
        [property: JsonPropertyName("user")] DesktopAgentAuthUser? User
    );
}
