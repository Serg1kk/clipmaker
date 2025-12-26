#!/bin/bash
# Run whisper transcription on a video file

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/transcribe.sh <video_file> [options]"
    echo ""
    echo "Options:"
    echo "  --language LANG    Language code (default: auto)"
    echo "  --format FORMAT    Output format: txt, srt, vtt, json, all"
    echo "  --translate        Translate to English"
    echo ""
    echo "Example:"
    echo "  ./scripts/transcribe.sh videos/my_video.mp4"
    echo "  ./scripts/transcribe.sh videos/spanish.mp4 --language es --translate"
    exit 1
fi

VIDEO_FILE="$1"
shift

# Check if file exists
if [ ! -f "$VIDEO_FILE" ]; then
    echo "❌ File not found: $VIDEO_FILE"
    exit 1
fi

# Get just the filename for mounting
FILENAME=$(basename "$VIDEO_FILE")
DIRNAME=$(dirname "$VIDEO_FILE")

echo "🎬 Transcribing: $FILENAME"
echo "📁 Output will be in: ./output/"

# Run whisper container
docker-compose run --rm \
    -v "$(cd "$DIRNAME" && pwd):/app/input:ro" \
    whisper "$FILENAME" "$@"

echo ""
echo "✅ Transcription complete!"
echo "📄 Check ./output/ for results"
