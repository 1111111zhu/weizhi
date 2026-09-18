using System.Diagnostics;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentFileService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentRuntimeState state,
    DesktopAgentFileTransfer transfer,
    DesktopAgentFileLauncher launcher,
    DesktopAgentOpenRequestValidator validator,
    DesktopAgentMasterFileService masterFileService,
    DesktopAgentOfficeDiagnostics officeDiagnostics,
    ILogger<DesktopAgentFileService> logger
)
{
    private const int InitialSessionGeneration = 1;

    public async Task<DesktopAgentOpenResponse> OpenAsync(
        DesktopAgentOpenRequest input,
        string authorization,
        CancellationToken cancellationToken
    )
    {
        var total = Stopwatch.StartNew();
        var request = validator.Validate(input);
        if (request.Mode == "MASTER" && !options.DisableFileLaunch)
        {
            officeDiagnostics.EnsureMasterEditorAvailable(request.FileName);
        }
        var response = request.Mode == "MASTER"
            ? await masterFileService.OpenAsync(request, authorization, cancellationToken)
            : await OpenReadOnlyAsync(request, authorization, cancellationToken);
        logger.LogInformation(
            "Desktop open {RequestId} completed for {Mode} attachment {AttachmentId} in {ElapsedMs} ms.",
            request.RequestId,
            request.Mode,
            request.AttachmentId,
            total.ElapsedMilliseconds
        );
        return response;
    }

    private async Task<DesktopAgentOpenResponse> OpenReadOnlyAsync(
        DesktopAgentValidatedOpenRequest request,
        string authorization,
        CancellationToken cancellationToken
    )
    {
        var timer = Stopwatch.StartNew();
        var localPath = DesktopAgentPathPolicy.BuildReadOnlyPath(
            options.CacheRoot,
            new DesktopAgentPathRequest
            {
                ProjectId = request.ProjectId,
                AttachmentId = request.AttachmentId,
                FileName = request.FileName,
                SessionSegment = "read-only",
            }
        );
        var transferResult = await transfer.DownloadForOpenAsync(
            request,
            localPath,
            authorization,
            makeReadOnly: true,
            cancellationToken,
            storeReusableCopy: false
        );
        var transferredAt = timer.ElapsedMilliseconds;
        await launcher.LaunchReadOnlyAsync(localPath, cancellationToken);
        var launchedAt = timer.ElapsedMilliseconds;
        if (!transferResult.CacheHit)
            transfer.StoreReusableCopyInBackground(request, localPath, transferResult.Sha256);

        var sessionId = Guid.NewGuid().ToString();
        var openedAt = DateTime.UtcNow.ToString("O");
        await state.UpsertSessionAsync(
            new DesktopAgentSession
            {
                SessionId = sessionId,
                Generation = InitialSessionGeneration,
                Mode = "READ_ONLY",
                ProjectId = request.ProjectId,
                AttachmentId = request.AttachmentId,
                FileName = request.FileName,
                LocalPath = localPath,
                OriginalHash = transferResult.Sha256,
                LastKnownHash = transferResult.Sha256,
                Status = "OPEN_UNCHANGED",
                LifecycleState = "OPEN",
                ContentState = "UNCHANGED",
                OpenedAt = openedAt,
                LaunchStartedAt = openedAt,
                LastSeenAt = openedAt,
                CheckInUrl = request.CheckInUrl,
                ReleaseUrl = request.ReleaseUrl,
                BaseVersion = request.BaseVersion,
                BaseVersionId = request.BaseVersionId,
                CacheVersionId = request.CacheVersionId,
                FileSize = request.FileSize,
                ContentToken = request.ContentToken,
                ContentHash = request.ContentHash,
            },
            cancellationToken
        );
        logger.LogInformation(
            "Desktop open {RequestId} stages for READ_ONLY attachment {AttachmentId}: transfer={TransferMs} ms, launch={LaunchMs} ms, persist={PersistMs} ms, cacheHit={CacheHit}.",
            request.RequestId,
            request.AttachmentId,
            transferredAt,
            launchedAt - transferredAt,
            timer.ElapsedMilliseconds - launchedAt,
            transferResult.CacheHit
        );
        return new DesktopAgentOpenResponse
        {
            Ok = true,
            RequestId = request.RequestId,
            SessionId = sessionId,
            LocalPath = localPath,
            OpenedAt = openedAt,
        };
    }

}
