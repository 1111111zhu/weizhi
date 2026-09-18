using System.Diagnostics;
using System.Globalization;

namespace ProjectWing.NativeRuntime;

// Linux Process.StartTime is translated through a per-process boot-time estimate.
// Compare the kernel's boot-relative generation directly, never approximate UTC
// values or a tolerance that could accept a recycled PID.
internal static class ProcessGenerationIdentity
{
    public static string CaptureCurrent()
    {
        using var current = Process.GetCurrentProcess();
        return Capture(current);
    }

    public static string Capture(Process process)
    {
        if (process.HasExited) throw new InvalidOperationException("Process generation has exited.");
        var pid = process.Id;
        var identity = OperatingSystem.IsLinux()
            ? FromLinuxStat(pid, File.ReadAllText($"/proc/{pid}/stat"), File.ReadAllText("/proc/sys/kernel/random/boot_id"))
            : FromStartTime(pid, process.StartTime.ToUniversalTime().Ticks);
        if (process.HasExited) throw new InvalidOperationException("Process generation exited while being identified.");
        return identity;
    }

    public static string FromStartTime(int pid, long ticks)
    {
        if (pid <= 0 || ticks <= 0) throw new InvalidDataException("Invalid process creation identity.");
        return FormattableString.Invariant($"utc:{pid}:{ticks}");
    }

    public static string FromLinuxStat(int pid, string stat, string bootId)
    {
        var open = stat.IndexOf('(');
        var close = stat.LastIndexOf(')'); // comm may itself contain spaces and ')'.
        if (pid <= 0 || open < 1 || close <= open
            || !int.TryParse(stat.AsSpan(0, open).Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var recordedPid)
            || recordedPid != pid || !Guid.TryParse(bootId.Trim(), out var boot))
            throw new InvalidDataException("Invalid Linux process identity record.");
        // The suffix starts at field 3 (state). Kernel starttime is field 22.
        var fields = stat[(close + 1)..].Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        if (fields.Length < 20 || !ulong.TryParse(fields[19], NumberStyles.None, CultureInfo.InvariantCulture, out var started))
            throw new InvalidDataException("Linux process start counter is missing or invalid.");
        return FormattableString.Invariant($"linux:{boot:D}:{pid}:{started}");
    }

    public static bool IsSupported(string identity, int pid)
    {
        var parts = identity.Split(':');
        if (OperatingSystem.IsLinux())
            return parts.Length == 4 && parts[0] == "linux" && Guid.TryParseExact(parts[1], "D", out _)
                && int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var value) && value == pid && pid > 0
                && ulong.TryParse(parts[3], NumberStyles.None, CultureInfo.InvariantCulture, out _);
        return parts.Length == 3 && parts[0] == "utc"
            && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var processId) && processId == pid && pid > 0
            && long.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks) && ticks > 0;
    }
}
