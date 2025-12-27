"""
Tests for the /render endpoint and WebSocket progress streaming.

This module provides comprehensive tests for:
- POST /render endpoint (job creation)
- GET /render/{job_id} (status retrieval)
- GET /render (job listing)
- DELETE /render/{job_id} (job deletion)
- WebSocket /ws/render/{job_id} (progress streaming)
"""

import asyncio
import json
import pytest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket

# Import the main app and models
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import (
    app,
    RenderJob,
    RenderJobStatus,
    RenderEndpointRequest,
    RenderEndpointResponse,
    RenderJobStatusResponse,
    render_jobs_store,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_project_id():
    """Generate a sample project ID."""
    return str(uuid4())


@pytest.fixture
def sample_moment_id():
    """Generate a sample moment ID."""
    return f"m-{uuid4()}"


@pytest.fixture
def sample_render_request(sample_project_id, sample_moment_id):
    """Create a sample render request."""
    return {
        "project_id": sample_project_id,
        "moment_id": sample_moment_id,
    }


@pytest.fixture
def sample_render_request_with_config(sample_project_id, sample_moment_id):
    """Create a sample render request with subtitle and audio config."""
    return {
        "project_id": sample_project_id,
        "moment_id": sample_moment_id,
        "subtitle_config": {
            "enabled": True,
            "font_name": "Arial",
            "font_size": 48,
            "primary_color": "#FFFF00",
        },
        "audio_config": {
            "mode": "original",
        },
        "output_filename": "test_output.mp4",
    }


@pytest.fixture
def sample_render_job(sample_project_id, sample_moment_id):
    """Create a sample render job."""
    return RenderJob(
        job_id=str(uuid4()),
        project_id=sample_project_id,
        moment_id=sample_moment_id,
        status=RenderJobStatus.PENDING,
    )


@pytest.fixture(autouse=True)
def clear_jobs_store():
    """Clear the render jobs store before each test."""
    render_jobs_store.clear()
    yield
    render_jobs_store.clear()


# =============================================================================
# POST /render Tests
# =============================================================================


class TestCreateRenderJob:
    """Tests for POST /render endpoint."""

    def test_create_render_job_success(self, client, sample_render_request):
        """Test successful render job creation."""
        response = client.post("/render", json=sample_render_request)

        assert response.status_code == 202
        data = response.json()

        assert "job_id" in data
        assert data["status"] == "pending"
        assert data["message"] == "Render job created successfully"
        assert "websocket_url" in data
        assert data["websocket_url"].startswith("/ws/render/")

    def test_create_render_job_with_config(self, client, sample_render_request_with_config):
        """Test render job creation with subtitle and audio config."""
        response = client.post("/render", json=sample_render_request_with_config)

        assert response.status_code == 202
        data = response.json()

        assert "job_id" in data
        assert data["status"] == "pending"

        # Verify job was stored
        job_id = data["job_id"]
        assert job_id in render_jobs_store

    def test_create_render_job_stores_in_memory(self, client, sample_render_request):
        """Test that render job is stored in memory."""
        response = client.post("/render", json=sample_render_request)
        data = response.json()

        job_id = data["job_id"]
        assert job_id in render_jobs_store

        job = render_jobs_store[job_id]
        assert job.project_id == sample_render_request["project_id"]
        assert job.moment_id == sample_render_request["moment_id"]
        # Job may be PENDING or FAILED (if background task already ran)
        # The important thing is that the job was stored
        assert job.status in [RenderJobStatus.PENDING, RenderJobStatus.PROCESSING, RenderJobStatus.FAILED]

    def test_create_render_job_missing_project_id(self, client, sample_moment_id):
        """Test error when project_id is missing."""
        response = client.post("/render", json={"moment_id": sample_moment_id})

        assert response.status_code == 422  # Validation error

    def test_create_render_job_missing_moment_id(self, client, sample_project_id):
        """Test error when moment_id is missing."""
        response = client.post("/render", json={"project_id": sample_project_id})

        assert response.status_code == 422  # Validation error


# =============================================================================
# GET /render/{job_id} Tests
# =============================================================================


class TestGetRenderJobStatus:
    """Tests for GET /render/{job_id} endpoint."""

    def test_get_render_job_status_success(self, client, sample_render_job):
        """Test successful job status retrieval."""
        # Store the job
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        response = client.get(f"/render/{sample_render_job.job_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["job_id"] == sample_render_job.job_id
        assert data["project_id"] == sample_render_job.project_id
        assert data["moment_id"] == sample_render_job.moment_id
        assert data["status"] == "pending"
        assert data["progress"] == 0.0

    def test_get_render_job_status_not_found(self, client):
        """Test error when job is not found."""
        response = client.get(f"/render/{uuid4()}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_render_job_status_completed(self, client, sample_render_job):
        """Test status retrieval for completed job."""
        sample_render_job.status = RenderJobStatus.COMPLETED
        sample_render_job.progress = 100.0
        sample_render_job.output_path = "/output/test.mp4"
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        response = client.get(f"/render/{sample_render_job.job_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "completed"
        assert data["progress"] == 100.0
        assert data["output_path"] == "/output/test.mp4"

    def test_get_render_job_status_failed(self, client, sample_render_job):
        """Test status retrieval for failed job."""
        sample_render_job.status = RenderJobStatus.FAILED
        sample_render_job.error = "Test error message"
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        response = client.get(f"/render/{sample_render_job.job_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "failed"
        assert data["error"] == "Test error message"


# =============================================================================
# GET /render Tests
# =============================================================================


class TestListRenderJobs:
    """Tests for GET /render endpoint."""

    def test_list_render_jobs_empty(self, client):
        """Test listing when no jobs exist."""
        response = client.get("/render")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_render_jobs_with_jobs(self, client, sample_project_id, sample_moment_id):
        """Test listing multiple jobs."""
        # Create multiple jobs
        for i in range(3):
            job = RenderJob(
                job_id=str(uuid4()),
                project_id=sample_project_id,
                moment_id=f"m-{i}",
            )
            render_jobs_store[job.job_id] = job

        response = client.get("/render")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_render_jobs_with_status_filter(self, client, sample_project_id, sample_moment_id):
        """Test listing jobs with status filter."""
        # Create jobs with different statuses
        pending_job = RenderJob(
            job_id=str(uuid4()),
            project_id=sample_project_id,
            moment_id=f"m-1",
            status=RenderJobStatus.PENDING,
        )
        completed_job = RenderJob(
            job_id=str(uuid4()),
            project_id=sample_project_id,
            moment_id=f"m-2",
            status=RenderJobStatus.COMPLETED,
        )
        render_jobs_store[pending_job.job_id] = pending_job
        render_jobs_store[completed_job.job_id] = completed_job

        # Filter by pending
        response = client.get("/render?status=pending")
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "pending"

        # Filter by completed
        response = client.get("/render?status=completed")
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "completed"

    def test_list_render_jobs_with_limit(self, client, sample_project_id, sample_moment_id):
        """Test listing jobs with limit."""
        # Create 10 jobs
        for i in range(10):
            job = RenderJob(
                job_id=str(uuid4()),
                project_id=sample_project_id,
                moment_id=f"m-{i}",
            )
            render_jobs_store[job.job_id] = job

        response = client.get("/render?limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5


# =============================================================================
# DELETE /render/{job_id} Tests
# =============================================================================


class TestDeleteRenderJob:
    """Tests for DELETE /render/{job_id} endpoint."""

    def test_delete_render_job_success(self, client, sample_render_job):
        """Test successful job deletion."""
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        response = client.delete(f"/render/{sample_render_job.job_id}")

        assert response.status_code == 200
        assert sample_render_job.job_id not in render_jobs_store

    def test_delete_render_job_not_found(self, client):
        """Test error when job is not found."""
        response = client.delete(f"/render/{uuid4()}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


# =============================================================================
# WebSocket Tests
# =============================================================================


class TestWebSocketRenderProgress:
    """Tests for WebSocket /ws/render/{job_id} endpoint."""

    def test_websocket_connect_success(self, client, sample_render_job):
        """Test successful WebSocket connection."""
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        with client.websocket_connect(f"/ws/render/{sample_render_job.job_id}") as websocket:
            # Should receive initial status
            data = websocket.receive_json()

            assert data["type"] == "initial_render_status"
            assert data["job_id"] == sample_render_job.job_id
            assert data["status"] == "pending"

    def test_websocket_connect_waiting_for_job(self, client):
        """Test WebSocket connection when job doesn't exist yet."""
        job_id = str(uuid4())

        with client.websocket_connect(f"/ws/render/{job_id}") as websocket:
            data = websocket.receive_json()

            assert data["type"] == "waiting"
            assert data["job_id"] == job_id

    def test_websocket_receives_initial_status_with_progress(self, client, sample_render_job):
        """Test WebSocket receives initial status with progress info."""
        sample_render_job.status = RenderJobStatus.PROCESSING
        sample_render_job.progress = 50.0
        sample_render_job.current_phase = "extracting"
        sample_render_job.message = "Extracting moment..."
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        with client.websocket_connect(f"/ws/render/{sample_render_job.job_id}") as websocket:
            data = websocket.receive_json()

            assert data["type"] == "initial_render_status"
            assert data["progress"] == 50.0
            assert data["current_phase"] == "extracting"
            assert data["message"] == "Extracting moment..."

    def test_websocket_ping_pong(self, client, sample_render_job):
        """Test WebSocket ping/pong mechanism."""
        render_jobs_store[sample_render_job.job_id] = sample_render_job

        with client.websocket_connect(f"/ws/render/{sample_render_job.job_id}") as websocket:
            # Receive initial status
            websocket.receive_json()

            # Send ping
            websocket.send_json({"type": "ping"})

            # Should receive pong
            data = websocket.receive_json()
            assert data["type"] == "pong"


# =============================================================================
# Integration Tests
# =============================================================================


class TestRenderEndpointIntegration:
    """Integration tests for the render endpoint flow."""

    def test_full_render_job_lifecycle(self, client, sample_render_request):
        """Test complete job lifecycle: create -> status -> delete."""
        # Create job
        create_response = client.post("/render", json=sample_render_request)
        assert create_response.status_code == 202
        job_id = create_response.json()["job_id"]

        # Check status
        status_response = client.get(f"/render/{job_id}")
        assert status_response.status_code == 200
        assert status_response.json()["job_id"] == job_id

        # List jobs
        list_response = client.get("/render")
        assert len(list_response.json()) == 1

        # Delete job
        delete_response = client.delete(f"/render/{job_id}")
        assert delete_response.status_code == 200

        # Verify deleted
        status_response = client.get(f"/render/{job_id}")
        assert status_response.status_code == 404

    def test_multiple_concurrent_jobs(self, client, sample_project_id):
        """Test handling multiple concurrent render jobs."""
        job_ids = []

        # Create 5 jobs
        for i in range(5):
            request = {
                "project_id": sample_project_id,
                "moment_id": f"m-{i}",
            }
            response = client.post("/render", json=request)
            assert response.status_code == 202
            job_ids.append(response.json()["job_id"])

        # Verify all jobs exist
        list_response = client.get("/render")
        assert len(list_response.json()) == 5

        # Check each job status
        for job_id in job_ids:
            response = client.get(f"/render/{job_id}")
            assert response.status_code == 200


# =============================================================================
# Model Validation Tests
# =============================================================================


class TestRenderRequestValidation:
    """Tests for RenderEndpointRequest validation."""

    def test_valid_request(self):
        """Test valid request passes validation."""
        request = RenderEndpointRequest(
            project_id=str(uuid4()),
            moment_id=f"m-{uuid4()}",
        )
        assert request.project_id is not None
        assert request.moment_id is not None

    def test_request_with_subtitle_config(self):
        """Test request with subtitle config."""
        request = RenderEndpointRequest(
            project_id=str(uuid4()),
            moment_id=f"m-{uuid4()}",
            subtitle_config={
                "enabled": True,
                "font_size": 48,
            },
        )
        assert request.subtitle_config["enabled"] is True
        assert request.subtitle_config["font_size"] == 48

    def test_request_with_audio_config(self):
        """Test request with audio config."""
        request = RenderEndpointRequest(
            project_id=str(uuid4()),
            moment_id=f"m-{uuid4()}",
            audio_config={
                "mode": "original",
            },
        )
        assert request.audio_config["mode"] == "original"


class TestRenderJobModel:
    """Tests for RenderJob model."""

    def test_render_job_defaults(self):
        """Test RenderJob default values."""
        job = RenderJob(
            job_id=str(uuid4()),
            project_id=str(uuid4()),
            moment_id=f"m-{uuid4()}",
        )

        assert job.status == RenderJobStatus.PENDING
        assert job.progress == 0.0
        assert job.current_phase == "pending"
        assert job.output_path is None
        assert job.error is None

    def test_render_job_status_transitions(self):
        """Test RenderJob status can be updated."""
        job = RenderJob(
            job_id=str(uuid4()),
            project_id=str(uuid4()),
            moment_id=f"m-{uuid4()}",
        )

        job.status = RenderJobStatus.PROCESSING
        assert job.status == RenderJobStatus.PROCESSING

        job.status = RenderJobStatus.COMPLETED
        assert job.status == RenderJobStatus.COMPLETED


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
