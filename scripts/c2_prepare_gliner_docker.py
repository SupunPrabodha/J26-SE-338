"""Prepare a read-only Docker mount from existing verified local assets; no download."""

import hashlib
import json
import os
import shutil
from pathlib import Path

from preprocessing.multilingual_candidate import WEIGHTS_SHA256


def main():
    source = Path(".local/c2-gliner-model")
    target = Path(".local/c2-gliner-docker")
    if target.exists():
        raise SystemExit("Existing Docker snapshot preserved")
    weights = source / "model.safetensors"
    digest = hashlib.file_digest(weights.open("rb"), "sha256").hexdigest()
    if digest != WEIGHTS_SHA256:
        raise SystemExit("Model integrity failure")
    target.mkdir()
    for item in source.iterdir():
        if item.is_file():
            if item.name == "model.safetensors":
                os.link(item, target / item.name)
            else:
                shutil.copyfile(item, target / item.name)
    config = json.loads((target / "gliner_config.json").read_text(encoding="utf-8"))
    config["model_name"] = "/models/backbone"
    (target / "gliner_config.json").write_text(json.dumps(config), encoding="utf-8")
    print("Existing weights verified; Docker-only local path configuration prepared.")


if __name__ == "__main__":
    main()
