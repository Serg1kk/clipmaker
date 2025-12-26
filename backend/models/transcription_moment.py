"""
TranscriptionMoment model for AI Clips project.

This model represents a specific moment in a transcription that is
meaningful for clip generation - it captures key points, quotes,
highlights, or other notable moments within the transcript.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict, field_validator


class MomentType(str, Enum):
    """Classification type for transcription moments."""
    KEY_POINT = "key_point"
    QUOTE = "quote"
    HIGHLIGHT = "highlight"
    QUESTION = "question"
    ANSWER = "answer"
    TRANSITION = "transition"
    INTRODUCTION = "introduction"
    CONCLUSION = "conclusion"
    EXAMPLE = "example"
    DEFINITION = "definition"
    ACTION_ITEM = "action_item"
    CUSTOM = "custom"


class MomentSource(str, Enum):
    """How the moment was identified."""
    MANUAL = "manual"
    AI_DETECTED = "ai_detected"
    RULE_BASED = "rule_based"
    IMPORTED = "imported"


class TranscriptionMoment(BaseModel):
    """
    A specific moment in a transcription that represents a meaningful
    segment suitable for clip generation.

    Attributes:
        id: Unique identifier for the moment
        start_time: Start time in seconds
        end_time: End time in seconds
        duration_seconds: Duration of the moment (computed)
        text: Text content of the moment
        segment_id: ID of the parent segment
        segment_ids: List of segment IDs if moment spans multiple segments
        word_indices: Indices of words within the segment(s)
        moment_type: Classification of the moment
        labels: Additional classification labels/tags
        confidence: Confidence score for the moment identification
        source: How the moment was identified
        speaker: Speaker identification if available
        metadata: Additional metadata for clip generation
        created_at: Timestamp when moment was created
        updated_at: Timestamp when moment was last modified
        notes: Optional user notes about the moment
        is_favorite: Whether user marked as favorite
        clip_id: ID of generated clip (if any)
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "m-550e8400-e29b-41d4-a716-446655440000",
                "start_time": 45.2,
                "end_time": 52.8,
                "duration_seconds": 7.6,
                "text": "The key takeaway is that consistency beats intensity.",
                "segment_id": 5,
                "segment_ids": [5, 6],
                "word_indices": {"5": [0, 1, 2, 3, 4, 5], "6": [0, 1, 2, 3]},
                "moment_type": "key_point",
                "labels": ["motivation", "advice"],
                "confidence": 0.92,
                "source": "ai_detected",
                "speaker": "host",
                "metadata": {
                    "sentiment": "positive",
                    "topic": "productivity"
                },
                "created_at": "2025-12-26T19:15:00Z",
                "updated_at": "2025-12-26T19:15:00Z",
                "notes": "Great quote for social media clip",
                "is_favorite": True,
                "clip_id": None
            }
        }
    )

    id: str = Field(
        default_factory=lambda: f"m-{uuid4()}",
        description="Unique moment identifier with 'm-' prefix"
    )
    start_time: float = Field(
        ...,
        ge=0.0,
        description="Start time in seconds"
    )
    end_time: float = Field(
        ...,
        ge=0.0,
        description="End time in seconds"
    )
    duration_seconds: float = Field(
        default=0.0,
        ge=0.0,
        description="Duration of the moment in seconds (computed)"
    )
    text: str = Field(
        ...,
        min_length=1,
        description="Text content of the moment"
    )
    segment_id: int = Field(
        ...,
        ge=0,
        description="Primary segment ID this moment belongs to"
    )
    segment_ids: list[int] = Field(
        default_factory=list,
        description="All segment IDs if moment spans multiple segments"
    )
    word_indices: dict[str, list[int]] = Field(
        default_factory=dict,
        description="Word indices per segment (segment_id -> [word_indices])"
    )
    moment_type: MomentType = Field(
        default=MomentType.HIGHLIGHT,
        description="Primary classification of the moment"
    )
    labels: list[str] = Field(
        default_factory=list,
        description="Additional classification labels/tags"
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score for moment identification (0.0-1.0)"
    )
    source: MomentSource = Field(
        default=MomentSource.MANUAL,
        description="How the moment was identified"
    )
    speaker: Optional[str] = Field(
        default=None,
        description="Speaker identification if available"
    )
    metadata: dict = Field(
        default_factory=dict,
        description="Additional metadata for clip generation"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when moment was created"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when moment was last modified"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Optional user notes about the moment"
    )
    is_favorite: bool = Field(
        default=False,
        description="Whether user marked this moment as favorite"
    )
    clip_id: Optional[str] = Field(
        default=None,
        description="ID of generated clip if moment was converted to clip"
    )

    @field_validator('end_time')
    @classmethod
    def end_time_must_be_after_start(cls, v: float, info) -> float:
        """Validate that end_time is after start_time."""
        if 'start_time' in info.data and v < info.data['start_time']:
            raise ValueError('end_time must be >= start_time')
        return v

    @field_validator('labels')
    @classmethod
    def normalize_labels(cls, v: list[str]) -> list[str]:
        """Normalize labels to lowercase and remove duplicates."""
        return list(set(label.lower().strip() for label in v if label.strip()))

    def model_post_init(self, __context) -> None:
        """Calculate duration and ensure segment_ids consistency."""
        if self.duration_seconds == 0.0 and self.end_time > self.start_time:
            object.__setattr__(
                self,
                'duration_seconds',
                round(self.end_time - self.start_time, 3)
            )
        if not self.segment_ids:
            object.__setattr__(self, 'segment_ids', [self.segment_id])
        elif self.segment_id not in self.segment_ids:
            object.__setattr__(
                self,
                'segment_ids',
                [self.segment_id] + self.segment_ids
            )

    def add_label(self, label: str) -> None:
        """Add a new label to the moment."""
        normalized = label.lower().strip()
        if normalized and normalized not in self.labels:
            self.labels.append(normalized)
            self.updated_at = datetime.utcnow()

    def remove_label(self, label: str) -> bool:
        """Remove a label from the moment. Returns True if removed."""
        normalized = label.lower().strip()
        if normalized in self.labels:
            self.labels.remove(normalized)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def to_clip_params(self) -> dict:
        """Convert moment to parameters suitable for ClipSchema creation."""
        return {
            "name": f"{self.moment_type.value.replace('_', ' ').title()} - {self.text[:30]}...",
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_seconds": self.duration_seconds,
            "transcript_text": self.text,
            "tags": self.labels + [self.moment_type.value],
            "notes": self.notes,
            "segment_ids": self.segment_ids
        }


