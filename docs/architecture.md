# AI Clips - System Architecture Document

**Version:** 1.0.0
**Last Updated:** 2025-12-26
**Author:** Architecture Agent (Hive Mind Swarm)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Component Diagram](#2-system-component-diagram)
3. [Component Specifications](#3-component-specifications)
4. [Data Flow Architecture](#4-data-flow-architecture)
5. [API Endpoint Specifications](#5-api-endpoint-specifications)
6. [WebSocket Protocol](#6-websocket-protocol)
7. [JSON Schema Definitions](#7-json-schema-definitions)
8. [File Organization Structure](#8-file-organization-structure)
9. [Performance Optimization for M1 Mac](#9-performance-optimization-for-m1-mac)
10. [Docker Architecture](#10-docker-architecture)
11. [Architecture Decision Records](#11-architecture-decision-records)

---

## 1. Executive Summary

AI Clips is a local video-to-clips pipeline designed for extracting engaging moments from long-form video content (2+ hour podcasts/meetings). The system runs entirely on Docker with Python backend and React frontend, optimized for M1 Mac with 16GB RAM.

### Key Capabilities

- Local file browsing with path validation
- FFmpeg-based audio extraction and video processing
- Local Whisper model for transcription with word-level timestamps
- AI-powered clip recommendation via OpenRouter API (Gemini 2.5 Pro / 3.0 Preview)
- Multi-frame template compositing (1/2/3 frame layouts)
- Karaoke-style subtitle generation (.ass format)
- Project persistence with full history

### Design Principles

1. **Local-First**: All processing happens locally except AI recommendations
2. **M1 Optimized**: Architecture tuned for Apple Silicon with 16GB RAM
3. **Docker Containerized**: Easy deployment and dependency management
4. **Real-time Feedback**: WebSocket-based progress streaming
5. **Multi-language Support**: Interface in English, videos in any language

---

## 2. System Component Diagram

```
+------------------------------------------------------------------+
|                         DOCKER ENVIRONMENT                        |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------+      +-------------------+                  |
|  |   FRONTEND       |      |   NGINX           |                  |
|  |   (React 18)     |<---->|   (Reverse Proxy) |<-- Port 3000     |
|  |   + Vite         |      +-------------------+                  |
|  +------------------+              |                              |
|         |                          |                              |
|         | HTTP/WebSocket           |                              |
|         v                          v                              |
|  +---------------------------------------------------------------+|
|  |                    FASTAPI BACKEND                            ||
|  |  Port 8000                                                    ||
|  |  +------------------+  +------------------+  +---------------+||
|  |  | File Selector    |  | Job Queue        |  | WebSocket     |||
|  |  | Service          |  | Manager          |  | Server        |||
|  |  +------------------+  +------------------+  +---------------+||
|  |         |                     |                    |          ||
|  |         v                     v                    v          ||
|  |  +------------------+  +------------------+  +---------------+||
|  |  | FFmpeg Module    |  | Whisper Engine   |  | AI Connector  |||
|  |  | (Audio/Video)    |  | (Transcription)  |  | (OpenRouter)  |||
|  |  +------------------+  +------------------+  +---------------+||
|  +---------------------------------------------------------------+|
|         |                     |                                   |
|         v                     v                                   |
|  +------------------+  +------------------+                       |
|  | Whisper Service  |  | FFmpeg Container |                       |
|  | (whisper.cpp)    |  | (Processing)     |                       |
|  +------------------+  +------------------+                       |
|         |                     |                                   |
+---------|---------------------|-----------------------------------+
          v                     v
    +-------------+       +-------------+
    | /app/models |       | /app/videos |  (Host Volumes)
    | (Whisper)   |       | /app/output |
    +-------------+       +-------------+
          |                     |
          +----------+----------+
                     |
              +------v------+
              | LOCAL DISK  |
              | (Video Files)|
              +-------------+
```

---

## 3. Component Specifications

### 3.1 Video File Selector Service

**Purpose**: Browse and validate local video files for processing

**Location**: `/backend/services/file_selector.py`

```python
# Interface Specification
class FileSelector:
    async def list_directory(path: str) -> DirectoryListing
    async def validate_video_file(path: str) -> VideoMetadata
    async def get_video_thumbnail(path: str, time_offset: float) -> bytes
```

**Features**:
- Directory traversal with security constraints (no symlink following, path whitelist)
- Video format validation using FFprobe
- Thumbnail extraction at specified timestamps
- File metadata extraction (duration, resolution, codec, size)

**Allowed Paths** (configurable):
- `/app/videos` (mounted from host)
- `/app/uploads` (uploaded files)
- Custom paths via environment variable `ALLOWED_VIDEO_PATHS`

**Validation Rules**:
- Extensions: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`
- Max file size: 50GB
- Path must be within allowed directories
- File must be readable

---

### 3.2 FFmpeg Audio Extraction Module

**Purpose**: Extract audio from video and perform format conversion

**Location**: `/backend/services/ffmpeg_service.py`

```python
# Interface Specification
class FFmpegService:
    async def extract_audio(
        video_path: str,
        output_path: str,
        format: str = "wav",
        sample_rate: int = 16000
    ) -> AudioExtractionResult

    async def extract_clip(
        video_path: str,
        start_time: float,
        end_time: float,
        regions: list[CropRegion],
        template: FrameTemplate,
        output_path: str
    ) -> ClipResult

    async def compose_final_video(
        clips: list[ClipConfig],
        subtitles: SubtitleConfig,
        output_path: str
    ) -> VideoResult

    async def get_video_info(video_path: str) -> VideoMetadata
```

**Audio Extraction Settings (Whisper-optimized)**:
- Format: WAV (PCM signed 16-bit little-endian)
- Sample Rate: 16kHz (Whisper requirement)
- Channels: Mono
- Bit Depth: 16-bit

**Clip Composition Features**:
- Frame template application (1/2/3 frame layouts)
- Region cropping with position data
- Audio track merging (single audio output)
- 9:16 vertical format output
- Hardware acceleration via VideoToolbox (M1)

---

### 3.3 Whisper Transcription Engine

**Purpose**: Local speech-to-text with word-level timestamps

**Location**: `/backend/services/whisper_service.py`

```python
# Interface Specification
class WhisperService:
    async def transcribe(
        audio_path: str,
        language: str = "auto",
        task: str = "transcribe"
    ) -> TranscriptionResult

    async def get_model_info() -> WhisperModelInfo
    async def download_model(model_name: str) -> DownloadStatus
```

**Model Selection for M1 16GB**:
| Model | VRAM | Speed | Accuracy | Recommended |
|-------|------|-------|----------|-------------|
| tiny  | 1GB  | 32x   | Low      | Testing     |
| base  | 1GB  | 16x   | Medium   | Quick jobs  |
| small | 2GB  | 6x    | Good     | **Default** |
| medium| 5GB  | 2x    | High     | Quality     |
| large | 10GB | 1x    | Best     | Final only  |

**Output Format**:
```json
{
  "text": "Full transcript text",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 4.5,
      "text": "Segment text",
      "words": [
        {"word": "Hello", "start": 0.0, "end": 0.3, "confidence": 0.98}
      ]
    }
  ],
  "language": "en",
  "duration": 7200.0
}
```

---

### 3.4 WebSocket Progress Server

**Purpose**: Real-time bidirectional communication for progress updates

**Location**: `/backend/services/websocket_server.py`

```python
# Interface Specification
class WebSocketManager:
    async def connect(websocket: WebSocket, job_id: str) -> None
    async def disconnect(job_id: str) -> None
    async def broadcast_progress(job_id: str, progress: ProgressUpdate) -> None
    async def send_error(job_id: str, error: ErrorMessage) -> None
```

**Connection Flow**:
1. Client connects to `/ws/{job_id}`
2. Server authenticates connection
3. Bidirectional message exchange begins
4. Progress updates streamed in real-time
5. Connection closed on job completion or error

---

### 3.5 JSON Storage Schema

**Purpose**: Persistent storage for projects, transcriptions, and settings

**Location**: `/data/projects/` (host-mounted volume)

**Storage Strategy**: File-based JSON with SQLite index for fast queries

---

## 4. Data Flow Architecture

### 4.1 Complete Processing Pipeline

```
[User] --> [Frontend] --> [Backend API]
              |               |
              |    +----------+----------+
              |    |                     |
              v    v                     v
         [File Selection]         [Upload Handling]
              |                          |
              +------------+-------------+
                           |
                           v
                    [Video Validation]
                           |
                           v
                +----------+----------+
                |                     |
                v                     v
         [Audio Extraction]    [Thumbnail Gen]
         (FFmpeg: WAV 16kHz)    (FFmpeg: JPEG)
                |
                v
         [Whisper Transcription]
         (Local Model + GPU)
                |
                v
         [Word-Level Timestamps]
                |
                +-------------------+
                |                   |
                v                   v
         [AI Clip Analysis]   [Manual Selection]
         (OpenRouter API)      (Frontend)
                |                   |
                +--------+----------+
                         |
                         v
                  [Clip Selection]
                         |
                         v
                  [Frame Template]
                  [Position Editor]
                         |
                         v
                  [Subtitle Generation]
                  (ASS Format)
                         |
                         v
                  [Video Composition]
                  (FFmpeg: 9:16 MP4)
                         |
                         v
                  [Project Storage]
                         |
                         v
                  [Download/Export]
```

### 4.2 Real-time Progress Updates

```
[Processing Task] --> [Progress Tracker] --> [WebSocket Manager]
                                                     |
                                              +------+------+
                                              |             |
                                              v             v
                                        [Active WS]   [Pending Queue]
                                        [Clients]     [Store & Forward]
```

---

## 5. API Endpoint Specifications

### 5.1 File Management

```yaml
GET /api/files/browse:
  description: List directory contents
  parameters:
    - path: string (default: "/app/videos")
  response:
    - directories: array
    - files: array (with metadata)

GET /api/files/validate:
  description: Validate video file
  parameters:
    - path: string
  response:
    - valid: boolean
    - metadata: VideoMetadata
    - errors: array

GET /api/files/thumbnail/{path}:
  description: Get video thumbnail
  parameters:
    - path: string (URL encoded)
    - time: float (default: 0)
  response: image/jpeg
```

### 5.2 Transcription

```yaml
POST /api/transcribe:
  description: Start transcription job
  body:
    - file_path: string (optional)
    - file: File (optional, multipart)
    - language: string (default: "auto")
    - model: string (default: "small")
  response:
    - job_id: string
    - status: "pending"

GET /api/transcribe/{job_id}:
  description: Get transcription status
  response:
    - job_id: string
    - status: enum[pending, processing, completed, failed]
    - progress: float (0-100)
    - result: TranscriptionResult (if completed)
    - error: string (if failed)

DELETE /api/transcribe/{job_id}:
  description: Cancel/delete job
  response:
    - message: string
```

### 5.3 AI Clip Analysis

```yaml
POST /api/clips/analyze:
  description: Get AI-recommended clip moments
  body:
    - transcription_id: string
    - preferences:
        - min_duration: float (default: 13)
        - max_duration: float (default: 60)
        - clip_count: int (default: 10)
        - topics: array[string] (optional)
  response:
    - job_id: string
    - status: "pending"

GET /api/clips/analyze/{job_id}:
  description: Get analysis results
  response:
    - recommendations: array[ClipRecommendation]
    - reasoning: string
```

### 5.4 Clip Composition

```yaml
POST /api/clips/compose:
  description: Create final video clip
  body:
    - source_video: string
    - start_time: float
    - end_time: float
    - template: enum[1-frame, 2-frame, 3-frame]
    - regions: array[CropRegion]
    - subtitles:
        - enabled: boolean
        - style: SubtitleStyle
        - position: Position
  response:
    - job_id: string
    - status: "pending"

GET /api/clips/{job_id}/download:
  description: Download composed clip
  response: video/mp4
```

### 5.5 Projects

```yaml
GET /api/projects:
  description: List all projects
  response:
    - projects: array[ProjectSummary]

POST /api/projects:
  description: Create new project
  body:
    - name: string
    - source_video: string
  response:
    - project: Project

GET /api/projects/{id}:
  description: Get project details
  response:
    - project: Project (full)

PUT /api/projects/{id}:
  description: Update project
  body: ProjectUpdate
  response:
    - project: Project

DELETE /api/projects/{id}:
  description: Delete project
  response:
    - message: string
```

### 5.6 Health and System

```yaml
GET /health:
  description: Health check
  response:
    - status: "healthy"
    - timestamp: datetime
    - version: string
    - services:
        - whisper: ServiceStatus
        - ffmpeg: ServiceStatus

GET /api/system/gpu:
  description: GPU information
  response:
    - available: boolean
    - type: string
    - memory: MemoryInfo

GET /api/system/models:
  description: Available Whisper models
  response:
    - models: array[ModelInfo]
```

---

## 6. WebSocket Protocol

### 6.1 Connection

```
Client connects to: ws://localhost:8000/ws/{job_id}
```

### 6.2 Message Types

#### Server to Client Messages

```typescript
// Progress Update
{
  "type": "progress",
  "job_id": "uuid",
  "stage": "transcription" | "analysis" | "composition",
  "progress": 45.5,  // 0-100
  "message": "Processing audio...",
  "eta_seconds": 120,
  "timestamp": "2025-12-26T10:30:00Z"
}

// Stage Complete
{
  "type": "stage_complete",
  "job_id": "uuid",
  "stage": "transcription",
  "result": { ... },
  "timestamp": "2025-12-26T10:30:00Z"
}

// Job Complete
{
  "type": "complete",
  "job_id": "uuid",
  "result": {
    "output_path": "/app/output/clip_001.mp4",
    "duration": 45.3,
    "size_bytes": 15000000
  },
  "timestamp": "2025-12-26T10:30:00Z"
}

// Error
{
  "type": "error",
  "job_id": "uuid",
  "error_code": "WHISPER_FAILED",
  "message": "Transcription failed: Out of memory",
  "recoverable": false,
  "timestamp": "2025-12-26T10:30:00Z"
}

// Heartbeat (every 30s)
{
  "type": "heartbeat",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

#### Client to Server Messages

```typescript
// Cancel Job
{
  "type": "cancel",
  "job_id": "uuid"
}

// Ping (client heartbeat)
{
  "type": "ping"
}
```

### 6.3 Connection States

```
CONNECTING -> CONNECTED -> RECEIVING -> DISCONNECTED
                 |                           ^
                 +------ ERROR --------------+
```

---

## 7. JSON Schema Definitions

### 7.1 Project Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Project",
  "type": "object",
  "required": ["id", "name", "created_at", "source_video"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    },
    "source_video": {
      "$ref": "#/definitions/SourceVideo"
    },
    "transcription": {
      "$ref": "#/definitions/Transcription"
    },
    "clips": {
      "type": "array",
      "items": { "$ref": "#/definitions/Clip" }
    },
    "settings": {
      "$ref": "#/definitions/ProjectSettings"
    }
  },
  "definitions": {
    "SourceVideo": {
      "type": "object",
      "required": ["path", "duration"],
      "properties": {
        "path": { "type": "string" },
        "filename": { "type": "string" },
        "duration": { "type": "number" },
        "width": { "type": "integer" },
        "height": { "type": "integer" },
        "fps": { "type": "number" },
        "codec": { "type": "string" },
        "size_bytes": { "type": "integer" }
      }
    },
    "Transcription": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "status": { "enum": ["pending", "processing", "completed", "failed"] },
        "language": { "type": "string" },
        "model": { "type": "string" },
        "text": { "type": "string" },
        "segments": {
          "type": "array",
          "items": { "$ref": "#/definitions/Segment" }
        },
        "created_at": { "type": "string", "format": "date-time" }
      }
    },
    "Segment": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "start": { "type": "number" },
        "end": { "type": "number" },
        "text": { "type": "string" },
        "words": {
          "type": "array",
          "items": { "$ref": "#/definitions/Word" }
        }
      }
    },
    "Word": {
      "type": "object",
      "properties": {
        "word": { "type": "string" },
        "start": { "type": "number" },
        "end": { "type": "number" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "Clip": {
      "type": "object",
      "required": ["id", "start_time", "end_time"],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "start_time": { "type": "number" },
        "end_time": { "type": "number" },
        "duration": { "type": "number" },
        "source": { "enum": ["ai", "manual"] },
        "ai_reasoning": { "type": "string" },
        "template": { "$ref": "#/definitions/FrameTemplate" },
        "regions": {
          "type": "array",
          "items": { "$ref": "#/definitions/CropRegion" }
        },
        "subtitles": { "$ref": "#/definitions/SubtitleConfig" },
        "output": { "$ref": "#/definitions/ClipOutput" },
        "created_at": { "type": "string", "format": "date-time" }
      }
    },
    "FrameTemplate": {
      "type": "object",
      "properties": {
        "type": { "enum": ["1-frame", "2-frame", "3-frame"] },
        "layout": {
          "type": "object",
          "properties": {
            "output_width": { "type": "integer", "default": 1080 },
            "output_height": { "type": "integer", "default": 1920 },
            "frame_positions": {
              "type": "array",
              "items": { "$ref": "#/definitions/FramePosition" }
            }
          }
        }
      }
    },
    "FramePosition": {
      "type": "object",
      "properties": {
        "x": { "type": "integer" },
        "y": { "type": "integer" },
        "width": { "type": "integer" },
        "height": { "type": "integer" }
      }
    },
    "CropRegion": {
      "type": "object",
      "properties": {
        "frame_index": { "type": "integer" },
        "source_x": { "type": "integer" },
        "source_y": { "type": "integer" },
        "source_width": { "type": "integer" },
        "source_height": { "type": "integer" },
        "label": { "type": "string" }
      }
    },
    "SubtitleConfig": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "style": {
          "type": "object",
          "properties": {
            "font_family": { "type": "string", "default": "Arial" },
            "font_size": { "type": "integer", "default": 48 },
            "primary_color": { "type": "string", "default": "#FFFFFF" },
            "outline_color": { "type": "string", "default": "#000000" },
            "outline_width": { "type": "integer", "default": 3 },
            "shadow_offset": { "type": "integer", "default": 2 },
            "bold": { "type": "boolean", "default": true },
            "animation": { "enum": ["none", "fade", "pop", "slide"], "default": "pop" }
          }
        },
        "position": {
          "type": "object",
          "properties": {
            "alignment": { "enum": ["top", "center", "bottom"], "default": "bottom" },
            "margin_v": { "type": "integer", "default": 100 }
          }
        },
        "word_timing": {
          "type": "object",
          "properties": {
            "mode": { "enum": ["word-by-word", "phrase", "full"], "default": "word-by-word" },
            "highlight_color": { "type": "string", "default": "#FFFF00" }
          }
        }
      }
    },
    "ClipOutput": {
      "type": "object",
      "properties": {
        "status": { "enum": ["pending", "processing", "completed", "failed"] },
        "path": { "type": "string" },
        "size_bytes": { "type": "integer" },
        "generated_at": { "type": "string", "format": "date-time" }
      }
    },
    "ProjectSettings": {
      "type": "object",
      "properties": {
        "default_clip_duration": {
          "type": "object",
          "properties": {
            "min": { "type": "number", "default": 13 },
            "max": { "type": "number", "default": 60 }
          }
        },
        "whisper_model": { "type": "string", "default": "small" },
        "output_quality": { "enum": ["draft", "standard", "high"], "default": "standard" }
      }
    }
  }
}
```

### 7.2 Transcription Result Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TranscriptionResult",
  "type": "object",
  "required": ["text", "segments", "language", "duration"],
  "properties": {
    "text": {
      "type": "string",
      "description": "Full transcript text"
    },
    "segments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "start": { "type": "number" },
          "end": { "type": "number" },
          "text": { "type": "string" },
          "words": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "word": { "type": "string" },
                "start": { "type": "number" },
                "end": { "type": "number" },
                "confidence": { "type": "number" }
              }
            }
          },
          "no_speech_prob": { "type": "number" }
        }
      }
    },
    "language": { "type": "string" },
    "language_probability": { "type": "number" },
    "duration": { "type": "number" },
    "model": { "type": "string" },
    "processing_time_seconds": { "type": "number" }
  }
}
```

### 7.3 AI Clip Recommendation Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ClipRecommendation",
  "type": "object",
  "required": ["start_time", "end_time", "score", "reasoning"],
  "properties": {
    "start_time": {
      "type": "number",
      "description": "Start time in seconds"
    },
    "end_time": {
      "type": "number",
      "description": "End time in seconds"
    },
    "duration": {
      "type": "number",
      "description": "Clip duration in seconds"
    },
    "score": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Engagement score (0-1)"
    },
    "reasoning": {
      "type": "string",
      "description": "AI explanation for why this moment is engaging"
    },
    "topics": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Main topics discussed in this clip"
    },
    "hook_type": {
      "enum": ["question", "revelation", "story", "insight", "humor", "controversy"],
      "description": "Type of engagement hook"
    },
    "transcript_excerpt": {
      "type": "string",
      "description": "Key quote from the clip"
    }
  }
}
```

---

## 8. File Organization Structure

```
/Users/serg1kk/Local Documents /AI Clips/
|
+-- backend/
|   +-- main.py                 # FastAPI application entry point
|   +-- requirements.txt        # Python dependencies
|   +-- Dockerfile              # Backend container definition
|   +-- docker-compose.yml      # Backend-specific compose (dev)
|   |
|   +-- api/                    # API route handlers
|   |   +-- __init__.py
|   |   +-- files.py            # File browsing endpoints
|   |   +-- transcription.py    # Transcription endpoints
|   |   +-- clips.py            # Clip analysis and composition
|   |   +-- projects.py         # Project management
|   |   +-- websocket.py        # WebSocket handlers
|   |
|   +-- services/               # Business logic services
|   |   +-- __init__.py
|   |   +-- file_selector.py    # File browsing service
|   |   +-- ffmpeg_service.py   # FFmpeg operations
|   |   +-- whisper_service.py  # Whisper transcription
|   |   +-- ai_service.py       # OpenRouter AI integration
|   |   +-- subtitle_service.py # ASS subtitle generation
|   |   +-- project_service.py  # Project persistence
|   |
|   +-- models/                 # Pydantic models
|   |   +-- __init__.py
|   |   +-- project.py          # Project data models
|   |   +-- transcription.py    # Transcription models
|   |   +-- clip.py             # Clip and template models
|   |   +-- job.py              # Job queue models
|   |
|   +-- core/                   # Core utilities
|   |   +-- __init__.py
|   |   +-- config.py           # Configuration management
|   |   +-- logging.py          # Logging setup
|   |   +-- exceptions.py       # Custom exceptions
|   |
|   +-- tests/                  # Backend tests
|       +-- __init__.py
|       +-- test_files.py
|       +-- test_transcription.py
|       +-- test_clips.py
|
+-- frontend/
|   +-- package.json
|   +-- vite.config.js
|   +-- Dockerfile
|   +-- index.html
|   |
|   +-- src/
|   |   +-- App.jsx             # Main application component
|   |   +-- main.jsx            # Entry point
|   |   |
|   |   +-- components/         # UI components
|   |   |   +-- FileBrowser/    # File selection UI
|   |   |   +-- VideoPlayer/    # Video preview player
|   |   |   +-- Timeline/       # Timeline with clips
|   |   |   +-- FrameEditor/    # Frame template editor
|   |   |   +-- SubtitleEditor/ # Subtitle style editor
|   |   |   +-- Progress/       # Progress indicators
|   |   |
|   |   +-- hooks/              # Custom React hooks
|   |   |   +-- useWebSocket.js
|   |   |   +-- useTranscription.js
|   |   |   +-- useProject.js
|   |   |
|   |   +-- services/           # API client services
|   |   |   +-- api.js
|   |   |   +-- websocket.js
|   |   |
|   |   +-- store/              # State management
|   |   |   +-- projectStore.js
|   |   |   +-- uiStore.js
|   |   |
|   |   +-- styles/             # CSS/styling
|   |
|   +-- public/                 # Static assets
|
+-- docker/
|   +-- Dockerfile              # Whisper.cpp container
|   +-- entrypoint.sh           # Container startup script
|
+-- docs/
|   +-- architecture.md         # This document
|   +-- api.md                  # API documentation
|   +-- development.md          # Development guide
|
+-- data/                       # Persistent data (volume mount)
|   +-- projects/               # Project JSON files
|   +-- cache/                  # Temporary processing files
|
+-- videos/                     # Source videos (host mount)
+-- output/                     # Generated clips (host mount)
|
+-- docker-compose.yml          # Main compose file
+-- .env.example                # Environment variables template
+-- .gitignore
+-- README.md
+-- requirements.md             # Project requirements
+-- CLAUDE.md                   # Development configuration
```

---

## 9. Performance Optimization for M1 Mac

### 9.1 Memory Management Strategy

**Total Available**: 16GB RAM (shared with GPU)

**Allocation Strategy**:
| Component | Max Memory | Priority |
|-----------|------------|----------|
| Whisper Model | 5GB | High |
| FFmpeg Processing | 3GB | Medium |
| Docker Overhead | 2GB | Required |
| Backend Services | 1GB | Medium |
| Frontend/Nginx | 512MB | Low |
| System Reserve | 4.5GB | Critical |

### 9.2 Whisper Optimization

```python
# Recommended configuration for M1 16GB
WHISPER_CONFIG = {
    "model": "small",           # Best quality/memory tradeoff
    "device": "cpu",            # Use CPU with Metal acceleration
    "compute_type": "int8",     # Quantized for efficiency
    "threads": 4,               # M1 has 4 performance cores
    "beam_size": 5,             # Standard accuracy
    "best_of": 5,
    "word_timestamps": True,
    "condition_on_previous_text": True,
    "vad_filter": True,         # Voice activity detection
    "vad_parameters": {
        "threshold": 0.5,
        "min_speech_duration_ms": 250,
        "min_silence_duration_ms": 100
    }
}
```

### 9.3 FFmpeg Optimization

```bash
# Hardware acceleration flags for M1
FFMPEG_M1_FLAGS=(
    -hwaccel videotoolbox      # Use VideoToolbox for decode
    -c:v hevc_videotoolbox     # Use VideoToolbox for encode
    -threads 0                  # Auto-detect optimal threads
    -preset medium             # Balance speed/quality
    -b:v 4M                    # Target bitrate for 1080x1920
)
```

### 9.4 Batch Processing Strategy

For long videos (2+ hours):
1. Split audio into 30-minute chunks for transcription
2. Process chunks in parallel (2 concurrent max)
3. Merge transcription results
4. Memory cleanup between chunks

---

## 10. Docker Architecture

### 10.1 Service Overview

```yaml
services:
  whisper:
    # Whisper.cpp with M1 optimizations
    # Runs on-demand for transcription
    memory: 6g

  backend:
    # FastAPI application
    # Always running, handles API requests
    memory: 2g

  frontend:
    # Nginx serving React build
    # Always running, serves UI
    memory: 512m

  ffmpeg:
    # FFmpeg with VideoToolbox
    # Shared with backend, spawned per-job
    memory: 4g
