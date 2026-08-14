# rag/Dockerfile — RAG API Python Service
# Built from the AI-T root (context: ./)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install (fastapi + uvicorn are already listed here)
COPY rag/requirements.txt ./rag/requirements.txt
RUN pip install --no-cache-dir -r rag/requirements.txt

# Copy the full RAG package
# NOTE: backend/.env is NOT copied here — on AWS the RAG api reads secrets
# from Secrets Manager (via AWS_REGION env var) or from docker-compose env vars.
# For local dev, rag/config.py will fall back to reading ../backend/.env at runtime.
COPY rag/ ./rag/

# Pre-download models at build time so container startup is fast (~30s saved)
RUN python -c "from rag.embeddings.embedder import EmbedderSingleton; EmbedderSingleton.get_instance()" || true

EXPOSE 8001

CMD ["uvicorn", "rag.api:app", "--host", "0.0.0.0", "--port", "8001"]
