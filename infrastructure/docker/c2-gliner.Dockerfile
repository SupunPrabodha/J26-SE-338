FROM j26-platform:0.1.0-dev
# Prepare the Linux environment on the workspace drive using
# scripts/c2_prepare_gliner_environment.py; mount it read-only in the overlay.
# Large experimental packages never expand the Docker data disk/image layer.
ENV PATH=/opt/c2-gliner/bin:$PATH HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1
USER research
