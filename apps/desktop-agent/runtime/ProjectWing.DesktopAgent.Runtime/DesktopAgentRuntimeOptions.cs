using System.Reflection;
using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed record DesktopAgentRuntimeOptions
{
    public const string DefaultUrl = "http://127.0.0.1:17862";

    public required string Version { get; init; }
    public required string ManagerVersion { get; init; }
    public required IReadOnlySet<string> AllowedWebOrigins { get; init; }
    public required IReadOnlySet<string> AllowedAuthOrigins { get; init; }
    public required IReadOnlySet<string> AllowedDownloadOrigins { get; init; }
    public required IReadOnlySet<string> AllowedDownloadRedirectOrigins { get; init; }
    public required string StateRoot { get; init; }
    public required string CacheRoot { get; init; }
    public required string ApiBaseUrl { get; init; }
    public required bool DisableFileLaunch { get; init; }
    public required string WatcherPath { get; init; }
    public required string ManagerPath { get; init; }
    public required string UpdateDownloadUrl { get; init; }
    public required string AgentBaseUrl { get; init; }
    public required DesktopAgentNetworkMode NetworkMode { get; init; }
    public required Uri? ExplicitProxyUri { get; init; }
    public required TimeSpan MasterOpenObservationTimeout { get; init; }
    public required long CacheMaxBytes { get; init; }
    public required TimeSpan CacheTtl { get; init; }
    public string CacheEvictionPolicy { get; init; } = "LRU";

    private static readonly string[] DefaultAllowedWebOrigins =
    [
        "https://emp.superfx.cn",
        "https://emp.wzcpa.hk",
        "https://wing.superfx.cn",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3021",
        "http://127.0.0.1:3021",
    ];

    private static readonly string[] DefaultAllowedAuthOrigins =
    [
        "https://auth.superfx.cn",
        "https://auth.wzcpa.hk",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3020",
        "http://127.0.0.1:3020",
    ];

    private static readonly string[] DefaultAllowedDownloadOrigins =
    [
        "https://emp.superfx.cn",
        "https://emp.wzcpa.hk",
        "https://wing.superfx.cn",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3020",
        "http://127.0.0.1:3020",
    ];

    private static readonly string[] DefaultAllowedDownloadRedirectOrigins =
    [
        "https://superfx-project-wing-files.oss-cn-shenzhen.aliyuncs.com",
        "https://oss-cn-shenzhen.aliyuncs.com",
    ];

    public static DesktopAgentRuntimeOptions FromConfiguration(IConfiguration configuration)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var assemblyVersion = assembly.GetName().Version?.ToString(3) ?? "0.2.1";
        var version = ReadValue(configuration, "PROJECT_WING_AGENT_VERSION")
            ?? assemblyVersion;
        var managerVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion
            .Split('+')[0]
            ?? assemblyVersion;
        var networkMode = ReadNetworkMode(configuration);
        var stateRoot = DesktopAgentStateDirectory.Resolve(ResolveDataRoot(
            configuration,
            "PROJECT_WING_AGENT_STATE_ROOT",
            "AgentState"
        ));
        var persistedCacheSettings = ReadPersistedCacheSettings(stateRoot);

        return new DesktopAgentRuntimeOptions
        {
            Version = version,
            ManagerVersion = managerVersion,
            AllowedWebOrigins = ReadOrigins(
                configuration,
                "PROJECT_WING_AGENT_ALLOWED_WEB_ORIGINS",
                DefaultAllowedWebOrigins
            ),
            AllowedAuthOrigins = ReadOrigins(
                configuration,
                "PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS",
                DefaultAllowedAuthOrigins
            ),
            AllowedDownloadOrigins = ReadOrigins(
                configuration,
                "PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS",
                DefaultAllowedDownloadOrigins
            ),
            AllowedDownloadRedirectOrigins = ReadOrigins(
                configuration,
                "PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_REDIRECT_ORIGINS",
                DefaultAllowedDownloadRedirectOrigins
            ),
            StateRoot = stateRoot,
            CacheRoot = persistedCacheSettings?.CacheRoot
                ?? ResolveDataRoot(
                    configuration,
                    "PROJECT_WING_AGENT_CACHE_ROOT",
                    "agent-cache"
                ),
            ApiBaseUrl = ResolveApiBaseUrl(configuration),
            DisableFileLaunch = string.Equals(
                ReadValue(configuration, "PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH"),
                "true",
                StringComparison.OrdinalIgnoreCase
            ),
            WatcherPath = ResolveWatcherPath(configuration),
            ManagerPath = ResolveManagerPath(configuration),
            UpdateDownloadUrl = ResolveUpdateDownloadUrl(configuration),
            AgentBaseUrl = ReadValue(configuration, "PROJECT_WING_AGENT_BASE_URL")
                ?? DefaultUrl,
            NetworkMode = networkMode,
            ExplicitProxyUri = ReadExplicitProxyUri(configuration, networkMode),
            MasterOpenObservationTimeout = ReadTimeout(configuration),
            CacheMaxBytes = persistedCacheSettings?.MaxBytes
                ?? ReadLong(
                    configuration,
                    "PROJECT_WING_AGENT_CACHE_MAX_BYTES",
                    5L * 1024 * 1024 * 1024
                ),
            CacheEvictionPolicy = persistedCacheSettings?.EvictionPolicy ?? "LRU",
            CacheTtl = persistedCacheSettings?.IdleDays is { } idleDays ? TimeSpan.FromDays(idleDays) : TimeSpan.FromHours(ReadLong(
                configuration,
                "PROJECT_WING_AGENT_CACHE_TTL_HOURS",
                24L * 30
            )),
        };
    }

    private static PersistedCacheSettings? ReadPersistedCacheSettings(string stateRoot)
    {
        var path = Path.Combine(stateRoot, "cache-settings.json");
        if (!File.Exists(path)) return null;
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            if (
                !root.TryGetProperty("cacheRoot", out var cacheRootProperty)
                || cacheRootProperty.ValueKind != JsonValueKind.String
                || cacheRootProperty.GetString() is not { Length: > 0 } cacheRoot
                || !Path.IsPathFullyQualified(cacheRoot)
            )
            {
                return null;
            }
            long? maxBytes = null;
            if (
                root.TryGetProperty("maxBytes", out var maxBytesProperty)
                && maxBytesProperty.ValueKind == JsonValueKind.Number
                && maxBytesProperty.TryGetInt64(out var parsedMaxBytes)
                && parsedMaxBytes > 0
            )
            {
                maxBytes = parsedMaxBytes;
            }
            var policy = root.TryGetProperty("evictionPolicy", out var policyValue) && policyValue.ValueKind == JsonValueKind.String && policyValue.GetString() == "FIFO" ? "FIFO" : "LRU";
            int? idleDays = root.TryGetProperty("idleDays", out var daysValue) && daysValue.ValueKind == JsonValueKind.Number && daysValue.TryGetInt32(out var parsedDays) && parsedDays is >= 1 and <= 3650 ? parsedDays : null;
            return new PersistedCacheSettings(Path.GetFullPath(cacheRoot), maxBytes, policy, idleDays);
        }
        catch (Exception error) when (
            error is IOException
                or UnauthorizedAccessException
                or JsonException
                or ArgumentException
                or NotSupportedException
        )
        {
            return null;
        }
    }

    private static DesktopAgentNetworkMode ReadNetworkMode(IConfiguration configuration)
    {
        var configured = ReadValue(configuration, "PROJECT_WING_AGENT_NETWORK_MODE");
        return configured?.ToUpperInvariant() switch
        {
            null or "DIRECT" => DesktopAgentNetworkMode.Direct,
            "SYSTEM" => DesktopAgentNetworkMode.System,
            "EXPLICIT" => DesktopAgentNetworkMode.Explicit,
            _ => throw new InvalidOperationException(
                "PROJECT_WING_AGENT_NETWORK_MODE must be DIRECT, SYSTEM, or EXPLICIT."
            ),
        };
    }

    private static Uri? ReadExplicitProxyUri(
        IConfiguration configuration,
        DesktopAgentNetworkMode networkMode
    )
    {
        var configured = ReadValue(configuration, "PROJECT_WING_AGENT_PROXY_URL");
        if (networkMode is not DesktopAgentNetworkMode.Explicit)
        {
            return null;
        }
        if (
            !Uri.TryCreate(configured, UriKind.Absolute, out var proxyUri)
            || proxyUri.Scheme is not ("http" or "https")
        )
        {
            throw new InvalidOperationException(
                "Explicit proxy mode requires a valid HTTP(S) PROJECT_WING_AGENT_PROXY_URL."
            );
        }
        return proxyUri;
    }

    private static IReadOnlySet<string> ReadOrigins(
        IConfiguration configuration,
        string name,
        string[] defaults
    )
    {
        var configured = ReadValue(configuration, name);
        var origins = configured?.Split(
            ',',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
        ) ?? defaults;

        return origins.ToHashSet(StringComparer.Ordinal);
    }

    private static string? ReadValue(IConfiguration configuration, string name)
    {
        var value = configuration[name]?.Trim();
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string ResolveDataRoot(
        IConfiguration configuration,
        string environmentName,
        string directoryName
    )
    {
        var configured = ReadValue(configuration, environmentName);
        if (configured is not null)
        {
            return Path.GetFullPath(configured);
        }

        if (OperatingSystem.IsWindows())
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ProjectWing",
                directoryName
            );
        }

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".project-wing",
            directoryName
        );
    }

    private static string ResolveWatcherPath(IConfiguration configuration)
    {
        return ReadValue(configuration, "PROJECT_WING_EXCEL_WATCHER_EXE_PATH")
            ?? Path.Combine(
                AppContext.BaseDirectory,
                OperatingSystem.IsWindows()
                    ? "ProjectWing.ExcelWatcher.exe"
                    : "ProjectWing.ExcelWatcher"
            );
    }

    private static string ResolveManagerPath(IConfiguration configuration)
    {
        return ReadValue(configuration, "PROJECT_WING_AGENT_MANAGER_EXE_PATH")
            ?? Path.Combine(
                AppContext.BaseDirectory,
                OperatingSystem.IsWindows()
                    ? "ProjectWing.AgentManager.exe"
                    : "ProjectWing.AgentManager"
            );
    }

    private static string ResolveUpdateDownloadUrl(IConfiguration configuration)
    {
        var platformName = OperatingSystem.IsMacOS() ? "MACOS" : "WINDOWS";
        var configured = ReadValue(
            configuration,
            $"PROJECT_WING_AGENT_{platformName}_DOWNLOAD_URL"
        );
        if (configured is not null)
        {
            return configured;
        }
        var apiBaseUrl = ReadValue(configuration, "PROJECT_WING_AGENT_API_BASE_URL")
            ?? "https://emp.superfx.cn/api";
        var platformPath = OperatingSystem.IsMacOS() ? "macos" : "windows";
        return $"{apiBaseUrl.TrimEnd('/')}/downloads/desktop-agent/{platformPath}/latest";
    }

    private static string ResolveApiBaseUrl(IConfiguration configuration)
    {
        var configured = ReadValue(configuration, "PROJECT_WING_AGENT_API_BASE_URL")
            ?? "https://emp.superfx.cn/api";
        if (
            !Uri.TryCreate(configured, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https")
        )
        {
            throw new InvalidOperationException(
                "PROJECT_WING_AGENT_API_BASE_URL must be an absolute HTTP(S) URL."
            );
        }
        return configured.TrimEnd('/');
    }

    private static TimeSpan ReadTimeout(IConfiguration configuration)
    {
        const int defaultTimeoutMilliseconds = 20_000;
        var value = ReadValue(
            configuration,
            "PROJECT_WING_AGENT_OPEN_OBSERVATION_TIMEOUT_MS"
        );
        return int.TryParse(value, out var milliseconds) && milliseconds >= 0
            ? TimeSpan.FromMilliseconds(milliseconds)
            : TimeSpan.FromMilliseconds(defaultTimeoutMilliseconds);
    }

    private static long ReadLong(
        IConfiguration configuration,
        string name,
        long fallback
    )
    {
        var value = ReadValue(configuration, name);
        return long.TryParse(value, out var parsed) && parsed > 0 ? parsed : fallback;
    }
}

internal sealed record PersistedCacheSettings(string CacheRoot, long? MaxBytes, string EvictionPolicy, int? IdleDays);
