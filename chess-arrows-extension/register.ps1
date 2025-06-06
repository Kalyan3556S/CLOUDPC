# Run as administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Set error action preference to stop on any error
$ErrorActionPreference = "Stop"

# Get extension ID from command line
param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

Write-Host "Installing native messaging host for extension ID: $ExtensionId" -ForegroundColor Green

# Get absolute paths
$hostPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\chess-arrows-host\lc0_connector.js")
$hostManifestPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\chess-arrows-host\manifest.json")

# Verify Node.js installation
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Path
    $nodeVersion = & node --version
    Write-Host "Found Node.js $nodeVersion at: $nodePath" -ForegroundColor Green
} catch {
    Write-Error "Node.js not found in PATH. Please install Node.js first."
    exit 1
}

# Update the native messaging host manifest
Write-Host "Updating manifest with extension ID..." -ForegroundColor Green
try {
    $manifest = @{
        name = "com.chess.arrows.host"
        description = "Chess Arrows Native Messaging Host"
        path = $nodePath
        type = "stdio"
        allowed_origins = @(
            "chrome-extension://$ExtensionId"
        )
        args = @(
            $hostPath
        )
    }

    # Save the manifest
    $manifest | ConvertTo-Json -Depth 10 | Set-Content $hostManifestPath -Encoding UTF8 -Force
    Write-Host "✓ Updated manifest file" -ForegroundColor Green
} catch {
    Write-Error "Failed to update manifest: $_"
    exit 1
}

# Create the registry keys
Write-Host "`nCreating registry keys..." -ForegroundColor Green

$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chess.arrows.host"
)

foreach ($registryPath in $registryPaths) {
    Write-Host "Setting up: $registryPath"
    try {
        # Create parent keys if they don't exist
        $parentPath = Split-Path $registryPath
        if (-not (Test-Path $parentPath)) {
            New-Item -Path $parentPath -Force | Out-Null
        }
        
        # Remove existing key if it exists
        if (Test-Path $registryPath) {
            Remove-Item -Path $registryPath -Force -Recurse
        }
        
        # Create new key and set the manifest path
        New-Item -Path $registryPath -Force | Out-Null
        Set-ItemProperty -Path $registryPath -Name "(Default)" -Value $hostManifestPath
        
        # Verify the registry entry
        $regValue = (Get-ItemProperty -Path $registryPath -Name "(Default)" -ErrorAction Stop).'(Default)'
        if ($regValue -eq $hostManifestPath) {
            Write-Host "✓ Successfully registered in: $registryPath" -ForegroundColor Green
        } else {
            throw "Registry value verification failed"
        }
    } catch {
        Write-Error "Failed to register in: $registryPath - $_"
        exit 1
    }
}

# Install npm dependencies
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Green
try {
    Push-Location "$PSScriptRoot\chess-arrows-host"
    npm install
    Pop-Location
} catch {
    Write-Error "Failed to install npm dependencies: $_"
    exit 1
}

# Verify the installation
Write-Host "`nVerifying installation..." -ForegroundColor Green

# Check file existence
$filesToCheck = @{
    "Native messaging host script" = $hostPath
    "Host manifest" = $hostManifestPath
    "Node.js executable" = $nodePath
}

foreach ($file in $filesToCheck.GetEnumerator()) {
    if (Test-Path $file.Value) {
        Write-Host "✓ $($file.Key) exists at: $($file.Value)" -ForegroundColor Green
    } else {
        Write-Error "❌ $($file.Key) not found at: $($file.Value)"
        exit 1
    }
}

Write-Host "`nVerifying registry..." -ForegroundColor Green
foreach ($registryPath in $registryPaths) {
    $regValue = Get-ItemProperty -Path $registryPath -Name "(Default)" -ErrorAction SilentlyContinue
    if ($regValue -and ($regValue.'(Default)' -eq $hostManifestPath)) {
        Write-Host "✓ Registry entry verified in: $registryPath" -ForegroundColor Green
    } else {
        Write-Error "❌ Registry entry incorrect in: $registryPath"
        exit 1
    }
}

Write-Host "`n✓ Native messaging host installation completed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Close all Chrome windows" -ForegroundColor Yellow
Write-Host "2. Start Chrome again" -ForegroundColor Yellow
Write-Host "3. Test the connection using the extension's popup" -ForegroundColor Yellow