```

### 10.2 Volume Mappings

```yaml
volumes:
  # Host paths -> Container paths
  ./videos:/app/videos:ro        # Source videos (read-only)
  ./output:/app/output           # Generated clips
  ./data:/app/data               # Project storage
  whisper-models:/app/models     # Cached Whisper models
  backend-uploads:/app/uploads   # Temporary uploads
```

### 10.3 Network Configuration

```
                    +----------------+
                    |   Host :3000   |
                    +-------+--------+
                            |
                    +-------v--------+
                    |   Frontend     |
                    |   (Nginx)      |
                    +-------+--------+
                            |
          +-----------------+-----------------+
          |                                   |
  +-------v--------+                 +--------v-------+
  | /api/* proxy   |                 | Static files   |
  +-------+--------+                 +----------------+
          |
  +-------v--------+
  |   Backend      |
  |   :8000        |
  +-------+--------+
          |
  +-------v--------+
  |   Whisper      |
  |   (on-demand)  |
  +----------------+
```

---

## 11. Architecture Decision Records

### ADR-001: Local Whisper vs Cloud Transcription

**Status**: Accepted

**Context**: Need speech-to-text with word-level timestamps for clips.

**Decision**: Use local Whisper model instead of cloud services.

**Rationale**:
- Privacy: Video content stays local
- Cost: No per-minute API charges
- Latency: No network round-trip
- Multi-language: Same model works for all languages
- Offline: Works without internet

**Consequences**:
- Higher local resource usage
- Initial model download required
- Slower than parallel cloud processing

---

### ADR-002: FFmpeg for Video Processing

**Status**: Accepted

**Context**: Need reliable video/audio processing with format conversion.

**Decision**: Use FFmpeg with VideoToolbox acceleration.

**Rationale**:
- Universal format support
- M1 hardware acceleration via VideoToolbox
- Proven reliability for production use
- Extensive filter and composition capabilities
- ASS subtitle burning support

**Consequences**:
- Large container image size
- Complex filter syntax for compositions
- Requires careful memory management

---

### ADR-003: WebSocket for Real-time Updates

**Status**: Accepted

**Context**: Need real-time progress updates during processing.

**Decision**: Use WebSocket connections for bidirectional communication.

**Rationale**:
- Lower latency than polling
- Efficient for streaming updates
- Supports bidirectional communication (e.g., cancel)
- Native browser support

**Consequences**:
- Additional connection management complexity
- Requires reconnection handling
- More complex testing requirements

---

### ADR-004: File-based JSON Storage

**Status**: Accepted

**Context**: Need persistent storage for projects without external database.

**Decision**: Use file-based JSON with SQLite index.

**Rationale**:
- Simple backup (just copy files)
- Human-readable project data
- No database server required
- Fast queries via SQLite index
- Easy data migration

**Consequences**:
- Limited concurrent write scalability
- Manual index synchronization
- Potential data fragmentation

---

### ADR-005: OpenRouter for AI Integration

**Status**: Accepted

**Context**: Need AI analysis for clip recommendations.

**Decision**: Use OpenRouter API for Gemini model access.

**Rationale**:
- Single API for multiple models
- Fallback to alternative models
- Cost tracking and limits
- No direct Google API setup

**Consequences**:
- Network dependency for AI features
- API costs per request
- Rate limiting considerations

---

## Document Metadata

**Architecture Stored**: Memory namespace `hive/architecture`

```json
{
  "namespace": "hive/architecture",
  "version": "1.0.0",
  "components": [
    "file-selector",
    "ffmpeg-service",
    "whisper-engine",
    "websocket-server",
    "json-storage"
  ],
  "optimizations": "m1-16gb",
  "containerization": "docker"
}
```

---

*This architecture document provides the foundation for implementing the AI Clips video transcription and clip generation pipeline. All components are designed for local execution with Docker containerization, optimized for M1 Mac with 16GB RAM.*
