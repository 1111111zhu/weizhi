param(
  [string] $Version = "0.2.16",
  [string] $Configuration = "Release",
  [string] $WindowsSdkVersion = "",
  [switch] $SkipDesktopUiBuild,
  [switch] $RequireSigning,
  [switch] $SkipSigningTimestamp
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "../..")
$desktopAgentRoot = Join-Path $repoRoot "apps/desktop-agent"
$desktopUiRoot = Join-Path $repoRoot "apps/desktop-agent-windows"
$outputRoot = Join-Path $repoRoot "output/desktop-agent/windows"
$payloadRoot = Join-Path $outputRoot "payload"
$payloadZip = Join-Path $outputRoot "ProjectWingDesktopAgentPayload-win-x64.zip"
$installerOutput = Join-Path $outputRoot "installer"
$watcherProject = Join-Path $desktopAgentRoot "watcher/ProjectWing.ExcelWatcher/ProjectWing.ExcelWatcher.csproj"
$watcherPublish = Join-Path $outputRoot "watcher-publish"
$managerProject = Join-Path $desktopAgentRoot "manager/ProjectWing.AgentManager/ProjectWing.AgentManager.csproj"
$managerPublish = Join-Path $outputRoot "manager-publish"
$runtimeProject = Join-Path $desktopAgentRoot "runtime/ProjectWing.DesktopAgent.Runtime/ProjectWing.DesktopAgent.Runtime.csproj"
$runtimePublish = Join-Path $outputRoot "runtime-publish"
$managedPublish = Join-Path $payloadRoot "managed"
$managedMergeReport = Join-Path $outputRoot "managed-runtime-merge.json"
$payloadSizeReport = Join-Path $outputRoot "payload-size-report.json"
$payloadSigningReport = Join-Path $outputRoot "payload-signing-report.json"
$installerSigningReport = Join-Path $outputRoot "installer-signing-report.json"
$setupProject = Join-Path $desktopAgentRoot "installer/ProjectWing.DesktopAgentSetup/ProjectWing.DesktopAgentSetup.csproj"
$signingScript = Join-Path $scriptRoot "sign-windows-artifacts.ps1"
$signingVariableNames = @(
  "PROJECT_WING_WINDOWS_SIGNING_PFX_BASE64",
  "PROJECT_WING_WINDOWS_SIGNING_PFX_PATH",
  "PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD",
  "PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_BASE64",
  "PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_PATH",
  "PROJECT_WING_WINDOWS_SIGNING_CERTIFICATE_THUMBPRINT",
  "PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT",
  "PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL"
)
$signingEnvironment = @{}
foreach ($name in $signingVariableNames) {
  $signingEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
  [Environment]::SetEnvironmentVariable($name, $null)
}

