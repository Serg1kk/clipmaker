"""
Generic JSON File Storage for AI Clips project data persistence.

This module provides a generic, type-safe JSON-based storage class that can
store any Pydantic model to the /data/projects folder.

Storage Structure:
    /data/
    └── projects/
        ├── {project_id}.json
        └── ...

Usage:
    >>> from models.transcription_moment import ProjectTranscriptionMoment
    >>> storage = JSONFileStorage("/data/projects", ProjectTranscriptionMoment)
    >>> storage.save("project-123", project_data)
    >>> loaded = storage.load("project-123")
"""

from __future__ import annotations

import json
import threading
from abc import ABC, abstractmethod
from pathlib import Path
from typing import TypeVar, Generic, Optional, Type, List, Dict, Any

from pydantic import BaseModel


# ============================================================================
# Exception Classes
# ============================================================================

class StorageError(Exception):
    """Base exception for all storage-related errors."""

    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message)
        self.cause = cause


class EntityNotFoundError(StorageError):
    """Raised when an entity with the specified ID is not found."""

    def __init__(self, entity_id: str, entity_type: str = "Entity"):
        super().__init__(f"{entity_type} not found: {entity_id}")
        self.entity_id = entity_id
        self.entity_type = entity_type


class StorageIOError(StorageError):
    """Raised when a read/write operation fails."""

    def __init__(self, operation: str, path: str, cause: Optional[Exception] = None):
        super().__init__(f"Failed to {operation} at '{path}'", cause)
        self.operation = operation
        self.path = path


class ValidationError(StorageError):
    """Raised when data validation fails during load."""

    def __init__(self, entity_id: str, cause: Optional[Exception] = None):
        super().__init__(f"Invalid data for entity: {entity_id}", cause)
        self.entity_id = entity_id


class StorageConfigurationError(StorageError):
    """Raised when storage is misconfigured."""
    pass


# ============================================================================
# Type Definitions
# ============================================================================

T = TypeVar("T", bound=BaseModel)


# ============================================================================
# Abstract Storage Interface
# ============================================================================

class AbstractStorage(ABC, Generic[T]):
    """
    Abstract base class defining the storage interface.
    """

    @abstractmethod
    def save(self, entity_id: str, data: T) -> None:
        """Save an entity to storage."""
        pass

    @abstractmethod
    def load(self, entity_id: str) -> T:
        """Load an entity from storage."""
        pass

    @abstractmethod
    def list_all(self) -> List[T]:
        """List all entities in storage."""
        pass

    @abstractmethod
    def delete(self, entity_id: str) -> None:
        """Delete an entity from storage."""
        pass

    @abstractmethod
    def exists(self, entity_id: str) -> bool:
        """Check if an entity exists in storage."""
        pass


# ============================================================================
# JSON File Storage Implementation
# ============================================================================

