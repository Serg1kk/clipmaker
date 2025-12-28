"""
Render model for persisting render history.

This model stores metadata about rendered clips independently from projects,
allowing renders to persist even if the project is deleted.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


class Render(BaseModel):
    """
    Model representing a rendered clip.

    This is stored separately from projects to preserve render history
    even when projects are deleted.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "project_id": "660e8400-e29b-41d4-a716-446655440001",
                "project_name": "My Video Project",
                "moment_id": "770e8400-e29b-41d4-a716-446655440002",
                "moment_reason": "Emotional moment with high engagement",
                "file_path": "/output/project_id/moment_id/20251228_120000/render.mp4",
                "file_size_bytes": 15728640,
                "file_size_formatted": "15.0 MB",
                "duration_seconds": 30.5,
                "thumbnail_path": None,
                "created_at": "2025-12-28T12:00:00Z",
                "crop_template": "2-frame",
                "crop_coordinates": [{"id": "frame-1", "x": 0.1, "y": 0.2, "width": 0.8, "height": 0.6}],
                "subtitle_config": {"enabled": True, "font_size": 48}
            }
        }
    )

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique render identifier"
    )
    project_id: str = Field(..., description="ID of the source project")
    project_name: str = Field(..., description="Name of the source project (denormalized)")
    moment_id: str = Field(..., description="ID of the rendered moment")
    moment_reason: str = Field(default="", description="Why this moment was selected (denormalized)")
    file_path: str = Field(..., description="Path to the rendered video file")
    file_size_bytes: int = Field(default=0, ge=0, description="File size in bytes")
    file_size_formatted: str = Field(default="", description="Human-readable file size")
    duration_seconds: float = Field(default=0.0, ge=0.0, description="Video duration in seconds")
    thumbnail_path: Optional[str] = Field(default=None, description="Path to thumbnail image")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Render creation timestamp"
    )
    # Settings snapshot for reference
    crop_template: str = Field(default="1-frame", description="Crop template used")
    crop_coordinates: list[dict] = Field(default_factory=list, description="Crop coordinates used")
    subtitle_config: dict = Field(default_factory=dict, description="Subtitle configuration used")

    @classmethod
    def from_render_result(
        cls,
        project_id: str,
        project_name: str,
        moment_id: str,
        moment_reason: str,
        file_path: str,
        duration_seconds: float,
        crop_template: str = "1-frame",
        crop_coordinates: Optional[list[dict]] = None,
        subtitle_config: Optional[dict] = None,
    ) -> "Render":
        """
        Create a Render instance from render result data.

        Automatically calculates file size from the file path.
        """
        from pathlib import Path

        path = Path(file_path)
        file_size_bytes = 0
        if path.exists():
            file_size_bytes = path.stat().st_size

        return cls(
            project_id=project_id,
            project_name=project_name,
            moment_id=moment_id,
            moment_reason=moment_reason,
            file_path=file_path,
            file_size_bytes=file_size_bytes,
            file_size_formatted=format_file_size(file_size_bytes),
            duration_seconds=duration_seconds,
            crop_template=crop_template,
            crop_coordinates=crop_coordinates or [],
            subtitle_config=subtitle_config or {},
        )


class RenderListResponse(BaseModel):
    """Response model for listing renders."""
    renders: list[Render] = Field(..., description="List of renders")
    total: int = Field(..., ge=0, description="Total number of renders")
