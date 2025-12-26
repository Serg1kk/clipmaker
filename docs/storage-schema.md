# AI Clips Storage Schema Documentation

## Overview

This document describes the JSON storage schema used by AI Clips for persisting project data, transcription results, and clip definitions.

## Directory Structure

```
/output/
├── projects/
│   ├── {project_id}/
│   │   ├── project.json          # Main project file
│   │   ├── audio/
│   │   │   └── extracted.wav     # Extracted audio for transcription
│   │   ├── transcription/
│   │   │   └── transcript.json   # Separate transcript file
│   │   ├── clips/
│   │   │   └── {clip_id}.mp4     # Generated clips
│   │   └── exports/
│   │       └── *.srt, *.vtt      # Exported subtitles
│   └── index.json                # Project index for quick listing
```

## Schema Definitions

### Project Schema (`project.json`)

The main project file contains all project data:

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Video Project",
    "description": "Optional project description",
    "created_at": "2025-12-26T19:00:00Z",
    "updated_at": "2025-12-26T19:30:00Z",
    "source_video": {
        "path": "/absolute/path/to/video.mp4",
        "filename": "video.mp4",
        "duration_seconds": 7200.0,
        "format": "mp4",
        "resolution": "1920x1080",
        "file_size_bytes": 1073741824,
        "codec": "h264",
        "fps": 30.0
    },
    "transcription": {
        "status": "completed",
        "language": "en",
        "model_used": "base",
        "processing_time_seconds": 180.5,
        "text": "Full transcript text...",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 5.2,
                "text": "Hello, welcome to this video.",
                "words": [
                    {
                        "word": "Hello",
                        "start": 0.0,
                        "end": 0.5,
                        "probability": 0.98
                    }
                ],
                "speaker": null,
                "confidence": 0.95
            }
        ],
        "word_count": 1500,
        "duration_seconds": 7200.0,
        "error_message": null
    },
    "clips": [
        {
            "id": "clip-uuid",
            "name": "Introduction",
            "start_time": 0.0,
            "end_time": 30.5,
            "duration_seconds": 30.5,
            "transcript_text": "Welcome to this video...",
            "status": "completed",
            "output_path": "/output/projects/{id}/clips/intro.mp4",
            "created_at": "2025-12-26T19:00:00Z",
            "updated_at": "2025-12-26T19:00:00Z",
            "tags": ["intro", "opening"],
            "notes": "Good opening segment",
            "segment_ids": [0, 1, 2]
        }
    ],
    "settings": {
        "whisper_model": "base",
        "language_preference": "auto",
        "auto_save": true,
        "export_format": "srt",
        "include_word_timestamps": true
    },
    "tags": ["tutorial", "programming"],
    "version": "1.0.0"
}
```

### Project Index (`index.json`)

Quick reference index for listing all projects:

```json
{
    "version": "1.0.0",
    "updated_at": "2025-12-26T19:30:00Z",
    "projects": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "My Video Project",
            "created_at": "2025-12-26T19:00:00Z",
            "updated_at": "2025-12-26T19:30:00Z",
            "video_filename": "video.mp4",
            "transcription_status": "completed",
            "clip_count": 5
        }
    ]
}
```

## Field Descriptions

### TranscriptionStatus Enum

| Value | Description |
|-------|-------------|
| `pending` | Transcription not started |
| `processing` | Transcription in progress |
| `completed` | Transcription finished successfully |
| `failed` | Transcription failed with error |

### ClipStatus Enum

| Value | Description |
|-------|-------------|
| `pending` | Clip not generated |
| `processing` | Clip generation in progress |
| `completed` | Clip generated successfully |
| `failed` | Clip generation failed |

### Whisper Model Options

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `tiny` | 39M | Fastest | Basic |
| `base` | 74M | Fast | Good |
| `small` | 244M | Medium | Better |
| `medium` | 769M | Slow | High |
| `large` | 1.5GB | Slowest | Best |

## Storage Service API

### Creating a Project

```python
from backend.services.storage_service import StorageService

service = StorageService("/output")
project = service.create_project(
    name="My Video",
    video_path="/path/to/video.mp4",
    description="Tutorial video"
)
service.save_project(project)
```

### Loading a Project

```python
project = service.load_project("project-uuid")
```

### Updating Transcription

```python
from backend.models.schemas import TranscriptionSchema, TranscriptionStatus

transcription = TranscriptionSchema(
    status=TranscriptionStatus.COMPLETED,
    language="en",
    text="Full transcript...",
    segments=[...]
)
service.update_transcription(project_id, transcription)
```

### Adding Clips

```python
from backend.models.schemas import ClipSchema

clip = ClipSchema(
    name="Introduction",
    start_time=0.0,
    end_time=30.0,
    transcript_text="Welcome..."
)
service.add_clip(project_id, clip)
```

### Exporting Subtitles

```python
# Export as SRT
srt_path = service.export_project(project_id, "srt")

# Export as WebVTT
vtt_path = service.export_project(project_id, "vtt")

# Export as plain text
txt_path = service.export_project(project_id, "txt")
```

### Listing Projects

```python
projects = service.list_projects()
for p in projects:
    print(f"{p.name}: {p.transcription_status}")
```

## Export Formats

### SRT (SubRip)

```
1
00:00:00,000 --> 00:00:05,200
Hello, welcome to this video.

2
00:00:05,200 --> 00:00:10,500
Today we will learn about Python.
```

### VTT (WebVTT)

```
WEBVTT

1
00:00:00.000 --> 00:00:05.200
Hello, welcome to this video.

2
00:00:05.200 --> 00:00:10.500
Today we will learn about Python.
```

## Best Practices

1. **Regular Saves**: Enable `auto_save` in settings
2. **Backup**: Periodically backup the `/output` directory
3. **Word Timestamps**: Enable for precise clip selection
4. **Tagging**: Use tags for project organization
5. **Notes**: Add notes to clips for context

## Schema Versioning

The schema includes a `version` field for future migrations:
- Current version: `1.0.0`
- Version format: `MAJOR.MINOR.PATCH`
- Breaking changes increment MAJOR version
