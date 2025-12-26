"""
File Browser Service for AI Clips

Provides secure file system browsing capabilities for video file selection.
Includes path validation, security checks, and video file detection.
"""

import mimetypes
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


# Configuration
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
    "video/x-m4v",
}
HIDDEN_PATTERNS = [
    r"^\.",  # Unix hidden files
    r"^__",  # Python cache
    r"\.pyc$",
    r"^node_modules$",
    r"^\.git$",
    r"^\.svn$",
    r"^\$",  # Windows system files
    r"^desktop\.ini$",
    r"^Thumbs\.db$",
    r"^\.DS_Store$",
]


class FileItem(BaseModel):
    """Model representing a file or directory item."""
    name: str = Field(..., description="File or directory name")
    type: str = Field(..., description="'file' or 'directory'")
    path: str = Field(..., description="Full absolute path")
    size_bytes: Optional[int] = Field(None, description="File size in bytes")
    size_formatted: Optional[str] = Field(None, description="Human-readable file size")
    modified: Optional[str] = Field(None, description="ISO format modification date")
    is_video: bool = Field(default=False, description="Whether file is a video")
    extension: Optional[str] = Field(None, description="File extension")


class BrowseResponse(BaseModel):
    """Response model for directory browsing."""
    current_path: str = Field(..., description="Current directory path")
    parent_path: Optional[str] = Field(None, description="Parent directory path")
    items: list[FileItem] = Field(default_factory=list, description="Directory contents")
    error: Optional[str] = Field(None, description="Error message if any")


class RootDirectory(BaseModel):
    """Model for a root directory option."""
    name: str = Field(..., description="Display name")
    path: str = Field(..., description="Absolute path")
    icon: str = Field(..., description="Icon identifier")
    exists: bool = Field(..., description="Whether directory exists")


class ValidationResult(BaseModel):
    """Result of path validation."""
    valid: bool = Field(..., description="Whether the path is valid")
    path: Optional[str] = Field(None, description="Validated absolute path")
    is_video: bool = Field(default=False, description="Whether file is a valid video")
    file_info: Optional[FileItem] = Field(None, description="File information if valid")
    error: Optional[str] = Field(None, description="Error message if invalid")


