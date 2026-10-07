"""Create a local development environment without displaying secrets."""

import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
    target = ROOT / ".env"
    if target.exists():
        print("Existing .env preserved. To rotate, explicitly archive it outside Git first.")
        return
    lines = []
    for line in (ROOT / ".env.example").read_text().splitlines():
        if "=GENERATE_LOCALLY" in line:
            key = line.split("=", 1)[0]
            line = key + "=" + secrets.token_urlsafe(36)
        lines.append(line)
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
        output.write("\n".join(lines) + "\n")
    print("Created gitignored .env with random DEVELOPMENT-ONLY credentials.")
    print("Next: docker compose up --build")
    print("Open http://localhost:3000 and http://localhost:3001")
    print("Read DEV_COUNSELLOR_USERNAME/PASSWORD privately from .env for dashboard login.")


if __name__ == "__main__":
    main()
