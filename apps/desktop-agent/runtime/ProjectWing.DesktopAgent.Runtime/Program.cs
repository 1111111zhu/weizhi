using System.Text.Json.Serialization.Metadata;
using ProjectWing.DesktopAgent.Runtime;

var builder = WebApplication.CreateBuilder(args);
var options = DesktopAgentRuntimeOptions.FromConfiguration(builder.Configuration);
using var ownership = ProjectWing.NativeRuntime.RuntimeOwnershipLease.Acquire(options.StateRoot, "runtime");
using var cacheOwnership = ProjectWing.NativeRuntime.RuntimeOwnershipLease.Acquire(options.CacheRoot, "cache");

if (string.IsNullOrWhiteSpace(builder.Configuration["urls"]))
{
    builder.WebHost.UseUrls(DesktopAgentRuntimeOptions.DefaultUrl);
}

builder.Services.AddSingleton(options);
builder.Services.AddSingleton<DesktopAgentRuntimeState>();
builder.Services.AddSingleton<DesktopAgentCacheService>();
builder.Services.AddSingleton<DesktopAgentContentCache>();
builder.Services.AddSingleton<DesktopAgentCacheSettingsService>();
builder.Services.AddHostedService<DesktopAgentCacheMaintenanceService>();
builder.Services.AddSingleton<DesktopAgentSessionReconciler>();
builder.Services.AddSingleton<DesktopAgentHealthService>();
builder.Services.AddSingleton<DesktopAgentOfficeDiagnostics>();
builder.Services.AddSingleton<DesktopAgentPrinterDiscovery>();
builder.Services.AddSingleton<DesktopAgentPrintService>();
builder.Services.AddSingleton<DesktopAgentPrintEndpointServices>();
builder.Services.AddSingleton<DesktopAgentUpdateStatusReader>();
builder.Services.AddSingleton<DesktopAgentUpdateSessionResolver>();
builder.Services.AddSingleton<DesktopAgentUpdateServices>();
builder.Services.AddSingleton<DesktopAgentUpdateOrchestrator>();
builder.Services.AddSingleton(_ => DesktopAgentNetworkPolicy.CreateHttpClient(options));
builder.Services.AddSingleton<DesktopAgentDeviceAuthSession>();
builder.Services.AddSingleton<DesktopAgentTransferDiagnosticLog>();
builder.Services.AddSingleton<DesktopAgentFileTransfer>();
builder.Services.AddSingleton<DesktopAgentPdfEditorResolver>();
builder.Services.AddSingleton<DesktopAgentFileLauncher>();
builder.Services.AddSingleton<DesktopAgentLocalFileProbe>();
builder.Services.AddSingleton<DesktopAgentOpenRequestValidator>();
builder.Services.AddSingleton<DesktopAgentMasterFileService>();
builder.Services.AddSingleton<DesktopAgentFileService>();
builder.Services.AddSingleton<DesktopAgentSessionEvents>();
builder.Services.AddSingleton<DesktopAgentLaunchRecoveryService>();
builder.Services.AddSingleton<DesktopAgentSessionEventServices>();
builder.Services.AddSingleton<DesktopAgentSessionRemoteClient>();
builder.Services.AddSingleton<DesktopAgentUploadSnapshotService>();
builder.Services.AddSingleton<DesktopAgentSessionSyncService>();
builder.Services.AddHostedService<DesktopAgentHeartbeatService>();
builder.Services.AddSingleton<DesktopAgentBackgroundSyncService>();
builder.Services.AddHostedService(provider =>
    provider.GetRequiredService<DesktopAgentBackgroundSyncService>()
);
builder.Services.AddHostedService<DesktopAgentLocalObservationService>();
builder.Services.ConfigureHttpJsonOptions(json =>
{
    json.SerializerOptions.TypeInfoResolverChain.Add(new DefaultJsonTypeInfoResolver());
    json.SerializerOptions.DefaultIgnoreCondition =
        System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy =>
    policy.WithOrigins(options.AllowedWebOrigins.ToArray())
        .AllowAnyHeader()
        .AllowAnyMethod()
));

var app = builder.Build();
using var managerLifetime = DesktopAgentManagerLifetimeGuard.Start(app.Lifetime);

app.UseMiddleware<LoopbackOnlyMiddleware>();
app.UseMiddleware<TrustedOriginMiddleware>();
app.UseMiddleware<PrivateNetworkAccessMiddleware>();
app.UseCors();
app.MapDesktopAgentRuntimeEndpoints();

app.Run();
