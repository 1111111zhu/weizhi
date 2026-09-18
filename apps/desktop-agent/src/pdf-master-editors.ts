import { existsSync } from "node:fs";
import pathModule from "node:path";

const { basename } = pathModule;

export const PDF_MASTER_EDITOR_INSTALL_RECOMMENDATION =
  "Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then restart Desktop Agent.";

export const PDF_MASTER_EDITOR_OPEN_RECOMMENDATION =
  "Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then retry Master.";

const TRUSTED_PDF_MASTER_EDITOR_FAMILIES = [
  {
    id: "adobe",
    displayName: "Adobe Acrobat",
    executableNames: ["acrobat.exe", "acrord32.exe", "acrord64.exe"],
    appPathNames: ["Acrobat.exe", "AcroRd32.exe", "AcroRd64.exe"],
    installLocationRelativePaths: [
      "Acrobat.exe",
      String.raw`Acrobat\Acrobat.exe`,
      String.raw`Reader\AcroRd32.exe`,
      String.raw`Reader\AcroRd64.exe`,
    ],
    commonRelativePaths: [
      String.raw`Adobe\Acrobat DC\Acrobat\Acrobat.exe`,
      String.raw`Adobe\Acrobat Reader DC\Reader\AcroRd32.exe`,
      String.raw`Adobe\Acrobat Reader\Reader\AcroRd32.exe`,
      String.raw`Adobe\Acrobat\Acrobat\Acrobat.exe`,
    ],
  },
  {
    id: "pdf-xchange",
    displayName: "PDF-XChange Editor",
    executableNames: ["pdfxedit.exe", "pdfxcview.exe", "pxceditor.exe"],
    appPathNames: ["PDFXEdit.exe", "PDFXCview.exe", "PXCEditor.exe"],
    installLocationRelativePaths: [
      "PDFXEdit.exe",
      "PXCEditor.exe",
      String.raw`PDF Editor\PDFXEdit.exe`,
      String.raw`PDF Editor\PXCEditor.exe`,
      String.raw`PDF Viewer\PDFXCview.exe`,
    ],
    commonRelativePaths: [
      String.raw`Tracker Software\PDF Editor\PDFXEdit.exe`,
      String.raw`Tracker Software\PDF Viewer\PDFXCview.exe`,
      String.raw`PDF-XChange\PDF Editor\PXCEditor.exe`,
    ],
  },
  {
    id: "foxit",
    displayName: "Foxit PDF Editor",
    executableNames: ["foxitpdfeditor.exe", "foxitphantompdf.exe"],
    appPathNames: ["FoxitPDFEditor.exe", "FoxitPhantomPDF.exe"],
    installLocationRelativePaths: [
      "FoxitPDFEditor.exe",
      "FoxitPhantomPDF.exe",
      String.raw`Foxit PDF Editor\FoxitPDFEditor.exe`,
      String.raw`Foxit PhantomPDF\FoxitPhantomPDF.exe`,
    ],
    commonRelativePaths: [
      String.raw`Foxit Software\Foxit PDF Editor\FoxitPDFEditor.exe`,
      String.raw`Foxit Software\Foxit PhantomPDF\FoxitPhantomPDF.exe`,
    ],
  },
  {
    id: "pdfill",
    displayName: "PDFill PDF Editor",
    executableNames: ["pdfill.exe", "PDFill.exe"],
    appPathNames: ["PDFill.exe"],
    installLocationRelativePaths: ["PDFill.exe"],
    commonRelativePaths: [
      String.raw`PlotSoft\PDFill\PDFill.exe`,
      String.raw`PDFill\PDFill.exe`,
    ],
  },
  {
    id: "pdf-master",
    displayName: "PDF Master Editor",
    executableNames: ["masterpdf.exe", "masterpdfeditor.exe"],
    appPathNames: ["masterpdf.exe", "MasterPDFEditor.exe"],
    installLocationRelativePaths: ["masterpdf.exe", "MasterPDFEditor.exe"],
    commonRelativePaths: [
      String.raw`Code Industry\Master PDF Editor 6\masterpdf.exe`,
      String.raw`Code Industry\Master PDF Editor 6\MasterPDFEditor.exe`,
      String.raw`Code Industry\Master PDF Editor 5\masterpdf.exe`,
      String.raw`Code Industry\Master PDF Editor 5\MasterPDFEditor.exe`,
      String.raw`Master PDF Editor\masterpdf.exe`,
      String.raw`Master PDF Editor\MasterPDFEditor.exe`,
    ],
  },
] as const;
const TRUSTED_PDF_MASTER_EDITOR_FAMILIES_JSON = JSON.stringify(
  TRUSTED_PDF_MASTER_EDITOR_FAMILIES
).replaceAll("'", "''");

