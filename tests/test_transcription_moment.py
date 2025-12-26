"""
Tests for TranscriptionMoment models and JSONFileStorage.

This module tests:
- TranscriptionMoment model validation
- TranscriptionMomentCollection operations
- ProjectTranscriptionMoment operations
- JSONFileStorage save/load methods
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from models.transcription_moment import (
    TranscriptionMoment,
    TranscriptionMomentCollection,
    ProjectTranscriptionMoment,
    MomentType,
    MomentSource,
)
from services.json_storage import (
    JSONFileStorage,
    EntityNotFoundError,
    StorageError,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_moment():
    """Create a sample TranscriptionMoment."""
    return TranscriptionMoment(
        start_time=10.5,
        end_time=15.2,
        text="This is a key point in the video.",
        segment_id=2,
        moment_type=MomentType.KEY_POINT,
        labels=["Important", "Summary"],
        confidence=0.95,
        source=MomentSource.AI_DETECTED,
    )


@pytest.fixture
def sample_collection(sample_moment):
    """Create a sample TranscriptionMomentCollection."""
    return TranscriptionMomentCollection(
        project_id="test-project-123",
        moments=[sample_moment],
    )


@pytest.fixture
def sample_project(sample_collection):
    """Create a sample ProjectTranscriptionMoment."""
    return ProjectTranscriptionMoment(
        name="Test Video Project",
        description="A test project for unit testing",
        video_path="/path/to/video.mp4",
        video_filename="video.mp4",
        video_duration=3600.0,
        moments=sample_collection,
    )


@pytest.fixture
def temp_storage_dir():
    """Create a temporary directory for storage tests."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def storage(temp_storage_dir):
    """Create a JSONFileStorage instance for testing."""
    return JSONFileStorage(
        base_path=temp_storage_dir,
        model_class=ProjectTranscriptionMoment,
    )


# ============================================================================
# TranscriptionMoment Tests
# ============================================================================

class TestTranscriptionMoment:
    """Tests for TranscriptionMoment model."""

    def test_create_moment_with_required_fields(self):
        """Test creating a moment with required fields."""
        moment = TranscriptionMoment(
            start_time=0.0,
            end_time=5.0,
            text="Hello world",
            segment_id=0,
        )
        assert moment.start_time == 0.0
        assert moment.end_time == 5.0
        assert moment.text == "Hello world"
        assert moment.segment_id == 0
        assert moment.id.startswith("m-")

    def test_duration_auto_calculated(self):
        """Test that duration is automatically calculated."""
        moment = TranscriptionMoment(
            start_time=10.0,
            end_time=15.5,
            text="Test text",
            segment_id=1,
        )
        assert moment.duration_seconds == 5.5

    def test_segment_ids_includes_primary(self):
        """Test that segment_ids includes the primary segment_id."""
        moment = TranscriptionMoment(
            start_time=0.0,
            end_time=5.0,
            text="Test",
            segment_id=3,
        )
        assert 3 in moment.segment_ids

    def test_labels_normalized(self):
        """Test that labels are normalized to lowercase."""
        moment = TranscriptionMoment(
            start_time=0.0,
            end_time=5.0,
            text="Test",
            segment_id=0,
            labels=["IMPORTANT", "Key Point", "summary"],
        )
        assert "important" in moment.labels
        assert "key point" in moment.labels
        assert "summary" in moment.labels

    def test_end_time_validation(self):
        """Test that end_time must be >= start_time."""
        with pytest.raises(ValueError, match="end_time must be >= start_time"):
            TranscriptionMoment(
                start_time=10.0,
                end_time=5.0,
                text="Invalid",
                segment_id=0,
            )

    def test_add_label(self, sample_moment):
        """Test adding a label."""
        sample_moment.add_label("New Label")
        assert "new label" in sample_moment.labels

    def test_remove_label(self, sample_moment):
        """Test removing a label."""
        result = sample_moment.remove_label("important")
        assert result is True
        assert "important" not in sample_moment.labels

    def test_to_clip_params(self, sample_moment):
        """Test conversion to clip parameters."""
        params = sample_moment.to_clip_params()
        assert "start_time" in params
        assert "end_time" in params
        assert params["start_time"] == sample_moment.start_time
        assert params["end_time"] == sample_moment.end_time
        assert "transcript_text" in params


