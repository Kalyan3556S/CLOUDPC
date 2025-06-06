# Run as administrator with UTF-8 output
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8

# Stop on first error
$ErrorActionPreference = "Stop"

Write-Host "Starting native messaging host installation..." -ForegroundColor Green

# Get absolute paths
$extensionRoot = $PSScriptRoot
$hostPath = Join-Path $extensionRoot "chess-arrows-host\lc0_connector.js"
$hostManifestPath = Join-Path $extensionRoot "chess-arrows-host\manifest.json"

# Verify Node.js installation
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $nodeVersion = & node --version
    Write-Host "Found Node.js $nodeVersion at: $nodePath" -ForegroundColor Green
} catch {
    Write-Error "Node.js not found. Please install Node.js and make sure it's in your PATH"
    exit 1
}

# Create the manifest content
$manifest = @{
    name = "com.chess.arrows.host"
    description = "Chess Arrows Native Messaging Host"
    path = $nodePath
    type = "stdio"
    allowed_origins = @(
        "chrome-extension://*"
    )
    args = @(
        $hostPath
    )
} | ConvertTo-Json -Depth 10

# Save the manifest
Write-Host "Creating native messaging host manifest..." -ForegroundColor Green
$manifest | Set-Content -Path $hostManifestPath -Encoding UTF8 -Force

# Register in Windows Registry
$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chess.arrows.host",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.chess.arrows.host"
)

foreach ($registryPath in $registryPaths) {
    Write-Host "Registering in $registryPath..." -ForegroundColor Green
    
    # Remove existing registration if it exists
    if (Test-Path $registryPath) {
        Remove-Item -Path $registryPath -Force -Recurse
    }
    
    # Create new registration
    New-Item -Path $registryPath -Force | Out-Null
    Set-ItemProperty -Path $registryPath -Name "(Default)" -Value $hostManifestPath
}

# Verify the installation
Write-Host "`nVerifying installation..." -ForegroundColor Green

# Check manifest file
if (Test-Path $hostManifestPath) {
    Write-Host "✓ Manifest file exists at: $hostManifestPath" -ForegroundColor Green
} else {
    Write-Error "❌ Manifest file not found!"
}

# Check Node.js script
if (Test-Path $hostPath) {
    Write-Host "✓ Native messaging host script exists at: $hostPath" -ForegroundColor Green
} else {
    Write-Error "❌ Native messaging host script not found!"
}

# Check registry entries
foreach ($registryPath in $registryPaths) {
    $regValue = Get-ItemProperty -Path $registryPath -Name "(Default)" -ErrorAction SilentlyContinue
    if ($regValue -and ($regValue."(Default)" -eq $hostManifestPath)) {
        Write-Host "✓ Registry entry correct in: $registryPath" -ForegroundColor Green
    } else {
        Write-Host "❌ Registry entry missing or incorrect in: $registryPath" -ForegroundColor Red
    }
}

Write-Host "`nInstallation complete!" -ForegroundColor Green
Write-Host "Please restart Chrome/Edge for the changes to take effect." -ForegroundColor Yellow
