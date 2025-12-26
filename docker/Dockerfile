# Optimized Dockerfile for whisper.cpp on ARM64/Apple Silicon (M1/M2/M3)
# Note: Metal acceleration is not available in Docker, using CPU with ARM NEON optimizations

FROM debian:bookworm-slim AS builder

# Build arguments for optimization
ARG DEBIAN_FRONTEND=noninteractive
ARG WHISPER_MODEL=base

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Clone whisper.cpp
WORKDIR /build
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git

# Build whisper.cpp with ARM64 optimizations
WORKDIR /build/whisper.cpp
RUN make clean && make -j$(nproc) \
    WHISPER_NO_METAL=1 \
    CFLAGS="-O3 -march=armv8-a+simd -mtune=native -ffast-math -funroll-loops" \
    CXXFLAGS="-O3 -march=armv8-a+simd -mtune=native -ffast-math -funroll-loops"

# Download the specified model
RUN bash ./models/download-ggml-model.sh ${WHISPER_MODEL}

# Runtime stage - minimal image
FROM debian:bookworm-slim AS runtime

ARG WHISPER_MODEL=base

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create working directories
RUN mkdir -p /app/models /app/input /app/output

# Copy whisper binary and model from builder
COPY --from=builder /build/whisper.cpp/main /app/whisper
COPY --from=builder /build/whisper.cpp/models/ggml-${WHISPER_MODEL}.bin /app/models/

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set working directory
WORKDIR /app

# Environment variables
ENV WHISPER_MODEL=${WHISPER_MODEL}
ENV WHISPER_THREADS=4
ENV WHISPER_LANGUAGE=auto
ENV WHISPER_OUTPUT_FORMAT=txt

# Volumes for input/output
VOLUME ["/app/input", "/app/output"]

# Entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command shows help
CMD ["--help"]