class JSONFileStorage(AbstractStorage[T]):
    """
    Generic JSON file-based storage implementation.

    Stores Pydantic model instances as individual JSON files in a directory.
    Thread-safe with per-file locking for concurrent access.

    Attributes:
        base_path: Directory where JSON files are stored
        model_class: The Pydantic model class for type validation
        file_extension: Extension for storage files (default: ".json")

    Example:
        >>> from models.transcription_moment import ProjectTranscriptionMoment
        >>>
        >>> storage = JSONFileStorage(
        ...     base_path="data/projects",
        ...     model_class=ProjectTranscriptionMoment,
        ...     auto_create_dir=True
        ... )
        >>>
        >>> project = ProjectTranscriptionMoment(name="My Project")
        >>> storage.save(project.id, project)
        >>>
        >>> loaded = storage.load(project.id)
        >>> print(loaded.name)  # "My Project"
    """

    def __init__(
        self,
        base_path: str,
        model_class: Type[T],
        *,
        auto_create_dir: bool = True,
        file_extension: str = ".json",
        encoding: str = "utf-8",
        indent: int = 2,
    ) -> None:
        """
        Initialize the JSON file storage.

        Args:
            base_path: Directory path where JSON files will be stored
            model_class: The Pydantic model class for validation
            auto_create_dir: If True, create the directory if it doesn't exist
            file_extension: File extension for stored files (default: ".json")
            encoding: Character encoding for files (default: "utf-8")
            indent: JSON indentation level (default: 2)

        Raises:
            StorageConfigurationError: If base_path is invalid or cannot be created
        """
        self._base_path = Path(base_path).resolve()
        self._model_class = model_class
        self._file_extension = file_extension
        self._encoding = encoding
        self._indent = indent
        self._lock = threading.RLock()
        self._file_locks: Dict[str, threading.RLock] = {}

        if auto_create_dir:
            self._ensure_directory()
        elif not self._base_path.exists():
            raise StorageConfigurationError(
                f"Storage directory does not exist: {self._base_path}"
            )

    @property
    def base_path(self) -> Path:
        """Get the base storage directory path."""
        return self._base_path

    @property
    def model_class(self) -> Type[T]:
        """Get the Pydantic model class."""
        return self._model_class

    def _ensure_directory(self) -> None:
        """Create the storage directory if it doesn't exist."""
        try:
            self._base_path.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise StorageConfigurationError(
                f"Failed to create storage directory: {self._base_path}"
            ) from e

    def _get_file_path(self, entity_id: str) -> Path:
        """Get the file path for an entity."""
        safe_id = entity_id.replace("/", "_").replace("\\", "_")
        return self._base_path / f"{safe_id}{self._file_extension}"

    def _get_file_lock(self, entity_id: str) -> threading.RLock:
        """Get or create a lock for a specific entity file."""
        with self._lock:
            if entity_id not in self._file_locks:
                self._file_locks[entity_id] = threading.RLock()
            return self._file_locks[entity_id]

    def save(self, entity_id: str, data: T) -> None:
        """
        Save an entity to a JSON file.

        Args:
            entity_id: Unique identifier for the entity
            data: The Pydantic model instance to save

        Raises:
            StorageIOError: If the write operation fails
            StorageError: If serialization fails
        """
        file_path = self._get_file_path(entity_id)
        file_lock = self._get_file_lock(entity_id)

        with file_lock:
            try:
                json_content = data.model_dump_json(indent=self._indent)
                file_path.write_text(json_content, encoding=self._encoding)
            except OSError as e:
                raise StorageIOError("write", str(file_path), e) from e
            except Exception as e:
                raise StorageError(
                    f"Failed to serialize entity: {entity_id}", e
                ) from e

    def load(self, entity_id: str) -> T:
        """
        Load an entity from a JSON file.

        Args:
            entity_id: Unique identifier for the entity

        Returns:
            The deserialized Pydantic model instance

        Raises:
            EntityNotFoundError: If the file doesn't exist
            ValidationError: If the JSON data is invalid for the model
            StorageIOError: If the read operation fails
        """
        file_path = self._get_file_path(entity_id)
        file_lock = self._get_file_lock(entity_id)

        if not file_path.exists():
            raise EntityNotFoundError(
                entity_id,
                entity_type=self._model_class.__name__
            )

        with file_lock:
            try:
                json_content = file_path.read_text(encoding=self._encoding)
                data = json.loads(json_content)
                return self._model_class.model_validate(data)
            except json.JSONDecodeError as e:
                raise ValidationError(entity_id, e) from e
            except OSError as e:
                raise StorageIOError("read", str(file_path), e) from e
            except Exception as e:
                if isinstance(e, (EntityNotFoundError, ValidationError, StorageIOError)):
                    raise
                raise ValidationError(entity_id, e) from e

    def list_all(self) -> List[T]:
        """
        List all entities in storage.

        Returns:
            List of all valid Pydantic model instances

        Raises:
            StorageIOError: If directory listing fails
        """
        entities: List[T] = []

        try:
            pattern = f"*{self._file_extension}"
            files = sorted(self._base_path.glob(pattern))
        except OSError as e:
            raise StorageIOError("list", str(self._base_path), e) from e

        for file_path in files:
            entity_id = file_path.stem
            try:
                entity = self.load(entity_id)
                entities.append(entity)
            except (ValidationError, StorageIOError):
                continue

        return entities

    def list_ids(self) -> List[str]:
        """
        List all entity IDs without loading full data.

        Returns:
            List of entity identifiers

        Raises:
            StorageIOError: If directory listing fails
        """
        try:
            pattern = f"*{self._file_extension}"
            files = sorted(self._base_path.glob(pattern))
            return [f.stem for f in files]
        except OSError as e:
            raise StorageIOError("list", str(self._base_path), e) from e

    def delete(self, entity_id: str) -> None:
        """
        Delete an entity file from storage.

        Args:
            entity_id: Unique identifier for the entity

        Raises:
            EntityNotFoundError: If the file doesn't exist
            StorageIOError: If the delete operation fails
        """
        file_path = self._get_file_path(entity_id)
        file_lock = self._get_file_lock(entity_id)

        if not file_path.exists():
            raise EntityNotFoundError(
                entity_id,
                entity_type=self._model_class.__name__
            )

        with file_lock:
            try:
                file_path.unlink()
            except OSError as e:
                raise StorageIOError("delete", str(file_path), e) from e

        with self._lock:
            self._file_locks.pop(entity_id, None)

    def exists(self, entity_id: str) -> bool:
        """
        Check if an entity exists in storage.

        Args:
            entity_id: Unique identifier for the entity

        Returns:
            True if the entity file exists, False otherwise
        """
        file_path = self._get_file_path(entity_id)
        return file_path.exists()

    def count(self) -> int:
        """Get the count of stored entities."""
        return len(self.list_ids())

    def clear(self) -> int:
        """
        Delete all entities from storage.

        Returns:
            Number of entities deleted
        """
        ids = self.list_ids()
        count = 0
        for entity_id in ids:
            try:
                self.delete(entity_id)
                count += 1
            except EntityNotFoundError:
                continue
        return count

    def save_if_not_exists(self, entity_id: str, data: T) -> bool:
        """
        Save an entity only if it doesn't already exist.

        Args:
            entity_id: Unique identifier for the entity
            data: The Pydantic model instance to save

        Returns:
            True if saved, False if already exists
        """
        file_lock = self._get_file_lock(entity_id)
        with file_lock:
            if self.exists(entity_id):
                return False
            self.save(entity_id, data)
            return True

    def update(self, entity_id: str, update_fn: callable) -> T:
        """
        Atomically load, update, and save an entity.

        Args:
            entity_id: Unique identifier for the entity
            update_fn: Function that receives the entity and returns updated

        Returns:
            The updated entity

        Raises:
            EntityNotFoundError: If the entity doesn't exist
        """
        file_lock = self._get_file_lock(entity_id)
        with file_lock:
            entity = self.load(entity_id)
            updated_entity = update_fn(entity)
            self.save(entity_id, updated_entity)
            return updated_entity


