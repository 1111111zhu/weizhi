# Desktop Agent Windows release trust

ProjectWing supports two Windows release policies:

- `optional`: permits a genuinely unsigned installer after HTTPS origin, file size, and SHA-256 verification.
- `required`: additionally requires a valid Authenticode signature and publisher continuity.

Current automated releases use `optional` until the enterprise signing certificate is available. Invalid, corrupt, or unexpectedly untrusted signatures are rejected in both modes; `optional` only relaxes the specific Windows `TRUST_E_NOSIGNATURE` result.

Unsigned compatibility begins with Desktop Agent `0.2.10`. Older agents cannot safely consume the new policy and must run the repair installer once before they can self-update from an unsigned release.

## Enabling enterprise signing

When enterprise signing is enabled, the release installer and every ProjectWing-owned executable inside its payload are signed by the same enterprise code-signing certificate.

## Certificate requirements

The signing certificate must:

- contain an RSA private key;
- include the Code Signing EKU (`1.3.6.1.5.5.7.3.3`);
- be valid for the intended release period;
- chain to the company private root certificate;
- use the exact subject configured in CI.

The private enterprise root certificate must be distributed to `LocalMachine\Root` on employee Windows devices through company-managed deployment such as Group Policy or Intune. The Desktop Agent installer does not silently add a trust root.

## GitHub configuration

Configure these repository or environment secrets:

- `DESKTOP_AGENT_WINDOWS_SIGNING_PFX_BASE64`
- `DESKTOP_AGENT_WINDOWS_SIGNING_PFX_PASSWORD`
- `DESKTOP_AGENT_WINDOWS_SIGNING_ROOT_CERT_BASE64`

Configure these repository or environment variables:

- `DESKTOP_AGENT_WINDOWS_SIGNING_EXPECTED_SUBJECT`
- `DESKTOP_AGENT_WINDOWS_SIGNING_TIMESTAMP_URL`

Encode certificate files without line breaks:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("company-desktop-agent-signing.pfx")
)

[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("company-private-root.cer")
)
```

Do not print the resulting values in CI logs. Store the PFX password only in the secret store.

Run the workflow manually with `sign_windows=true` to require signing. In this mode, a missing value, invalid certificate, publisher mismatch, or timestamp failure stops the Windows release before it is uploaded. With `sign_windows=false`, the workflow publishes an unsigned installer with `signaturePolicy: optional`.

The build reads PFX policy information with an ephemeral key and passes the PFX directly to SignTool. It does not import the private key into the Windows certificate store. Signing variables are removed from the environment while dependencies and binaries are compiled, then restored only for the two signing operations.

## Azure fallback

The GitHub workflow forwards the same values to the Azure pipeline as secret runtime variables. The Azure pipeline invokes the same repository build and signing scripts, so GitHub and Azure builds produce equivalent signed installers.

Signed Windows OCI release assets contain both the installer and its signing report. A signed publish-only retry verifies that the report is timestamped, has `Valid` status, identifies the expected publisher, and matches the installer's file name and SHA-256. Unsigned assets omit the signing report and carry an explicit `optional` signature-policy annotation.

## Local signing

Local builds can use a PFX:

```powershell
$env:PROJECT_WING_WINDOWS_SIGNING_PFX_PATH = "C:\secure\agent-signing.pfx"
$env:PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD = "<secret>"
$env:PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_PATH = "C:\secure\company-root.cer"
$env:PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT = "CN=<company subject>"
$env:PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL = "https://<timestamp-service>"
$env:PROJECT_WING_WINDOWS_SIGNING_REQUIRED = "true"

pwsh -File scripts/desktop-agent/build-windows-installer.ps1 -Version 0.2.8
```

Alternatively, set `PROJECT_WING_WINDOWS_SIGNING_CERTIFICATE_THUMBPRINT` for a certificate already available with its private key in `CurrentUser\My`.

## Local smoke test

The smoke test creates a temporary self-signed Code Signing certificate, signs two fixture versions, verifies the embedded Authenticode signer and publisher identity, simulates a `0.2.6` to `0.2.7` replacement, and confirms local state remains unchanged:

```powershell
pwsh -File scripts/desktop-agent/test-windows-signing-upgrade.ps1
```

The test does not modify the local Windows trust store. It explicitly tolerates only the temporary certificate's untrusted root and bypasses timestamping. Both exceptions are disabled in CI and signed release builds and require the smoke-test marker. Temporary private key and PFX files are removed even when other diagnostic artifacts are retained.

This validates signing, publisher pinning, rejection paths, and state-preserving replacement mechanics only. A production release using `signaturePolicy: required` still requires the company certificate, timestamp service, managed private-root deployment, and full `WinVerifyTrust` success.

## Switching to required signing

Unsigned Managers cannot establish a trusted publisher from their own binary. Users must manually install the first signed release once before required-signature self-updates can rely on publisher continuity. After that, the signed Manager pins later installers to the same signing certificate.

Before rotating the company signing certificate, ship a transition release that trusts both the current and replacement publisher certificates. A direct certificate change without that transition will be rejected by installed Managers.
