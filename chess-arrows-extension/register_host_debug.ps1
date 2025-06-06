# Run as administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting administrator privileges..."
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Enable verbose output
$VerbosePreference = "Continue"
$ErrorActionPreference = "Stop"

Write-Host "Starting native messaging host registration..." -ForegroundColor Green

# Get the absolute paths
$hostPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\chess-arrows-host\lc0_connector.js")
$hostManifestPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\chess-arrows-host\manifest.json")

Write-Verbose "Host path: $hostPath"
Write-Verbose "Host manifest path: $hostManifestPath"

# Verify paths exist
if (-not (Test-Path $hostPath)) {
    throw "Host script not found at: $hostPath"
}
if (-not (Test-Path $hostManifestPath)) {
    throw "Host manifest not found at: $hostManifestPath"
}

# Verify Node.js installation
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Path
    $nodeVersion = & node --version
    Write-Host "Found Node.js $nodeVersion at: $nodePath" -ForegroundColor Green
} catch {
    throw "Node.js not found in PATH. Please install Node.js and try again."
}

# Update the native messaging host manifest
Write-Host "Updating native messaging host manifest..." -ForegroundColor Green
$manifest = Get-Content $hostManifestPath -Raw | ConvertFrom-Json
$manifest.path = $nodePath
$manifest.args = @($hostPath)
$manifest.allowed_origins = @(
    "chrome-extension://*",
    "edge-extension://*"
)
$manifest | ConvertTo-Json -Depth 10 | Set-Content $hostManifestPath -Encoding UTF8 -Force

# Register for Chrome
Write-Host "Registering for Chrome..." -ForegroundColor Green
$chromeRegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chess.arrows.host"
if (Test-Path $chromeRegistryPath) {
    Remove-Item -Path $chromeRegistryPath -Force -Recurse
}
New-Item -Path $chromeRegistryPath -Force | Out-Null
Set-ItemProperty -Path $chromeRegistryPath -Name "(Default)" -Value $hostManifestPath

# Register for Edge
Write-Host "Registering for Edge..." -ForegroundColor Green
$edgeRegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.chess.arrows.host"
if (Test-Path $edgeRegistryPath) {
    Remove-Item -Path $edgeRegistryPath -Force -Recurse
}
New-Item -Path $edgeRegistryPath -Force | Out-Null
Set-ItemProperty -Path $edgeRegistryPath -Name "(Default)" -Value $hostManifestPath

Write-Host "`nVerifying registration..." -ForegroundColor Green
$chromeReg = Get-ItemProperty -Path $chromeRegistryPath -ErrorAction SilentlyContinue
$edgeReg = Get-ItemProperty -Path $edgeRegistryPath -ErrorAction SilentlyContinue

Write-Host "Chrome registration: $($chromeReg.'(default)')"
Write-Host "Edge registration: $($edgeReg.'(default)')"

Write-Host "`nNative messaging host registration complete!" -ForegroundColor Green
Write-Host "Please restart your browser for the changes to take effect." -ForegroundColor Yellow
