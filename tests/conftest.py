"""
Test Fixtures for AI Clips Backend

Provides shared fixtures for testing:
- FastAPI TestClient
- Mock video file fixtures
- Mock FFmpeg/Whisper services
- WebSocket test utilities

Prerequisites:
    pip install pytest pytest-asyncio httpx
    # Or: pip install -r tests/requirements-test.txt
"""

import asyncio
import json
import os
import sys
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Dict, Generator, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Check for required test dependencies
try:
    import httpx
except ImportError:
    raise ImportError(
        "httpx is required for testing. Install with: pip install httpx\n"
        "Or install all test dependencies: pip install -r tests/requirements-test.txt"
    )

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Add backend to path for imports
BACKEND_PATH = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(BACKEND_PATH))
sys.path.insert(0, str(BACKEND_PATH / "services"))


# =============================================================================
# Mock Heavy Dependencies (torch, whisper) for lightweight testing
# =============================================================================

# Mock torch if not installed (required by whisper_service)
try:
    import torch
except ImportError:
    # Create a minimal mock for torch
    torch_mock = MagicMock()
    torch_mock.cuda.is_available.return_value = False
    torch_mock.backends.mps.is_available.return_value = False
    torch_mock.float32 = "float32"
    torch_mock.float16 = "float16"
    sys.modules["torch"] = torch_mock

# Mock whisper if not installed
try:
    import whisper
except ImportError:
    whisper_mock = MagicMock()
    sys.modules["whisper"] = whisper_mock


# =============================================================================
# Application Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def app() -> FastAPI:
    """Create a fresh FastAPI application for testing."""
    from main import app as main_app
    return main_app


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    """Create a TestClient for the FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def async_client(app: FastAPI):
    """Create an async test client for async testing."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# =============================================================================
# Mock Video File Fixtures
# =============================================================================


@pytest.fixture
def mock_video_path(tmp_path: Path) -> Path:
    """Create a mock video file path for testing."""
    video_file = tmp_path / "test_video.mp4"
    # Create a minimal file (not a real video, for path testing)
    video_file.write_bytes(b"\x00" * 1024)  # 1KB dummy file
    return video_file


@pytest.fixture
def mock_video_directory(tmp_path: Path) -> Path:
    """Create a directory with multiple mock video files."""
    videos_dir = tmp_path / "videos"
    videos_dir.mkdir(exist_ok=True)

    # Create several mock video files
    for name in ["video1.mp4", "video2.mov", "video3.mkv", "document.txt"]:
        file_path = videos_dir / name
        file_path.write_bytes(b"\x00" * 1024)

    return videos_dir


