using System.Text.Json;
using System.Text.Json.Nodes;
using static ProjectWing.DesktopAgent.Runtime.DesktopAgentSessionSyncPolicy;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed partial class DesktopAgentSessionSyncService
{
    public async Task<object> EndTrackingAsync(string sessionId, CancellationToken cancellationToken)
    {
        var gate = sessionLocks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        var streams = new List<FileStream>();
        try
        {
            var value = await state.ReadSessionAsync(sessionId, cancellationToken)
                ?? throw StateChanged();
            var node = JsonNode.Parse(value.GetRawText())!.AsObject();
            var lifecycle = node["lifecycleState"]?.GetValue<string>();
            if (lifecycle is not ("LOCAL_FILE_MISSING" or "LEASE_LOST" or "LOCK_REVOKED" or "SERVER_FILE_REMOVED"))
                throw StateChanged();
            var mode = node["mode"]?.GetValue<string>();
            if (mode is not ("MASTER" or "READ_ONLY")) throw StateChanged();

            // Keep recovery copies outside the evictable working cache. Do not
            // delete originals; hold read locks through release and archival.
            var invalidNameChars = Path.GetInvalidFileNameChars();
            var label = new string((node["fileName"]?.GetValue<string>() ?? "file")
                .Where(character => !invalidNameChars.Contains(character) && !char.IsControl(character))
                .Take(32).ToArray()).Trim(' ', '.');
            var archive = Path.Combine(options.StateRoot, "resolved-sessions", $"{DateTime.UtcNow:yyyyMMdd-HHmmss}-{label}-{Guid.NewGuid():N}");
            Directory.CreateDirectory(archive);
            foreach (var field in new[] { "localPath", "snapshotPath" })
            {
                var source = node[field]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(source)) continue;
                source = Path.GetFullPath(source);
                AssertRecoveryPath(source);
                FileStream stream;
                try { stream = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read); }
                catch (FileNotFoundException) { continue; }
                catch (DirectoryNotFoundException) { continue; }
                streams.Add(stream);
                var fileName = Path.GetFileName(source);
                var target = Path.Combine(archive, $"{field}-{fileName}");
                await using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                await stream.CopyToAsync(output, cancellationToken);
                await output.FlushAsync(cancellationToken);
                output.Flush(true);
            }
            if (mode == "MASTER")
            {
                // Never trust renderer-provided URLs or skip the server merely
                // because a local status says the lease expired.
                var url = ReadAllowedUrl(node["releaseUrl"]?.GetValue<string>());
                await remoteClient.EndTrackingAsync(new DesktopAgentReleaseContext
                {
                    Url = url,
                    ProjectId = node["projectId"]!.GetValue<string>(),
                    AttachmentId = node["attachmentId"]!.GetValue<string>(),
                    GrantSecret = node["grantSecret"]?.GetValue<string>(),
                    LockEpoch = node["lockEpoch"]?.GetValue<int>(),
                    Reason = "RECOVERY_ENDED",
                }, cancellationToken);
            }
            var removed = await state.RemoveSessionAsync(sessionId, current =>
            {
                foreach (var field in new[] { "sessionId", "generation", "mode", "lifecycleState", "localPath", "snapshotPath", "snapshotHash", "lastKnownHash", "releaseUrl", "grantSecret", "lockSessionId", "lockEpoch" })
                    if (!JsonNode.DeepEquals(current[field], node[field])) return false;
                var record = node.DeepClone().AsObject();
                record["status"] = "TRACKING_ENDED";
                record["resolvedAt"] = DateTime.UtcNow.ToString("O");
                foreach (var secret in new[] { "grantSecret", "checkInUrl", "releaseUrl", "openSignalToken", "closeSignalToken", "contentToken" }) record.Remove(secret);
                // Persist a private recovery receipt BEFORE removing the active
                // record. Failure leaves the active record available for retry.
                using var receipt = new FileStream(Path.Combine(archive, "record.json"), FileMode.CreateNew, FileAccess.Write, FileShare.None);
                using var writer = new StreamWriter(receipt);
                writer.Write(record.ToJsonString());
                writer.Flush(); receipt.Flush(true);
                return true;
            }, cancellationToken);
            if (removed is null) throw StateChanged();
            return new { ok = true, archiveDirectory = archive };
        }
        finally
        {
            foreach (var stream in streams) stream.Dispose();
            gate.Release();
        }
    }

    private void AssertRecoveryPath(string source)
    {
        var root = Path.GetFullPath(options.CacheRoot).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!source.StartsWith(root, comparison))
            throw new DesktopAgentRuntimeException("RECOVERY_PATH_UNVERIFIED", "The retained file is outside the current cache. Open its original location and preserve a copy before requesting support.", 409);
        // The configured cache root itself may live beneath Windows profile
        // redirection. Reject redirects inside that root, not its ancestors.
        for (var entry = new FileInfo(source) as FileSystemInfo;
            entry is not null && !entry.FullName.TrimEnd(Path.DirectorySeparatorChar).Equals(root.TrimEnd(Path.DirectorySeparatorChar), comparison);
            entry = Directory.GetParent(entry.FullName))
        {
            if (entry.Exists && (entry.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new DesktopAgentRuntimeException("RECOVERY_PATH_UNVERIFIED", "A redirected recovery path needs manual review. No record was removed.", 409);
        }
    }
}
