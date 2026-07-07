FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/models

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
RUN pip install .

EXPOSE 8000
CMD ["uvicorn", "airadar.main:app", "--host", "0.0.0.0", "--port", "8000"]
