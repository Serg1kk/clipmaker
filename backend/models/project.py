"""
Project model for the projects API.

This model represents a simple project entity for CRUD operations.
Uses the existing JSONFileStorage for persistence.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict


class ProjectBase(BaseModel):
    """Base project fields for create/update operations."""
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, max_length=2000, description="Project description")
    video_path: Optional[str] = Field(None, description="Path to source video file")
    tags: list[str] = Field(default_factory=list, description="Project tags")
    metadata: dict = Field(default_factory=dict, description="Additional project metadata")


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
