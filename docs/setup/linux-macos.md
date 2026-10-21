# Linux / macOS

Install Python 3.12, Node 22 LTS, Git and Docker Engine/Desktop with Compose. Use Linux containers.

```sh
bash scripts/bootstrap-dev.sh
docker compose up --build
```

Open localhost ports 3000/3001 in separate browser profiles and privately read generated staff credentials from `.env`. Bootstrap creates the file with mode 0600, preserves existing values and prints no secrets.

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install uv==0.12.23
.venv/bin/uv sync --frozen
.venv/bin/ruff check .
.venv/bin/python scripts/run.py pytest
.venv/bin/python scripts/run.py scripts.generate_contracts --check
npm ci
npm run contracts:check
npm run lint
npm run typecheck
npm test
```

Normal shutdown: `docker compose down`. Explicit disposable-data reset: `bash scripts/reset-dev.sh --confirm-synthetic-reset`. Do not expose Docker ports beyond loopback.
