import argparse
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
    parser.add_argument("command", choices=["seed"])
    parser.parse_args()
    seed()


if __name__ == "__main__":
    main()
