#!/bin/bash
# Entrypoint script for whisper.cpp Docker container
# Handles video/audio input, extracts audio, and runs transcription

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration from environment variables
MODEL="${WHISPER_MODEL:-base}"
THREADS="${WHISPER_THREADS:-4}"
LANGUAGE="${WHISPER_LANGUAGE:-auto}"
OUTPUT_FORMAT="${WHISPER_OUTPUT_FORMAT:-txt}"

# Model path
MODEL_PATH="/app/models/ggml-${MODEL}.bin"

# Function to display help
show_help() {
    echo -e "${GREEN}Whisper.cpp Transcription Container${NC}"
    echo ""
    echo "Usage: docker run -v /path/to/input:/app/input -v /path/to/output:/app/output whisper-arm64 [OPTIONS] <input_file>"
    echo ""
    echo "Options:"
    echo "  --help              Show this help message"
    echo "  --language LANG     Set language (default: auto-detect)"
    echo "  --threads N         Number of threads (default: 4)"
    echo "  --format FORMAT     Output format: txt, srt, vtt (default: txt)"
    echo "  --translate         Translate to English"
    echo ""
    echo "Examples:"
    echo "  docker run -v \$(pwd):/app/input -v \$(pwd)/output:/app/output whisper-arm64 video.mp4"
    echo "  docker run -v \$(pwd):/app/input -v \$(pwd)/output:/app/output whisper-arm64 --language en audio.wav"
    echo ""
    echo "Environment Variables:"
    echo "  WHISPER_MODEL       Model to use (default: base)"
    echo "  WHISPER_THREADS     Number of threads (default: 4)"
    echo "  WHISPER_LANGUAGE    Language code (default: auto)"
    echo "  WHISPER_OUTPUT_FORMAT  Output format (default: txt)"
    exit 0
}

# Function to log messages
log() {
    echo -e "${GREEN}[WHISPER]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Parse arguments
TRANSLATE=""
INPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            ;;
        --language|-l)
            LANGUAGE="$2"
            shift 2
            ;;
        --threads|-t)
            THREADS="$2"
            shift 2
            ;;
        --format|-f)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        --translate)
            TRANSLATE="--translate"
            shift
            ;;
        *)
            INPUT_FILE="$1"
            shift
            ;;
    esac
done

# Check if input file is provided
if [ -z "$INPUT_FILE" ]; then
    log_error "No input file specified"
    show_help
fi

# Determine input path
if [[ "$INPUT_FILE" = /* ]]; then
    FULL_INPUT_PATH="$INPUT_FILE"
else
    FULL_INPUT_PATH="/app/input/$INPUT_FILE"
fi

# Check if input file exists
if [ ! -f "$FULL_INPUT_PATH" ]; then
    log_error "Input file not found: $FULL_INPUT_PATH"
    exit 1
fi

# Check if model exists
if [ ! -f "$MODEL_PATH" ]; then
    log_error "Model not found: $MODEL_PATH"
    log_error "Available models:"
    ls -la /app/models/ 2>/dev/null || echo "No models directory found"
    exit 1
fi

# Get base filename without extension
BASENAME=$(basename "$FULL_INPUT_PATH")
FILENAME="${BASENAME%.*}"

# Temporary audio file
TEMP_AUDIO="/tmp/${FILENAME}_audio.wav"

# Output file
OUTPUT_FILE="/app/output/${FILENAME}"

log "Starting transcription pipeline..."
log "Input: $FULL_INPUT_PATH"
log "Model: $MODEL"
log "Threads: $THREADS"
log "Language: $LANGUAGE"
log "Output Format: $OUTPUT_FORMAT"

# Step 1: Extract/Convert audio to 16kHz mono WAV (required by whisper.cpp)
log "Extracting audio with FFmpeg..."
ffmpeg -y -i "$FULL_INPUT_PATH" \
    -ar 16000 \
    -ac 1 \
    -c:a pcm_s16le \
    -loglevel warning \
    "$TEMP_AUDIO"

if [ ! -f "$TEMP_AUDIO" ]; then
    log_error "Failed to extract audio"
    exit 1
fi

log "Audio extracted successfully"

# Step 2: Build whisper command based on output format
WHISPER_CMD="/app/whisper"
WHISPER_ARGS="-m $MODEL_PATH -t $THREADS -f $TEMP_AUDIO"

# Add language if not auto
if [ "$LANGUAGE" != "auto" ]; then
    WHISPER_ARGS="$WHISPER_ARGS -l $LANGUAGE"
fi

# Add translate flag if specified
if [ -n "$TRANSLATE" ]; then
    WHISPER_ARGS="$WHISPER_ARGS --translate"
fi

# Add output format specific flags
case $OUTPUT_FORMAT in
    txt)
        WHISPER_ARGS="$WHISPER_ARGS -otxt -of $OUTPUT_FILE"
        ;;
    srt)
        WHISPER_ARGS="$WHISPER_ARGS -osrt -of $OUTPUT_FILE"
        ;;
    vtt)
        WHISPER_ARGS="$WHISPER_ARGS -ovtt -of $OUTPUT_FILE"
        ;;
    json)
        WHISPER_ARGS="$WHISPER_ARGS -oj -of $OUTPUT_FILE"
        ;;
    all)
        WHISPER_ARGS="$WHISPER_ARGS -otxt -osrt -ovtt -of $OUTPUT_FILE"
        ;;
    *)
        log_warn "Unknown format '$OUTPUT_FORMAT', defaulting to txt"
        WHISPER_ARGS="$WHISPER_ARGS -otxt -of $OUTPUT_FILE"
        ;;
esac

# Step 3: Run whisper transcription
log "Running whisper transcription..."
log "Command: $WHISPER_CMD $WHISPER_ARGS"

$WHISPER_CMD $WHISPER_ARGS

# Step 4: Cleanup
rm -f "$TEMP_AUDIO"

# Step 5: Report results
log "Transcription complete!"
log "Output files:"
ls -la /app/output/${FILENAME}.* 2>/dev/null || log_warn "No output files found"

# Print the text output if it exists
if [ -f "${OUTPUT_FILE}.txt" ]; then
    echo ""
    echo -e "${GREEN}=== Transcription Result ===${NC}"
    cat "${OUTPUT_FILE}.txt"
    echo ""
fi

exit 0
