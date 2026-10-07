$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
python scripts/bootstrap_dev.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