function Reset-Directory([string] $Path) {
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Copy-RequiredFile([string] $Source, [string] $Destination) {
  if (-not (Test-Path $Source)) {
    throw "Required file is missing: $Source"
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Assert-NativeCommandSucceeded([string] $Label) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Test-Truthy([string] $Value) {
  return $Value -match '^(1|true|yes|on)$'
}

function Test-SigningConfigured {
  return [bool](
    $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_PFX_BASE64"] -or
    $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_PFX_PATH"] -or
    $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_CERTIFICATE_THUMBPRINT"]
  )
}

function Assert-ReleaseSigningConfiguration {
  if (-not $script:signingRequired) {
    return
  }
  $requiredValues = [ordered]@{
    signingCertificate = Test-SigningConfigured
    signingPassword = [bool](
      $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_CERTIFICATE_THUMBPRINT"] -or
      $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD"]
    )
    rootCertificate = [bool](
      $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_BASE64"] -or
      $signingEnvironment["PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_PATH"]
    )
    expectedSubject = [bool]$signingEnvironment[
      "PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT"
    ]
    timestampUrl = [bool]$signingEnvironment[
      "PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL"
    ]
  }
  $missing = @($requiredValues.GetEnumerator() |
    Where-Object { -not $_.Value } |
    ForEach-Object Key)
  if ($missing.Count -gt 0) {
    throw "Required Desktop Agent release signing configuration is missing: $($missing -join ', ')"
  }
  if ($SkipSigningTimestamp) {
    throw "Release signing cannot skip the Authenticode timestamp."
  }
}

function Invoke-ArtifactSigning([string[]] $Paths, [string] $ReportPath) {
  if (-not $script:signingConfigured) {
    Write-Host "Skipping Windows signing for this non-release build."
    return
  }
  try {
    foreach ($name in $signingVariableNames) {
      [Environment]::SetEnvironmentVariable($name, $signingEnvironment[$name])
    }
    & $signingScript `
      -Path $Paths `
      -ReportPath $ReportPath `
      -SkipTimestamp:$SkipSigningTimestamp
    Assert-NativeCommandSucceeded "Windows Authenticode signing"
  }
  finally {
    foreach ($name in $signingVariableNames) {
      [Environment]::SetEnvironmentVariable($name, $null)
    }
  }
}

function Resolve-WindowsSdkVersion([string] $RequestedVersion) {
  $sdkRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits/10/Lib"
  if (-not (Test-Path -LiteralPath $sdkRoot -PathType Container)) {
    throw "Windows SDK library directory was not found: $sdkRoot"
  }
  $candidates = Get-ChildItem -LiteralPath $sdkRoot -Directory | ForEach-Object {
    try {
      [pscustomobject]@{ Name = $_.Name; Version = [Version] $_.Name }
    }
    catch {
      Write-Verbose "Ignoring non-version Windows SDK directory: $($_.Name)"
    }
  }
  if ($RequestedVersion) {
    $selected = $candidates | Where-Object Name -eq $RequestedVersion | Select-Object -First 1
  }
  else {
    $selected = $candidates | Sort-Object Version -Descending | Select-Object -First 1
  }
  if ($null -eq $selected -or $selected.Version -lt [Version] "10.0.22621.0") {
    throw "React Native Windows requires Windows SDK 10.0.22621.0 or newer."
  }
  return $selected.Name
}

function Build-SharedDesktopAgentPackage {
  Push-Location $repoRoot
  try {
    corepack pnpm --filter @project-wing/desktop-agent bundle
    Assert-NativeCommandSucceeded "Shared Desktop Agent package build"
  }
  finally {
    Pop-Location
  }
}

function Build-DesktopUi([string] $SdkVersion) {
  Push-Location $desktopUiRoot
  try {
    corepack pnpm exec react-native run-windows `
      --release `
      --arch x64 `
      --no-launch `
      --no-deploy `
      --no-telemetry `
      --msbuildprops "WindowsTargetPlatformVersion=$SdkVersion,TargetPlatformVersion=$SdkVersion"
    Assert-NativeCommandSucceeded "React Native Windows build"
  }
  finally {
    Pop-Location
  }
}

function Copy-DesktopUiPayload {
  $source = Join-Path $desktopUiRoot "windows/x64/$Configuration"
  $uiExecutable = Join-Path $source "ProjectWingDesktopAgent.exe"
  if (-not (Test-Path -LiteralPath $uiExecutable -PathType Leaf)) {
    throw "React Native Windows executable was not found at $uiExecutable."
  }
  $destination = Join-Path $payloadRoot "ui"
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  $runtimeExtensions = @(
    ".bin", ".bundle", ".cer", ".config", ".css", ".dat", ".dll", ".exe",
    ".gif", ".html", ".ico", ".jpeg", ".jpg", ".js", ".json", ".manifest",
    ".mui", ".otf", ".pak", ".png", ".pri", ".resw", ".svg", ".ttf", ".txt",
    ".wasm", ".webp", ".winmd", ".woff", ".woff2", ".xaml", ".xbf", ".xml"
  )
  $excludedDirectories = @("Generated Files", "sourcemaps")
  $excludedExtensions = @(
    ".appxrecipe", ".exp", ".ilk", ".iobj", ".ipdb", ".lastbuildstate",
    ".lib", ".log", ".map", ".obj", ".pch", ".pdb", ".recipe", ".tlog"
  )
  Get-ChildItem -LiteralPath $source -File -Recurse | ForEach-Object {
    $relative = [System.IO.Path]::GetRelativePath($source, $_.FullName)
    $segments = $relative -split '[\\/]'
    if (
      ($excludedDirectories | Where-Object { $segments -contains $_ }) -or
      $excludedExtensions -contains $_.Extension.ToLowerInvariant()
    ) {
      return
    }
    if ($runtimeExtensions -notcontains $_.Extension.ToLowerInvariant()) {
      throw "Unclassified React Native Windows output: $relative"
    }
    Copy-RequiredFile $_.FullName (Join-Path $destination $relative)
  }
}

$signingRequired = $RequireSigning -or
  (Test-Truthy $env:PROJECT_WING_WINDOWS_SIGNING_REQUIRED)
$signingConfigured = Test-SigningConfigured
Assert-ReleaseSigningConfiguration

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Reset-Directory $payloadRoot
Reset-Directory $watcherPublish
Reset-Directory $managerPublish
Reset-Directory $runtimePublish
Reset-Directory $installerOutput

Write-Host "Building React Native Windows tray host..."
$resolvedWindowsSdkVersion = Resolve-WindowsSdkVersion $WindowsSdkVersion
Write-Host "Using Windows SDK $resolvedWindowsSdkVersion."
Build-SharedDesktopAgentPackage
if ($SkipDesktopUiBuild) {
  $existingUi = Join-Path $desktopUiRoot "windows/x64/$Configuration/ProjectWingDesktopAgent.exe"
  $generatedBundle = Join-Path $desktopUiRoot "windows/ProjectWingDesktopAgent/Bundle/index.windows.bundle"
  $releaseBundle = Join-Path $desktopUiRoot "windows/x64/$Configuration/Bundle/index.windows.bundle"
  if (-not (Test-Path -LiteralPath $existingUi -PathType Leaf)) {
    throw "Skipping the Desktop UI build requires an existing native executable: $existingUi"
  }
  if (-not (Test-Path -LiteralPath $generatedBundle -PathType Leaf)) {
    throw "Skipping the Desktop UI build requires a freshly generated Hermes bundle: $generatedBundle"
  }
  $uiSourceRoots = @(
    (Join-Path $repoRoot "packages/desktop-agent-ui/src"),
    $desktopUiRoot
  )
  $newestUiSource = $uiSourceRoots `
    | ForEach-Object { Get-ChildItem -LiteralPath $_ -File } `
    | Sort-Object LastWriteTimeUtc -Descending `
    | Select-Object -First 1
  if ((Get-Item -LiteralPath $generatedBundle).LastWriteTimeUtc -lt $newestUiSource.LastWriteTimeUtc) {
    throw "The existing Hermes bundle is older than Desktop UI source: $($newestUiSource.FullName)"
  }
  $nativeSourceRoot = Join-Path $desktopUiRoot "windows/ProjectWingDesktopAgent"
  $newestNativeSource = Get-ChildItem -LiteralPath $nativeSourceRoot -File `
    | Where-Object { $_.Extension -in @(".cpp", ".h", ".ico", ".rc", ".vcxproj") } `
    | Sort-Object LastWriteTimeUtc -Descending `
    | Select-Object -First 1
  if ((Get-Item -LiteralPath $existingUi).LastWriteTimeUtc -lt $newestNativeSource.LastWriteTimeUtc) {
    throw "The existing native tray host is older than native source: $($newestNativeSource.FullName)"
  }
  Copy-RequiredFile $generatedBundle $releaseBundle
  Write-Host "Reusing the validated native tray host with the freshly generated UI bundle."
}
else {
  Build-DesktopUi $resolvedWindowsSdkVersion
}

Write-Host "Publishing Excel watcher..."
dotnet publish $watcherProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  /p:PublishSingleFile=false `
  /p:DebugType=None `
  /p:DebugSymbols=false `
  -o $watcherPublish
Assert-NativeCommandSucceeded "Excel watcher publish"

Write-Host "Publishing Desktop Agent manager..."
dotnet publish $managerProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  /p:PublishSingleFile=false `
  /p:DebugType=None `
  /p:DebugSymbols=false `
  -o $managerPublish
Assert-NativeCommandSucceeded "Desktop Agent manager publish"

Write-Host "Publishing Desktop Agent runtime..."
dotnet publish $runtimeProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  /p:PublishSingleFile=false `
  /p:DebugType=None `
  /p:DebugSymbols=false `
  -o $runtimePublish
Assert-NativeCommandSucceeded "Desktop Agent runtime publish"

Write-Host "Assembling installer payload..."
# WindowsDesktop.App supplies the compatible Windows implementations for these
# shared-framework assemblies, so the watcher publish must win known overlays.
node (Join-Path $scriptRoot "merge-dotnet-publish.mjs") `
  --destination $managedPublish `
  --source $watcherPublish `
  --source $managerPublish `
  --source $runtimePublish `
  --prefer-first "Microsoft.VisualBasic.dll" `
  --prefer-first "System.Diagnostics.EventLog.Messages.dll" `
  --prefer-first "System.Diagnostics.EventLog.dll" `
  --prefer-first "System.Drawing.dll" `
  --prefer-first "System.Security.Cryptography.Pkcs.dll" `
  --prefer-first "System.Security.Cryptography.Xml.dll" `
  --prefer-first "WindowsBase.dll" `
  --required "ProjectWing.ExcelWatcher.exe" `
  --required "ProjectWing.AgentManager.exe" `
  --required "ProjectWing.DesktopAgent.Runtime.exe" `
  --report $managedMergeReport
Assert-NativeCommandSucceeded "Managed runtime merge"
Copy-DesktopUiPayload

Write-Host "Signing Desktop Agent payload executables..."
$payloadExecutables = @(
  (Join-Path $managedPublish "ProjectWing.AgentManager.exe"),
  (Join-Path $managedPublish "ProjectWing.DesktopAgent.Runtime.exe"),
  (Join-Path $managedPublish "ProjectWing.ExcelWatcher.exe"),
  (Join-Path $payloadRoot "ui/ProjectWingDesktopAgent.exe")
)
Invoke-ArtifactSigning $payloadExecutables $payloadSigningReport

$manifest = [ordered]@{
  app = "project-wing-desktop-agent"
  version = $Version
  platform = "win-x64"
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
  healthUrl = "http://127.0.0.1:17862/health"
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $payloadRoot "agent-manifest.json") -Encoding utf8

if (Test-Path $payloadZip) {
  Remove-Item -LiteralPath $payloadZip -Force
}
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $payloadRoot,
  $payloadZip,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)
node (Join-Path $scriptRoot "report-package-size.mjs") `
  --root $payloadRoot `
  --archive $payloadZip `
  --report $payloadSizeReport
Assert-NativeCommandSucceeded "Payload size report"

Write-Host "Publishing Windows setup executable..."
dotnet publish $setupProject `
  -c $Configuration `
  -r win-x64 `
  --self-contained true `
  /p:PublishAot=true `
  /p:PublishSingleFile=false `
  /p:OptimizationPreference=Size `
  /p:StripSymbols=true `
  /p:DebugType=None `
  /p:DebugSymbols=false `
  /p:Version=$Version `
  /p:PayloadZip="$payloadZip" `
  -o $installerOutput
Assert-NativeCommandSucceeded "Windows setup publish"

$setupExe = Join-Path $installerOutput "ProjectWingDesktopAgentSetup.exe"
$finalExe = Join-Path $outputRoot "desktop-agent-win-x64-$Version.exe"
$webDownloadDirectory = Join-Path $repoRoot "apps/emp/public/downloads"
$webDownloadExe = Join-Path $webDownloadDirectory "desktop-agent-win-x64.exe"
$deployDownloadDirectory = Join-Path $repoRoot "deploy/downloads"
$deployDownloadExe = Join-Path $deployDownloadDirectory "desktop-agent-win-x64.exe"
Copy-RequiredFile $setupExe $finalExe
Write-Host "Signing final Desktop Agent installer..."
Invoke-ArtifactSigning @($finalExe) $installerSigningReport
Copy-RequiredFile $finalExe $webDownloadExe
Copy-RequiredFile $finalExe $deployDownloadExe

Write-Host "Built installer:"
Write-Host "  $finalExe"
Write-Host "  $webDownloadExe"
Write-Host "  $deployDownloadExe"
if ($signingConfigured) {
  Write-Host "  $payloadSigningReport"
  Write-Host "  $installerSigningReport"
}
