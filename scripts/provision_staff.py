"""Privately provision one local staff account using the existing identity backend."""

import argparse
import json
import os
import secrets
import subprocess
from pathlib import Path
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", required=True, choices=("ADMIN", "COUNSELLOR", "RESEARCHER"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = root / ".local" / ("staff-" + uuid4().hex + ".env")
    if (
        subprocess.run(
            ["git", "check-ignore", "--quiet", str(destination)], cwd=root, capture_output=True
        ).returncode
        != 0
    ):
        raise SystemExit("Refusing to write credentials outside an ignored local path")
    username, password = secrets.token_urlsafe(30), secrets.token_urlsafe(48)
    destination.parent.mkdir(exist_ok=True)
    # Exclusive creation; POSIX mode 0600. On Windows the existing user directory ACL applies.
    descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        output.write(
            f"STAFF_ROLE={args.role}\nSTAFF_USERNAME={username}\nSTAFF_PASSWORD={password}\n"
        )
    environment = dict(os.environ, STAFF_USERNAME=username, STAFF_PASSWORD=password)
    result = subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "-e",
            "STAFF_USERNAME",
            "-e",
            "STAFF_PASSWORD",
            "orchestrator",
            "python",
            "-m",
            "orchestrator.manage",
            "provision",
            "--role",
            args.role,
        ],
        cwd=root,
        env=environment,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise SystemExit(
            "Provisioning did not succeed. Private generated values remain at "
            + str(destination)
            + "; no command output was exposed."
        )
    try:
        account = json.loads(result.stdout)
        from uuid import UUID

        identifier = str(UUID(account["account_id"]))
    except (ValueError, KeyError, TypeError):
        raise SystemExit(
            "Provisioning returned an unexpected receipt; private file preserved"
        ) from None
    with destination.open("a", encoding="utf-8") as output:
        output.write(f"STAFF_ACCOUNT_ID={identifier}\n")
    print(
        f"Local {args.role} account provisioned. Read credentials privately in {destination}. Values were not printed."
    )


if __name__ == "__main__":
    main()
