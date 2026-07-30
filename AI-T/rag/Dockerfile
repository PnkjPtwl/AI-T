# rag/Dockerfile — RAG API Python Service
# Built from the AI-T root (context: ./)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY rag/requirements.txt ./rag/requirements.txt
RUN pip install --no-cache-dir -r rag/requirements.txt
RUN pip install --no-cache-dir uvicorn fastapi

# Copy the full RAG package and backend .env
COPY rag/ ./rag/
COPY backend/.env ./backend/.env

# Pre-download models at build time so startup is fast
RUN python -c "from rag.embeddings.embedder import EmbedderSingleton; EmbedderSingleton.get_instance()" || true

EXPOSE 8001

CMD ["uvicorn", "rag.api:app", "--host", "0.0.0.0", "--port", "8001"]