class TranscriptionMomentCollection(BaseModel):
    """
    Collection of transcription moments for a project.

    Attributes:
        project_id: Associated project identifier
        moments: List of transcription moments
        total_duration: Total duration of all moments
        created_at: Collection creation timestamp
        updated_at: Last update timestamp
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "project_id": "550e8400-e29b-41d4-a716-446655440000",
                "moments": [],
                "total_duration": 45.5,
                "created_at": "2025-12-26T19:00:00Z",
                "updated_at": "2025-12-26T19:30:00Z"
            }
        }
    )

    project_id: str = Field(..., description="Associated project identifier")
    moments: list[TranscriptionMoment] = Field(
        default_factory=list,
        description="List of transcription moments"
    )
    total_duration: float = Field(
        default=0.0,
        ge=0.0,
        description="Total duration of all moments in seconds"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Collection creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )

    def model_post_init(self, __context) -> None:
        """Calculate total duration after initialization."""
        if self.moments and self.total_duration == 0.0:
            total = sum(m.duration_seconds for m in self.moments)
            object.__setattr__(self, 'total_duration', round(total, 3))

    def add_moment(self, moment: TranscriptionMoment) -> None:
        """Add a moment to the collection."""
        self.moments.append(moment)
        self.total_duration = round(
            self.total_duration + moment.duration_seconds, 3
        )
        self.updated_at = datetime.utcnow()

    def get_moments_by_type(
        self, moment_type: MomentType
    ) -> list[TranscriptionMoment]:
        """Filter moments by type."""
        return [m for m in self.moments if m.moment_type == moment_type]

    def get_moments_by_label(self, label: str) -> list[TranscriptionMoment]:
        """Filter moments by label."""
        normalized = label.lower().strip()
        return [m for m in self.moments if normalized in m.labels]

    def get_favorites(self) -> list[TranscriptionMoment]:
        """Get all favorite moments."""
        return [m for m in self.moments if m.is_favorite]

    def get_moments_in_range(
        self, start: float, end: float
    ) -> list[TranscriptionMoment]:
        """Get moments that overlap with the given time range."""
        return [
            m for m in self.moments
            if m.start_time < end and m.end_time > start
        ]


class ProjectTranscriptionMoment(BaseModel):
    """
    Complete project with transcription moments data structure.

    This model combines project metadata with its associated
    transcription moments for JSON file storage.

    Attributes:
        id: Unique project identifier
        name: Project display name
        description: Project description
        video_path: Path to source video file
        video_filename: Source video filename
        video_duration: Video duration in seconds
        moments: Collection of transcription moments
        created_at: Project creation timestamp
        updated_at: Last modification timestamp
        version: Schema version for migrations
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "My Video Project",
                "description": "Tutorial video transcription",
                "video_path": "/path/to/video.mp4",
                "video_filename": "video.mp4",
                "video_duration": 7200.0,
                "moments": {
                    "project_id": "550e8400-e29b-41d4-a716-446655440000",
                    "moments": [],
                    "total_duration": 0.0
                },
                "created_at": "2025-12-26T19:00:00Z",
                "updated_at": "2025-12-26T19:30:00Z",
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
    video_path: Optional[str] = Field(
        default=None,
        description="Path to source video file"
    )
    video_filename: Optional[str] = Field(
        default=None,
        description="Source video filename"
    )
    video_duration: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Video duration in seconds"
    )
    moments: TranscriptionMomentCollection = Field(
        default_factory=lambda: TranscriptionMomentCollection(project_id=""),
        description="Collection of transcription moments"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    version: str = Field(
        default="1.0.0",
        description="Schema version"
    )

    def model_post_init(self, __context) -> None:
        """Ensure moments collection has correct project_id."""
        if self.moments.project_id != self.id:
            # Create new collection with correct project_id
            new_collection = TranscriptionMomentCollection(
                project_id=self.id,
                moments=self.moments.moments,
                total_duration=self.moments.total_duration,
                created_at=self.moments.created_at,
                updated_at=self.moments.updated_at,
            )
            object.__setattr__(self, 'moments', new_collection)

    def add_moment(self, moment: TranscriptionMoment) -> None:
        """Add a moment to the project's collection."""
        self.moments.add_moment(moment)
        self.updated_at = datetime.utcnow()

    def get_moment_by_id(self, moment_id: str) -> Optional[TranscriptionMoment]:
        """Get a specific moment by ID."""
        for moment in self.moments.moments:
            if moment.id == moment_id:
                return moment
        return None

    def remove_moment(self, moment_id: str) -> bool:
        """Remove a moment by ID. Returns True if removed."""
        for i, moment in enumerate(self.moments.moments):
            if moment.id == moment_id:
                removed = self.moments.moments.pop(i)
                self.moments.total_duration = round(
                    self.moments.total_duration - removed.duration_seconds, 3
                )
                self.updated_at = datetime.utcnow()
                return True
        return False
