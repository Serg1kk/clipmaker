"""
Pydantic schemas for AI Clips project data models.

This module defines the data structures for:
- Project metadata and configuration
- Transcription results with timing data
- Word-level timing information
- Clip definitions and metadata
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, ConfigDict


class TranscriptionStatus(str, Enum):
    """Status of transcription processing."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ClipStatus(str, Enum):
    """Status of clip generation."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class WordTimingSchema(BaseModel):
    """
    Word-level timing information from Whisper transcription.

    Attributes:
        word: The transcribed word
        start: Start time in seconds
        end: End time in seconds
        probability: Confidence score (0.0 to 1.0)
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "word": "Hello",
                "start": 0.0,
                "end": 0.5,
                "probability": 0.98
            }
        }
    )

    word: str = Field(..., description="The transcribed word")
    start: float = Field(..., ge=0.0, description="Start time in seconds")
    end: float = Field(..., ge=0.0, description="End time in seconds")
    probability: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score"
    )


class SegmentSchema(BaseModel):
    """
    Transcription segment with timing and word-level data.

    Attributes:
        id: Segment index/identifier
        start: Segment start time in seconds
        end: Segment end time in seconds
        text: Full text of the segment
        words: List of word-level timing data
        speaker: Optional speaker identification
        confidence: Overall segment confidence score
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 0,
                "start": 0.0,
                "end": 5.2,
                "text": "Hello, welcome to this video.",
                "words": [
                    {"word": "Hello", "start": 0.0, "end": 0.5, "probability": 0.98}
                ],
                "speaker": None,
                "confidence": 0.95
            }
        }
    )

    id: int = Field(..., ge=0, description="Segment index")
    start: float = Field(..., ge=0.0, description="Start time in seconds")
    end: float = Field(..., ge=0.0, description="End time in seconds")
    text: str = Field(..., description="Segment text content")
    words: list[WordTimingSchema] = Field(
        default_factory=list,
        description="Word-level timing data"
    )
    speaker: Optional[str] = Field(
        default=None,
        description="Speaker identification"
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Segment confidence score"
    )


class TranscriptionSchema(BaseModel):
    """
    Complete transcription result with metadata.

    Attributes:
        status: Current transcription status
        language: Detected or specified language code
        model_used: Whisper model variant used
        processing_time_seconds: Time taken to transcribe
        text: Full transcript text
        segments: List of timed segments
        word_count: Total word count
        duration_seconds: Total audio duration transcribed
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "completed",
                "language": "en",
                "model_used": "base",
                "processing_time_seconds": 180.5,
                "text": "Full transcript text...",
                "segments": [],
                "word_count": 1500,
                "duration_seconds": 7200.0
            }
        }
    )

    status: TranscriptionStatus = Field(
        default=TranscriptionStatus.PENDING,
        description="Transcription processing status"
    )
    language: str = Field(
        default="en",
        description="Language code (ISO 639-1)"
    )
    model_used: str = Field(
        default="base",
        description="Whisper model variant"
    )
    processing_time_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Processing duration in seconds"
    )
    text: str = Field(
        default="",
        description="Full transcript text"
    )
    segments: list[SegmentSchema] = Field(
        default_factory=list,
        description="Timed transcript segments"
    )
    word_count: int = Field(
        default=0,
        ge=0,
        description="Total word count"
    )
    duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Total transcribed duration"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if transcription failed"
    )


