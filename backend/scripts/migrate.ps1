# DB マイグレーション（Windows）
# 使い方: backend ディレクトリで .\scripts\migrate.ps1
#
# 前提: PostgreSQL が起動していること
#   docker compose up -d   # backend ディレクトリで実行（Docker Desktop 起動後）

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Test-NeedsStamp001 {
    $out = python scripts\stamp_check.py 2>&1
    return ($LASTEXITCODE -eq 2)
}

Write-Host "Running: python -m alembic upgrade head"
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    if (Test-NeedsStamp001) {
        Write-Host ""
        Write-Host "Tables exist but alembic_version is missing. Stamping revision 001..." -ForegroundColor Yellow
        python -m alembic stamp 001
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Write-Host "Retrying: python -m alembic upgrade head"
        python -m alembic upgrade head
    }
}
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Migration failed." -ForegroundColor Red
    Write-Host "Tips:"
    Write-Host "  - Use python -m alembic (not bare alembic command)"
    Write-Host "  - Start PostgreSQL: docker compose up -d"
    Write-Host "  - If tables exist without alembic_version: python -m alembic stamp 001 && python -m alembic upgrade head"
    exit $LASTEXITCODE
}
Write-Host "Migration complete." -ForegroundColor Green
