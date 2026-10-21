"""Run local Docker evaluations and retain only aggregate JSON in ignored .local."""

import argparse
import json
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evaluation", choices=("postgres", "performance"))
    parser.add_argument("--samples", type=int, default=200)
    parser.add_argument("--warmup", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    script = "postgres_checks.py" if args.evaluation == "postgres" else "c1_performance.py"
    command = [
        "docker",
        "compose",
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "-v",
        str(Path("scripts").resolve()) + ":/verification:ro",
        "orchestrator",
        "python",
        "/verification/" + script,
    ]
    if args.evaluation == "performance":
        command += [
            "--samples",
            str(args.samples),
            "--warmup",
            str(args.warmup),
            "--concurrency",
            str(args.concurrency),
        ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        # Do not echo Docker exceptions, connection URLs or arbitrary subprocess output.
        try:
            failure = json.loads(result.stdout)
            if failure.get("passed") is False:
                print(
                    json.dumps(
                        {
                            key: failure[key]
                            for key in ("passed", "error_type", "frames")
                            if key in failure
                        }
                    )
                )
        except json.JSONDecodeError:
            pass
        raise SystemExit(
            "Synthetic evaluation failed; no report accepted. Inspect with the safe container harness."
        )
    report = json.loads(result.stdout)
    destination = Path(".local") / ("c1-" + args.evaluation + ".json")
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print("Aggregate evidence retained: " + str(destination))


if __name__ == "__main__":
    main()
