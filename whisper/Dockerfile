# Whisper Service Dockerfile
# FFmpeg + whisper.cpp optimized for ARM64/M1
#
# Build: docker build -t video-transcription/whisper:latest ./whisper
# Run:   docker run -v whisper-models:/app/models video-transcription/whisper

# =============================================================================
# Stage 1: Build whisper.cpp with ARM optimizations
# =============================================================================
FROM --platform=linux/arm64 debian:bookworm-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Clone and build whisper.cpp
WORKDIR /build
RUN git clone https://github.com/ggerganov/whisper.cpp.git

WORKDIR /build/whisper.cpp

# Build with ARM NEON optimizations
RUN cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DWHISPER_NO_ACCELERATE=OFF \
    -DWHISPER_COREML=OFF \
    && cmake --build build --config Release -j$(nproc)

# =============================================================================
# Stage 2: Runtime image
# =============================================================================
FROM --platform=linux/arm64 python:3.11-slim-bookworm

# Build argument for model size
ARG WHISPER_MODEL=base

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    # FFmpeg with all codecs
    ffmpeg \
    # For health checks
    curl \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN useradd -m -s /bin/bash whisper

# Create directory structure
RUN mkdir -p /app/models /app/processing /app/output /app/bin \
    && chown -R whisper:whisper /app

# Copy whisper.cpp binaries from builder
COPY --from=builder /build/whisper.cpp/build/bin/main /app/bin/whisper
COPY --from=builder /build/whisper.cpp/build/bin/server /app/bin/whisper-server

# Set permissions
RUN chmod +x /app/bin/whisper /app/bin/whisper-server

# Install Python dependencies for the API wrapper
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=whisper:whisper . /app/

# Model download script
RUN echo '#!/bin/bash\n\
MODEL=${WHISPER_MODEL:-base}\n\
MODEL_PATH="/app/models/ggml-${MODEL}.bin"\n\
if [ ! -f "$MODEL_PATH" ]; then\n\
    echo "Downloading whisper ${MODEL} model..."\n\
    curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL}.bin" -o "$MODEL_PATH"\n\
    echo "Model downloaded successfully"\n\
else\n\
    echo "Model already exists at ${MODEL_PATH}"\n\
fi' > /app/download-model.sh && chmod +x /app/download-model.sh

# Switch to non-root user
USER whisper

# Environment variables
ENV WHISPER_MODEL=${WHISPER_MODEL}
ENV WHISPER_MODEL_PATH=/app/models
ENV WHISPER_THREADS=6
ENV PATH="/app/bin:${PATH}"

# Expose API port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Entrypoint: download model if needed, then start server
CMD ["/bin/bash", "-c", "/app/download-model.sh && python /app/server.py"]
