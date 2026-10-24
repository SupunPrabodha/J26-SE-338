"""Prepare pinned Linux demo dependencies on the workspace drive, no model download.

Only a new ignored directory is written. The disposable installer container has
no access to accounts, database volumes, credentials, participant data or models.
"""

import argparse
import subprocess
from pathlib import Path

TORCH_WHEEL = (
    "https://download.pytorch.org/whl/cpu/"
    "torch-2.6.0%2Bcpu-cp312-cp312-linux_x86_64.whl"
    "#sha256=59e78aa0c690f70734e42670036d6b541930b8eabbaa18d94e090abf14cc4d91"
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--resume", action="store_true", help="Resume an inspected partial Linux environment"
    )
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    environment = root / ".local/c2-gliner-linux-env"
    temporary = root / ".local/c2-gliner-linux-tmp"
    existing = environment.exists() and any(environment.iterdir())
    if existing and not args.resume:
        raise SystemExit("Existing experimental environment preserved; inspect it before reuse")
    if args.resume and not (environment / "pyvenv.cfg").is_file():
        raise SystemExit("Resume requires an existing Linux virtual environment")
    environment.mkdir(exist_ok=True)
    temporary.mkdir(exist_ok=True)
    # This fixed shell program contains no interpolated input/secret values.
    install = (
        ("" if args.resume else "python -m venv --system-site-packages /opt/c2-gliner && ")
        + '( /opt/c2-gliner/bin/python -c "import importlib.metadata as m; '
        "assert m.version('torch') == '2.6.0+cpu'\" 2>/dev/null || "
        "/opt/c2-gliner/bin/pip install --timeout 120 --no-compile --no-cache-dir "
        + TORCH_WHEEL
        + " ) && "
        "/opt/c2-gliner/bin/pip install --timeout 120 --no-compile --no-cache-dir "
        "-r /requirements.txt && "
        "/opt/c2-gliner/bin/pip check"
    )
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--name",
            "c2-gliner-environment-installer",
            "--label",
            "j26.c2.experimental-installer=true",
            "--user",
            "root",
            "--env",
            "PIP_DISABLE_PIP_VERSION_CHECK=1",
            "--env",
            "TMPDIR=/tmp",
            "--mount",
            f"type=bind,source={environment},target=/opt/c2-gliner",
            "--mount",
            f"type=bind,source={temporary},target=/tmp",
            "--mount",
            f"type=bind,source={root / 'infrastructure/docker/c2-gliner-requirements.txt'},target=/requirements.txt,readonly",
            "j26-platform:0.1.0-dev",
            "sh",
            "-c",
            install,
        ],
        check=False,
    )
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