@pytest.fixture
def valid_video_extensions() -> set:
    """Return valid video file extensions."""
    return {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


@pytest.fixture
def nonexistent_video_path() -> str:
    """Return a path to a non-existent video file."""
    return "/nonexistent/path/to/video.mp4"


@pytest.fixture
def non_video_file(tmp_path: Path) -> Path:
    """Create a non-video file for testing invalid file handling."""
    txt_file = tmp_path / "document.txt"
    txt_file.write_text("This is not a video file")
    return txt_file


# =============================================================================
# Mock Service Fixtures
# =============================================================================


@pytest.fixture
def mock_ffmpeg_service():
    """Create a mock FFmpegService for unit testing."""
    from ffmpeg_service import VideoInfo, ExtractionProgress

    mock_service = MagicMock()
    mock_service.is_available.return_value = True
    mock_service.get_version.return_value = "5.1.2"
    mock_service.validate_video_file.return_value = True

    # Mock video info
    mock_video_info = VideoInfo(
        duration=120.5,
        duration_formatted="00:02:00",
        width=1920,
        height=1080,
        video_codec="h264",
        audio_codec="aac",
        frame_rate=30.0,
        bitrate=5000,
        file_size=10485760,  # 10MB
        has_audio=True,
        audio_sample_rate=44100,
        audio_channels=2,
        format_name="mp4",
    )
    mock_service.get_video_info = AsyncMock(return_value=mock_video_info)

    # Mock audio extraction
    async def mock_extract(video_path, output_path=None, **kwargs):
        output = output_path or Path("/tmp/output.wav")
        if kwargs.get("progress_callback"):
            # Simulate progress
            for i in range(0, 101, 25):
                kwargs["progress_callback"](ExtractionProgress(
                    percent=float(i),
                    time_processed=i * 1.2,
                    speed=1.5,
                    eta_seconds=max(0, (100 - i) * 0.8),
                    current_size=i * 1024,
                ))
        return output

    mock_service.extract_audio = AsyncMock(side_effect=mock_extract)

    return mock_service


@pytest.fixture
def mock_whisper_service():
    """Create a mock WhisperService for unit testing."""
    from whisper_service import TranscriptionResult, SegmentInfo, WordInfo

    mock_service = MagicMock()
    mock_service.device = "cpu"
    mock_service.model_size = "base"
    mock_service.get_device_info.return_value = {
        "device": "cpu",
        "platform": "Darwin",
        "model_loaded": True,
        "current_model": "base",
    }

    # Mock transcription result
    mock_result = TranscriptionResult(
        text="Hello, this is a test transcription.",
        segments=[
            SegmentInfo(
                id=0,
                start=0.0,
                end=2.5,
                text="Hello, this is",
                words=[
                    WordInfo(word="Hello,", start=0.0, end=0.5, probability=0.95),
                    WordInfo(word="this", start=0.6, end=0.9, probability=0.98),
                    WordInfo(word="is", start=1.0, end=1.2, probability=0.99),
                ],
            ),
            SegmentInfo(
                id=1,
                start=2.5,
                end=5.0,
                text="a test transcription.",
                words=[
                    WordInfo(word="a", start=2.5, end=2.7, probability=0.97),
                    WordInfo(word="test", start=2.8, end=3.2, probability=0.96),
                    WordInfo(word="transcription.", start=3.3, end=5.0, probability=0.94),
                ],
            ),
        ],
        language="en",
        duration=5.0,
        model_name="base",
    )

    mock_service.transcribe_with_word_timestamps = MagicMock(return_value=mock_result)
    mock_service.transcribe_audio = MagicMock(return_value=mock_result)

    return mock_service


@pytest.fixture
def mock_connection_manager():
    """Create a mock ConnectionManager for WebSocket testing."""
    mock_manager = MagicMock()
    mock_manager.total_connections = 0
    mock_manager.MAX_CONNECTIONS = 100

    mock_manager.connect_to_job = AsyncMock(return_value=True)
    mock_manager.connect_admin = AsyncMock(return_value=True)
    mock_manager.disconnect = AsyncMock()
    mock_manager.broadcast_to_job = AsyncMock()
    mock_manager.broadcast_to_all = AsyncMock()
    mock_manager.send_personal_message = AsyncMock(return_value=True)
    mock_manager.get_job_subscribers.return_value = 1
    mock_manager.get_connection_info.return_value = {
        "total_connections": 0,
        "job_connections": {},
        "admin_connections": 0,
        "max_connections": 100,
    }

    return mock_manager


# =============================================================================
# Job Store Fixtures
# =============================================================================


@pytest.fixture
def sample_job_id() -> str:
    """Generate a sample job ID."""
    return str(uuid.uuid4())


@pytest.fixture
def clear_jobs_store():
    """Clear the jobs store before and after test."""
    from main import jobs_store

    jobs_store.clear()
    yield jobs_store
    jobs_store.clear()


@pytest.fixture
def populated_jobs_store(clear_jobs_store, sample_job_id):
    """Create a jobs store with sample data."""
    from main import TranscriptionJob, JobStatus

    job = TranscriptionJob(
        job_id=sample_job_id,
        status=JobStatus.COMPLETED,
        file_path="/test/video.mp4",
        file_name="video.mp4",
        result="Sample transcription result",
        progress=100.0,
    )
    clear_jobs_store[sample_job_id] = job

    return clear_jobs_store


# =============================================================================
# WebSocket Test Utilities
# =============================================================================


class MockWebSocket:
    """Mock WebSocket for testing WebSocket handlers."""

    def __init__(self):
        self.sent_messages: list = []
        self.received_messages: list = []
        self.closed = False
        self.close_code: Optional[int] = None
        self.close_reason: Optional[str] = None
        self._accepted = False

    async def accept(self):
        """Accept the WebSocket connection."""
        self._accepted = True

    async def send_text(self, data: str):
        """Send text message."""
        self.sent_messages.append(json.loads(data) if data.startswith("{") else data)

    async def send_json(self, data: Dict):
        """Send JSON message."""
        self.sent_messages.append(data)

    async def receive_text(self) -> str:
        """Receive text message."""
        if self.received_messages:
            return json.dumps(self.received_messages.pop(0))
        # Simulate disconnect after no more messages
        from fastapi import WebSocketDisconnect
        raise WebSocketDisconnect()

    async def close(self, code: int = 1000, reason: str = ""):
        """Close the WebSocket."""
        self.closed = True
        self.close_code = code
        self.close_reason = reason

    def add_message(self, message: Dict):
        """Add a message to be received."""
        self.received_messages.append(message)


@pytest.fixture
def mock_websocket() -> MockWebSocket:
    """Create a mock WebSocket for testing."""
    return MockWebSocket()


# =============================================================================
# Progress Tracking Fixtures
# =============================================================================


@pytest.fixture
def sample_progress_stages() -> list:
    """Return sample progress stage data."""
    return [
        {"stage": "extracting", "progress": 0.0, "message": "Starting..."},
        {"stage": "extracting", "progress": 25.0, "message": "Extracting audio..."},
        {"stage": "transcribing", "progress": 50.0, "message": "Transcribing..."},
        {"stage": "transcribing", "progress": 75.0, "message": "Processing..."},
        {"stage": "completed", "progress": 100.0, "message": "Complete"},
    ]


# =============================================================================
# Cleanup Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def cleanup_temp_files(tmp_path):
    """Automatically clean up temporary files after tests."""
    yield
    # Cleanup is handled by pytest's tmp_path fixture


@pytest.fixture
def uploads_dir(tmp_path: Path) -> Path:
    """Create a temporary uploads directory."""
    uploads = tmp_path / "uploads"
    uploads.mkdir(exist_ok=True)
    return uploads


# =============================================================================
# Response Validation Helpers
# =============================================================================


def validate_job_response(response_data: Dict, expected_status: str = None) -> bool:
    """Validate a job status response has required fields."""
    required_fields = ["job_id", "status", "progress", "created_at", "updated_at"]
    for field in required_fields:
        if field not in response_data:
            return False

    if expected_status and response_data["status"] != expected_status:
        return False

    return True


def validate_transcription_response(response_data: Dict) -> bool:
    """Validate a transcription response has required fields."""
    required_fields = ["job_id", "status", "message"]
    return all(field in response_data for field in required_fields)


def validate_websocket_progress(message: Dict) -> bool:
    """Validate a WebSocket progress message."""
    required_fields = ["type", "job_id", "stage", "progress", "message", "timestamp"]
    return all(field in message for field in required_fields)


# Export helpers for use in tests
__all__ = [
    "validate_job_response",
    "validate_transcription_response",
    "validate_websocket_progress",
    "MockWebSocket",
]
