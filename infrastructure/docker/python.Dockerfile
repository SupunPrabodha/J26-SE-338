FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/packages/contracts/src:/app/packages/python-common/src:/app/services
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock && useradd --create-home --uid 10001 research
COPY packages/contracts/src packages/contracts/src
COPY packages/python-common/src packages/python-common/src
COPY services services
COPY infrastructure/database infrastructure/database
COPY alembic.ini .
COPY scripts/container_start.py scripts/container_start.py
USER research
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=4s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3)"
CMD ["python", "scripts/container_start.py"]