class SourceVideoSchema(BaseModel):
    """
    Source video file metadata.

    Attributes:
        path: Absolute path to the video file
        filename: Original filename
        duration_seconds: Video duration in seconds
        format: Video container format
        resolution: Video resolution (e.g., "1920x1080")
        file_size_bytes: File size in bytes
        codec: Video codec information
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "path": "/path/to/video.mp4",
                "filename": "video.mp4",
                "duration_seconds": 7200.0,
                "format": "mp4",
                "resolution": "1920x1080",
                "file_size_bytes": 1073741824,
                "codec": "h264"
            }
        }
    )

    path: str = Field(..., description="Absolute path to video file")
    filename: str = Field(..., description="Original filename")
    duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Video duration in seconds"
    )
    format: str = Field(
        default="mp4",
        description="Video container format"
    )
    resolution: Optional[str] = Field(
        default=None,
        description="Video resolution"
    )
    file_size_bytes: Optional[int] = Field(
        default=None,
        ge=0,
        description="File size in bytes"
    )
    codec: Optional[str] = Field(
        default=None,
        description="Video codec"
    )
    fps: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Frames per second"
    )


class ClipSchema(BaseModel):
    """
    Video clip definition with timing and metadata.

    Attributes:
        id: Unique clip identifier
        name: User-defined clip name
        start_time: Clip start time in seconds
        end_time: Clip end time in seconds
        duration_seconds: Clip duration
        transcript_text: Transcript text for this clip
        status: Clip generation status
        output_path: Path to generated clip file
        created_at: Clip creation timestamp
        tags: User-defined tags
        notes: User notes about the clip
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Introduction",
                "start_time": 0.0,
                "end_time": 30.5,
                "duration_seconds": 30.5,
                "transcript_text": "Welcome to this video...",
                "status": "completed",
                "output_path": "/output/clips/intro.mp4",
                "created_at": "2025-12-26T19:00:00Z",
                "tags": ["intro", "opening"],
                "notes": "Good opening segment"
            }
        }
    )

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique clip identifier"
    )
    name: str = Field(..., description="Clip name")
    start_time: float = Field(..., ge=0.0, description="Start time in seconds")
    end_time: float = Field(..., ge=0.0, description="End time in seconds")
    duration_seconds: float = Field(
        default=0.0,
        ge=0.0,
        description="Clip duration"
    )
    transcript_text: str = Field(
        default="",
        description="Transcript for this clip"
    )
    status: ClipStatus = Field(
        default=ClipStatus.PENDING,
        description="Clip generation status"
    )
    output_path: Optional[str] = Field(
        default=None,
        description="Path to generated clip"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    tags: list[str] = Field(
        default_factory=list,
        description="User-defined tags"
    )
    notes: Optional[str] = Field(
        default=None,
        description="User notes"
    )
    segment_ids: list[int] = Field(
        default_factory=list,
        description="Associated transcript segment IDs"
    )

    def model_post_init(self, __context) -> None:
        """Calculate duration after initialization."""
        if self.duration_seconds == 0.0 and self.end_time > self.start_time:
            object.__setattr__(
                self,
                'duration_seconds',
                self.end_time - self.start_time
            )


class ProjectSettingsSchema(BaseModel):
    """
    Project-level settings and preferences.

    Attributes:
        whisper_model: Preferred Whisper model
        language_preference: Language setting (auto or ISO code)
        auto_save: Enable automatic saving
        export_format: Default export format
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "whisper_model": "base",
                "language_preference": "auto",
                "auto_save": True,
                "export_format": "srt"
            }
        }
    )

    whisper_model: str = Field(
        default="base",
        description="Whisper model to use (tiny, base, small, medium, large)"
    )
    language_preference: str = Field(
        default="auto",
        description="Language preference (auto or ISO 639-1 code)"
    )
    auto_save: bool = Field(
        default=True,
        description="Enable automatic project saving"
    )
    export_format: str = Field(
        default="srt",
        description="Default subtitle export format"
    )
    include_word_timestamps: bool = Field(
        default=True,
        description="Include word-level timing in transcription"
    )


class ProjectSchema(BaseModel):
    """
    Complete project data structure.

    This is the main schema for storing all project data including
    source video metadata, transcription results, clips, and settings.

    Attributes:
        id: Unique project identifier
        name: Project display name
        description: Project description
        created_at: Project creation timestamp
        updated_at: Last modification timestamp
        source_video: Source video metadata
        transcription: Transcription results
        clips: List of defined clips
        settings: Project settings
        version: Schema version for migrations
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "My Video Project",
                "description": "Tutorial video transcription",
                "created_at": "2025-12-26T19:00:00Z",
                "updated_at": "2025-12-26T19:30:00Z",
                "source_video": {
                    "path": "/path/to/video.mp4",
                    "filename": "video.mp4",
                    "duration_seconds": 7200.0,
                    "format": "mp4",
                    "resolution": "1920x1080"
                },
                "transcription": {
                    "status": "completed",
                    "language": "en",
                    "model_used": "base",
                    "text": "Full transcript..."
                },
                "clips": [],
                "settings": {
                    "whisper_model": "base",
                    "language_preference": "auto"
                },
                "version": "1.0.0"
            }
        }
    )

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique project identifier"
    )
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(
        default=None,
        description="Project description"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    source_video: Optional[SourceVideoSchema] = Field(
        default=None,
        description="Source video metadata"
    )
    transcription: TranscriptionSchema = Field(
        default_factory=TranscriptionSchema,
        description="Transcription data"
    )
    clips: list[ClipSchema] = Field(
        default_factory=list,
        description="Defined clips"
    )
    settings: ProjectSettingsSchema = Field(
        default_factory=ProjectSettingsSchema,
        description="Project settings"
    )
    version: str = Field(
        default="1.0.0",
        description="Schema version"
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Project tags"
    )


class ProjectIndexEntry(BaseModel):
    """
    Summary entry for project index listing.

    Attributes:
        id: Project identifier
        name: Project name
        created_at: Creation timestamp
        updated_at: Last update timestamp
        video_filename: Source video filename
        transcription_status: Current transcription status
        clip_count: Number of clips defined
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "My Video Project",
                "created_at": "2025-12-26T19:00:00Z",
                "updated_at": "2025-12-26T19:30:00Z",
                "video_filename": "video.mp4",
                "transcription_status": "completed",
                "clip_count": 5
            }
        }
    )

    id: str = Field(..., description="Project identifier")
    name: str = Field(..., description="Project name")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    video_filename: Optional[str] = Field(
        default=None,
        description="Source video filename"
    )
    transcription_status: TranscriptionStatus = Field(
        default=TranscriptionStatus.PENDING,
        description="Transcription status"
    )
    clip_count: int = Field(
        default=0,
        ge=0,
        description="Number of clips"
    )


class ProjectIndex(BaseModel):
    """
    Index of all projects for quick listing.

    Attributes:
        version: Index schema version
        updated_at: Last index update timestamp
        projects: List of project summaries
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "version": "1.0.0",
                "updated_at": "2025-12-26T19:30:00Z",
                "projects": []
            }
        }
    )

    version: str = Field(
        default="1.0.0",
        description="Index schema version"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last index update"
    )
    projects: list[ProjectIndexEntry] = Field(
        default_factory=list,
        description="Project entries"
    )
