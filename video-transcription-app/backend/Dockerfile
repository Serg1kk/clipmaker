# Backend Service Dockerfile
# FastAPI Python application for video processing orchestration
#
# Build: docker build -t video-transcription/backend:latest ./backend
# Run:   docker run -p 8000:8000 video-transcription/backend

FROM --platform=linux/arm64 python:3.11-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # FFmpeg for video processing (composition, subtitle burning)
    ffmpeg \
    # For health checks
    curl \
    # For font handling in subtitles
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -s /bin/bash backend

# Create directory structure
RUN mkdir -p /app/videos /app/processing /app/output /app/data /app/models \
    && chown -R backend:backend /app

WORKDIR /app

# Install Python dependencies first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=backend:backend . /app/

# Switch to non-root user
USER backend

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV API_HOST=0.0.0.0
ENV API_PORT=8000

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
