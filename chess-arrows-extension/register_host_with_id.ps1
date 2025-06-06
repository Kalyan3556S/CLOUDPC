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
$manifest = Get-Content $hostManifestPath -Raw | ConvertFrom-Json

# Update the manifest
$manifest.path = $nodePath
$manifest.args = @($hostPath)
$manifest.allowed_origins = @(
    "chrome-extension://$ExtensionId"
)

# Save the updated manifest
$manifest | ConvertTo-Json -Depth 10 | Set-Content $hostManifestPath -Encoding UTF8 -Force

# Create the registry keys
Write-Host "Creating registry keys..." -ForegroundColor Green

$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chess.arrows.host",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.chess.arrows.host"
)

foreach ($registryPath in $registryPaths) {
    Write-Host "Setting up: $registryPath"
    try {
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

# Verify the files
Write-Host "`nVerifying installation..." -ForegroundColor Green

$filesToCheck = @{
    "Native messaging host script" = $hostPath
    "Host manifest" = $hostManifestPath
}

foreach ($file in $filesToCheck.GetEnumerator()) {
    if (Test-Path $file.Value) {
        Write-Host "✓ $($file.Key) exists at: $($file.Value)" -ForegroundColor Green
    } else {
        Write-Error "❌ $($file.Key) not found at: $($file.Value)"
        exit 1
    }
}

Write-Host "`nVerifying file contents..." -ForegroundColor Green

# Read and validate manifest
try {
    $manifest = Get-Content $hostManifestPath -Raw | ConvertFrom-Json
    
    # Check required fields
    @('name', 'description', 'path', 'type', 'allowed_origins') | ForEach-Object {
        if (-not $manifest.$_) {
            throw "Missing required field: $_"
        }
    }
    
    # Verify path exists
    if (-not (Test-Path $manifest.path)) {
        throw "Node.exe not found at path specified in manifest: $($manifest.path)"
    }
    
    Write-Host "✓ Manifest file content verified" -ForegroundColor Green
} catch {
    Write-Error "❌ Manifest verification failed: $_"
    exit 1
}

Write-Host "`n✓ Native messaging host installation completed successfully!" -ForegroundColor Green
Write-Host "`nIMPORTANT: You need to restart Chrome/Edge for the changes to take effect." -ForegroundColor Yellow
