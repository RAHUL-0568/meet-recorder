# ============================================================
# Bundle Extension - Zips the extension folder for deployment
# ============================================================
# Run from the dashboard folder:
#   powershell -File scripts/bundle-extension.ps1
# ============================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dashboardDir = Split-Path -Parent $scriptDir
$extensionDir = Join-Path (Split-Path -Parent $dashboardDir) "extension"
$outputZip = Join-Path (Join-Path $dashboardDir "public") "meet-recorder-extension.zip"

if (-not (Test-Path $extensionDir)) {
    Write-Host "ERROR: Extension folder not found at: $extensionDir" -ForegroundColor Red
    exit 1
}

# Remove old zip if it exists
if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
    Write-Host "Removed old zip" -ForegroundColor Yellow
}

# Create the zip
Write-Host "Zipping extension from: $extensionDir" -ForegroundColor Cyan
Compress-Archive -Path "$extensionDir\*" -DestinationPath $outputZip -CompressionLevel Optimal

if (Test-Path $outputZip) {
    $sizeKB = [math]::Round((Get-Item $outputZip).Length / 1KB, 1)
    Write-Host "Extension bundled: public/meet-recorder-extension.zip ($sizeKB KB)" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to create zip" -ForegroundColor Red
    exit 1
}
