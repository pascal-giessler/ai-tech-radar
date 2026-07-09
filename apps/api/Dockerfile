FROM python:3.14-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/models

WORKDIR /app

# curl is used by container/k8s health probes
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src
RUN pip install .

# Non-root runtime; /models is writable for the fastembed cache (worker only)
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /models && chown -R appuser:appuser /models /app
USER appuser

EXPOSE 8000
# Default command is the API; the worker/migrate override this (compose & k8s).
CMD ["uvicorn", "airadar.main:app", "--host", "0.0.0.0", "--port", "8000"]
