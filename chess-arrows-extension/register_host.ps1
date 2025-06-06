# Get the absolute paths
$hostPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\chess-arrows-host\lc0_connector.js")
$hostManifestPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\chess-arrows-host\manifest.json")
$nodePath = "node.exe"

# Verify Node.js is available
try {
    $nodeVersion = & node --version
    Write-Host "Found Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js not found in PATH. Please install Node.js and try again."
    exit 1
}

# Update the native messaging host manifest
$manifest = Get-Content $hostManifestPath -Raw | ConvertFrom-Json
$manifest.path = $nodePath
$manifest.args = @($hostPath)
$manifest | ConvertTo-Json -Depth 10 | Set-Content $hostManifestPath -Encoding UTF8

# Create the registry key for Chrome/Edge
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chess.arrows.host"
New-Item -Path $registryPath -Force
Set-ItemProperty -Path $registryPath -Name "(Default)" -Value $hostManifestPath

# Also register for Microsoft Edge
$edgeRegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.chess.arrows.host"
New-Item -Path $edgeRegistryPath -Force
Set-ItemProperty -Path $edgeRegistryPath -Name "(Default)" -Value $hostManifestPath

Write-Host "Native messaging host registered successfully!"
