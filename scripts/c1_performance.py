"""C1 core overhead proxy using PostgreSQL and the existing in-process development mocks."""

import argparse
import importlib.metadata
import json
import math
import os
import platform
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from threading import Event

from orchestrator import main, workflow
from research_common.database import Case, Job, engine
from sqlalchemy import select
from sqlalchemy.orm import Session
from synthetic_runtime import (
    isolated_postgres,
    owner_consent,
    request,
    submission,
    synthetic_adapter,
)


def percentiles(values):
    ordered = sorted(values)
    if not ordered:
        return {"p50_ms": None, "p95_ms": None, "p99_ms": None}
    return {
        f"p{p}_ms": round(ordered[max(0, math.ceil(len(ordered) * p / 100) - 1)], 3)
        for p in (50, 95, 99)
    }


def batch(samples, concurrency):
    # Provisioning/consent are setup, deliberately outside the measured intake boundary.
    prepared = [owner_consent() for _ in range(samples)]

    def intake(pair):
        owner, consent = pair
        body, req = submission(consent), request()
        with Session(engine(), expire_on_commit=False) as db:
            start = time.perf_counter_ns()
            response = main.submit(body, req, owner, db)
            elapsed = (time.perf_counter_ns() - start) / 1e6
        return str(response.case_id), elapsed

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        intakes = dict(pool.map(intake, prepared))
    intake_wall = time.perf_counter() - started
    with Session(engine()) as db:
        mapping = {
            job.id: job.case_id for job in db.scalars(select(Job).where(Job.status == "QUEUED"))
        }

    def execute(_):
        mock_ns = 0

        def timed_adapter(*args):
            nonlocal mock_ns
            begin = time.perf_counter_ns()
            try:
                return synthetic_adapter(*args)
            finally:
                mock_ns += time.perf_counter_ns() - begin

        begin = time.perf_counter_ns()
        claimed = workflow.claim_job()
        # SKIP LOCKED can temporarily find no row while another claimant commits.
        # This bounded polling delay is included in the measured claim overhead.
        deadline = time.monotonic() + 5
        while not claimed and time.monotonic() < deadline:
            Event().wait(0.001)
            claimed = workflow.claim_job()
        if not claimed:
            return None
        workflow.process_job(*claimed, adapter=timed_adapter)
        elapsed = (time.perf_counter_ns() - begin - mock_ns) / 1e6
        return mapping[claimed[0]], elapsed, mock_ns / 1e6

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        executions = list(pool.map(execute, range(samples)))
    workflow_wall = time.perf_counter() - started
    with Session(engine()) as db:
        completed = {
            case.id for case in db.scalars(select(Case).where(Case.status == "READY_FOR_REVIEW"))
        }
    valid = [row for row in executions if row and row[0] in completed]
    total = [intakes[case] + elapsed for case, elapsed, _ in valid]
    return {
        "samples": samples,
        "successful_samples": len(valid),
        "errors": samples - len(valid),
        "error_rate": (samples - len(valid)) / samples,
        "c1_core_overhead": percentiles(total),
        "intake": percentiles(list(intakes.values())),
        "workflow_excluding_mock": percentiles([elapsed for _, elapsed, _ in valid]),
        "excluded_mock_time": percentiles([mock for _, _, mock in valid]),
        "measured_phase_wall_seconds": round(intake_wall + workflow_wall, 6),
        "observed_batch_throughput_per_second": round(
            len(valid) / (intake_wall + workflow_wall), 3
        ),
        "provisional_p95_target_ms": 500,
        "proxy_below_provisional_target": bool(total) and percentiles(total)["p95_ms"] < 500,
    }


def resource_value(path):
    file = Path(path)
    return file.read_text().strip() if file.exists() else "unavailable"


def run(samples=200, warmup=20, concurrency=4):
    if not (1 <= concurrency <= 16 and 1 <= samples <= 2000 and 1 <= warmup <= 100):
        raise ValueError("Use bounded synthetic evaluation parameters")
    with isolated_postgres():
        warmed = batch(warmup, concurrency)
        if warmed["errors"]:
            raise RuntimeError("Warm-up did not drain; no measurement accepted")
        result = batch(samples, concurrency)
        with engine().connect() as connection:
            database_version = connection.exec_driver_sql("SHOW server_version").scalar()
    return {
        "synthetic": True,
        "measurement": "MOCK_BASED_C1_CORE_PROXY",
        "measured_at": datetime.now(UTC).isoformat(),
        "environment": {
            "python": platform.python_version(),
            "system": platform.system(),
            "release": platform.release(),
            "architecture": platform.machine(),
            "visible_logical_cpus": os.cpu_count(),
            "cpu_quota": resource_value("/sys/fs/cgroup/cpu.max"),
            "memory_limit_bytes": resource_value("/sys/fs/cgroup/memory.max"),
            "postgresql": database_version,
            "packages": {
                name: importlib.metadata.version(name)
                for name in ("SQLAlchemy", "fastapi", "pydantic", "psycopg")
            },
        },
        "fixture": "english / synthetic-fixtures-1",
        "concurrency": concurrency,
        "warmup_samples": warmup,
        "percentile_method": "nearest rank",
        "results": result,
        "boundaries": "Per case: validated submission handler through commit/response construction plus claim and process_job through final commit, minus measured in-process provider calls. Intake and worker phases run separately; per-case timings are summed. Queue wait excluded.",
        "throughput_boundary": "Successful workflows divided by intake batch wall time plus worker batch wall time; includes mock calls, excludes setup, migration, verification and queue delay between phases.",
        "limitations": [
            "No HTTP transport, JWT/CSRF/session dependency timing, consent creation, browser or queue latency.",
            "Existing mock endpoints invoked in-process; no real inference or remote adapter/network overhead.",
            "Shared Docker Desktop/WSL resources; no CPU isolation or dedicated benchmark host.",
            "Single synthetic workload and run; this comparison does not establish real integration compliance.",
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=200)
    parser.add_argument("--warmup", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.samples, args.warmup, args.concurrency), indent=2))
    except Exception as error:
        print(
            json.dumps(
                {
                    "passed": False,
                    "error_type": type(error).__name__,
                    "frames": [
                        {
                            "file": Path(frame.filename).name,
                            "line": frame.lineno,
                            "function": frame.name,
                        }
                        for frame in traceback.extract_tb(error.__traceback__)
                    ],
                }
            )
        )
        raise SystemExit(1) from None
