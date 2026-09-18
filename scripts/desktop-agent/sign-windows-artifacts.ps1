param(
  [Parameter(Mandatory = $true)]
  [string[]] $Path,
  [string] $PfxPath = $env:PROJECT_WING_WINDOWS_SIGNING_PFX_PATH,
  [string] $CertificateThumbprint = $env:PROJECT_WING_WINDOWS_SIGNING_CERTIFICATE_THUMBPRINT,
  [string] $ExpectedSubject = $env:PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT,
  [string] $TimestampUrl = $env:PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL,
  [string] $SignToolPath = $env:PROJECT_WING_WINDOWS_SIGNTOOL_PATH,
  [string] $ReportPath = "",
  [switch] $VerifyOnly,
  [switch] $SkipTimestamp,
  [switch] $AllowUntrustedRoot
)

$ErrorActionPreference = "Stop"
$codeSigningEku = "1.3.6.1.5.5.7.3.3"
$temporaryFiles = [System.Collections.Generic.List[string]]::new()
$importedCertificates = [System.Collections.Generic.List[string]]::new()
$certificate = $null

function Normalize-Thumbprint([string] $Value) {
  return ($Value -replace '\s', '').ToUpperInvariant()
}

function Resolve-SignTool([string] $RequestedPath) {
  if ($RequestedPath) {
    if (-not (Test-Path -LiteralPath $RequestedPath -PathType Leaf)) {
      throw "Configured signtool.exe was not found: $RequestedPath"
    }
    return (Resolve-Path -LiteralPath $RequestedPath).Path
  }
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  $sdkRoots = @(
    (Join-Path ${env:ProgramFiles(x86)} "Windows Kits/10/bin"),
    (Join-Path $env:ProgramFiles "Windows Kits/10/bin")
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
  $candidate = Get-ChildItem -Path $sdkRoots -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '[\\/]x64[\\/]signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $candidate) {
    throw "signtool.exe was not found. Install the Windows SDK or set PROJECT_WING_WINDOWS_SIGNTOOL_PATH."
  }
  return $candidate.FullName
}

function Invoke-NativeCommand(
  [string] $Executable,
  [string[]] $Arguments
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
    throw "Failed to start $Executable."
  }
  $standardOutput = $process.StandardOutput.ReadToEnd()
  $standardError = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  $result = [ordered]@{
    exitCode = $process.ExitCode
    output = @($standardOutput, $standardError) |
      Where-Object { $_ } |
      ForEach-Object { $_.Trim() }
  }
  $process.Dispose()
  return $result
}

function Write-TemporaryCertificate([string] $Base64, [string] $Extension) {
  $file = Join-Path ([System.IO.Path]::GetTempPath()) (
    "projectwing-signing-{0}.{1}" -f [Guid]::NewGuid().ToString("N"), $Extension
  )
  try {
    [System.IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($Base64))
  }
  catch {
    throw "Desktop Agent signing certificate data is not valid base64."
  }
  $temporaryFiles.Add($file)
  return $file
}

function Find-CertificateInStore([string] $StoreName, [string] $Thumbprint) {
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
    $StoreName,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
    $certificate = $store.Certificates |
      Where-Object {
        (Normalize-Thumbprint $_.Thumbprint) -eq (Normalize-Thumbprint $Thumbprint)
      } |
      Select-Object -First 1
    if ($certificate) {
      return [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
        $certificate
      )
    }
    return $null
  }
  finally {
    $store.Close()
  }
}

function Add-CertificateToStore(
  [string] $StoreName,
  [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate
) {
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
    $StoreName,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($Certificate)
  }
  finally {
    $store.Close()
  }
}

function Remove-CertificateFromStore([string] $StoreName, [string] $Thumbprint) {
  $certificate = Find-CertificateInStore $StoreName $Thumbprint
  if (-not $certificate) {
    return
  }
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
    $StoreName,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Remove($certificate)
  }
  finally {
    $store.Close()
  }
}

function Import-RootCertificate([string] $RootPath) {
  if (-not $RootPath) {
    return
  }
  if (-not (Test-Path -LiteralPath $RootPath -PathType Leaf)) {
    throw "Configured signing root certificate was not found: $RootPath"
  }
  $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    (Resolve-Path -LiteralPath $RootPath).Path
  )
  $thumbprint = Normalize-Thumbprint $certificate.Thumbprint
  if (-not (Find-CertificateInStore "Root" $thumbprint)) {
    Add-CertificateToStore "Root" $certificate
    $importedCertificates.Add("Root|$thumbprint")
  }
}

