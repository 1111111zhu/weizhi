using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;

namespace ProjectWing.AgentManager;

internal static class InstallerSignatureVerifier
{
    private const int TrustENoSignature = unchecked((int)0x800B0100);

    public static void Verify(string installerPath, string signaturePolicy = "required")
    {
        if (!File.Exists(installerPath))
        {
            throw new InvalidDataException("Downloaded Desktop Agent installer is missing.");
        }
        if (OperatingSystem.IsWindows())
        {
            VerifyInstallerAuthenticode(installerPath, signaturePolicy);
            return;
        }
        if (OperatingSystem.IsMacOS())
        {
            VerifyMacPackageSignature(installerPath);
            return;
        }
        throw new PlatformNotSupportedException("Desktop Agent updates are unsupported here.");
    }

    private static void VerifyInstallerAuthenticode(
        string installerPath,
        string signaturePolicy
    )
    {
        var trustStatus = AuthenticodeVerifier.GetTrustStatus(installerPath);
        if (trustStatus == TrustENoSignature && signaturePolicy == "optional")
        {
            return;
        }
        if (trustStatus != 0)
        {
            throw new InvalidDataException(
                "Downloaded Desktop Agent installer does not have a trusted Authenticode signature."
            );
        }
        using var installerCertificate = new X509Certificate2(
            X509Certificate.CreateFromSignedFile(installerPath)
        );
        var trustedThumbprints = ReadTrustedPublisherThumbprints();
        var managerPath = Environment.ProcessPath;
        if (
            !string.IsNullOrWhiteSpace(managerPath)
            && File.Exists(managerPath)
            && AuthenticodeVerifier.GetTrustStatus(managerPath) == 0
        )
        {
            using var managerCertificate = new X509Certificate2(
                X509Certificate.CreateFromSignedFile(managerPath)
            );
            trustedThumbprints.Add(NormalizeThumbprint(managerCertificate.Thumbprint));
        }
        if (trustedThumbprints.Count == 0)
        {
            if (signaturePolicy == "optional")
            {
                return;
            }
            throw new InvalidDataException(
                "No trusted Desktop Agent publisher is configured and the installed Manager is unsigned."
            );
        }
        if (!trustedThumbprints.Contains(NormalizeThumbprint(installerCertificate.Thumbprint)))
        {
            throw new InvalidDataException(
                "Downloaded Desktop Agent installer was signed by an unexpected publisher certificate."
            );
        }
    }

    private static void VerifyMacPackageSignature(string installerPath)
    {
        var startInfo = new ProcessStartInfo("/usr/sbin/pkgutil")
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        startInfo.ArgumentList.Add("--check-signature");
        startInfo.ArgumentList.Add(installerPath);
        using var process = Process.Start(startInfo)
            ?? throw new InvalidDataException("Could not verify the macOS package signature.");
        var output = process.StandardOutput.ReadToEnd() + process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0)
        {
            throw new InvalidDataException("Downloaded Desktop Agent package is not signed.");
        }
        var trustedSigners = (
            Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_TRUSTED_MACOS_SIGNERS")
            ?? string.Empty
        ).Split(
            [',', ';'],
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
        );
        if (
            trustedSigners.Length > 0
            && !trustedSigners.Any(signer =>
                output.Contains(signer, StringComparison.OrdinalIgnoreCase)
            )
        )
        {
            throw new InvalidDataException(
                "Downloaded Desktop Agent package was signed by an unexpected macOS publisher."
            );
        }
    }

    private static HashSet<string> ReadTrustedPublisherThumbprints()
    {
        var configured = Environment.GetEnvironmentVariable(
            "PROJECT_WING_AGENT_TRUSTED_PUBLISHER_THUMBPRINTS"
        );
        return (configured ?? string.Empty)
            .Split(
                [',', ';'],
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
            )
            .Select(NormalizeThumbprint)
            .Where(value => value.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static string NormalizeThumbprint(string? value)
    {
        return new string(
            (value ?? string.Empty)
                .Where(character => !char.IsWhiteSpace(character))
                .ToArray()
        ).ToUpperInvariant();
    }

    private static class AuthenticodeVerifier
    {
        private static readonly Guid WinTrustActionGenericVerifyV2 = new(
            "00AAC56B-CD44-11D0-8CC2-00C04FC295EE"
        );

        public static int GetTrustStatus(string filePath)
        {
            var fileInfo = new WinTrustFileInfo(filePath);
            var pointer = Marshal.AllocHGlobal(Marshal.SizeOf<WinTrustFileInfo>());
            Marshal.StructureToPtr(fileInfo, pointer, fDeleteOld: false);
            try
            {
                var trustData = new WinTrustData(pointer);
                var action = WinTrustActionGenericVerifyV2;
                var result = WinVerifyTrust(IntPtr.Zero, ref action, ref trustData);
                trustData.StateAction = WinTrustDataStateAction.Close;
                _ = WinVerifyTrust(IntPtr.Zero, ref action, ref trustData);
                return result;
            }
            finally
            {
                Marshal.DestroyStructure<WinTrustFileInfo>(pointer);
                Marshal.FreeHGlobal(pointer);
                Marshal.FreeCoTaskMem(fileInfo.FilePath);
            }
        }

        [DllImport("wintrust.dll", ExactSpelling = true, SetLastError = true)]
        private static extern int WinVerifyTrust(
            IntPtr windowHandle,
            [MarshalAs(UnmanagedType.LPStruct)] ref Guid actionId,
            ref WinTrustData trustData
        );

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct WinTrustFileInfo(string filePath)
        {
            public uint StructSize = (uint)Marshal.SizeOf<WinTrustFileInfo>();
            public IntPtr FilePath = Marshal.StringToCoTaskMemUni(filePath);
            public IntPtr FileHandle = IntPtr.Zero;
            public IntPtr KnownSubject = IntPtr.Zero;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct WinTrustData(IntPtr fileInfoPointer)
        {
            public uint StructSize = (uint)Marshal.SizeOf<WinTrustData>();
            public IntPtr PolicyCallbackData = IntPtr.Zero;
            public IntPtr SIPClientData = IntPtr.Zero;
            public WinTrustDataUIChoice UIChoice = WinTrustDataUIChoice.None;
            public WinTrustDataRevocationChecks RevocationChecks =
                WinTrustDataRevocationChecks.WholeChain;
            public WinTrustDataChoice UnionChoice = WinTrustDataChoice.File;
            public IntPtr FileInfoPointer = fileInfoPointer;
            public WinTrustDataStateAction StateAction = WinTrustDataStateAction.Verify;
            public IntPtr StateData = IntPtr.Zero;
            public string? URLReference = null;
            public WinTrustDataProviderFlags ProviderFlags =
                WinTrustDataProviderFlags.RevocationCheckChainExcludeRoot;
            public uint UIContext = 0;
        }

        private enum WinTrustDataUIChoice : uint { None = 2 }
        private enum WinTrustDataRevocationChecks : uint { WholeChain = 1 }
        private enum WinTrustDataChoice : uint { File = 1 }
        private enum WinTrustDataStateAction : uint { Verify = 1, Close = 2 }

        [Flags]
        private enum WinTrustDataProviderFlags : uint
        {
            RevocationCheckChainExcludeRoot = 0x00000080,
        }
    }
}
