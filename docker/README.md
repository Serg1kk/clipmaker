# Whisper.cpp Docker for ARM64/Apple Silicon

Optimized Docker container for running whisper.cpp transcription on ARM64 architecture (Apple M1/M2/M3).

## Build Instructions

### Quick Build (default base model)

```bash
cd docker
docker build -t whisper-arm64 .
```

### Build with Different Model

Available models: `tiny`, `base`, `small`, `medium`, `large`

```bash
# Build with small model (better accuracy, slower)
docker build --build-arg WHISPER_MODEL=small -t whisper-arm64:small .

# Build with tiny model (fastest, lower accuracy)
docker build --build-arg WHISPER_MODEL=tiny -t whisper-arm64:tiny .
```

### Build for Specific Platform

```bash
# Ensure ARM64 build on Apple Silicon
docker build --platform linux/arm64 -t whisper-arm64 .
```

## Usage

### Basic Transcription

```bash
# Transcribe a video file
docker run --rm \
  -v $(pwd):/app/input \
  -v $(pwd)/output:/app/output \
  whisper-arm64 video.mp4
```

### With Options

```bash
# Specify language and output format
docker run --rm \
  -v $(pwd):/app/input \
  -v $(pwd)/output:/app/output \
  whisper-arm64 --language en --format srt video.mp4

# Translate to English
docker run --rm \
  -v $(pwd):/app/input \
  -v $(pwd)/output:/app/output \
  whisper-arm64 --translate foreign_video.mp4

# Use more threads for faster processing
docker run --rm \
  -v $(pwd):/app/input \
  -v $(pwd)/output:/app/output \
  -e WHISPER_THREADS=8 \
  whisper-arm64 video.mp4
```

### Output Formats

- `txt` - Plain text (default)
- `srt` - SubRip subtitles
- `vtt` - WebVTT subtitles
- `json` - JSON with timestamps
- `all` - Generate all formats

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | `base` | Model name |
| `WHISPER_THREADS` | `4` | CPU threads |
| `WHISPER_LANGUAGE` | `auto` | Language code |
| `WHISPER_OUTPUT_FORMAT` | `txt` | Output format |

## Performance Notes

- Metal GPU acceleration is not available in Docker
- Container uses ARM NEON SIMD optimizations for CPU
- Recommended: Use 4-8 threads on M1/M2
- The `base` model offers good balance of speed/accuracy
- For batch processing, consider `tiny` model

## Supported Input Formats

Any format supported by FFmpeg:
- Video: MP4, MKV, AVI, MOV, WebM
- Audio: MP3, WAV, FLAC, AAC, OGG

## Troubleshooting

### Container exits immediately
Check that input file exists and is mounted correctly.

### Out of memory
Use a smaller model (`tiny` or `base`).

### Slow performance
Increase thread count with `-e WHISPER_THREADS=8`.
