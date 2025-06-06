Write-Host "Installing native messaging host..." -ForegroundColor Green

# Check if running as administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

# Get absolute paths
$hostManifestPath = Join-Path $PSScriptRoot "chess-arrows-host\manifest.json"
$hostManifestPath = [System.IO.Path]::GetFullPath($hostManifestPath)

Write-Host "Manifest path: $hostManifestPath"

if (-not (Test-Path $hostManifestPath)) {
    Write-Error "Manifest file not found at: $hostManifestPath"
    exit 1
}

# Create registry keys
$paths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chess.arrows.host",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.chess.arrows.host"
)

foreach ($path in $paths) {
    Write-Host "Creating registry key: $path"
    
    try {
        # Create parent keys if they don't exist
        $parentPath = Split-Path $path
        if (-not (Test-Path $parentPath)) {
            New-Item -Path $parentPath -Force | Out-Null
        }
        
        # Remove existing key if it exists
        if (Test-Path $path) {
            Remove-Item -Path $path -Force -Recurse
        }
        
        # Create new key and set default value
        New-Item -Path $path -Force | Out-Null
        Set-ItemProperty -Path $path -Name "(Default)" -Value $hostManifestPath
        
        # Verify registration
        $value = (Get-ItemProperty -Path $path -ErrorAction SilentlyContinue).'(Default)'
        if ($value -eq $hostManifestPath) {
            Write-Host "✓ Successfully registered in: $path" -ForegroundColor Green
        } else {
            throw "Registry value verification failed"
        }
    } catch {
        Write-Error "Failed to register in: $path - $_"
        exit 1
    }
}

Write-Host "`nVerifying Node.js installation..."
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Path
    $nodeVersion = & node --version
    Write-Host "✓ Found Node.js $nodeVersion at: $nodePath" -ForegroundColor Green
    
    # Verify manifest file contents
    Write-Host "`nVerifying manifest file contents..."
    try {
        $manifest = Get-Content $hostManifestPath -Raw | ConvertFrom-Json
        
        # Verify node.exe path exists
        if (-not (Test-Path $manifest.path)) {
            throw "Node.exe not found at path specified in manifest: $($manifest.path)"
        }
        
        # Verify test_host.js exists
        $hostScript = $manifest.args[0]
        if (-not (Test-Path $hostScript)) {
            throw "Host script not found at: $hostScript"
        }
        
        Write-Host "✓ Manifest file verification completed" -ForegroundColor Green
    } catch {
        Write-Error "Manifest verification failed: $_"
        exit 1
    }
} catch {
    Write-Error "Node.js not found in PATH"
}

Write-Host "`nInstallation complete! Please restart your browser." -ForegroundColor Green
