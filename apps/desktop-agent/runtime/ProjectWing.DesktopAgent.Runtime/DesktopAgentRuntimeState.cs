using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Security.Cryptography;
using System.Text;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentRuntimeState(DesktopAgentRuntimeOptions options)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };
    private readonly SemaphoreSlim stateLock = new(1, 1);
    private readonly SemaphoreSlim recentStateLock = new(1, 1);
    private bool cacheChangePending;
    public async Task<IReadOnlyList<JsonElement>> ReadSessionsAsync(
        CancellationToken cancellationToken
    )
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            return await ReadSessionsCoreAsync(cancellationToken);
        }
        finally
        {
            stateLock.Release();
        }
    }

    private async Task<IReadOnlyList<JsonElement>> ReadSessionsCoreAsync(
        CancellationToken cancellationToken
    )
    {
        var sessionFile = Path.Combine(options.StateRoot, "sessions.json");
        if (!File.Exists(sessionFile)
            && !File.Exists($"{sessionFile}.bak")
            && !File.Exists($"{sessionFile}.bak2"))
        {
            return Array.Empty<JsonElement>();
        }

        var json = File.Exists(sessionFile)
            ? await File.ReadAllTextAsync(sessionFile, cancellationToken)
            : "";
        var recoveredFromBackup = false;
        JsonDocument document;
        try
        {
            document = ParseSessionArray(json);
        }
        catch (JsonException)
        {
            await QuarantineAsync("sessions-file", json, cancellationToken);
            var backupFile = $"{sessionFile}.bak";
            if (!File.Exists(backupFile)) backupFile = $"{sessionFile}.bak2";
            if (!File.Exists(backupFile)) return Array.Empty<JsonElement>();
            var backupJson = await File.ReadAllTextAsync(backupFile, cancellationToken);
            try
            {
                document = ParseSessionArray(backupJson);
                json = backupJson;
                recoveredFromBackup = true;
            }
            catch (JsonException)
            {
                await QuarantineAsync("sessions-backup", backupJson, cancellationToken);
                var secondBackupFile = $"{sessionFile}.bak2";
                if (!File.Exists(secondBackupFile)) return Array.Empty<JsonElement>();
                var secondBackupJson = await File.ReadAllTextAsync(
                    secondBackupFile,
                    cancellationToken
                );
                try
                {
                    document = ParseSessionArray(secondBackupJson);
                    json = secondBackupJson;
                    recoveredFromBackup = true;
                }
                catch (JsonException)
                {
                    await QuarantineAsync(
                        "sessions-backup2",
                        secondBackupJson,
                        cancellationToken
                    );
                    // Preserve corrupt records in quarantine and keep the service
                    // available for diagnostics/new work instead of a crash loop.
                    return Array.Empty<JsonElement>();
                }
            }
        }
        using (document)
        {
        var valid = new List<JsonElement>();
        var invalidIndex = 0;
        var foundInvalidSession = false;
        foreach (var item in document.RootElement.EnumerateArray())
        {
            if (IsSessionObject(item) && IsReadableSession(item))
            {
                valid.Add(item.Clone());
                continue;
            }
            await QuarantineAsync(
                $"session-{invalidIndex++}",
                item.GetRawText(),
                cancellationToken
            );
            foundInvalidSession = true;
        }
        if (recoveredFromBackup || foundInvalidSession)
        {
            await WriteSessionsAsync(valid, cancellationToken);
        }
        return valid;
        }
    }

    public async Task UpsertSessionAsync(
        DesktopAgentSession session,
        CancellationToken cancellationToken
    )
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            if (cacheChangePending) throw CacheChangePending();
            var sessions = await ReadSessionsCoreAsync(cancellationToken);
            var replacement = JsonSerializer.SerializeToElement(session, JsonOptions);
            var next = sessions
                .Where(item => ReadSessionId(item) != session.SessionId)
                .Append(replacement)
                .ToArray();
            await WriteSessionsAsync(next, cancellationToken);
        }
        finally
        {
            stateLock.Release();
        }
    }

    public async Task BeginCacheChangeAsync(CancellationToken cancellationToken, bool requireIdle = true)
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            if (cacheChangePending) throw CacheChangePending();
            if (requireIdle && (await ReadSessionsCoreAsync(cancellationToken)).Count != 0)
                throw new DesktopAgentRuntimeException("CACHE_CHANGE_REQUIRES_IDLE",
                    "Close local working files and wait for synchronization to finish before changing the cache location. The current location has not changed.",
                    StatusCodes.Status409Conflict);
            cacheChangePending = true;
        }
        finally { stateLock.Release(); }
    }

    public async Task WithUntrackedCacheFileAsync(string path, Action action, CancellationToken cancellationToken)
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            if (cacheChangePending) throw CacheChangePending();
            var sessions = await ReadSessionsCoreAsync(cancellationToken);
            var diagnostics = ReadDiagnostics();
            var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            var protectedFile = sessions.Any(session => new[] { "localPath", "snapshotPath" }.Any(field =>
                ReadString(session, field) is { } value && Path.GetFullPath(value).Equals(Path.GetFullPath(path), comparison)));
            if (protectedFile || diagnostics.QuarantineCount != 0 || diagnostics.RestoreState != "READY")
                throw new DesktopAgentRuntimeException("CACHE_FILE_PROTECTED", "The cache file is in use or required for recovery. No file was deleted.", 409);
            action();
        }
        finally { stateLock.Release(); }
    }

    public async Task CancelCacheChangeAsync()
    {
        await stateLock.WaitAsync();
        try { cacheChangePending = false; }
        finally { stateLock.Release(); }
    }

    public async Task WithReservedCacheChangeAsync(Func<IReadOnlyList<JsonElement>, Task> action, CancellationToken cancellationToken)
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            if (!cacheChangePending) throw CacheChangePending();
            await action(await ReadSessionsCoreAsync(cancellationToken));
        }
        finally { stateLock.Release(); }
    }

    private static DesktopAgentRuntimeException CacheChangePending() => new(
        "CACHE_CHANGE_IN_PROGRESS",
        "The local service is applying a cache setting. Please retry opening the file after it restarts; existing work is preserved.",
        StatusCodes.Status409Conflict);

    public async Task<JsonElement?> ReadSessionAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        var sessions = await ReadSessionsAsync(cancellationToken);
        var session = sessions.FirstOrDefault(item => ReadSessionId(item) == sessionId);
        return session.ValueKind == JsonValueKind.Undefined ? null : session;
    }

    public async Task<bool> HasActiveMasterSessionAsync(
        DesktopAgentMasterIdentity identity,
        CancellationToken cancellationToken
    )
    {
        var sessions = await ReadSessionsAsync(cancellationToken);
        return sessions.Any(session =>
            ReadString(session, "mode") == "MASTER"
            && ReadString(session, "projectId") == identity.ProjectId
            && ReadString(session, "attachmentId") == identity.AttachmentId
            && ReadString(session, "lockSessionId") == identity.LockSessionId
            && IsActiveSession(session)
        );
    }

    public async Task<JsonElement?> MutateSessionAsync(
        string sessionId,
        DesktopAgentSessionMutation mutation,
        CancellationToken cancellationToken
    )
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            var sessions = (await ReadSessionsCoreAsync(cancellationToken)).ToArray();
            var index = Array.FindIndex(
                sessions,
                session => ReadSessionId(session) == sessionId
            );
            if (index < 0)
            {
                return null;
            }
            var node = JsonNode.Parse(sessions[index].GetRawText())!.AsObject();
            if (!mutation.Predicate(node))
            {
                return null;
            }
            mutation.Apply(node);
            node["lastSeenAt"] = DateTime.UtcNow.ToString("O");
            sessions[index] = JsonSerializer.SerializeToElement(node, JsonOptions);
            await WriteSessionsAsync(sessions, cancellationToken);
            return sessions[index];
        }
        finally
        {
            stateLock.Release();
        }
    }

    public async Task<JsonElement?> RemoveSessionAsync(
        string sessionId,
        Func<JsonObject, bool> predicate,
        CancellationToken cancellationToken
    )
    {
        await stateLock.WaitAsync(cancellationToken);
        try
        {
            var sessions = (await ReadSessionsCoreAsync(cancellationToken)).ToList();
            var index = sessions.FindIndex(session => ReadSessionId(session) == sessionId);
            if (index < 0)
            {
                return null;
            }
            var removed = sessions[index];
            var node = JsonNode.Parse(removed.GetRawText())!.AsObject();
            if (!predicate(node))
            {
                return null;
            }
            sessions.RemoveAt(index);
            await WriteSessionsAsync(sessions, cancellationToken);
            return removed;
        }
        finally
        {
            stateLock.Release();
        }
    }

    public async Task<IReadOnlyList<DesktopAgentRecentSession>> ReadRecentSessionsAsync(
        CancellationToken cancellationToken
    )
    {
        await recentStateLock.WaitAsync(cancellationToken);
        try
        {
            return await ReadRecentSessionsCoreAsync(cancellationToken);
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or JsonException
        )
        {
            return Array.Empty<DesktopAgentRecentSession>();
        }
        finally
        {
            recentStateLock.Release();
        }
    }

    public async Task<bool> TryRecordRecentSessionAsync(
        JsonObject session,
        CancellationToken cancellationToken
    )
    {
        var projectId = ReadString(session, "projectId");
        var attachmentId = ReadString(session, "attachmentId");
        var fileName = ReadString(session, "fileName");
        var mode = ReadString(session, "mode");
        var openedAt = ReadString(session, "openedAt");
        if (
            ReadString(session, "openObservedAt") is null
            || string.IsNullOrWhiteSpace(projectId)
            || string.IsNullOrWhiteSpace(attachmentId)
            || string.IsNullOrWhiteSpace(fileName)
            || mode is not ("MASTER" or "READ_ONLY")
            || !IsTimestamp(openedAt)
        )
        {
            return false;
        }

        var recent = new DesktopAgentRecentSession(
            projectId,
            attachmentId,
            fileName,
            mode,
            openedAt!,
            ReadString(session, "closeDetectedAt") ?? DateTime.UtcNow.ToString("O")
        );
        await recentStateLock.WaitAsync(cancellationToken);
        try
        {
            var current = await ReadRecentSessionsCoreAsync(cancellationToken);
            var next = current
                .Where(item =>
                    item.ProjectId != recent.ProjectId
                    || item.AttachmentId != recent.AttachmentId
                )
                .Append(recent)
                .OrderByDescending(item => ParseTimestamp(item.OpenedAt))
                .Take(5)
                .ToArray();
            await WriteRecentSessionsAsync(next, cancellationToken);
            return true;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or JsonException
        )
        {
            return false;
        }
        finally
        {
            recentStateLock.Release();
        }
    }

    private async Task<IReadOnlyList<DesktopAgentRecentSession>> ReadRecentSessionsCoreAsync(
        CancellationToken cancellationToken
    )
    {
        var recentFile = Path.Combine(options.StateRoot, "recent-sessions.json");
        if (!File.Exists(recentFile))
        {
            return Array.Empty<DesktopAgentRecentSession>();
        }

        JsonDocument? document = null;
        var recoveredFromBackup = false;
        foreach (var candidate in new[] { recentFile, $"{recentFile}.bak" })
        {
            if (!File.Exists(candidate)) continue;
            var json = await File.ReadAllTextAsync(candidate, cancellationToken);
            try
            {
                document = ParseSessionArray(json);
                recoveredFromBackup = candidate != recentFile;
                break;
            }
            catch (JsonException)
            {
                await TryQuarantineRecentAsync(
                    candidate == recentFile ? "recent-sessions-file" : "recent-sessions-backup",
                    json,
                    cancellationToken
                );
            }
        }
        if (document is null)
        {
            await WriteRecentSessionsAsync(
                Array.Empty<DesktopAgentRecentSession>(),
                cancellationToken
            );
            return Array.Empty<DesktopAgentRecentSession>();
        }

        using (document)
        {
            var valid = new List<DesktopAgentRecentSession>();
            var invalidIndex = 0;
            foreach (var item in document.RootElement.EnumerateArray())
            {
                DesktopAgentRecentSession? recent = null;
                try
                {
                    recent = item.Deserialize<DesktopAgentRecentSession>(JsonOptions);
                }
                catch (JsonException)
                {
                    // The malformed entry is quarantined below.
                }
                if (recent is not null && IsValidRecentSession(recent))
                {
                    valid.Add(recent);
                    continue;
                }
                await TryQuarantineRecentAsync(
                    $"recent-session-{invalidIndex++}",
                    item.GetRawText(),
                    cancellationToken
                );
            }

            var normalized = valid
                .GroupBy(item => (item.ProjectId, item.AttachmentId))
                .Select(group => group.MaxBy(item => ParseTimestamp(item.OpenedAt))!)
                .OrderByDescending(item => ParseTimestamp(item.OpenedAt))
                .Take(5)
                .ToArray();
            if (recoveredFromBackup || invalidIndex > 0 || normalized.Length != valid.Count)
            {
                await WriteRecentSessionsAsync(normalized, cancellationToken);
            }
            return normalized;
        }
    }

    private async Task WriteRecentSessionsAsync(
        IReadOnlyList<DesktopAgentRecentSession> sessions,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(options.StateRoot);
        var recentFile = Path.Combine(options.StateRoot, "recent-sessions.json");
        var temporaryFile = $"{recentFile}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        try
        {
            var json = JsonSerializer.Serialize(sessions, JsonOptions);
            await using (var stream = new FileStream(
                temporaryFile,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                16 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough
            ))
            await using (var writer = new StreamWriter(stream))
            {
                await writer.WriteAsync(json.AsMemory(), cancellationToken);
                await writer.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(recentFile) && IsValidJsonArrayFile(recentFile))
            {
                File.Copy(recentFile, $"{recentFile}.bak", overwrite: true);
            }
            File.Move(temporaryFile, recentFile, overwrite: true);
        }
        catch
        {
            TryDeleteFile(temporaryFile);
            throw;
        }
    }

    private async Task TryQuarantineRecentAsync(
        string label,
        string contents,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var root = Path.Combine(options.StateRoot, "recent-history-quarantine");
            Directory.CreateDirectory(root);
            var hash = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes($"{label}\n{contents}"))
            ).ToLowerInvariant();
            var path = Path.Combine(root, $"{label}-{hash}.json");
            await File.WriteAllTextAsync(path, contents, cancellationToken);
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            // Recent history is non-critical and must not block active sessions.
        }
    }

    private static bool IsValidRecentSession(DesktopAgentRecentSession session)
    {
        return !string.IsNullOrWhiteSpace(session.ProjectId)
            && !string.IsNullOrWhiteSpace(session.AttachmentId)
            && !string.IsNullOrWhiteSpace(session.FileName)
            && session.Mode is "MASTER" or "READ_ONLY"
            && IsTimestamp(session.OpenedAt)
            && IsTimestamp(session.ClosedAt);
    }

    private static bool IsTimestamp(string? value)
    {
        return DateTimeOffset.TryParse(value, out _);
    }

    private static DateTimeOffset ParseTimestamp(string value)
    {
        return DateTimeOffset.Parse(value);
    }

    private static bool IsSessionObject(JsonElement value)
    {
        return value.ValueKind == JsonValueKind.Object
            && HasString(value, "sessionId")
            && HasString(value, "mode")
            && HasString(value, "projectId")
            && HasString(value, "attachmentId")
            && HasString(value, "fileName")
            && HasString(value, "localPath")
            && HasString(value, "status");
    }

    private static bool HasString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(property.GetString());
    }

    private static bool IsReadableSession(JsonElement value)
    {
        try
        {
            if (
                value.TryGetProperty("schemaVersion", out var schemaVersion)
                && (
                    schemaVersion.ValueKind != JsonValueKind.Number
                    || !schemaVersion.TryGetInt32(out var version)
                    || version != 1
                )
            )
            {
                return false;
            }
            _ = DesktopAgentSyncSession.From(value);
            return true;
        }
        catch (DesktopAgentRuntimeException)
        {
            return false;
        }
    }

    private async Task WriteSessionsAsync(
        IReadOnlyList<JsonElement> sessions,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(options.StateRoot);
        var sessionFile = Path.Combine(options.StateRoot, "sessions.json");
        var temporaryFile = $"{sessionFile}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        try
        {
            var json = JsonSerializer.Serialize(sessions, JsonOptions);
            await using (var stream = new FileStream(
                temporaryFile,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                64 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough
            ))
            await using (var writer = new StreamWriter(stream))
            {
                await writer.WriteAsync(json.AsMemory(), cancellationToken);
                await writer.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(sessionFile) && IsValidJsonArrayFile(sessionFile))
            {
                var backupFile = $"{sessionFile}.bak";
                if (File.Exists(backupFile) && IsValidJsonArrayFile(backupFile))
                {
                    File.Copy(backupFile, $"{sessionFile}.bak2", overwrite: true);
                }
                File.Copy(sessionFile, $"{sessionFile}.bak", overwrite: true);
            }
            File.Move(temporaryFile, sessionFile, overwrite: true);
        }
        catch
        {
            TryDeleteFile(temporaryFile);
            throw;
        }
    }

    private async Task QuarantineAsync(
        string label,
        string contents,
        CancellationToken cancellationToken
    )
    {
        var root = Path.Combine(options.StateRoot, "session-quarantine");
        Directory.CreateDirectory(root);
        var hash = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes($"{label}\n{contents}"))
        ).ToLowerInvariant();
        var path = Path.Combine(
            root,
            $"{label}-{hash}.json"
        );
        try
        {
            await using var stream = new FileStream(
                path,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.Read,
                16 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough
            );
            await using var writer = new StreamWriter(stream);
            await writer.WriteAsync(contents.AsMemory(), cancellationToken);
            await writer.FlushAsync(cancellationToken);
            stream.Flush(flushToDisk: true);
        }
        catch (IOException) when (File.Exists(path))
        {
            // Content-addressed quarantine entries are intentionally idempotent.
        }
    }

    public DesktopAgentStateDiagnostics ReadDiagnostics()
    {
        var root = Path.Combine(options.StateRoot, "session-quarantine");
        if (!Directory.Exists(root))
        {
            return new DesktopAgentStateDiagnostics(0, "READY");
        }
        try
        {
            var count = Directory.EnumerateFiles(root, "*.json").Count();
            return new DesktopAgentStateDiagnostics(
                count,
                count > 0 ? "READY_WITH_ATTENTION" : "READY"
            );
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            return new DesktopAgentStateDiagnostics(0, "DEGRADED_NEEDS_ATTENTION");
        }
    }

    private static bool IsValidJsonArrayFile(string path)
    {
        try
        {
            using var document = JsonDocument.Parse(
                StripUtf8Bom(File.ReadAllText(path))
            );
            return document.RootElement.ValueKind == JsonValueKind.Array;
        }
        catch (Exception error) when (error is IOException or JsonException)
        {
            return false;
        }
    }

    private static JsonDocument ParseSessionArray(string json)
    {
        var document = JsonDocument.Parse(StripUtf8Bom(json));
        if (document.RootElement.ValueKind == JsonValueKind.Array)
        {
            return document;
        }
        document.Dispose();
        throw new JsonException("Desktop Agent session store root is not an array.");
    }

    private static string? ReadSessionId(JsonElement session)
    {
        return session.TryGetProperty("sessionId", out var value)
            ? value.GetString()
            : null;
    }

    private static string? ReadString(JsonElement session, string name)
    {
        return session.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static string? ReadString(JsonObject session, string name)
    {
        return session[name]?.GetValue<string>();
    }

    private static bool IsActiveSession(JsonElement session)
    {
        return ReadString(session, "lifecycleState") is not (
            "CLOSED"
            or "LOCAL_FILE_MISSING"
            or "LOCK_REVOKED"
            or "CLEANUP_PENDING"
            or "CLEANUP_FAILED"
        );
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            // Preserve the original session persistence error.
        }
    }

    private static string StripUtf8Bom(string value)
    {
        return value.Length > 0 && value[0] == '\uFEFF' ? value[1..] : value;
    }

}

public sealed record DesktopAgentSessionMutation(
    Func<JsonObject, bool> Predicate,
    Action<JsonObject> Apply
);

public sealed record DesktopAgentMasterIdentity(
    string ProjectId,
    string AttachmentId,
    string LockSessionId
);

public sealed record DesktopAgentStateDiagnostics(
    int QuarantineCount,
    string RestoreState
);
