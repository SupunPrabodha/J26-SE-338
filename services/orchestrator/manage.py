import argparse
import json
import os

from research_common.config import settings
from research_common.database import Account, engine
from sqlalchemy import select
from sqlalchemy.orm import Session

from orchestrator.auth import passwords


def seed():
    if settings().environment != "development":
        raise SystemExit("Development only")
    with Session(engine()) as db, db.begin():
        for role in ("COUNSELLOR", "ADMIN"):
            username, password = (
                os.environ.get(f"DEV_{role}_USERNAME"),
                os.environ.get(f"DEV_{role}_PASSWORD"),
            )
            if not username or not password or len(password) < 24:
                raise SystemExit(
                    "Supply randomly generated synthetic account values through environment"
                )
            existing = db.scalar(select(Account).where(Account.username == username))
            if not existing:
                db.add(
                    Account(username=username, password_hash=passwords.hash(password), role=role)
                )
    print("Development synthetic accounts are ready; credentials were not printed.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed", "provision"])
    parser.add_argument("--role", choices=["ADMIN", "COUNSELLOR", "RESEARCHER"])
    args = parser.parse_args()
    if args.command == "seed":
        seed()
    else:
        if not args.role:
            parser.error("provision requires --role")
        provision(args.role)


def provision(role):
    """Local operator only. No public registration; never print credential values."""
    if settings().environment != "development":
        raise SystemExit("Development only")
    username, password = os.environ.get("STAFF_USERNAME", ""), os.environ.get("STAFF_PASSWORD", "")
    if (
        role not in {"ADMIN", "COUNSELLOR", "RESEARCHER"}
        or not 24 <= len(username) <= 100
        or len(password) < 32
    ):
        raise SystemExit("Supply generated private staff values through environment")
    with Session(engine()) as db, db.begin():
        if db.scalar(select(Account.id).where(Account.username == username)):
            raise SystemExit("Staff account already exists; no existing account was changed")
        account = Account(role=role, username=username, password_hash=passwords.hash(password))
        db.add(account)
        db.flush()
        result = {"account_id": account.id, "role": account.role}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