# ============================================================================
# Singleton Pattern Support
# ============================================================================

class StorageRegistry:
    """
    Registry for managing singleton storage instances.

    Example:
        >>> registry = StorageRegistry()
        >>> storage = registry.get_storage(
        ...     "data/projects",
        ...     ProjectTranscriptionMoment
        ... )
    """

    _instance: Optional['StorageRegistry'] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls) -> 'StorageRegistry':
        """Ensure only one registry instance exists."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._storages = {}
                    cls._instance._storage_lock = threading.RLock()
        return cls._instance

    def get_storage(
        self,
        base_path: str,
        model_class: Type[T],
        **kwargs: Any,
    ) -> JSONFileStorage[T]:
        """
        Get or create a storage instance.

        Args:
            base_path: Directory path for storage
            model_class: Pydantic model class
            **kwargs: Additional arguments for JSONFileStorage

        Returns:
            JSONFileStorage instance (cached singleton per path+model)
        """
        key = (base_path, model_class.__name__)

        with self._storage_lock:
            if key not in self._storages:
                self._storages[key] = JSONFileStorage(
                    base_path=base_path,
                    model_class=model_class,
                    **kwargs
                )
            return self._storages[key]

    def clear_cache(self) -> None:
        """Clear all cached storage instances."""
        with self._storage_lock:
            self._storages.clear()


# ============================================================================
# Convenience Functions
# ============================================================================

_registry: Optional[StorageRegistry] = None


def get_storage_registry() -> StorageRegistry:
    """Get the global storage registry instance."""
    global _registry
    if _registry is None:
        _registry = StorageRegistry()
    return _registry


def get_project_moment_storage(
    base_path: str = "data/projects",
) -> JSONFileStorage:
    """
    Get a storage instance for ProjectTranscriptionMoment in /data/projects.

    Args:
        base_path: Base path (default: "data/projects")

    Returns:
        JSONFileStorage instance for ProjectTranscriptionMoment

    Example:
        >>> storage = get_project_moment_storage()
        >>> storage.save("my-project", project)
    """
    from models.transcription_moment import ProjectTranscriptionMoment
    registry = get_storage_registry()
    return registry.get_storage(base_path, ProjectTranscriptionMoment)