export const WINDOWS_TRUSTED_PDF_EDITOR_DISCOVERY_SCRIPT = `
$ProjectWingTrustedPdfEditorFamiliesJson = @'
${TRUSTED_PDF_MASTER_EDITOR_FAMILIES_JSON}
'@
$ProjectWingTrustedPdfEditorFamilies = $ProjectWingTrustedPdfEditorFamiliesJson | ConvertFrom-Json

function Get-ProjectWingExecutablePathFromCommand {
  param([string]$Command)
  if (-not $Command) { return $null }
  $trimmed = $Command.Trim()
  $quoted = [regex]::Match($trimmed, '^"([^"]+\\.exe)"(?:\\s|,|$)', 'IgnoreCase')
  if ($quoted.Success) { return $quoted.Groups[1].Value }
  $unquoted = [regex]::Match($trimmed, '^(.+?\\.exe)(?:\\s|,|$)', 'IgnoreCase')
  if ($unquoted.Success) { return $unquoted.Groups[1].Value }
  return $null
}

function ConvertTo-ProjectWingPdfEditorPath {
  param([string]$Value)
  if (-not $Value) { return $null }
  $expanded = [Environment]::ExpandEnvironmentVariables($Value.Trim())
  $fromCommand = Get-ProjectWingExecutablePathFromCommand -Command $expanded
  if ($fromCommand) { return $fromCommand }
  return $expanded.Trim('"')
}

function Add-ProjectWingPdfEditorCandidate {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [object]$Family,
    [string]$Path
  )
  $editorPath = ConvertTo-ProjectWingPdfEditorPath -Value $Path
  if (-not $editorPath) { return }
  $editorName = [System.IO.Path]::GetFileName($editorPath).ToLowerInvariant()
  $trustedNames = @($Family.executableNames)
  if (-not ($trustedNames -contains $editorName)) { return }
  if (-not (Test-Path -LiteralPath $editorPath -PathType Leaf -ErrorAction SilentlyContinue)) { return }
  $fullPath = [System.IO.Path]::GetFullPath($editorPath)
  if (-not $Candidates.Contains($fullPath)) {
    [void]$Candidates.Add($fullPath)
  }
}

function Add-ProjectWingPdfEditorAppPathCandidates {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [object]$Family
  )
  $roots = @(
    'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
    'Registry::HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
    'Registry::HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths'
  )
  foreach ($root in $roots) {
    foreach ($appPathName in @($Family.appPathNames)) {
      try {
        $item = Get-ItemProperty -LiteralPath "$root\\$appPathName" -ErrorAction Stop
        Add-ProjectWingPdfEditorCandidate -Candidates $Candidates -Family $Family -Path ([string]$item.'(default)')
        Add-ProjectWingPdfEditorCandidate -Candidates $Candidates -Family $Family -Path ([string]$item.Path)
      } catch {}
    }
  }
}

function Add-ProjectWingPdfEditorUninstallCandidates {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [object]$Family
  )
  $roots = @(
    'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'Registry::HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'Registry::HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )
  foreach ($root in $roots) {
    foreach ($item in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      Add-ProjectWingPdfEditorCandidate -Candidates $Candidates -Family $Family -Path ([string]$item.DisplayIcon)
      $installLocation = ConvertTo-ProjectWingPdfEditorPath -Value ([string]$item.InstallLocation)
      if ($installLocation -and (Test-Path -LiteralPath $installLocation -PathType Container -ErrorAction SilentlyContinue)) {
        foreach ($relativePath in @($Family.installLocationRelativePaths)) {
          Add-ProjectWingPdfEditorCandidate -Candidates $Candidates -Family $Family -Path (Join-Path $installLocation $relativePath)
        }
      }
    }
  }
}

function Get-ProjectWingDefaultPdfOpenCommand {
  $candidateProgIds = @()
  try {
    $userChoice = Get-ItemProperty -LiteralPath 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\UserChoice' -ErrorAction Stop
    $userChoiceProgId = [string]$userChoice.ProgId
    if ($userChoiceProgId) { $candidateProgIds += $userChoiceProgId }
  } catch {}
  try {
    $extension = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\\.pdf' -ErrorAction Stop
    $extensionProgId = [string]$extension.'(default)'
    if ($extensionProgId) { $candidateProgIds += $extensionProgId }
  } catch {}

  foreach ($progId in $candidateProgIds) {
    $commandPaths = @(
      "Registry::HKEY_CURRENT_USER\\Software\\Classes\\$progId\\shell\\open\\command",
      "Registry::HKEY_CLASSES_ROOT\\$progId\\shell\\open\\command",
      "Registry::HKEY_LOCAL_MACHINE\\Software\\Classes\\$progId\\shell\\open\\command"
    )
    foreach ($commandPath in $commandPaths) {
      try {
        $command = Get-ItemProperty -LiteralPath $commandPath -ErrorAction Stop
        $value = [string]$command.'(default)'
        if ($value) { return $value }
      } catch {}
    }
  }
  return $null
}

function Add-ProjectWingPdfEditorDefaultCommandCandidate {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [object]$Family
  )
  $command = Get-ProjectWingDefaultPdfOpenCommand
  if ($command) {
    Add-ProjectWingPdfEditorCandidate -Candidates $Candidates -Family $Family -Path $command
  }
}

function Add-ProjectWingPdfEditorCommonPathCandidates {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [object]$Family
  )
  $roots = @(
    [Environment]::GetFolderPath('ProgramFiles'),
    [Environment]::GetFolderPath('ProgramFilesX86'),
    [Environment]::GetFolderPath('LocalApplicationData')
  ) | Where-Object { $_ }
  foreach ($root in $roots) {
    foreach ($relativePath in @($Family.commonRelativePaths)) {
      Add-ProjectWingPdfEditorCandidate -Candidates $Candidates -Family $Family -Path (Join-Path $root $relativePath)
    }
  }
}

function Find-ProjectWingTrustedPdfEditorCandidatePaths {
  $candidates = [System.Collections.Generic.List[string]]::new()
  foreach ($family in @($ProjectWingTrustedPdfEditorFamilies)) {
    Add-ProjectWingPdfEditorAppPathCandidates -Candidates $candidates -Family $family
    Add-ProjectWingPdfEditorUninstallCandidates -Candidates $candidates -Family $family
    Add-ProjectWingPdfEditorDefaultCommandCandidate -Candidates $candidates -Family $family
    Add-ProjectWingPdfEditorCommonPathCandidates -Candidates $candidates -Family $family
  }
  @($candidates)
}
`;

export function selectTrustedPdfMasterEditorPath(
  candidates: readonly string[],
  pathExists: (filePath: string) => boolean = existsSync
) {
  const existingCandidates = candidates.filter(
    (candidate): candidate is string =>
      typeof candidate === "string" &&
      candidate.trim().length > 0 &&
      pathExists(candidate)
  );
  for (const family of TRUSTED_PDF_MASTER_EDITOR_FAMILIES) {
    const trustedNames: ReadonlySet<string> = new Set(family.executableNames);
    const candidate = existingCandidates.find((candidatePath) =>
      trustedNames.has(basename(candidatePath).toLowerCase())
    );
    if (candidate) {
      return candidate;
    }
  }
  return null;
}
