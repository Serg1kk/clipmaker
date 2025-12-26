"""
Storage Service for AI Clips project data persistence.

This module provides JSON-based storage operations for:
- Project CRUD operations
- Transcription data management
- Export functionality to various formats (SRT, VTT, JSON)

Storage Structure:
    /output/
    ├── projects/
    │   ├── {project_id}/
    │   │   ├── project.json
    │   │   ├── audio/
    │   │   │   └── extracted.wav
    │   │   ├── transcription/
    │   │   │   └── transcript.json
    │   │   └── clips/
    │   └── index.json
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from models.schemas import (
    ProjectSchema,
    ProjectIndex,
    ProjectIndexEntry,
    TranscriptionSchema,
    TranscriptionStatus,
    ClipSchema,
    SegmentSchema,
)


class StorageServiceError(Exception):
    """Base exception for storage service errors."""
    pass


class ProjectNotFoundError(StorageServiceError):
    """Raised when a project is not found."""
    pass


class StorageService:
    """
    JSON-based storage service for AI Clips projects.

    Provides persistent storage for projects, transcriptions, and clips
    using a structured JSON file format.

    Attributes:
        base_path: Root directory for all project storage
        projects_path: Directory containing project folders
        index_path: Path to the projects index file

    Example:
        >>> service = StorageService("/output")
        >>> project = service.create_project("My Video", "/path/to/video.mp4")
        >>> service.save_project(project)
        >>> loaded = service.load_project(project.id)
    """

    def __init__(self, base_path: str = "output"):
        """
        Initialize the storage service.

        Args:
            base_path: Root directory for storage (default: "output")
        """
        self.base_path = Path(base_path).resolve()
        self.projects_path = self.base_path / "projects"
        self.index_path = self.projects_path / "index.json"

        # Ensure directories exist
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        """Create necessary directory structure if it doesn't exist."""
        self.projects_path.mkdir(parents=True, exist_ok=True)

        # Initialize index if it doesn't exist
        if not self.index_path.exists():
            self._save_index(ProjectIndex())

    def _get_project_dir(self, project_id: str) -> Path:
        """Get the directory path for a specific project."""
        return self.projects_path / project_id

    def _get_project_file(self, project_id: str) -> Path:
        """Get the project.json file path for a specific project."""
        return self._get_project_dir(project_id) / "project.json"

    def _load_index(self) -> ProjectIndex:
        """Load the projects index from disk."""
        try:
            if self.index_path.exists():
                with open(self.index_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return ProjectIndex.model_validate(data)
        except (json.JSONDecodeError, Exception) as e:
            # Log error and return empty index
            print(f"Warning: Could not load index: {e}")
        return ProjectIndex()

    def _save_index(self, index: ProjectIndex) -> None:
        """Save the projects index to disk."""
        index.updated_at = datetime.utcnow()
        with open(self.index_path, "w", encoding="utf-8") as f:
            f.write(index.model_dump_json(indent=2))

    def _update_index_entry(self, project: ProjectSchema) -> None:
        """Update or add a project entry in the index."""
        index = self._load_index()

        # Create index entry
        entry = ProjectIndexEntry(
            id=project.id,
            name=project.name,
            created_at=project.created_at,
            updated_at=project.updated_at,
            video_filename=(
                project.source_video.filename
                if project.source_video else None
            ),
            transcription_status=project.transcription.status,
            clip_count=len(project.clips),
        )

        # Update or add entry
        found = False
        for i, existing in enumerate(index.projects):
            if existing.id == project.id:
                index.projects[i] = entry
                found = True
                break

        if not found:
            index.projects.append(entry)

        self._save_index(index)

    def _remove_index_entry(self, project_id: str) -> None:
        """Remove a project entry from the index."""
        index = self._load_index()
        index.projects = [p for p in index.projects if p.id != project_id]
        self._save_index(index)

    def create_project(
        self,
        name: str,
        video_path: Optional[str] = None,
        description: Optional[str] = None,
    ) -> ProjectSchema:
        """
        Create a new project with optional video file.

        Args:
            name: Project display name
            video_path: Optional path to source video file
            description: Optional project description

        Returns:
            The created ProjectSchema instance

        Example:
            >>> project = service.create_project(
            ...     "Tutorial Video",
            ...     "/videos/tutorial.mp4",
            ...     "Python programming tutorial"
            ... )
        """
        from ..models.schemas import SourceVideoSchema

        project_id = str(uuid4())
        project_dir = self._get_project_dir(project_id)

        # Create project directory structure
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "audio").mkdir(exist_ok=True)
        (project_dir / "transcription").mkdir(exist_ok=True)
        (project_dir / "clips").mkdir(exist_ok=True)

        # Build source video metadata if provided
        source_video = None
        if video_path:
            video_file = Path(video_path)
            if video_file.exists():
                source_video = SourceVideoSchema(
                    path=str(video_file.resolve()),
                    filename=video_file.name,
                    format=video_file.suffix.lstrip(".").lower(),
                    file_size_bytes=video_file.stat().st_size,
                )

        project = ProjectSchema(
            id=project_id,
            name=name,
            description=description,
            source_video=source_video,
        )

        return project

    def save_project(self, project: ProjectSchema) -> None:
        """
        Save a project to disk.

        Args:
            project: The ProjectSchema instance to save

        Raises:
            StorageServiceError: If save operation fails

        Example:
            >>> service.save_project(my_project)
        """
        try:
            project_dir = self._get_project_dir(project.id)
            project_dir.mkdir(parents=True, exist_ok=True)

            # Update timestamp
            project.updated_at = datetime.utcnow()

            # Save project JSON
            project_file = self._get_project_file(project.id)
            with open(project_file, "w", encoding="utf-8") as f:
                f.write(project.model_dump_json(indent=2))

            # Save separate transcription file for quick access
            if project.transcription.segments:
                transcript_file = project_dir / "transcription" / "transcript.json"
                with open(transcript_file, "w", encoding="utf-8") as f:
                    f.write(project.transcription.model_dump_json(indent=2))

            # Update index
            self._update_index_entry(project)

        except Exception as e:
            raise StorageServiceError(f"Failed to save project: {e}") from e

    def load_project(self, project_id: str) -> ProjectSchema:
        """
        Load a project from disk.

        Args:
            project_id: The unique project identifier

        Returns:
            The loaded ProjectSchema instance

        Raises:
            ProjectNotFoundError: If project doesn't exist
            StorageServiceError: If load operation fails

        Example:
            >>> project = service.load_project("uuid-string")
        """
        project_file = self._get_project_file(project_id)

        if not project_file.exists():
            raise ProjectNotFoundError(f"Project not found: {project_id}")

        try:
            with open(project_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ProjectSchema.model_validate(data)
        except json.JSONDecodeError as e:
            raise StorageServiceError(f"Invalid project file: {e}") from e
        except Exception as e:
            raise StorageServiceError(f"Failed to load project: {e}") from e

    def delete_project(self, project_id: str) -> None:
        """
        Delete a project and all associated files.

        Args:
            project_id: The unique project identifier

        Raises:
            ProjectNotFoundError: If project doesn't exist
            StorageServiceError: If delete operation fails

        Example:
            >>> service.delete_project("uuid-string")
        """
        project_dir = self._get_project_dir(project_id)

        if not project_dir.exists():
            raise ProjectNotFoundError(f"Project not found: {project_id}")

        try:
            shutil.rmtree(project_dir)
            self._remove_index_entry(project_id)
        except Exception as e:
            raise StorageServiceError(f"Failed to delete project: {e}") from e

    def list_projects(self) -> list[ProjectIndexEntry]:
        """
        List all projects with summary information.

        Returns:
            List of ProjectIndexEntry instances sorted by updated_at

        Example:
            >>> projects = service.list_projects()
            >>> for p in projects:
            ...     print(f"{p.name}: {p.transcription_status}")
        """
        index = self._load_index()
        # Sort by updated_at descending (most recent first)
        return sorted(
            index.projects,
            key=lambda x: x.updated_at,
            reverse=True
        )

    def update_transcription(
        self,
        project_id: str,
        transcription: TranscriptionSchema,
    ) -> ProjectSchema:
        """
        Update the transcription data for a project.

        Args:
            project_id: The unique project identifier
            transcription: The new TranscriptionSchema data

        Returns:
            The updated ProjectSchema instance

        Raises:
            ProjectNotFoundError: If project doesn't exist

        Example:
            >>> transcription = TranscriptionSchema(
            ...     status=TranscriptionStatus.COMPLETED,
            ...     text="Hello world...",
            ...     segments=[...]
            ... )
            >>> service.update_transcription(project_id, transcription)
        """
        project = self.load_project(project_id)
        project.transcription = transcription
        project.updated_at = datetime.utcnow()
        self.save_project(project)
        return project

    def add_clip(
        self,
        project_id: str,
        clip: ClipSchema,
    ) -> ProjectSchema:
        """
        Add a clip to a project.

        Args:
            project_id: The unique project identifier
            clip: The ClipSchema to add

        Returns:
            The updated ProjectSchema instance

        Example:
            >>> clip = ClipSchema(
            ...     name="Introduction",
            ...     start_time=0.0,
            ...     end_time=30.0
            ... )
            >>> service.add_clip(project_id, clip)
        """
        project = self.load_project(project_id)
        project.clips.append(clip)
        project.updated_at = datetime.utcnow()
        self.save_project(project)
        return project

    def remove_clip(
        self,
        project_id: str,
        clip_id: str,
    ) -> ProjectSchema:
        """
        Remove a clip from a project.

        Args:
            project_id: The unique project identifier
            clip_id: The clip identifier to remove

        Returns:
            The updated ProjectSchema instance
        """
        project = self.load_project(project_id)
        project.clips = [c for c in project.clips if c.id != clip_id]
        project.updated_at = datetime.utcnow()
        self.save_project(project)
        return project

    def export_project(
        self,
        project_id: str,
        format: str = "json",
        output_path: Optional[str] = None,
    ) -> str:
        """
        Export project data to various formats.

        Supported formats:
        - json: Full project JSON
        - srt: SubRip subtitle format
        - vtt: WebVTT subtitle format
        - txt: Plain text transcript

        Args:
            project_id: The unique project identifier
            format: Export format (json, srt, vtt, txt)
            output_path: Optional custom output path

        Returns:
            Path to the exported file

        Raises:
            ProjectNotFoundError: If project doesn't exist
            ValueError: If format is not supported

        Example:
            >>> path = service.export_project(project_id, "srt")
            >>> print(f"Exported to: {path}")
        """
        project = self.load_project(project_id)
        format_lower = format.lower()

        # Determine output path
        if output_path:
            export_path = Path(output_path)
        else:
            export_dir = self._get_project_dir(project_id) / "exports"
            export_dir.mkdir(exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            export_path = export_dir / f"{project.name}_{timestamp}.{format_lower}"

        # Generate content based on format
        if format_lower == "json":
            content = project.model_dump_json(indent=2)
        elif format_lower == "srt":
            content = self._generate_srt(project.transcription.segments)
        elif format_lower == "vtt":
            content = self._generate_vtt(project.transcription.segments)
        elif format_lower == "txt":
            content = project.transcription.text
        else:
            raise ValueError(f"Unsupported export format: {format}")

        # Write file
        with open(export_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(export_path)

    def _format_timestamp_srt(self, seconds: float) -> str:
        """Format seconds as SRT timestamp (HH:MM:SS,mmm)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _format_timestamp_vtt(self, seconds: float) -> str:
        """Format seconds as VTT timestamp (HH:MM:SS.mmm)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

    def _generate_srt(self, segments: list[SegmentSchema]) -> str:
        """Generate SRT subtitle content from segments."""
        lines = []
        for i, segment in enumerate(segments, 1):
            start = self._format_timestamp_srt(segment.start)
            end = self._format_timestamp_srt(segment.end)
            lines.append(str(i))
            lines.append(f"{start} --> {end}")
            lines.append(segment.text.strip())
            lines.append("")  # Empty line between entries
        return "\n".join(lines)

    def _generate_vtt(self, segments: list[SegmentSchema]) -> str:
        """Generate WebVTT subtitle content from segments."""
        lines = ["WEBVTT", ""]
        for i, segment in enumerate(segments, 1):
            start = self._format_timestamp_vtt(segment.start)
            end = self._format_timestamp_vtt(segment.end)
            lines.append(str(i))
            lines.append(f"{start} --> {end}")
            lines.append(segment.text.strip())
            lines.append("")  # Empty line between entries
        return "\n".join(lines)

    def get_project_stats(self, project_id: str) -> dict:
        """
        Get statistics for a project.

        Args:
            project_id: The unique project identifier

        Returns:
            Dictionary with project statistics

        Example:
            >>> stats = service.get_project_stats(project_id)
            >>> print(f"Word count: {stats['word_count']}")
        """
        project = self.load_project(project_id)

        total_clip_duration = sum(
            clip.duration_seconds for clip in project.clips
        )

        return {
            "project_id": project.id,
            "project_name": project.name,
            "transcription_status": project.transcription.status.value,
            "segment_count": len(project.transcription.segments),
            "word_count": project.transcription.word_count,
            "clip_count": len(project.clips),
            "total_clip_duration_seconds": total_clip_duration,
            "video_duration_seconds": (
                project.source_video.duration_seconds
                if project.source_video else None
            ),
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
        }


# Singleton instance for convenience
_default_service: Optional[StorageService] = None


def get_storage_service(base_path: str = "output") -> StorageService:
    """
    Get or create the default storage service instance.

    Args:
        base_path: Root directory for storage

    Returns:
        StorageService instance
    """
    global _default_service
    if _default_service is None:
        _default_service = StorageService(base_path)
    return _default_service