function Read-SigningCertificate([string] $FilePath) {
  if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    throw "Configured signing PFX was not found: $FilePath"
  }
  $passwordValue = $env:PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD
  if (-not $passwordValue) {
    throw "PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD is required for PFX signing."
  }
  $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $FilePath,
    $passwordValue,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
  )
  if (-not $certificate.HasPrivateKey) {
    throw "The Desktop Agent signing PFX did not contain a private key."
  }
  return $certificate
}

function Assert-CertificatePolicy(
  [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate,
  [bool] $RequirePrivateKey
) {
  $normalized = Normalize-Thumbprint $Certificate.Thumbprint
  if ($RequirePrivateKey -and -not $Certificate.HasPrivateKey) {
    throw "Desktop Agent signing certificate $normalized does not have a private key."
  }
  if ($Certificate.NotAfter -le (Get-Date)) {
    throw "Desktop Agent signing certificate $normalized is expired."
  }
  $hasCodeSigningEku = $Certificate.Extensions |
    Where-Object { $_ -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension] } |
    ForEach-Object { $_.EnhancedKeyUsages } |
    Where-Object { $_.Value -eq $codeSigningEku }
  if (-not $hasCodeSigningEku) {
    throw "Desktop Agent signing certificate $normalized does not include the Code Signing EKU."
  }
  if ($ExpectedSubject -and $Certificate.Subject -ine $ExpectedSubject) {
    throw "Desktop Agent signing certificate subject does not match the configured publisher."
  }
}

function Resolve-SigningCertificate([string] $Thumbprint) {
  $normalized = Normalize-Thumbprint $Thumbprint
  if (-not $normalized) {
    throw "A Desktop Agent signing certificate thumbprint is required."
  }
  $certificate = Find-CertificateInStore "My" $normalized
  if (-not $certificate) {
    throw "Desktop Agent signing certificate $normalized was not found in CurrentUser\My."
  }
  Assert-CertificatePolicy $certificate $true
  return $certificate
}

