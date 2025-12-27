# AI Clips - Video Transcription & Clip Generation

A full-stack application for transcribing videos, identifying engaging moments using AI, and generating short-form clips with synchronized subtitles.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

| Software | Minimum Version | Download |
|----------|-----------------|----------|
| **Node.js** | 20.x or higher | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.12 or higher | [python.org](https://www.python.org/) |
| **Docker** | 24.x or higher | [docker.com](https://www.docker.com/) |
| **Docker Compose** | 2.x or higher | Included with Docker Desktop |

### Verify Installation

```bash
# Check Node.js
node --version  # Should output v20.x.x or higher

# Check Python
python3 --version  # Should output Python 3.12.x or higher

# Check Docker
docker --version  # Should output Docker version 24.x.x or higher
docker compose version  # Should output Docker Compose version v2.x.x
```

### API Keys Required

- **OpenRouter API Key** - For AI-powered moment detection using Gemini models
  - Get your key at: [https://openrouter.ai/keys](https://openrouter.ai/keys)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ai-clips.git
cd ai-clips
```

### 2. Create Environment File

Create a `.env` file in the project root with your configuration:

```bash
# Copy the example (if available) or create new
cp video-transcription-app/.env.example .env

# Or create manually
touch .env
```

Add the following required configuration to your `.env` file:

```env
# ============================================================================
# REQUIRED: API Keys
# ============================================================================

# OpenRouter API key for Gemini access
# Get yours at: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# ============================================================================
# REQUIRED: Video Source Path
# ============================================================================

# Path to your local video files directory
# The backend will have READ-ONLY access to this directory
# Examples:
#   macOS: /Users/yourname/Videos
#   Linux: /home/yourname/Videos
VIDEO_SOURCE_PATH=~/Videos

# ============================================================================
# OPTIONAL: Model Configuration
# ============================================================================

# Gemini model to use via OpenRouter
# Options: google/gemini-2.5-pro-preview, google/gemini-pro, google/gemini-1.5-pro
GEMINI_MODEL=google/gemini-2.5-pro-preview

# Whisper model size for transcription
# Options: tiny, base, small, medium, large
# Recommended for 16GB RAM: base or small
WHISPER_MODEL=base

# ============================================================================
# OPTIONAL: Processing Settings
# ============================================================================

# Maximum concurrent processing jobs
MAX_CONCURRENT_JOBS=2

# Clip duration constraints (seconds)
CLIP_MIN_DURATION=13
CLIP_MAX_DURATION=60

# FFmpeg encoding preset: ultrafast, superfast, fast, medium, slow
FFMPEG_PRESET=medium

# FFmpeg CRF (quality): 18-28 recommended, lower = better quality
FFMPEG_CRF=23
```

---

## Running with Docker

### Build and Start All Services

```bash
# Build the Docker images
docker compose build

# Start all services in detached mode
docker compose up -d

# Or build and start in one command
docker compose up -d --build
```

### View Logs

```bash
# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (clears data)
docker compose down -v
```

---

## Accessing the Application

Once the services are running, access the application at:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | [http://localhost:3000](http://localhost:3000) | React web interface |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI REST endpoints |
| **API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger/OpenAPI documentation |

### Health Check

Verify services are running:

```bash
# Check backend health
curl http://localhost:8000/health

# Check frontend
curl -I http://localhost:3000
```

---

## Usage Guide

This section provides a complete step-by-step walkthrough for creating short-form video clips from your source videos.

### Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI CLIPS WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ 1. ADD   │───▶│ 2. CREATE│───▶│ 3. SELECT│───▶│ 4. TRANS-│              │
│  │  VIDEOS  │    │  PROJECT │    │   VIDEO  │    │   CRIBE  │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                                               │                     │
│       ▼                                               ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │              /videos folder (your source videos)             │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ 5. GET   │───▶│ 6. SELECT│───▶│ 7. CONFIG│───▶│ 8. RENDER│              │
│  │ AI MOMENT│    │ TEMPLATE │    │ SUBTITLES│    │   CLIP   │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                                               │                     │
│       ▼                                               ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │              /output folder (your rendered clips)            │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: Adding Videos to the /videos Folder

Before you can start creating clips, you need to add your source video files to the `/videos` folder.

**Supported Formats:** MP4, MOV, AVI, MKV, WebM, M4V

#### Method 1: Direct Copy (Recommended)

```bash
# Navigate to the project directory
cd ai-clips

# Copy your video files to the videos folder
cp /path/to/your/video.mp4 ./videos/

# Or move multiple files
cp /path/to/videos/*.mp4 ./videos/
```

#### Method 2: Symlink (For Large Video Collections)

```bash
# Create a symbolic link to your existing video folder
ln -s /path/to/your/videos ./videos
```

#### Method 3: Configure VIDEO_SOURCE_PATH

If you prefer to keep videos in a different location, update your `.env` file:

```env
# Point to your existing video library
VIDEO_SOURCE_PATH=/Users/yourname/Movies
```

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO FOLDER STRUCTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ai-clips/                                                      │
│  ├── videos/                    ◄── Add your videos here        │
│  │   ├── interview.mp4                                          │
│  │   ├── podcast-episode-1.mov                                  │
│  │   ├── tutorial.mkv                                           │
│  │   └── vlog-2024-01-15.mp4                                    │
│  │                                                              │
│  └── output/                    ◄── Rendered clips appear here  │
│      ├── clip_001.mp4                                           │
│      └── clip_002.mp4                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Important Notes:**
- The Docker container mounts the `/videos` folder as read-only
- Ensure video files have read permissions: `chmod 644 ./videos/*`
- Large files (1GB+) work fine but may take longer to process

---

### Step 2: Creating a New Project

Once your videos are in place, create a project to organize your work.

**Navigate to:** [http://localhost:3000/projects](http://localhost:3000/projects)

```
┌─────────────────────────────────────────────────────────────────┐
│  PROJECTS PAGE                                          [+ New] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Project 1      │  │  Project 2      │  │  [Empty State]  │ │
│  │  ─────────────  │  │  ─────────────  │  │                 │ │
│  │  📹 video.mp4   │  │  📹 podcast.mov │  │  No projects    │ │
│  │  Created: Today │  │  Created: Yest. │  │  yet. Click     │ │
│  │  [🗑️ Delete]    │  │  [🗑️ Delete]    │  │  "+ New" to     │ │
│  └─────────────────┘  └─────────────────┘  │  get started.   │ │
│                                            └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Click the **"+ New Project"** button (top right)
2. A new project is automatically created with a timestamp name
3. You're redirected to the **Project Editor** page

---

### Step 3: Selecting a Video for Your Project

In the Project Editor, you'll attach a source video to your project.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    PROJECT: New Project - Dec 27, 2:30 PM               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────┐  ┌──────────────┐ │
│  │         VIDEO SOURCE                    │  │   DETAILS    │ │
│  │  ┌───────────────────────────────────┐  │  │              │ │
│  │  │                                   │  │  │ Created:     │ │
│  │  │        No video attached          │  │  │ Dec 27, 2024 │ │
│  │  │                                   │  │  │              │ │
│  │  │      [🎬 Select Video]            │  │  │ Updated:     │ │
│  │  │                                   │  │  │ Just now     │ │
│  │  └───────────────────────────────────┘  │  │              │ │
│  │                                          │  ├──────────────┤ │
│  └─────────────────────────────────────────┘  │   ACTIONS    │ │
│                                               │              │ │
│                                               │ [📹 Select   │ │
│                                               │    Video]    │ │
│                                               │ [📤 Export]  │ │
│                                               └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Click **"Select Video"** button
2. A video picker modal appears showing all videos in `/videos`
3. Click on your desired video to highlight it
4. Click **"Select Video"** to confirm

```
┌─────────────────────────────────────────────────────────────────┐
│  SELECT VIDEO                                        [🔄 Refresh]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ ▶ interview.mp4        │  │ ▶ podcast-ep1.mov       │      │
│  │   1.2 GB • 45:30 • 1080p│  │   890 MB • 32:15 • 1080p│      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ ▶ tutorial.mkv     [✓] │  │ ▶ vlog.mp4              │      │
│  │   650 MB • 22:10 • 720p │  │   420 MB • 15:45 • 1080p│      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Select Video]           │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 4: Running Transcription

After selecting a video, run the transcription to generate word-level timestamps.

**This step uses Whisper AI to:**
- Extract audio from your video
- Transcribe speech to text
- Generate precise word-by-word timestamps

```
┌─────────────────────────────────────────────────────────────────┐
│  TRANSCRIPTION PROGRESS                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📹 interview.mp4                                               │
│                                                                 │
│  Stage: Transcribing audio...                                   │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  42%           │
│                                                                 │
│  ⏱️ Elapsed: 2:34                                                │
│  📊 Processing: 00:15:30 / 00:45:30                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. With a video selected, click **"Transcribe"** button
2. Wait for transcription to complete (progress shown via WebSocket)
3. The transcription includes:
   - Full text transcript
   - Word-level timestamps
   - Language detection

**Transcription Tips:**
- First run downloads the Whisper model (~1GB for `base`)
- Use `WHISPER_MODEL=base` for English (faster)
- Use `WHISPER_MODEL=small` for multilingual (more accurate)

---

### Step 5: Getting AI Moments

After transcription, use AI to automatically detect engaging moments.

**AI analyzes the transcript to find:**
- Emotional peaks
- Key insights or quotes
- Dramatic moments
- Hook-worthy segments

```
┌─────────────────────────────────────────────────────────────────┐
│  AI MOMENTS SIDEBAR                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AI Moments                                                     │
│  5 moments detected                                             │
│                                                                 │
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 🎯 The Breakthrough Moment                                  ││
│  │    02:34 - 02:58                              [24s]         ││
│  │    "This is when everything changed..."                     ││
│  │    ●●●○○ 85%                           [AI] [🗑️]            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 💡 Key Insight                                              ││
│  │    05:12 - 05:45                              [33s]         ││
│  │    "The secret is consistency..."                           ││
│  │    ●●●●○ 92%                           [AI] [🗑️]            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 🎭 Emotional Peak                                           ││
│  │    12:08 - 12:35                              [27s]         ││
│  │    "I never thought I'd say this..."                        ││
│  │    ●●●○○ 78%                           [AI] [🗑️]            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Time Range**: Shows start and end timestamps
- **Duration Badge**: Quick view of clip length
- **Description**: AI-generated reason for selection
- **Confidence Score**: How confident AI is (green/yellow/red)
- **Click to Seek**: Click any moment to jump to that point
- **Delete**: Remove unwanted moments with 🗑️ button

---

### Step 6: Selecting a Template

Choose a frame layout for your final clip.

```
┌─────────────────────────────────────────────────────────────────┐
│  TEMPLATE SELECTOR                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select video template layout:                                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ┌──────────┐ │  │ ┌────┐┌────┐ │  │ ┌──┐┌──┐┌──┐ │          │
│  │ │          │ │  │ │    ││    │ │  │ │  ││  ││  │ │          │
│  │ │  Single  │ │  │ │Side││Side│ │  │ │TripleFrame │          │
│  │ │  Frame   │ │  │ │    ││    │ │  │ │  ││  ││  │ │          │
│  │ └──────────┘ │  │ └────┘└────┘ │  │ └──┘└──┘└──┘ │          │
│  │  [✓] Active  │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│   Single Frame      Two Frames       Three Frames              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Available Templates:**

| Template | Description | Best For |
|----------|-------------|----------|
| **Single Frame** | One video frame, full width | Standard clips, talking heads |
| **Two Frames** | Side-by-side dual layout | Reactions, comparisons |
| **Three Frames** | Triple frame layout | Multi-angle, B-roll heavy |

---

### Step 7: Configuring Subtitles

Customize how subtitles appear on your clip.

```
┌─────────────────────────────────────────────────────────────────┐
│  TEXT STYLING PANEL                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Font Family                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Arial                                              [▼]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Font Size                                            32px     │
│  ○────────────────●────────────────────────────────────○       │
│  12px                                                 72px     │
│                                                                 │
│  Text Color                                                     │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│  │███│ │███│ │███│ │███│ │███│ │███│ │███│ │[✓]│            │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘            │
│                                                                 │
│  Text Position                                                  │
│  ┌────────┐  ┌────────┐  ┌────────┐                            │
│  │  TOP   │  │ CENTER │  │ BOTTOM │ ← Selected                 │
│  └────────┘  └────────┘  └────────┘                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Preview                                                  │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │                                                     │ │   │
│  │ │                                                     │ │   │
│  │ │                  Sample Text                        │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Subtitle Options:**

| Option | Values | Description |
|--------|--------|-------------|
| **Font Family** | Arial, Helvetica, Roboto, Impact, etc. | 10 font choices |
| **Font Size** | 12px - 72px | Slider for precise control |
| **Text Color** | Preset palette + custom hex | Click to select |
| **Position** | Top, Center, Bottom | Vertical placement |

**Pro Tips:**
- Use **Impact** for bold, attention-grabbing captions
- **32-48px** works well for most vertical clips
- **White with black outline** is most readable
- **Bottom** position is standard for short-form

---

### Step 8: Rendering the Final Clip

Generate your final video clip with subtitles and audio.

```
┌─────────────────────────────────────────────────────────────────┐
│  RENDER CLIP                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📹 Moment: "The Breakthrough Moment"                           │
│  ⏱️ Duration: 24 seconds (02:34 - 02:58)                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rendering Progress                                      │   │
│  │  ████████████████████████████░░░░░░░░░░░░  65%            │   │
│  │                                                          │   │
│  │  Stage: Encoding video with subtitles...                 │   │
│  │  Elapsed: 00:45                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                           [Cancel]  [Render]    │
└─────────────────────────────────────────────────────────────────┘
```

**Render Process:**
1. Select a moment from the AI Moments sidebar
2. Configure subtitle styling (Step 7)
3. Click **"Render"** button
4. Progress is streamed via WebSocket
5. Final clip saved to `/output` folder

**Render Stages:**
```
1. Extracting clip segment    ████████░░░░  33%
2. Generating subtitles       ████████████  67%
3. Encoding with FFmpeg       ████████████████ 100%
```

**Output:**
```bash
# Rendered clips appear in the output folder
ls -la ./output/
# clip_breakthrough_moment_2024-12-27.mp4
```

---

### Complete Application Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FULL APPLICATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │         HOME PAGE (/)                │
                    │   Browse videos in /videos folder    │
                    │   Quick-start projects from here     │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │      PROJECTS PAGE (/projects)       │
                    │   • View all projects                │
                    │   • Create new project               │
                    │   • Delete existing projects         │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │  PROJECT EDITOR (/projects/:id)      │
                    │  ┌────────────────────────────────┐  │
                    │  │ 1. Select Video                │  │
                    │  │ 2. Run Transcription           │  │
                    │  │ 3. Get AI Moments              │  │
                    │  │ 4. Select Template             │  │
                    │  │ 5. Configure Subtitles         │  │
                    │  │ 6. Render Clip                 │  │
                    │  └────────────────────────────────┘  │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │         OUTPUT (/output)             │
                    │   Final rendered clips (.mp4)        │
                    └──────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │         API DOCS (:8000/docs)        │
                    │   Swagger UI for all endpoints       │
                    └──────────────────────────────────────┘
```

---

### Troubleshooting Common Issues

#### Videos Not Appearing in Picker

**Symptoms:** Video picker shows "No videos available"

**Solutions:**
```bash
# 1. Check videos folder exists and has files
ls -la ./videos/

# 2. Verify file permissions
chmod 644 ./videos/*

# 3. Check supported formats (MP4, MOV, AVI, MKV, WebM, M4V)
file ./videos/myvideo.mp4

# 4. Restart Docker containers
docker compose down && docker compose up -d

# 5. Check VIDEO_SOURCE_PATH in .env matches your setup
cat .env | grep VIDEO_SOURCE_PATH
```

#### Transcription Fails or Times Out

**Symptoms:** Transcription stuck at 0% or fails with error

**Solutions:**
```bash
# 1. Check Docker container logs
docker compose logs -f backend

# 2. Verify Whisper model downloaded
docker compose exec backend ls -la /app/models/

# 3. Reduce model size for less RAM usage
# In .env: WHISPER_MODEL=tiny (fastest) or base (balanced)

# 4. Increase Docker memory allocation
# Docker Desktop > Settings > Resources > Memory: 8GB+

# 5. Test with a short video first (<1 min)
```

#### AI Moments Not Detected

**Symptoms:** "No moments detected" after analysis

**Solutions:**
```bash
# 1. Verify OpenRouter API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# 2. Check API key in .env
cat .env | grep OPENROUTER_API_KEY

# 3. Ensure video has speech (not just music/silence)

# 4. Try a different Gemini model
# In .env: GEMINI_MODEL=google/gemini-pro

# 5. Check backend logs for API errors
docker compose logs backend | grep -i "openrouter\|error"
```

#### Render Fails or Produces Corrupted Output

**Symptoms:** Render stops mid-process or output file is broken

**Solutions:**
```bash
# 1. Check FFmpeg is working
docker compose exec backend ffmpeg -version

# 2. Verify output directory exists and is writable
ls -la ./output/
chmod 755 ./output/

# 3. Check disk space
df -h

# 4. Try different encoding preset
# In .env: FFMPEG_PRESET=ultrafast (faster, larger file)

# 5. Check render job logs
docker compose logs backend | grep -i "render\|ffmpeg"
```

#### WebSocket Connection Issues

**Symptoms:** Progress not updating, stuck at "Connecting..."

**Solutions:**
```bash
# 1. Check WebSocket endpoint is accessible
curl -i http://localhost:8000/ws

# 2. Verify CORS settings allow WebSocket
docker compose logs backend | grep -i "cors\|websocket"

# 3. Check browser console for errors (F12 > Console)

# 4. Try different browser or incognito mode

# 5. Restart both frontend and backend
docker compose restart
```

#### Docker Build or Start Failures

**Symptoms:** `docker compose up` fails

**Solutions:**
```bash
# 1. Clean build (no cache)
docker compose build --no-cache

# 2. Remove all containers and volumes
docker compose down -v
docker system prune -a

# 3. Check port availability
lsof -i :3000
lsof -i :8000

# 4. Verify Docker daemon is running
docker info

# 5. Check Docker resource limits
# Docker Desktop > Settings > Resources
# Recommended: 4 CPUs, 8GB RAM
```

#### Font Not Rendering in Subtitles

**Symptoms:** Subtitles show default/wrong font

**Solutions:**
```bash
# 1. Use web-safe fonts (Arial, Helvetica, Verdana)

# 2. Check font availability in Docker container
docker compose exec backend fc-list | grep -i "arial"

# 3. For custom fonts, add to Docker image
# Edit backend/Dockerfile to include font files

# 4. Use Impact or Arial for maximum compatibility
```

---

## Folder Structure

```
ai-clips/
├── backend/                    # FastAPI Backend Service
│   ├── main.py                 # Application entry point & API routes
│   ├── Dockerfile              # Backend container configuration
│   ├── requirements.txt        # Python dependencies
│   ├── models/                 # Pydantic data models
│   │   └── transcription_moment.py
│   ├── routers/                # API route modules
│   │   └── projects.py         # Project CRUD endpoints
│   └── services/               # Business logic services
│       ├── ffmpeg_service.py       # Video/audio processing
│       ├── whisper_service.py      # Speech-to-text transcription
│       ├── render_service.py       # Final clip rendering
│       ├── file_browser_service.py # Local file browsing
│       ├── video_files_service.py  # Video file management
│       ├── websocket_service.py    # Real-time progress updates
│       ├── json_storage.py         # Data persistence
│       ├── karaoke_generator.py    # Word-by-word subtitle sync
│       ├── composite_service.py    # Clip composition
│       ├── engaging_moments.py     # AI moment detection
│       └── openrouter/             # OpenRouter API client
│           ├── client.py           # HTTP client
│           ├── config.py           # Configuration
│           ├── models.py           # API models
│           ├── rate_limiter.py     # Rate limiting
│           └── exceptions.py       # Custom exceptions
│
├── frontend/                   # React Frontend (Vite + TypeScript)
│   ├── Dockerfile              # Frontend container configuration
│   ├── package.json            # Node.js dependencies
│   ├── vite.config.ts          # Vite configuration
│   └── src/
│       ├── main.tsx            # Application entry point
│       ├── App.tsx             # Root component with routing
│       ├── pages/              # Page components
│       │   ├── Home.tsx            # Video browser & transcription
│       │   ├── Projects.tsx        # Project management
│       │   └── ProjectEditor.tsx   # Clip editing interface
│       ├── components/         # Reusable UI components
│       │   ├── VideoPlayer.tsx     # Video playback
│       │   ├── VideoCard.tsx       # Video thumbnail cards
│       │   ├── MomentsSidebar.tsx  # Engaging moments list
│       │   ├── TemplateSelector.tsx # Clip templates
│       │   ├── TextStylingPanel.tsx # Subtitle styling
│       │   ├── ColorPicker.tsx     # Color selection
│       │   ├── PositionSelector.tsx # Element positioning
│       │   ├── cropper/            # Video cropping tools
│       │   ├── subtitle/           # Subtitle components
│       │   └── timeline/           # Timeline editor
│       ├── hooks/              # Custom React hooks
│       ├── services/           # API client services
│       ├── constants/          # Application constants
│       └── utils/              # Utility functions
│
├── docker/                     # Shared Docker configurations
│   └── Dockerfile              # Whisper transcription service
│
├── tests/                      # Test suites
│   ├── unit/                   # Unit tests
│   └── fixtures/               # Test fixtures
│
├── docs/                       # Documentation
│
├── videos/                     # Video input directory (mounted)
├── output/                     # Rendered clips output
├── uploads/                    # Temporary upload storage
│
├── docker-compose.yml          # Multi-container orchestration
├── .env                        # Environment configuration (create this)
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

---

## Whisper Model Setup

This section covers setting up the Whisper speech-to-text model for transcription.

### Which Model to Download

For **M1 Mac with 16GB RAM**, we recommend:

| Model | RAM Usage | Speed | Accuracy | Recommendation |
|-------|-----------|-------|----------|----------------|
| **base** | ~1GB | 16x realtime | Good | **Recommended for English** |
| **small** | ~2GB | 6x realtime | Better | **Recommended for non-English/multilingual** |
| tiny | ~1GB | 32x realtime | Lower | Only for quick tests |
| medium | ~5GB | 2x realtime | High | Use if accuracy is critical |
| large | ~10GB | 1x realtime | Highest | May require memory management |

**TL;DR**: Use `base` for English content, `small` for other languages.

### Model File Location

When using **Docker** (recommended), models are automatically downloaded and cached:

```
# Models are stored in a Docker volume
whisper-models:/app/models

# The model file follows this naming pattern:
/app/models/ggml-base.bin
/app/models/ggml-small.bin
```

When running **without Docker** (local development), models are cached at:

```
~/.cache/whisper/
├── base.pt
├── small.pt
└── ...
```

### Environment Variables

Add these to your `.env` file to configure Whisper:

```env
# ============================================================================
# Whisper Configuration
# ============================================================================

# Model size: tiny, base, small, medium, large
# For M1 16GB: use 'base' (English) or 'small' (multilingual)
WHISPER_MODEL=base

# Number of CPU threads for transcription (Docker only)
# Recommended: 4 for M1, adjust based on your CPU cores
WHISPER_THREADS=4

# Language: 'auto' for detection, or specify: en, ru, es, fr, de, etc.
WHISPER_LANGUAGE=auto

# Output format: txt, vtt, srt, json
WHISPER_OUTPUT_FORMAT=txt
```

### FFmpeg - No Extra Setup Required

**FFmpeg is already included in the Docker image** - no additional installation needed!

The Docker container automatically includes FFmpeg for:
- Audio extraction from video files
- Format conversion
- Clip rendering with subtitles

If running locally without Docker, install FFmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
```

### Verify Whisper Works

**With Docker:**

```bash
# 1. Build the whisper service
docker compose build whisper

# 2. Test with a sample audio file (place a test.mp3 in ./videos/)
docker compose run --rm whisper /app/input/test.mp3

# 3. Check the output
ls -la ./output/
```

**Without Docker (local development):**

```bash
# 1. Activate your virtual environment
cd backend
source venv/bin/activate

# 2. Test Whisper installation
python -c "import whisper; print('Whisper installed:', whisper.__version__)"

# 3. Test transcription (creates a test in Python)
python -c "
from services.whisper_service import get_whisper_service
service = get_whisper_service('base')
print('Device:', service.get_device_info())
print('Available models:', service.get_available_models())
"

# 4. Full transcription test with a file
python -c "
from services.whisper_service import get_whisper_service
service = get_whisper_service('base')
result = service.transcribe_audio('/path/to/your/test-audio.mp3')
print(f'Transcribed {result.duration:.1f}s of audio')
print(f'Language detected: {result.language}')
print(f'Text preview: {result.text[:200]}...')
"
```

**Quick health check via API:**

```bash
# Start the backend service
docker compose up -d backend

# Check transcription endpoint is available
curl http://localhost:8000/docs | grep -i transcri
```

### Troubleshooting Whisper

**Model download fails:**
```bash
# Clear the model cache and retry
docker compose down -v
docker volume rm whisper-models-cache
docker compose build --no-cache whisper
```

**Out of memory on M1:**
- Switch to a smaller model: `WHISPER_MODEL=base` or `tiny`
- Reduce concurrent jobs: `MAX_CONCURRENT_JOBS=1`
- Close other applications during transcription

**Slow transcription:**
- Ensure you're using the right model size for your needs
- Check Docker resource allocation (Docker Desktop > Settings > Resources)
- Increase `WHISPER_THREADS` if you have more CPU cores

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│    Backend      │────▶│   Whisper       │
│  (React/Vite)   │     │   (FastAPI)     │     │  Transcriber    │
│   Port: 3000    │     │   Port: 8000    │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      │                       │
         ▼                      ▼                       ▼
   ┌──────────┐          ┌──────────┐           ┌──────────┐
   │  nginx   │          │ FFmpeg   │           │ Whisper  │
   │  proxy   │          │ + OpenAI │           │   cpp    │
   └──────────┘          └──────────┘           └──────────┘
                               │
                               ▼
                        ┌──────────┐
                        │OpenRouter│
                        │  (AI)    │
                        └──────────┘
```

---

## Development (Without Docker)

### Backend Development

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

---

## Troubleshooting

### Common Issues

**Docker build fails on ARM64/M1 Mac:**
```bash
# Ensure Docker Desktop is updated and using correct platform
docker compose build --no-cache
```

**Port already in use:**
```bash
# Check what's using the port
lsof -i :3000
lsof -i :8000

# Kill the process or change ports in docker-compose.yml
```

**OpenRouter API errors:**
- Verify your API key is correct in `.env`
- Check your OpenRouter account has available credits
- Ensure the model name is valid (e.g., `google/gemini-2.5-pro-preview`)

**Permission denied on video files:**
- Ensure `VIDEO_SOURCE_PATH` points to an accessible directory
- Check Docker has permission to mount the volume

---

## License

MIT License - See [LICENSE](LICENSE) for details.
