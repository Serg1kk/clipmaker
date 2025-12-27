"""
Project model for the projects API.

This model represents a simple project entity for CRUD operations.
Uses the existing JSONFileStorage for persistence.
"""

from datetime import datetime
from typing import Optional, Any
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict


class TranscriptionSegment(BaseModel):
    """A segment of transcribed text with timing."""
    id: int = Field(..., description="Segment ID")
    start: float = Field(..., ge=0.0, description="Start time in seconds")
    end: float = Field(..., ge=0.0, description="End time in seconds")
    text: str = Field(..., description="Transcribed text")
    words: list[dict] = Field(default_factory=list, description="Word-level timestamps")


class TranscriptionData(BaseModel):
    """Complete transcription data for a video."""
    text: str = Field(..., description="Full transcription text")
    segments: list[TranscriptionSegment] = Field(default_factory=list, description="Segments with timing")
    language: str = Field(default="en", description="Detected language")
    duration: float = Field(default=0.0, ge=0.0, description="Video duration in seconds")


class MomentData(BaseModel):
    """An AI-detected engaging moment."""
    id: str = Field(..., description="Unique moment ID")
    start: float = Field(..., ge=0.0, description="Start time in seconds")
    end: float = Field(..., ge=0.0, description="End time in seconds")
    reason: str = Field(..., description="Why this moment is engaging")
    text: str = Field(default="", description="Transcript text for this moment")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Confidence score")
    # Crop data per moment
    crop_template: Optional[str] = Field(default="1-frame", description="Crop template type")
    crop_coordinates: list[dict] = Field(default_factory=list, description="Normalized crop coordinates")
    # Subtitle settings per moment
    subtitle_config: dict = Field(default_factory=dict, description="Subtitle styling config")
    # Rendered clip path
    rendered_path: Optional[str] = Field(default=None, description="Path to rendered clip")


class ProjectBase(BaseModel):
    """Base project fields for create/update operations."""
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, max_length=2000, description="Project description")
    video_path: Optional[str] = Field(None, description="Path to source video file")
    tags: list[str] = Field(default_factory=list, description="Project tags")
    metadata: dict = Field(default_factory=dict, description="Additional project metadata")
    # Transcription data (persisted after transcription)
    transcription: Optional[TranscriptionData] = Field(default=None, description="Transcription result")
    # AI moments (persisted after finding moments)
    moments: list[MomentData] = Field(default_factory=list, description="AI-detected engaging moments")
    # Currently selected moment ID (for state restoration)
    current_moment_id: Optional[str] = Field(default=None, description="Currently selected moment ID")


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""
    pass


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project. All fields are optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, max_length=2000, description="Project description")
    video_path: Optional[str] = Field(None, description="Path to source video file")
    tags: Optional[list[str]] = Field(None, description="Project tags")
    metadata: Optional[dict] = Field(None, description="Additional project metadata")
    transcription: Optional[TranscriptionData] = Field(None, description="Transcription result")
    moments: Optional[list[MomentData]] = Field(None, description="AI-detected engaging moments")
    current_moment_id: Optional[str] = Field(None, description="Currently selected moment ID")


class Project(ProjectBase):
    """
    Complete project model with all fields.

    This model is used for storage and API responses.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "My Video Project",
                "description": "A tutorial video project",
                "video_path": "/path/to/video.mp4",
                "tags": ["tutorial", "editing"],
                "metadata": {"duration": 3600, "format": "mp4"},
                "created_at": "2025-12-27T00:00:00Z",
                "updated_at": "2025-12-27T00:00:00Z"
            }
        }
    )

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique project identifier"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Project creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )

    def apply_update(self, update: ProjectUpdate) -> "Project":
        """Apply partial update to project and return updated instance."""
        update_data = update.model_dump(exclude_unset=True)
        current_data = self.model_dump()

        for key, value in update_data.items():
            if value is not None:
                current_data[key] = value

        current_data["updated_at"] = datetime.utcnow()
        return Project.model_validate(current_data)


class ProjectListResponse(BaseModel):
    """Response model for listing projects."""
    projects: list[Project] = Field(..., description="List of projects")
    total: int = Field(..., ge=0, description="Total number of projects")
