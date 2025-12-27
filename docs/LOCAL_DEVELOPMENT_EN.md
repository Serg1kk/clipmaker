# Local Development Guide

> 🌐 **Language:** English | [Русский](LOCAL_DEVELOPMENT.md)

Complete guide for deploying Clipmaker on your local machine (macOS/Linux).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Install FFmpeg](#3-install-ffmpeg)
4. [Python & Whisper Setup](#4-python--whisper-setup)
5. [Video Folder Configuration](#5-video-folder-configuration)
6. [Backend Setup](#6-backend-setup)
7. [Frontend Setup](#7-frontend-setup)
8. [Running the Application](#8-running-the-application)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

### Required Software

| Software | Version | Check Command | Install |
|----------|---------|---------------|---------|
| **Node.js** | 20+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.11+ | `python3 --version` | [python.org](https://python.org/) |
| **FFmpeg** | 6+ | `ffmpeg -version` | See section 3 |
| **Git** | any | `git --version` | [git-scm.com](https://git-scm.com/) |

### API Keys

| Service | Purpose | Get Key |
|---------|---------|---------|
| **OpenRouter** | AI analysis (Gemini) | [openrouter.ai/keys](https://openrouter.ai/keys) |

---

## 2. Clone the Repository

```bash
# Navigate to your projects folder
cd ~/Projects  # or any folder you prefer

# Clone the repository
git clone https://github.com/Serg1kk/clipmaker.git

# Enter the project directory
cd clipmaker
```

### Project Structure

```
clipmaker/
├── backend/           # FastAPI server + Whisper
├── frontend/          # React application + nginx.conf
├── docker/            # Docker configurations (CLI whisper)
├── whisper/           # Whisper HTTP service (for production)
├── docs/              # Documentation
├── videos/            # Source video files
├── output/            # Rendered clips
├── uploads/           # Temporary uploads
├── docker-compose.yml              # Development config
├── docker-compose.production.yml   # Production config (microservices)
├── README.md
└── .env.example
```

---

## 3. Install FFmpeg

FFmpeg is used for:
- Extracting audio from video (for Whisper)
- Rendering final clips with subtitles
- Format conversion

### macOS (via Homebrew)

```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install FFmpeg
brew install ffmpeg

# Verify installation
ffmpeg -version
# Should show: ffmpeg version 7.x.x ...
```

### Ubuntu/Debian Linux

```bash
sudo apt update
sudo apt install ffmpeg

# Verify
ffmpeg -version
```

### Windows (WSL2)

```bash
# In WSL2 terminal
sudo apt update
sudo apt install ffmpeg
```

---

## 4. Python & Whisper Setup

### About Whisper

Whisper is OpenAI's speech recognition neural network. It runs **completely locally** on your machine.

| Model | Size | RAM | Speed* | Quality | Recommendation |
|-------|------|-----|--------|---------|----------------|
| `tiny` | 75 MB | 4 GB | 32x | ⭐⭐ | Quick tests |
| **`base`** | 142 MB | 4 GB | 16x | ⭐⭐⭐ | **Recommended** |
| `small` | 466 MB | 6 GB | 6x | ⭐⭐⭐⭐ | Better quality |
| `medium` | 1.5 GB | 10 GB | 2x | ⭐⭐⭐⭐⭐ | High quality |
| `large` | 2.9 GB | 16 GB | 1x | ⭐⭐⭐⭐⭐ | Maximum quality |

*Speed relative to real-time on Apple M1

### GPU Acceleration

| Platform | GPU Acceleration | How it Works |
|----------|------------------|--------------|
| **Mac M1/M2/M3** | ✅ MPS (Metal) | Automatic |
| **NVIDIA GPU** | ✅ CUDA | Automatic |
| **CPU only** | ❌ | 3-5x slower |

### Create Virtual Environment

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python3 -m venv venv

# Activate the environment
# macOS/Linux:
source venv/bin/activate
# Windows:
# .\venv\Scripts\activate

# Verify activation
which python
# Should show: /path/to/clipmaker/backend/venv/bin/python
```

### Install Dependencies

```bash
# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

**Installation time:** ~5-10 minutes (PyTorch is large)

### First Whisper Run (Model Download)

On first use, Whisper will automatically download the model:

```bash
# Test run to download the model
python -c "import whisper; whisper.load_model('base')"
```

Model is saved to `~/.cache/whisper/` (~150MB for base)

---

## 5. Video Folder Configuration

You have **3 options** for organizing your video files:

### Option A: Project Folder (Recommended for Starting)

```bash
# Create videos folder in project
mkdir -p videos

# Copy a test video
cp ~/Downloads/test-video.mp4 videos/
```

**Pros:** Everything in one place, easy to backup
**Cons:** Videos take space in project folder

### Option B: System Videos Folder

```bash
# Create folder if it doesn't exist
mkdir -p ~/Videos/clipmaker-source

# In .env, specify the path
VIDEO_SOURCE_PATH=~/Videos/clipmaker-source
```

**Pros:** Videos separate from code, doesn't affect git
**Cons:** Need to remember file locations

### Option C: Symlink to Any Folder

```bash
# Create symbolic link to existing video folder
ln -s /Volumes/ExternalDrive/MyVideos ./videos

# Or link to iCloud/Dropbox folder
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/Videos ./videos
```

**Pros:** Use your existing folder structure
**Cons:** Need to ensure drive is available

### Verify Access

```bash
# Check that folder exists and contains videos
ls -la videos/

# Should show your video files
# -rw-r--r--  1 user  staff  50000000 Dec 27 10:00 video.mp4
```

---

## 6. Backend Setup

### Create Configuration File

```bash
# Navigate to project root
cd ..  # exit backend folder to project root

cat > .env << 'EOF'
# ============================================
# API Keys
# ============================================
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# ============================================
# Video Source
# ============================================
# Option A: folder in project
VIDEO_SOURCE_PATH=./videos

# Option B: system folder
# VIDEO_SOURCE_PATH=~/Videos/clipmaker-source

# ============================================
# Whisper Configuration
# ============================================
# Models: tiny, base, small, medium, large
WHISPER_MODEL=base

# ============================================
# Processing Settings
# ============================================
MAX_CONCURRENT_JOBS=2
CLIP_MIN_DURATION=13
CLIP_MAX_DURATION=60

# ============================================
# FFmpeg Settings
# ============================================
# Presets: ultrafast, superfast, fast, medium, slow
FFMPEG_PRESET=medium
# CRF: 18 (best quality) - 28 (smaller size)
FFMPEG_CRF=23
EOF
```

### Getting OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai/)
2. Sign up / Log in
3. Navigate to [API Keys](https://openrouter.ai/keys)
4. Click "Create Key"
5. Copy the key (starts with `sk-or-v1-`)
6. Paste into `.env` file

---

## 7. Frontend Setup

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install
```

**Installation time:** ~2-3 minutes

---

## 8. Running the Application

### Start Backend (Terminal 1)

```bash
# Make sure you're in project root
cd /path/to/clipmaker

# Activate virtual environment
source backend/venv/bin/activate

# Navigate to backend
cd backend

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345]
INFO:     Started server process [12346]
INFO:     Application startup complete.
```

### Start Frontend (Terminal 2)

```bash
# In a new terminal
cd /path/to/clipmaker/frontend

# Start dev server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

---

## 9. Verify Everything Works

### Check Backend API

```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}

# Check video files list
curl http://localhost:8000/files

# API documentation
open http://localhost:8000/docs
```

### Check Frontend

1. Open browser: http://localhost:5173/
2. Main page should load
3. Verify videos from folder are displayed

### Test Transcription

1. Select a video in the interface
2. Click "Transcribe"
3. Wait for completion (real-time progress)
4. Check results with timestamps

---

## 10. Troubleshooting

### Whisper Can't Find GPU (Mac)

```bash
# Check MPS availability
python -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"

# If False - upgrade PyTorch
pip install --upgrade torch torchvision torchaudio
```

### FFmpeg Not Found

```bash
# Check installation
which ffmpeg
# Should show path, e.g. /opt/homebrew/bin/ffmpeg

# If empty - reinstall
brew reinstall ffmpeg
```

### "Module not found" Error

```bash
# Make sure virtual environment is active
which python
# Should show path in venv, NOT /usr/bin/python

# If not - activate it
source backend/venv/bin/activate
```

### Port 8000 Already in Use

```bash
# Find the process
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use different port
uvicorn main:app --reload --port 8001
```

### Videos Not Showing

```bash
# Check videos folder
ls -la videos/

# Check permissions
chmod 755 videos/
chmod 644 videos/*.mp4

# Verify format is supported
# Supported: .mp4, .mov, .avi, .mkv, .webm, .m4v
```

### OpenRouter API Error

```bash
# Check key is set
echo $OPENROUTER_API_KEY
# or
grep OPENROUTER .env

# Check balance at openrouter.ai/credits
```

---

## Quick Start (TL;DR)

```bash
# 1. Clone
git clone https://github.com/Serg1kk/clipmaker.git && cd clipmaker

# 2. Install FFmpeg (Mac)
brew install ffmpeg

# 3. Setup backend
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# 4. Create .env (in project root)
cd .. && cp .env.example .env
# Edit .env - add OPENROUTER_API_KEY

# 5. Create videos folder and add test video
mkdir -p videos && cp ~/Downloads/test.mp4 videos/

# 6. Start backend (terminal 1)
cd backend && source venv/bin/activate && uvicorn main:app --reload

# 7. Start frontend (terminal 2)
cd frontend && npm install && npm run dev

# 8. Open http://localhost:5173/
```

---

## Useful Commands

```bash
# Restart backend
# Ctrl+C in backend terminal, then:
uvicorn main:app --reload

# Clear Whisper model cache
rm -rf ~/.cache/whisper/

# Watch logs in real-time
tail -f backend/logs/app.log  # if logging is configured

# Check memory usage
top -pid $(pgrep -f uvicorn)
```
