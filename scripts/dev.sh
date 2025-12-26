#!/bin/bash
# Development startup script

set -e

echo "🚀 Starting Video Transcription Development Environment..."

# Create necessary directories
mkdir -p videos output

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Build and start services
echo "📦 Building containers..."
docker-compose build

echo "🔄 Starting services..."
docker-compose up -d backend frontend

echo ""
echo "✅ Services started!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📁 Place video files in: ./videos/"
echo "📄 Transcriptions saved to: ./output/"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
