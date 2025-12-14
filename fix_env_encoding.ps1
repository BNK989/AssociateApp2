$path = Join-Path (Get-Location) ".env"
if (Test-Path $path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
        $newBytes = $bytes[3..($bytes.Length - 1)]
        [System.IO.File]::WriteAllBytes($path, $newBytes)
        Write-Host "Successfully removed BOM from .env" -ForegroundColor Green
    } else {
        Write-Host "No BOM found in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host ".env file not found at $path" -ForegroundColor Red
}
