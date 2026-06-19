# バックエンド開発サーバー起動
# 使い方: backend ディレクトリで .\scripts\run_dev.ps1

$ErrorActionPreference = "Stop"
$PreferredPort = 8000
$FallbackPort = 8002
$FrontendEnv = Join-Path $PSScriptRoot "..\..\frontend\.env.development"

function Get-ListenerPid([int]$p) {
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.OwningProcess }
    return $null
}

function Stop-Listener([int]$p) {
    $pid = Get-ListenerPid $p
    if (-not $pid) { return $true }
    if (Get-Process -Id $pid -ErrorAction SilentlyContinue) {
        Write-Host "Stopping PID $pid on port $p..."
        Stop-Process -Id $pid -Force
        Start-Sleep -Seconds 1
        return $true
    }
    return $false
}

$port = $PreferredPort
if (-not (Stop-Listener $PreferredPort)) {
    Write-Warning "Port $PreferredPort is held by a zombie process. Using port $FallbackPort."
    Write-Warning "PC再起動後は $PreferredPort で起動できます。"
    $port = $FallbackPort
    Stop-Listener $FallbackPort | Out-Null
}

$backendUrl = "http://127.0.0.1:$port"
Set-Content -Path $FrontendEnv -Encoding utf8 -Value @(
    "# Auto-updated by run_dev.ps1",
    "VITE_DEV_BACKEND_URL=$backendUrl"
)

Write-Host "Vite proxy -> $backendUrl (see frontend/.env.development)"
Write-Host "Starting backend on $backendUrl"
Set-Location $PSScriptRoot\..
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port $port