# ============================================================================
# TranscriptionMomentCollection Tests
# ============================================================================

class TestTranscriptionMomentCollection:
    """Tests for TranscriptionMomentCollection."""

    def test_create_empty_collection(self):
        """Test creating an empty collection."""
        collection = TranscriptionMomentCollection(project_id="test-123")
        assert collection.project_id == "test-123"
        assert len(collection.moments) == 0
        assert collection.total_duration == 0.0

    def test_add_moment(self, sample_moment):
        """Test adding a moment to collection."""
        collection = TranscriptionMomentCollection(project_id="test-123")
        collection.add_moment(sample_moment)
        assert len(collection.moments) == 1
        assert collection.total_duration == sample_moment.duration_seconds

    def test_total_duration_calculated(self, sample_moment):
        """Test that total duration is calculated on init."""
        collection = TranscriptionMomentCollection(
            project_id="test-123",
            moments=[sample_moment],
        )
        assert collection.total_duration == sample_moment.duration_seconds

    def test_get_moments_by_type(self, sample_collection):
        """Test filtering moments by type."""
        key_points = sample_collection.get_moments_by_type(MomentType.KEY_POINT)
        assert len(key_points) == 1

        quotes = sample_collection.get_moments_by_type(MomentType.QUOTE)
        assert len(quotes) == 0

    def test_get_moments_by_label(self, sample_collection):
        """Test filtering moments by label."""
        moments = sample_collection.get_moments_by_label("important")
        assert len(moments) == 1

    def test_get_favorites(self, sample_moment):
        """Test getting favorite moments."""
        sample_moment.is_favorite = True
        collection = TranscriptionMomentCollection(
            project_id="test-123",
            moments=[sample_moment],
        )
        favorites = collection.get_favorites()
        assert len(favorites) == 1

    def test_get_moments_in_range(self, sample_moment):
        """Test getting moments in time range."""
        collection = TranscriptionMomentCollection(
            project_id="test-123",
            moments=[sample_moment],
        )
        # Moment is at 10.5-15.2
        in_range = collection.get_moments_in_range(10.0, 20.0)
        assert len(in_range) == 1

        out_of_range = collection.get_moments_in_range(20.0, 30.0)
        assert len(out_of_range) == 0


# ============================================================================
# ProjectTranscriptionMoment Tests
# ============================================================================

class TestProjectTranscriptionMoment:
    """Tests for ProjectTranscriptionMoment model."""

    def test_create_project(self):
        """Test creating a project."""
        project = ProjectTranscriptionMoment(name="Test Project")
        assert project.name == "Test Project"
        assert project.id is not None
        assert project.moments.project_id == project.id

    def test_add_moment_to_project(self, sample_project, sample_moment):
        """Test adding a moment to project."""
        initial_count = len(sample_project.moments.moments)
        new_moment = TranscriptionMoment(
            start_time=20.0,
            end_time=25.0,
            text="New moment",
            segment_id=5,
        )
        sample_project.add_moment(new_moment)
        assert len(sample_project.moments.moments) == initial_count + 1

    def test_get_moment_by_id(self, sample_project, sample_moment):
        """Test getting a moment by ID."""
        found = sample_project.get_moment_by_id(sample_moment.id)
        assert found is not None
        assert found.id == sample_moment.id

    def test_remove_moment(self, sample_project, sample_moment):
        """Test removing a moment."""
        result = sample_project.remove_moment(sample_moment.id)
        assert result is True
        assert sample_project.get_moment_by_id(sample_moment.id) is None

    def test_project_serialization(self, sample_project):
        """Test that project can be serialized to JSON."""
        json_str = sample_project.model_dump_json()
        assert "Test Video Project" in json_str

        # Test round-trip
        loaded = ProjectTranscriptionMoment.model_validate_json(json_str)
        assert loaded.name == sample_project.name
        assert loaded.id == sample_project.id


# ============================================================================
# JSONFileStorage Tests
# ============================================================================

