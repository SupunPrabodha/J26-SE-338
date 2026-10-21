param([switch]$ConfirmSyntheticReset)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmSyntheticReset) { throw 'DEVELOPMENT ONLY: pass -ConfirmSyntheticReset to erase this Compose project synthetic volumes.' }
Set-Location (Split-Path -Parent $PSScriptRoot)
docker compose down --volumes