function Sign-File(
  [string] $ToolPath,
  [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate,
  [string] $FilePath,
  [string] $SigningPfxPath
) {
  $arguments = @("sign")
  if ($SigningPfxPath) {
    $arguments += @(
      "/f", $SigningPfxPath,
      "/p", $env:PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD
    )
  } else {
    $arguments += @(
      "/sha1", (Normalize-Thumbprint $Certificate.Thumbprint),
      "/s", "My"
    )
  }
  $arguments += @("/fd", "SHA256", "/d", "Project Wing Desktop Agent")
  if (-not $SkipTimestamp) {
    if (-not $TimestampUrl) {
      throw "PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL is required for release signing."
    }
    $arguments += @("/tr", $TimestampUrl, "/td", "SHA256")
  }
  $arguments += $FilePath
  $result = Invoke-NativeCommand $ToolPath $arguments
  if ($result.exitCode -ne 0) {
    throw "Authenticode signing for $(Split-Path -Leaf $FilePath) failed: $($result.output -join [Environment]::NewLine)"
  }
}

function Verify-File(
  [string] $ToolPath,
  [string] $FilePath,
  [string] $ExpectedThumbprint
) {
  $result = Invoke-NativeCommand $ToolPath @("verify", "/pa", "/all", $FilePath)
  $verificationFailed = $result.exitCode -ne 0
  $untrustedRootOnly = $verificationFailed -and $AllowUntrustedRoot -and (
    ($result.output -join " ") -match
      "not trusted|untrusted|terminated in a root|0x800B0109"
  )
  if ($verificationFailed -and -not $untrustedRootOnly) {
    throw "Authenticode verification for $(Split-Path -Leaf $FilePath) failed: $($result.output -join [Environment]::NewLine)"
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $FilePath
  if ($signature.Status -ne "Valid" -and -not $untrustedRootOnly) {
    throw "Authenticode verification returned $($signature.Status) for $(Split-Path -Leaf $FilePath)."
  }
  if (-not $signature.SignerCertificate) {
    throw "No Authenticode signer certificate was found for $(Split-Path -Leaf $FilePath)."
  }
  $actualThumbprint = Normalize-Thumbprint $signature.SignerCertificate.Thumbprint
  if ($ExpectedThumbprint -and $actualThumbprint -ne (Normalize-Thumbprint $ExpectedThumbprint)) {
    throw "The signer thumbprint for $(Split-Path -Leaf $FilePath) is unexpected."
  }
  if ($ExpectedSubject -and $signature.SignerCertificate.Subject -ine $ExpectedSubject) {
    throw "The signer subject for $(Split-Path -Leaf $FilePath) is unexpected."
  }
  if (-not $SkipTimestamp -and -not $signature.TimeStamperCertificate) {
    throw "The Authenticode signature for $(Split-Path -Leaf $FilePath) is not timestamped."
  }
  return [ordered]@{
    fileName = Split-Path -Leaf $FilePath
    sha256 = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
    signerSubject = $signature.SignerCertificate.Subject
    signerThumbprint = $actualThumbprint
    timestamped = $null -ne $signature.TimeStamperCertificate
    status = if ($untrustedRootOnly) {
      "UntrustedRootTestOnly"
    } else {
      $signature.Status.ToString()
    }
  }
}

try {
  if ($AllowUntrustedRoot) {
    $isCi = $env:CI -match '^(1|true|yes|on)$'
    $signingRequired =
      $env:PROJECT_WING_WINDOWS_SIGNING_REQUIRED -match '^(1|true|yes|on)$'
    $isSmokeTest =
      $env:PROJECT_WING_WINDOWS_SIGNING_SMOKE_TEST -match '^(1|true|yes|on)$'
    if (-not $SkipTimestamp -or $isCi -or $signingRequired -or -not $isSmokeTest) {
      throw "AllowUntrustedRoot is restricted to the local signing smoke test."
    }
  }
  $resolvedPaths = @($Path | ForEach-Object {
    if (-not (Test-Path -LiteralPath $_ -PathType Leaf)) {
      throw "Desktop Agent signing input was not found: $_"
    }
    (Resolve-Path -LiteralPath $_).Path
  })
  if ($resolvedPaths.Count -eq 0) {
    throw "At least one Desktop Agent signing input is required."
  }

  $rootPath = $env:PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_PATH
  if (-not $rootPath -and $env:PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_BASE64) {
    $rootPath = Write-TemporaryCertificate `
      $env:PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_BASE64 `
      "cer"
  }
  Import-RootCertificate $rootPath

  if (-not $PfxPath -and $env:PROJECT_WING_WINDOWS_SIGNING_PFX_BASE64) {
    $PfxPath = Write-TemporaryCertificate $env:PROJECT_WING_WINDOWS_SIGNING_PFX_BASE64 "pfx"
  }
  if ($VerifyOnly) {
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
      [System.Security.Cryptography.X509Certificates.X509Certificate]::CreateFromSignedFile(
        $resolvedPaths[0]
      )
    )
    Assert-CertificatePolicy $certificate $false
    if (
      $CertificateThumbprint -and
      (Normalize-Thumbprint $certificate.Thumbprint) -ne
        (Normalize-Thumbprint $CertificateThumbprint)
    ) {
      throw "The signed file does not match the configured publisher thumbprint."
    }
  }
  else {
    if ($PfxPath) {
      $certificate = Read-SigningCertificate $PfxPath
      Assert-CertificatePolicy $certificate $true
      if (
        $CertificateThumbprint -and
        (Normalize-Thumbprint $certificate.Thumbprint) -ne
          (Normalize-Thumbprint $CertificateThumbprint)
      ) {
        throw "The signing PFX does not match the configured certificate thumbprint."
      }
    }
    else {
      if (-not $CertificateThumbprint) {
        throw "A signing PFX or certificate thumbprint is required."
      }
      $certificate = Resolve-SigningCertificate $CertificateThumbprint
    }
  }
  $tool = Resolve-SignTool $SignToolPath
  $results = @()
  foreach ($file in $resolvedPaths) {
    if (-not $VerifyOnly) {
      Sign-File $tool $certificate $file $PfxPath
    }
    $results += Verify-File $tool $file $certificate.Thumbprint
  }

  if ($ReportPath) {
    $reportDirectory = Split-Path -Parent $ReportPath
    if ($reportDirectory) {
      New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
    }
    [ordered]@{
      verifiedAt = (Get-Date).ToUniversalTime().ToString("o")
      expectedSubject = $ExpectedSubject
      certificateThumbprint = Normalize-Thumbprint $certificate.Thumbprint
      timestampRequired = -not $SkipTimestamp
      files = $results
    } | ConvertTo-Json -Depth 5 |
      Set-Content -LiteralPath $ReportPath -Encoding utf8
  }
}
finally {
  if ($certificate) {
    $certificate.Dispose()
  }
  foreach ($certificateRecord in $importedCertificates) {
    $parts = $certificateRecord.Split("|", 2)
    if ($parts.Count -eq 2) {
      Remove-CertificateFromStore $parts[0] $parts[1]
    }
  }
  foreach ($temporaryFile in $temporaryFiles) {
    Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue
  }
}