class TestJSONFileStorage:
    """Tests for JSONFileStorage class."""

    def test_storage_creates_directory(self, temp_storage_dir):
        """Test that storage creates directory if needed."""
        new_dir = Path(temp_storage_dir) / "new_folder"
        storage = JSONFileStorage(
            base_path=str(new_dir),
            model_class=ProjectTranscriptionMoment,
            auto_create_dir=True,
        )
        assert new_dir.exists()

    def test_save_and_load(self, storage, sample_project):
        """Test saving and loading a project."""
        storage.save(sample_project.id, sample_project)
        loaded = storage.load(sample_project.id)
        assert loaded.id == sample_project.id
        assert loaded.name == sample_project.name

    def test_load_not_found(self, storage):
        """Test loading a non-existent project."""
        with pytest.raises(EntityNotFoundError):
            storage.load("non-existent-id")

    def test_exists(self, storage, sample_project):
        """Test checking if project exists."""
        assert storage.exists(sample_project.id) is False
        storage.save(sample_project.id, sample_project)
        assert storage.exists(sample_project.id) is True

    def test_delete(self, storage, sample_project):
        """Test deleting a project."""
        storage.save(sample_project.id, sample_project)
        storage.delete(sample_project.id)
        assert storage.exists(sample_project.id) is False

    def test_delete_not_found(self, storage):
        """Test deleting a non-existent project."""
        with pytest.raises(EntityNotFoundError):
            storage.delete("non-existent-id")

    def test_list_all(self, storage, sample_project):
        """Test listing all projects."""
        storage.save(sample_project.id, sample_project)

        # Create another project
        project2 = ProjectTranscriptionMoment(name="Project 2")
        storage.save(project2.id, project2)

        all_projects = storage.list_all()
        assert len(all_projects) == 2

    def test_list_ids(self, storage, sample_project):
        """Test listing project IDs."""
        storage.save(sample_project.id, sample_project)
        ids = storage.list_ids()
        assert sample_project.id in ids

    def test_count(self, storage, sample_project):
        """Test counting projects."""
        assert storage.count() == 0
        storage.save(sample_project.id, sample_project)
        assert storage.count() == 1

    def test_clear(self, storage, sample_project):
        """Test clearing all projects."""
        storage.save(sample_project.id, sample_project)
        storage.save("project-2", ProjectTranscriptionMoment(name="P2"))
        deleted = storage.clear()
        assert deleted == 2
        assert storage.count() == 0

    def test_save_if_not_exists(self, storage, sample_project):
        """Test conditional save."""
        result1 = storage.save_if_not_exists(sample_project.id, sample_project)
        assert result1 is True

        result2 = storage.save_if_not_exists(sample_project.id, sample_project)
        assert result2 is False

    def test_update(self, storage, sample_project):
        """Test atomic update."""
        storage.save(sample_project.id, sample_project)

        def update_name(project):
            project.name = "Updated Name"
            return project

        updated = storage.update(sample_project.id, update_name)
        assert updated.name == "Updated Name"

        loaded = storage.load(sample_project.id)
        assert loaded.name == "Updated Name"


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for the complete workflow."""

    def test_full_workflow(self, temp_storage_dir):
        """Test complete workflow: create, save, load, modify, delete."""
        # Create storage
        storage = JSONFileStorage(
            base_path=temp_storage_dir,
            model_class=ProjectTranscriptionMoment,
        )

        # Create project
        project = ProjectTranscriptionMoment(
            name="Integration Test Project",
            video_filename="test.mp4",
        )

        # Add moments
        moment1 = TranscriptionMoment(
            start_time=0.0,
            end_time=10.0,
            text="Introduction segment",
            segment_id=0,
            moment_type=MomentType.INTRODUCTION,
        )
        moment2 = TranscriptionMoment(
            start_time=30.0,
            end_time=45.0,
            text="Key point about the topic",
            segment_id=3,
            moment_type=MomentType.KEY_POINT,
            labels=["important"],
        )

        project.add_moment(moment1)
        project.add_moment(moment2)

        # Save
        storage.save(project.id, project)

        # Load and verify
        loaded = storage.load(project.id)
        assert loaded.name == project.name
        assert len(loaded.moments.moments) == 2

        # Modify
        loaded.name = "Modified Project"
        storage.save(loaded.id, loaded)

        # Reload and verify modification
        reloaded = storage.load(loaded.id)
        assert reloaded.name == "Modified Project"

        # Delete
        storage.delete(project.id)
        assert not storage.exists(project.id)
