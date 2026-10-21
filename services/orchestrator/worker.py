import signal
import time

from research_common.web import redis_client

from orchestrator.workflow import claim_job, enforce_retention, process_job

running = True


def stop(*args):
    global running
    running = False


def main():
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    while running:
        try:
            redis_client().set("j26:worker:heartbeat", "synthetic-worker-ready", ex=120)
            if redis_client().get("j26:worker:probe"):
                redis_client().set("j26:worker:probe-result", "synthetic-task-complete", ex=60)
                redis_client().delete("j26:worker:probe")
            enforce_retention()
            job = claim_job()
            if job:
                process_job(*job)
        except Exception:
            # Exceptions may contain connection URLs; safe fixed event only.
            print(
                '{"event_type":"worker_dependency_unavailable","service_name":"worker"}', flush=True
            )
        time.sleep(1)


if __name__ == "__main__":
    main()
