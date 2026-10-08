"""Create a local development environment without displaying secrets."""

import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED_KEYS = {
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_SECRET",
    "PREPROCESSING_SECRET",
    "NLP_SECRET",
    "XAI_SECRET",
    "DEV_COUNSELLOR_USERNAME",
    "DEV_COUNSELLOR_PASSWORD",
    "DEV_ADMIN_USERNAME",
    "DEV_ADMIN_PASSWORD",
}


def create_environment(root: Path):
    """Generate credentials into a new private file; preserve any existing environment."""
    target = root / ".env"
    if target.exists():
        return False
    lines = []
    for line in (root / ".env.example").read_text().splitlines():
        key, separator, value = line.partition("=")
        if separator and key in GENERATED_KEYS:
            if value:
                raise ValueError("Credential fields in .env.example must be blank")
            line = key + "=" + secrets.token_urlsafe(36)
        lines.append(line)
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
        output.write("\n".join(lines) + "\n")
    return True


def main():
    if sys.version_info[:2] != (3, 12):
        raise SystemExit("Python 3.12 is required")
    for command in ("node", "npm", "docker"):
        if not shutil.which(command):
            raise SystemExit(f"Missing prerequisite: {command}")
    node = subprocess.check_output(["node", "--version"], text=True).strip()
    if not node.startswith("v22."):
        raise SystemExit("Node.js 22 LTS is required")
    subprocess.run(["docker", "compose", "version"], check=True)
    if not create_environment(ROOT):
        print("Existing .env preserved. To rotate, explicitly archive it outside Git first.")
        return
    print("Created gitignored .env with random DEVELOPMENT-ONLY credentials.")
    print("Next: docker compose up --build")
    print("Open http://localhost:3000 and http://localhost:3001")
    print("Read DEV_COUNSELLOR_USERNAME/PASSWORD privately from .env for dashboard login.")


if __name__ == "__main__":
    main()
