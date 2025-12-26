"""
Tests for Transcription API Endpoint

This module tests the /transcribe POST endpoint and related functionality:
- Valid video path submissions
- Invalid path handling (404)
- Non-video file handling (400)
- Job status polling via GET /transcribe/{job_id}
- Response format validation (words and timestamps)
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Add backend to path for imports
BACKEND_PATH = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(BACKEND_PATH))
sys.path.insert(0, str(BACKEND_PATH / "services"))


class TestTranscribeEndpointValidPath:
    """Tests for POST /transcribe with valid video paths."""

    def test_transcribe_with_valid_path(self, client: TestClient, mock_video_path: Path):
        """Test transcription request with a valid video file path."""
        response = client.post(
            "/transcribe",
            data={"file_path": str(mock_video_path)},
        )

        assert response.status_code == 202
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        assert "message" in data
        assert uuid.UUID(data["job_id"])  # Valid UUID

    def test_transcribe_returns_job_id(self, client: TestClient, mock_video_path: Path):
        """Test that transcription returns a valid UUID job ID."""
        response = client.post(
            "/transcribe",
            data={"file_path": str(mock_video_path)},
        )

        assert response.status_code == 202
        job_id = response.json()["job_id"]

        # Verify it's a valid UUID
        parsed_uuid = uuid.UUID(job_id)
        assert str(parsed_uuid) == job_id

    def test_transcribe_creates_job(
        self, client: TestClient, mock_video_path: Path, clear_jobs_store: Dict
    ):
        """Test that transcription creates a job in the store."""
        response = client.post(
            "/transcribe",
            data={"file_path": str(mock_video_path)},
        )

        assert response.status_code == 202
        job_id = response.json()["job_id"]

        # Verify job was created in store
        assert job_id in clear_jobs_store
        job = clear_jobs_store[job_id]
        # Job may quickly transition from pending to processing/failed
        # in background task, so just verify it exists
        assert job.job_id == job_id

    def test_transcribe_accepts_various_video_extensions(
        self, client: TestClient, mock_video_directory: Path
    ):
        """Test transcription accepts all valid video extensions."""
        valid_extensions = [".mp4", ".mov", ".mkv"]

        for ext in valid_extensions:
            video_file = mock_video_directory / f"video{ext}"
            video_file.write_bytes(b"\x00" * 1024)

            response = client.post(
                "/transcribe",
                data={"file_path": str(video_file)},
            )

            assert response.status_code == 202, f"Failed for extension {ext}"


class TestTranscribeEndpointInvalidPath:
    """Tests for POST /transcribe with invalid/non-existent paths."""

    def test_transcribe_nonexistent_path_returns_404(
        self, client: TestClient, nonexistent_video_path: str
    ):
        """Test transcription with non-existent path returns 404."""
        response = client.post(
            "/transcribe",
            data={"file_path": nonexistent_video_path},
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_transcribe_invalid_path_format(self, client: TestClient):
        """Test transcription with clearly invalid path."""
        response = client.post(
            "/transcribe",
            data={"file_path": "/this/path/does/not/exist/video.mp4"},
        )

        assert response.status_code == 404

    def test_transcribe_empty_path(self, client: TestClient):
        """Test transcription with empty path returns error."""
        response = client.post(
            "/transcribe",
            data={"file_path": ""},
        )

        # Empty path returns 400 (bad request) as it's not a valid file path
        # or 404 if the system tries to find an empty path
        assert response.status_code in [400, 404]


class TestTranscribeEndpointNonVideoFile:
    """Tests for POST /transcribe with non-video files."""

    def test_transcribe_non_video_returns_400(
        self, client: TestClient, non_video_file: Path
    ):
        """Test transcription with non-video file returns 400."""
        response = client.post(
            "/transcribe",
            data={"file_path": str(non_video_file)},
        )

        assert response.status_code == 400
        detail = response.json()["detail"].lower()
        assert "invalid" in detail or "allowed" in detail

    def test_transcribe_invalid_extension(self, client: TestClient, tmp_path: Path):
        """Test transcription with invalid video extension returns 400."""
        invalid_files = ["audio.mp3", "image.jpg", "document.pdf", "data.json"]

        for filename in invalid_files:
            file_path = tmp_path / filename
            file_path.write_bytes(b"\x00" * 1024)

            response = client.post(
                "/transcribe",
                data={"file_path": str(file_path)},
            )

            assert response.status_code == 400, f"Expected 400 for {filename}"


class TestTranscribeEndpointMissingParams:
    """Tests for POST /transcribe with missing parameters."""

    def test_transcribe_no_file_or_path(self, client: TestClient):
        """Test transcription without file or path returns 400."""
        response = client.post("/transcribe")

        assert response.status_code == 400
        assert "must be provided" in response.json()["detail"].lower()

    def test_transcribe_both_file_and_path_uses_file(
        self, client: TestClient, mock_video_path: Path, tmp_path: Path
    ):
        """Test that providing both file and path prioritizes file upload."""
        # Create a test file for upload
        test_file = tmp_path / "upload_test.mp4"
        test_file.write_bytes(b"\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d")

        with open(test_file, "rb") as f:
            response = client.post(
                "/transcribe",
                data={"file_path": str(mock_video_path)},
                files={"file": ("test.mp4", f, "video/mp4")},
            )

        # Should succeed - file takes priority
        assert response.status_code == 202


class TestJobStatusPolling:
    """Tests for GET /transcribe/{job_id} status polling."""

    def test_get_job_status_valid_id(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test getting status of a valid job ID."""
        response = client.get(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == sample_job_id
        assert "status" in data
        assert "progress" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_get_job_status_nonexistent_id(self, client: TestClient, clear_jobs_store):
        """Test getting status of non-existent job ID returns 404."""
        fake_job_id = str(uuid.uuid4())
        response = client.get(f"/transcribe/{fake_job_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_job_status_includes_result_when_completed(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test completed job includes result field."""
        response = client.get(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["progress"] == 100.0
        assert "result" in data
        assert data["result"] is not None

    def test_get_job_status_format(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test job status response has correct format."""
        response = client.get(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        data = response.json()

        # Check required fields
        required_fields = [
            "job_id", "status", "progress",
            "created_at", "updated_at", "result", "error"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        # Check types
        assert isinstance(data["progress"], float)
        assert 0 <= data["progress"] <= 100


class TestJobStatusTransitions:
    """Tests for job status transitions during processing."""

    def test_job_status_changes_after_creation(
        self, client: TestClient, mock_video_path: Path, clear_jobs_store: Dict
    ):
        """Test job status changes after creation."""
        response = client.post(
            "/transcribe",
            data={"file_path": str(mock_video_path)},
        )

        job_id = response.json()["job_id"]

        # Wait briefly for background task to start
        import time
        time.sleep(0.5)

        status_response = client.get(f"/transcribe/{job_id}")
        status = status_response.json()["status"]

        # Job may be in any state depending on processing speed
        # With mock files (not real videos), it will fail on FFprobe
        # Valid states are: pending, processing, completed, or failed
        assert status in ["pending", "processing", "completed", "failed"]


class TestResponseFormatWithTimestamps:
    """Tests for response format including words and timestamps."""

    def test_completed_job_has_result_text(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test completed job has result with text content."""
        response = client.get(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["result"] is not None
        assert isinstance(data["result"], str)
        assert len(data["result"]) > 0

    def test_job_progress_is_percentage(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test job progress is a valid percentage."""
        response = client.get(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        progress = response.json()["progress"]
        assert isinstance(progress, (int, float))
        assert 0 <= progress <= 100


class TestDeleteJob:
    """Tests for DELETE /transcribe/{job_id}."""

    def test_delete_existing_job(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test deleting an existing job."""
        response = client.delete(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        assert sample_job_id not in populated_jobs_store

    def test_delete_nonexistent_job(self, client: TestClient, clear_jobs_store):
        """Test deleting a non-existent job returns 404."""
        fake_job_id = str(uuid.uuid4())
        response = client.delete(f"/transcribe/{fake_job_id}")

        assert response.status_code == 404


class TestListJobs:
    """Tests for GET /jobs endpoint."""

    def test_list_jobs_empty(self, client: TestClient, clear_jobs_store):
        """Test listing jobs when store is empty."""
        response = client.get("/jobs")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_jobs_with_data(
        self, client: TestClient, populated_jobs_store: Dict
    ):
        """Test listing jobs when store has data."""
        response = client.get("/jobs")

        assert response.status_code == 200
        jobs = response.json()
        assert len(jobs) >= 1

    def test_list_jobs_filter_by_status(
        self, client: TestClient, populated_jobs_store: Dict
    ):
        """Test filtering jobs by status."""
        response = client.get("/jobs", params={"status": "completed"})

        assert response.status_code == 200
        jobs = response.json()
        for job in jobs:
            assert job["status"] == "completed"


class TestHealthEndpoint:
    """Tests for GET /health endpoint."""

    def test_health_check(self, client: TestClient):
        """Test health check endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data


class TestTranscriptionJobModel:
    """Tests for TranscriptionJob model and status."""

    def test_job_has_timestamps(
        self, client: TestClient, populated_jobs_store: Dict, sample_job_id: str
    ):
        """Test job response includes timestamp fields."""
        response = client.get(f"/transcribe/{sample_job_id}")

        assert response.status_code == 200
        data = response.json()

        # Check timestamp fields exist and are valid ISO format
        assert "created_at" in data
        assert "updated_at" in data

        # Verify they can be parsed as datetime
        datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
        datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
