# Windows / PowerShell

Install Python 3.12, Node.js 22 LTS, Git and Docker Desktop with Linux containers/WSL2. Start Docker Desktop. Clone and use a feature branch. Do not open `.env` in a shared screen recording.

```powershell
./scripts/bootstrap-dev.ps1
docker compose up --build
```

Use http://localhost:3000 and http://localhost:3001 in separate browser profiles. Read the random counsellor credentials privately from `.env`. The scripts preserve existing `.env` files. For environments that block PowerShell scripts, run `python scripts/bootstrap_dev.py` instead of weakening global execution policy.

Optional host checks:
```powershell
python -m venv .venv
./.venv/Scripts/python.exe -m pip install uv==0.12.23
./.venv/Scripts/uv.exe sync --frozen
./.venv/Scripts/ruff.exe check .
./.venv/Scripts/python.exe scripts/run.py pytest
./.venv/Scripts/python.exe scripts/run.py scripts.generate_contracts --check
npm ci
npm run contracts:check
npm run lint
npm run typecheck
npm test
```

Stop without deleting volumes: `docker compose down`. Reset disposable fixtures only: `./scripts/reset-dev.ps1 -ConfirmSyntheticReset`. No participant data may be placed in this environment.
