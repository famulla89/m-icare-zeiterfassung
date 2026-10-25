$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path ".").Path
$installer = Get-ChildItem "windows-app/dist/M-iCare-Setup-*.exe" | Select-Object -First 1
if (-not $installer) { throw "Windows-Installer fehlt." }
if ($installer.Length -lt 10MB) { throw "Installer zu klein / möglicherweise beschädigt." }
$stream = [System.IO.File]::OpenRead($installer.FullName)
try {
  if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) {
    throw "Ungültige Windows-PE-Signatur."
  }
} finally { $stream.Dispose() }
$hash = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ([string]::IsNullOrWhiteSpace($hash)) { throw "SHA-256 konnte nicht gebildet werden." }
Write-Host "Windows Setup: $($installer.Name) | SHA256=$hash"

$asarFile = Join-Path $root "windows-app/dist/win-unpacked/resources/app.asar"
if (-not (Test-Path $asarFile)) { throw "Electron-Paket app.asar nicht vorhanden." }
$extractDir = Join-Path $env:RUNNER_TEMP "micare-unpacked-check"
New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
Push-Location "windows-app"
try {
  # electron-builder nutzt das installierte @electron/asar; notfalls separat bereitstellen.
  npm exec --yes --package=@electron/asar -- asar extract "$asarFile" "$extractDir"
  if ($LASTEXITCODE -ne 0) { throw "app.asar konnte nicht extrahiert werden." }
} finally { Pop-Location }
$packagedHtml = Join-Path $extractDir "web/index.html"
$expectedHtml = Join-Path $root "index.html"
if (-not (Test-Path $packagedHtml)) { throw "Installationspaket enthält keine M-iCare-Oberfläche." }
$expectedSha = (Get-FileHash $expectedHtml -Algorithm SHA256).Hash
$packagedSha = (Get-FileHash $packagedHtml -Algorithm SHA256).Hash
if ($expectedSha -ne $packagedSha) { throw "Falscher Versionsstand in Windows-app.asar!" }
if (-not (Test-Path (Join-Path $extractDir "main.js"))) { throw "Electron main.js fehlt." }
Write-Host "Paketintegration: PASS (exakt dieselbe index.html wie im getesteten Quellcode)"

# Silent NSIS installation on an isolated, disposable Windows runner.
$target = Join-Path $env:RUNNER_TEMP "micare-qa-install"
$process = Start-Process -FilePath $installer.FullName -ArgumentList @("/S", "/D=$target") -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer ExitCode $($process.ExitCode)" }
$installedExe = Join-Path $target "M-iCare.exe"
if (-not (Test-Path $installedExe)) {
  $names = (Get-ChildItem -Path $target -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName) -join ', '
  throw "Installation hat M-iCare.exe nicht angelegt (EXEs: $names)."
}
if ((Get-Item $installedExe).Length -lt 1MB) { throw "Installierte EXE ist unvollständig." }
Write-Host "Windows Testinstallation: PASS ($installedExe)"
Write-Host "HINWEIS: UI-Funktionstests laufen separat unter Playwright; eine reale Nutzerinstallation ist damit nicht vollständig abgenommen."
