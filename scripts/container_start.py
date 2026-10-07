import logging
import os

import uvicorn
from alembic import command
from alembic.config import Config

logging.basicConfig(level=logging.INFO, format="%(message)s")
for name in ("httpx", "httpcore", "sqlalchemy", "uvicorn.access"):
    logging.getLogger(name).setLevel(logging.CRITICAL)
service = os.environ["SERVICE_NAME"]
if service == "orchestrator":
    from orchestrator.manage import seed

    command.upgrade(Config("alembic.ini"), "head")
    seed()
uvicorn.run(f"{service}.main:app", host="0.0.0.0", port=8000, access_log=False, log_level="warning")
