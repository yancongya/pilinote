# Stage 1: Build frontend
FROM node:22-slim AS frontend-builder

WORKDIR /build
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY pnpm-lock.yaml ./
COPY apps/web/ ./
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: Python runtime (serves both API and frontend)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies: ffmpeg, aria2
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    aria2 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY apps/api/ ./

# Copy project data files (prompt templates, asr model registry)
COPY apps/api/data/ /app/data/

# Copy term-bases (terminology library)
COPY term-bases/ /app/term-bases/
ENV PILINOTE_TERM_BASES_DIR=/app/term-bases

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/dist /app/frontend

# Default runtime directory (can be overridden via volume mount)
ENV PILINOTE_RUNTIME_DIR=/data
ENV DATABASE_URL=sqlite:////data/data/pilinote.db

RUN mkdir -p /data/{logs,downloads,temp,data}

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