class FileBrowserService:
    """
    Service for secure file system browsing.

    Provides methods for:
    - Browsing directories with security validation
    - Filtering video files
    - Path validation and sanitization
    - File metadata retrieval
    """

    def __init__(self, allowed_roots: Optional[list[str]] = None):
        """
        Initialize the file browser service.

        Args:
            allowed_roots: Optional list of allowed root directories.
                          If None, uses default user directories.
        """
        self.home_dir = Path.home()
        self.allowed_roots = allowed_roots or self._get_default_roots()

    def _get_default_roots(self) -> list[str]:
        """Get default allowed root directories."""
        roots = [
            str(self.home_dir),
            str(self.home_dir / "Desktop"),
            str(self.home_dir / "Downloads"),
            str(self.home_dir / "Videos"),
            str(self.home_dir / "Movies"),
            str(self.home_dir / "Documents"),
        ]
        # Add common video locations
        if os.name == "nt":  # Windows
            for drive in ["C:", "D:", "E:"]:
                if Path(f"{drive}\\").exists():
                    roots.append(f"{drive}\\")
        return roots

    def _is_hidden(self, name: str) -> bool:
        """Check if a file/directory should be hidden."""
        for pattern in HIDDEN_PATTERNS:
            if re.match(pattern, name, re.IGNORECASE):
                return True
        return False

    def _is_path_allowed(self, path: Path) -> bool:
        """
        Check if the path is within allowed directories.

        Prevents access to system directories and enforces
        path traversal protection.
        """
        try:
            resolved = path.resolve()
            resolved_str = str(resolved)

            # Check if path is within any allowed root
            for root in self.allowed_roots:
                root_resolved = str(Path(root).resolve())
                if resolved_str.startswith(root_resolved):
                    return True

            # Allow home directory and subdirectories
            if resolved_str.startswith(str(self.home_dir)):
                return True

            return False
        except Exception:
            return False

    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                if unit == "B":
                    return f"{size_bytes} {unit}"
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def _is_video_file(self, path: Path) -> bool:
        """Check if a file is a valid video file."""
        if not path.is_file():
            return False

        # Check extension
        ext = path.suffix.lower()
        if ext not in VIDEO_EXTENSIONS:
            return False

        # Check MIME type
        mime_type, _ = mimetypes.guess_type(str(path))
        if mime_type and mime_type not in VIDEO_MIME_TYPES:
            # Extension matched but MIME didn't - still allow if extension is valid
            pass

        return True

    def _check_file_integrity(self, path: Path) -> bool:
        """
        Basic file integrity check.

        Verifies the file exists, is readable, and has content.
        """
        try:
            if not path.exists() or not path.is_file():
                return False

            # Check if file is readable and has content
            if path.stat().st_size == 0:
                return False

            # Try to open the file briefly
            with open(path, "rb") as f:
                # Read first few bytes to verify accessibility
                header = f.read(12)
                if len(header) < 4:
                    return False

            return True
        except (PermissionError, OSError):
            return False

    def validate_path(self, path_str: str) -> ValidationResult:
        """
        Validate and sanitize a file path.

        Args:
            path_str: The path string to validate

        Returns:
            ValidationResult with validation status and details
        """
        try:
            # Handle empty path
            if not path_str or not path_str.strip():
                return ValidationResult(
                    valid=False,
                    error="Path cannot be empty"
                )

            # Normalize and resolve path
            path = Path(path_str).expanduser().resolve()

            # Check for path traversal attempts
            if ".." in path_str:
                # Verify resolved path doesn't escape allowed directories
                if not self._is_path_allowed(path):
                    return ValidationResult(
                        valid=False,
                        error="Path traversal not allowed"
                    )

            # Check if path exists
            if not path.exists():
                return ValidationResult(
                    valid=False,
                    error=f"Path does not exist: {path_str}"
                )

            # Check if path is allowed
            if not self._is_path_allowed(path):
                return ValidationResult(
                    valid=False,
                    error="Access to this directory is not allowed"
                )

            # For files, check if it's a video
            is_video = False
            file_info = None

            if path.is_file():
                is_video = self._is_video_file(path)
                if is_video and not self._check_file_integrity(path):
                    return ValidationResult(
                        valid=False,
                        error="File appears to be corrupted or inaccessible"
                    )
                file_info = self.get_file_info(str(path))

            return ValidationResult(
                valid=True,
                path=str(path),
                is_video=is_video,
                file_info=file_info
            )

        except PermissionError:
            return ValidationResult(
                valid=False,
                error="Permission denied"
            )
        except Exception as e:
            return ValidationResult(
                valid=False,
                error=f"Validation error: {str(e)}"
            )

    def get_file_info(self, path_str: str) -> Optional[FileItem]:
        """
        Get detailed information about a file.

        Args:
            path_str: Path to the file

        Returns:
            FileItem with file details or None if not accessible
        """
        try:
            path = Path(path_str).resolve()

            if not path.exists():
                return None

            stat = path.stat()

            if path.is_file():
                return FileItem(
                    name=path.name,
                    type="file",
                    path=str(path),
                    size_bytes=stat.st_size,
                    size_formatted=self._format_size(stat.st_size),
                    modified=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    is_video=self._is_video_file(path),
                    extension=path.suffix.lower()
                )
            else:
                return FileItem(
                    name=path.name,
                    type="directory",
                    path=str(path),
                    modified=datetime.fromtimestamp(stat.st_mtime).isoformat()
                )

        except (PermissionError, OSError):
            return None

    def browse_directory(
        self,
        path_str: Optional[str] = None,
        show_hidden: bool = False,
        video_only: bool = False
    ) -> BrowseResponse:
        """
        Browse a directory and return its contents.

        Args:
            path_str: Directory path to browse (defaults to home)
            show_hidden: Whether to show hidden files
            video_only: Whether to show only video files

        Returns:
            BrowseResponse with directory contents
        """
        try:
            # Default to home directory
            if not path_str:
                path_str = str(self.home_dir)

            # Validate path
            validation = self.validate_path(path_str)
            if not validation.valid:
                return BrowseResponse(
                    current_path=path_str,
                    parent_path=None,
                    items=[],
                    error=validation.error
                )

            path = Path(validation.path)  # type: ignore

            # Ensure it's a directory
            if not path.is_dir():
                path = path.parent

            # Get parent path
            parent_path = None
            if path != path.parent and self._is_path_allowed(path.parent):
                parent_path = str(path.parent)

            items: list[FileItem] = []

            # List directory contents
            try:
                entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
            except PermissionError:
                return BrowseResponse(
                    current_path=str(path),
                    parent_path=parent_path,
                    items=[],
                    error="Permission denied to read directory"
                )

            for entry in entries:
                # Skip hidden files unless requested
                if not show_hidden and self._is_hidden(entry.name):
                    continue

                # Skip if video_only and not a video or directory
                if video_only and entry.is_file() and not self._is_video_file(entry):
                    continue

                file_info = self.get_file_info(str(entry))
                if file_info:
                    items.append(file_info)

            return BrowseResponse(
                current_path=str(path),
                parent_path=parent_path,
                items=items
            )

        except Exception as e:
            return BrowseResponse(
                current_path=path_str or str(self.home_dir),
                parent_path=None,
                items=[],
                error=f"Error browsing directory: {str(e)}"
            )

    def get_video_files(self, path_str: str) -> BrowseResponse:
        """
        Get only video files from a directory.

        Args:
            path_str: Directory path to search

        Returns:
            BrowseResponse with only video files
        """
        return self.browse_directory(path_str, show_hidden=False, video_only=True)

    def get_root_directories(self) -> list[RootDirectory]:
        """
        Get list of available root directories for browsing.

        Returns:
            List of RootDirectory objects with common locations
        """
        roots = [
            RootDirectory(
                name="Home",
                path=str(self.home_dir),
                icon="home",
                exists=self.home_dir.exists()
            ),
            RootDirectory(
                name="Desktop",
                path=str(self.home_dir / "Desktop"),
                icon="desktop",
                exists=(self.home_dir / "Desktop").exists()
            ),
            RootDirectory(
                name="Downloads",
                path=str(self.home_dir / "Downloads"),
                icon="download",
                exists=(self.home_dir / "Downloads").exists()
            ),
            RootDirectory(
                name="Documents",
                path=str(self.home_dir / "Documents"),
                icon="document",
                exists=(self.home_dir / "Documents").exists()
            ),
        ]

        # Add Videos/Movies based on platform
        videos_dir = self.home_dir / "Videos"
        movies_dir = self.home_dir / "Movies"

        if videos_dir.exists():
            roots.append(RootDirectory(
                name="Videos",
                path=str(videos_dir),
                icon="video",
                exists=True
            ))
        elif movies_dir.exists():
            roots.append(RootDirectory(
                name="Movies",
                path=str(movies_dir),
                icon="video",
                exists=True
            ))
        else:
            # Add even if doesn't exist (for display purposes)
            roots.append(RootDirectory(
                name="Videos",
                path=str(videos_dir),
                icon="video",
                exists=False
            ))

        return roots


# Singleton instance for the service
file_browser_service = FileBrowserService()
