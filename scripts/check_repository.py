"""Conservative tracked/candidate-file guard; not a replacement for human review."""

import re
import subprocess
from pathlib import Path


def main():
    local_secrets = []
    if Path(".env").exists():
        for line in Path(".env").read_text().splitlines():
            key, _, value = line.partition("=")
            if ("SECRET" in key or "PASSWORD" in key) and len(value) >= 24:
                local_secrets.append(value)
    candidates = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"]
        )
        .decode()
        .split("\0")
    )
    violations = []
    prohibited = {
        "data",
        "datasets",
        "raw",
        "identity-mappings",
        "consent-records",
        "annotation-exports",
        "models",
        "checkpoints",
        "artifacts",
        "node_modules",
        ".venv",
        ".local",
    }
    for name in filter(None, candidates):
        path = Path(name)
        if (
            prohibited.intersection(path.parts)
            or path.suffix.lower()
            in {
                ".pem",
                ".key",
                ".p12",
                ".pt",
                ".pth",
                ".safetensors",
                ".onnx",
                ".db",
                ".sqlite",
                ".pdf",
                ".docx",
                ".log",
            }
            or (path.name.startswith(".env") and path.name != ".env.example")
        ):
            violations.append(name)
            continue
        if path.is_file():
            content = path.read_text(encoding="utf-8", errors="replace")
            if any(secret in content for secret in local_secrets):
                violations.append(name)
            if re.search(
                r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}",
                content,
            ):
                violations.append(name)
    for root in (Path("apps"), Path("packages/typescript-common/src")):
        for path in root.rglob("*.tsx"):
            if "node_modules" in path.parts or ".next" in path.parts:
                continue
            if re.search(
                r"console\.(log|debug)|localStorage|sessionStorage|google-analytics|@vercel/analytics",
                path.read_text(),
            ):
                violations.append(str(path))
    if violations:
        raise SystemExit("Repository safety check failed: " + ", ".join(sorted(set(violations))))
    print("Repository candidate-file and frontend privacy checks passed.")


if __name__ == "__main__":
    main()
