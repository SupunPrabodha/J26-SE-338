"""Cross-platform Python entry point with the monorepo import roots."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
paths = [ROOT / "packages/contracts/src", ROOT / "packages/python-common/src", ROOT / "services"]
os.environ["PYTHONPATH"] = os.pathsep.join(map(str, paths))
if len(sys.argv) < 2:
    raise SystemExit("Usage: python scripts/run.py MODULE [arguments]")
raise SystemExit(subprocess.call([sys.executable, "-m", *sys.argv[1:]], cwd=ROOT))
