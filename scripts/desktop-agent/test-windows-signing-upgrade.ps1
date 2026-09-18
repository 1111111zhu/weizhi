param(
  [string] $SignToolPath = $env:PROJECT_WING_WINDOWS_SIGNTOOL_PATH,
  [string] $OpenSslPath = "",
  [switch] $KeepArtifacts
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$signingScript = Join-Path $scriptRoot "sign-windows-artifacts.ps1"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
  "projectwing-signing-smoke-{0}" -f [Guid]::NewGuid().ToString("N")
)
$certificatePassword = "ProjectWing-Smoke-{0}" -f [Guid]::NewGuid().ToString("N")
$signingCertificate = $null
$privateMaterialPaths = [System.Collections.Generic.List[string]]::new()

function Assert-LastCommand([string] $Label) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

function Build-Fixture([string] $Version, [string] $Destination) {
  $projectRoot = Join-Path $testRoot "fixture"
  $publishRoot = Join-Path $testRoot "publish-$Version"
  dotnet publish (Join-Path $projectRoot "SigningFixture.csproj") `
    -c Release `
    -r win-x64 `
    --self-contained false `
    /p:Version=$Version `
    /p:AssemblyVersion="$Version.0" `
    -o $publishRoot
  Assert-LastCommand "Signing fixture $Version build"
  Copy-Item `
    -LiteralPath (Join-Path $publishRoot "ProjectWingSigningFixture.exe") `
    -Destination $Destination `
    -Force
}

function Assert-ExpectedFailure([scriptblock] $Action, [string] $Label) {
  $failed = $false
  try {
    & $Action
  }
  catch {
    $failed = $true
  }
  if (-not $failed) {
    throw "$Label unexpectedly succeeded."
  }
}

function Remove-PrivateMaterial {
  foreach ($privateMaterialPath in $privateMaterialPaths) {
    Remove-Item -LiteralPath $privateMaterialPath -Force -ErrorAction SilentlyContinue
  }
}

function Resolve-OpenSsl([string] $RequestedPath) {
  if ($RequestedPath -and (Test-Path -LiteralPath $RequestedPath -PathType Leaf)) {
    return (Resolve-Path -LiteralPath $RequestedPath).Path
  }
  $command = Get-Command openssl.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  foreach ($candidate in @(
    "C:\Program Files\Git\mingw64\bin\openssl.exe",
    "C:\Program Files\Git\usr\bin\openssl.exe"
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return $candidate
    }
  }
  throw "OpenSSL was not found. Set -OpenSslPath for the local signing smoke test."
}

function Invoke-OpenSsl(
  [string] $Executable,
  [string[]] $Arguments,
  [string] $Label
) {
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Executable
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true
  foreach ($argument in $Arguments) {
    $escaped = '"' + ($argument -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
    $startInfo.Arguments += if ($startInfo.Arguments) { " $escaped" } else { $escaped }
  }
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw "$Label failed to start."
  }
  $standardOutput = $process.StandardOutput.ReadToEnd()
  $standardError = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    $details = @($standardOutput, $standardError) |
      Where-Object { $_ } |
      ForEach-Object { $_.Trim() }
    throw "$Label failed: $($details -join [Environment]::NewLine)"
  }
  $process.Dispose()
}

try {
  Write-Host "Creating temporary signing fixtures..."
  New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
  $fixtureRoot = Join-Path $testRoot "fixture"
  New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
  @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <AssemblyName>ProjectWingSigningFixture</AssemblyName>
  </PropertyGroup>
</Project>
'@ | Set-Content -LiteralPath (Join-Path $fixtureRoot "SigningFixture.csproj") -Encoding utf8
  @'
using System;
using System.Reflection;

Console.WriteLine(Assembly.GetExecutingAssembly().GetName().Version);
'@ | Set-Content -LiteralPath (Join-Path $fixtureRoot "Program.cs") -Encoding utf8

  $openssl = Resolve-OpenSsl $OpenSslPath
  $leafPem = Join-Path $testRoot "local-signing.pem"
  $leafKey = Join-Path $testRoot "local-signing.key"
  $pfxPath = Join-Path $testRoot "local-signing.pfx"
  $privateMaterialPaths.Add($leafKey)
  $privateMaterialPaths.Add($pfxPath)
  Invoke-OpenSsl $openssl @(
    "req", "-x509", "-newkey", "rsa:3072", "-nodes",
    "-keyout", $leafKey,
    "-out", $leafPem,
    "-days", "1",
    "-sha256",
    "-subj", "/CN=Project Wing Local Signing Test",
    "-addext", "basicConstraints=critical,CA:FALSE",
    "-addext", "keyUsage=critical,digitalSignature",
    "-addext", "extendedKeyUsage=critical,codeSigning"
  ) "Local self-signed code signing certificate generation"
  Invoke-OpenSsl $openssl @(
    "pkcs12", "-export",
    "-out", $pfxPath,
    "-inkey", $leafKey,
    "-in", $leafPem,
    "-passout", "pass:$certificatePassword"
  ) "Local code signing PFX generation"
  $signingCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $pfxPath,
    $certificatePassword,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
  )
  $oldInstaller = Join-Path $testRoot "desktop-agent-win-x64-0.2.6.exe"
  $newInstaller = Join-Path $testRoot "desktop-agent-win-x64-0.2.7.exe"
  Build-Fixture "0.2.6" $oldInstaller
  Build-Fixture "0.2.7" $newInstaller
  Write-Host "Verifying unsigned installer rejection..."
  Assert-ExpectedFailure {
    & $signingScript `
      -Path @($oldInstaller) `
      -SignToolPath $SignToolPath `
      -VerifyOnly `
      -AllowUntrustedRoot
  } "Untrusted-root production verification"
  Assert-ExpectedFailure {
    & $signingScript `
      -Path @($oldInstaller) `
      -SignToolPath $SignToolPath `
      -VerifyOnly `
      -SkipTimestamp `
      -AllowUntrustedRoot
  } "Unsigned installer verification"

  $env:PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD = $certificatePassword
  $env:PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT = $signingCertificate.Subject
  $env:PROJECT_WING_WINDOWS_SIGNING_SMOKE_TEST = "true"
  Write-Host "Signing and verifying fixture releases..."
  $signatureReportPath = Join-Path $testRoot "signatures.json"
  & $signingScript `
    -Path @($oldInstaller, $newInstaller) `
    -PfxPath $pfxPath `
    -SignToolPath $SignToolPath `
    -SkipTimestamp `
    -AllowUntrustedRoot `
    -ReportPath $signatureReportPath
  Assert-LastCommand "Local Authenticode signing smoke test"
  $signatureReport = Get-Content -LiteralPath $signatureReportPath -Raw |
    ConvertFrom-Json
  if (
    @($signatureReport.files).Count -ne 2 -or
    @(
      $signatureReport.files |
        Where-Object status -notin @("Valid", "UntrustedRootTestOnly")
    ).Count -gt 0
  ) {
    throw "The signing report did not contain two valid fixture signatures."
  }
  Remove-PrivateMaterial
  Write-Host "Verifying publisher mismatch rejection..."
  Assert-ExpectedFailure {
    & $signingScript `
      -Path @($newInstaller) `
      -ExpectedSubject "CN=Unexpected Publisher" `
      -SignToolPath $SignToolPath `
      -VerifyOnly `
      -SkipTimestamp `
      -AllowUntrustedRoot
  } "Unexpected publisher verification"
  Write-Host "Verifying tampered installer rejection..."
  $tamperedInstaller = Join-Path $testRoot "desktop-agent-win-x64-tampered.exe"
  Copy-Item -LiteralPath $newInstaller -Destination $tamperedInstaller
  $tamperedBytes = [System.IO.File]::ReadAllBytes($tamperedInstaller)
  $tamperedBytes[512] = $tamperedBytes[512] -bxor 0x01
  [System.IO.File]::WriteAllBytes($tamperedInstaller, $tamperedBytes)
  Assert-ExpectedFailure {
    & $signingScript `
      -Path @($tamperedInstaller) `
      -ExpectedSubject $signingCertificate.Subject `
      -SignToolPath $SignToolPath `
      -VerifyOnly `
      -SkipTimestamp `
      -AllowUntrustedRoot
  } "Tampered installer verification"

  Write-Host "Simulating state-preserving signed upgrade..."
  $installationRoot = Join-Path $testRoot "installed"
  New-Item -ItemType Directory -Path $installationRoot -Force | Out-Null
  $installedExecutable = Join-Path $installationRoot "ProjectWingDesktopAgent.exe"
  $statePath = Join-Path $installationRoot "device-state.json"
  Copy-Item -LiteralPath $oldInstaller -Destination $installedExecutable
  '{"deviceToken":"preserved-test-token","cacheRoot":"preserved-cache"}' |
    Set-Content -LiteralPath $statePath -Encoding utf8
  $stateHashBefore = (Get-FileHash -LiteralPath $statePath -Algorithm SHA256).Hash

  $stagingPath = Join-Path $installationRoot "ProjectWingDesktopAgent.next.exe"
  Copy-Item -LiteralPath $newInstaller -Destination $stagingPath
  & $signingScript `
    -Path @($stagingPath) `
    -CertificateThumbprint $signingCertificate.Thumbprint `
    -ExpectedSubject $signingCertificate.Subject `
    -SignToolPath $SignToolPath `
    -VerifyOnly `
    -SkipTimestamp `
    -AllowUntrustedRoot
  Assert-LastCommand "Staged update signature verification"
  Move-Item -LiteralPath $stagingPath -Destination $installedExecutable -Force

  $stateHashAfter = (Get-FileHash -LiteralPath $statePath -Algorithm SHA256).Hash
  if ($stateHashBefore -ne $stateHashAfter) {
    throw "The simulated upgrade changed preserved Desktop Agent state."
  }
  $installedSignature = Get-AuthenticodeSignature -LiteralPath $installedExecutable
  if (-not $installedSignature.SignerCertificate) {
    throw "The simulated upgraded executable does not have an Authenticode signer."
  }
  [ordered]@{
    ok = $true
    fromVersion = "0.2.6"
    toVersion = "0.2.7"
    signerSubject = $installedSignature.SignerCertificate.Subject
    signerThumbprint = $installedSignature.SignerCertificate.Thumbprint
    statePreserved = $true
    timestampBypassedForLocalTest = $true
    artifactRoot = if ($KeepArtifacts) { $testRoot } else { $null }
  } | ConvertTo-Json -Depth 3
}
finally {
  Remove-Item Env:\PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:\PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT -ErrorAction SilentlyContinue
  Remove-Item Env:\PROJECT_WING_WINDOWS_SIGNING_SMOKE_TEST -ErrorAction SilentlyContinue
  if ($signingCertificate) {
    $signingCertificate.Dispose()
  }
  Remove-PrivateMaterial
  if (-not $KeepArtifacts) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
