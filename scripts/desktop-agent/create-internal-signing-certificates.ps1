param(
  [Parameter(Mandatory = $true)]
  [string] $Organization,
  [Parameter(Mandatory = $true)]
  [string] $PublisherName,
  [Parameter(Mandatory = $true)]
  [string] $PrivateDirectory,
  [Parameter(Mandatory = $true)]
  [string] $PublicDirectory
)

$ErrorActionPreference = "Stop"

function New-RandomPassword {
  $bytes = [byte[]]::new(36)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Set-PrivateDirectoryAcl([string] $Path) {
  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $system = [System.Security.Principal.SecurityIdentifier]::new(
    [System.Security.Principal.WellKnownSidType]::LocalSystemSid,
    $null
  )
  $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
    [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  $propagation = [System.Security.AccessControl.PropagationFlags]::None
  $allow = [System.Security.AccessControl.AccessControlType]::Allow
  $acl = [System.Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $acl.AddAccessRule(
    [System.Security.AccessControl.FileSystemAccessRule]::new(
      $currentUser,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      $propagation,
      $allow
    )
  )
  $acl.AddAccessRule(
    [System.Security.AccessControl.FileSystemAccessRule]::new(
      $system,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      $propagation,
      $allow
    )
  )
  Set-Acl -LiteralPath $Path -AclObject $acl
}

$resolvedPrivateDirectory = [System.IO.Path]::GetFullPath($PrivateDirectory)
$resolvedPublicDirectory = [System.IO.Path]::GetFullPath($PublicDirectory)

if (Test-Path -LiteralPath $resolvedPrivateDirectory) {
  $existingPrivateFiles = @(Get-ChildItem -LiteralPath $resolvedPrivateDirectory -Force)
  if ($existingPrivateFiles.Count -gt 0) {
    throw "Private signing directory is not empty: $resolvedPrivateDirectory"
  }
}
if (Test-Path -LiteralPath $resolvedPublicDirectory) {
  $existingPublicFiles = @(Get-ChildItem -LiteralPath $resolvedPublicDirectory -Force)
  if ($existingPublicFiles.Count -gt 0) {
    throw "Public certificate directory is not empty: $resolvedPublicDirectory"
  }
}

New-Item -ItemType Directory -Path $resolvedPrivateDirectory -Force | Out-Null
Set-PrivateDirectoryAcl $resolvedPrivateDirectory
New-Item -ItemType Directory -Path $resolvedPublicDirectory -Force | Out-Null

$rootSubject = "CN=$PublisherName Internal Root CA, O=$Organization, C=CN"
$publisherSubject = "CN=$PublisherName Software Publisher, O=$Organization, C=CN"

$root = New-SelfSignedCertificate `
  -Type Custom `
  -Subject $rootSubject `
  -FriendlyName "$PublisherName Internal Root CA" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 4096 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage CertSign, CRLSign `
  -KeyUsageProperty Sign `
  -TextExtension @("2.5.29.19={critical}{text}ca=1&pathlength=0") `
  -NotAfter (Get-Date).AddYears(10)

try {
  $publisher = New-SelfSignedCertificate `
    -Type Custom `
    -Subject $publisherSubject `
    -FriendlyName "Project Wing Desktop Agent Code Signing" `
    -Signer $root `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature `
    -KeyUsageProperty Sign `
    -TextExtension @(
      "2.5.29.19={critical}{text}ca=0",
      "2.5.29.37={critical}{text}1.3.6.1.5.5.7.3.3"
    ) `
    -NotAfter (Get-Date).AddYears(3)

  $rootPasswordText = New-RandomPassword
  $publisherPasswordText = New-RandomPassword
  $rootPassword = ConvertTo-SecureString $rootPasswordText -AsPlainText -Force
  $publisherPassword = ConvertTo-SecureString $publisherPasswordText -AsPlainText -Force

  $rootCer = Join-Path $resolvedPublicDirectory "Wing-Zenith-Internal-Root-CA.cer"
  $publisherCer = Join-Path $resolvedPublicDirectory "Wing-Zenith-Software-Publisher.cer"
  $rootPfx = Join-Path $resolvedPrivateDirectory "Wing-Zenith-Internal-Root-CA.pfx"
  $publisherPfx = Join-Path $resolvedPrivateDirectory "Wing-Zenith-Software-Publisher.pfx"

  Export-Certificate -Cert $root -FilePath $rootCer -Type CERT | Out-Null
  Export-Certificate -Cert $publisher -FilePath $publisherCer -Type CERT | Out-Null
  Export-PfxCertificate `
    -Cert $root `
    -FilePath $rootPfx `
    -Password $rootPassword `
    -ChainOption EndEntityCertOnly `
    -CryptoAlgorithmOption AES256_SHA256 | Out-Null
  Export-PfxCertificate `
    -Cert $publisher `
    -FilePath $publisherPfx `
    -Password $publisherPassword `
    -ChainOption EndEntityCertOnly `
    -CryptoAlgorithmOption AES256_SHA256 | Out-Null

  Set-Content `
    -LiteralPath (Join-Path $resolvedPrivateDirectory "ROOT-PFX-PASSWORD.txt") `
    -Value $rootPasswordText `
    -Encoding ascii `
    -NoNewline
  Set-Content `
    -LiteralPath (Join-Path $resolvedPrivateDirectory "PUBLISHER-PFX-PASSWORD.txt") `
    -Value $publisherPasswordText `
    -Encoding ascii `
    -NoNewline

  $metadata = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    organization = $Organization
    publisherName = $PublisherName
    root = [ordered]@{
      subject = $root.Subject
      thumbprint = $root.Thumbprint
      notBefore = $root.NotBefore.ToUniversalTime().ToString("o")
      notAfter = $root.NotAfter.ToUniversalTime().ToString("o")
    }
    publisher = [ordered]@{
      subject = $publisher.Subject
      thumbprint = $publisher.Thumbprint
      issuer = $publisher.Issuer
      notBefore = $publisher.NotBefore.ToUniversalTime().ToString("o")
      notAfter = $publisher.NotAfter.ToUniversalTime().ToString("o")
    }
    rootPrivateKeyRemovedFromCertificateStore = $true
  }
  $metadata | ConvertTo-Json -Depth 4 |
    Set-Content -LiteralPath (Join-Path $resolvedPrivateDirectory "certificate-metadata.json") -Encoding utf8
  $metadata | ConvertTo-Json -Depth 4 |
    Set-Content -LiteralPath (Join-Path $resolvedPublicDirectory "certificate-metadata.json") -Encoding utf8

  Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($root.Thumbprint)" -Force

  Write-Output $metadata
}
catch {
  if ($publisher) {
    Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($publisher.Thumbprint)" -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($root.Thumbprint)" -Force -ErrorAction SilentlyContinue
  throw
}
