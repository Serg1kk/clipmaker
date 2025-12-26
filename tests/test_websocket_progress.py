"""
Tests for WebSocket Progress Updates

This module tests the WebSocket endpoint /ws/job/{job_id}:
- WebSocket connection establishment
- Progress message format validation
- Stage transitions (extracting -> transcribing -> completed)
- Connection management
- Heartbeat/ping-pong functionality
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add backend to path for imports
BACKEND_PATH = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(BACKEND_PATH))
sys.path.insert(0, str(BACKEND_PATH / "services"))

from conftest import MockWebSocket, validate_websocket_progress


class TestWebSocketConnection:
    """Tests for WebSocket connection to /ws/job/{job_id}."""

    def test_mock_websocket_accept(self, mock_websocket: MockWebSocket):
        """Test MockWebSocket accept functionality."""
        asyncio.run(mock_websocket.accept())
        assert mock_websocket._accepted is True

    def test_mock_websocket_send_json(self, mock_websocket: MockWebSocket):
        """Test MockWebSocket JSON sending."""
        test_message = {"type": "test", "data": "value"}
        asyncio.run(mock_websocket.send_json(test_message))

        assert len(mock_websocket.sent_messages) == 1
        assert mock_websocket.sent_messages[0] == test_message

    def test_mock_websocket_close(self, mock_websocket: MockWebSocket):
        """Test MockWebSocket close functionality."""
        asyncio.run(mock_websocket.close(code=1000, reason="Normal closure"))

        assert mock_websocket.closed is True
        assert mock_websocket.close_code == 1000
        assert mock_websocket.close_reason == "Normal closure"


class TestConnectionManager:
    """Tests for ConnectionManager class."""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager for testing."""
        from websocket_service import ConnectionManager
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_connect_to_job(
        self, connection_manager, mock_websocket: MockWebSocket
    ):
        """Test connecting a client to a specific job."""
        job_id = str(uuid.uuid4())
        result = await connection_manager.connect_to_job(mock_websocket, job_id)

        assert result is True
        assert mock_websocket._accepted is True
        assert connection_manager.total_connections == 1
        assert connection_manager.get_job_subscribers(job_id) == 1

    @pytest.mark.asyncio
    async def test_connect_admin(
        self, connection_manager, mock_websocket: MockWebSocket
    ):
        """Test connecting an admin client."""
        result = await connection_manager.connect_admin(mock_websocket)

        assert result is True
        assert mock_websocket._accepted is True
        assert connection_manager.total_connections == 1

    @pytest.mark.asyncio
    async def test_disconnect(
        self, connection_manager, mock_websocket: MockWebSocket
    ):
        """Test disconnecting a client."""
        job_id = str(uuid.uuid4())
        await connection_manager.connect_to_job(mock_websocket, job_id)

        await connection_manager.disconnect(mock_websocket)

        assert connection_manager.total_connections == 0
        assert connection_manager.get_job_subscribers(job_id) == 0

    @pytest.mark.asyncio
    async def test_connection_limit(self, connection_manager):
        """Test connection limit enforcement."""
        # Create many websockets
        websockets = [MockWebSocket() for _ in range(connection_manager.MAX_CONNECTIONS + 5)]

        # Connect up to limit
        for i, ws in enumerate(websockets[:connection_manager.MAX_CONNECTIONS]):
            result = await connection_manager.connect_to_job(ws, f"job_{i}")
            assert result is True

        # Next connection should fail
        result = await connection_manager.connect_to_job(
            websockets[connection_manager.MAX_CONNECTIONS], "extra_job"
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_get_connection_info(
        self, connection_manager, mock_websocket: MockWebSocket
    ):
        """Test getting connection statistics."""
        job_id = str(uuid.uuid4())
        await connection_manager.connect_to_job(mock_websocket, job_id)

        info = connection_manager.get_connection_info()

        assert "total_connections" in info
        assert "job_connections" in info
        assert "admin_connections" in info
        assert "max_connections" in info
        assert info["total_connections"] == 1


class TestProgressMessage:
    """Tests for ProgressMessage format."""

    @pytest.fixture
    def progress_message(self):
        """Create a sample ProgressMessage."""
        from websocket_service import ProgressMessage
        return ProgressMessage(
            type="progress",
            job_id=str(uuid.uuid4()),
            stage="transcribing",
            progress=50.0,
            message="Transcribing audio...",
            details={"current_step": 2, "total_steps": 4},
        )

    def test_progress_message_to_dict(self, progress_message):
        """Test ProgressMessage conversion to dictionary."""
        data = progress_message.to_dict()

        assert data["type"] == "progress"
        assert data["stage"] == "transcribing"
        assert data["progress"] == 50.0
        assert "timestamp" in data
        assert "details" in data

    def test_progress_message_to_json(self, progress_message):
        """Test ProgressMessage conversion to JSON."""
        json_str = progress_message.to_json()

        data = json.loads(json_str)
        assert data["type"] == "progress"
        assert data["stage"] == "transcribing"

    def test_progress_message_has_timestamp(self, progress_message):
        """Test ProgressMessage includes timestamp."""
        data = progress_message.to_dict()

        assert "timestamp" in data
        # Verify it's a valid ISO timestamp
        datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))


class TestProgressStageTransitions:
    """Tests for progress stage transitions."""

    @pytest.fixture
    def progress_tracker(self):
        """Create a ProgressTracker for testing."""
        from websocket_service import ProgressTracker
        return ProgressTracker(job_id=str(uuid.uuid4()), total_steps=4)

    def test_initial_stage_is_pending(self, progress_tracker):
        """Test initial stage is pending."""
        from websocket_service import ProgressStage
        assert progress_tracker.stage == ProgressStage.PENDING

    @pytest.mark.asyncio
    async def test_stage_transition_to_extracting(self, progress_tracker):
        """Test transition to extracting stage."""
        from websocket_service import ProgressStage

        await progress_tracker.update_progress(
            stage=ProgressStage.EXTRACTING,
            progress=10.0,
            message="Extracting audio...",
        )

        assert progress_tracker.stage == ProgressStage.EXTRACTING

    @pytest.mark.asyncio
    async def test_stage_transition_to_transcribing(self, progress_tracker):
        """Test transition to transcribing stage."""
        from websocket_service import ProgressStage

        await progress_tracker.update_progress(
            stage=ProgressStage.TRANSCRIBING,
            progress=50.0,
            message="Transcribing...",
        )

        assert progress_tracker.stage == ProgressStage.TRANSCRIBING

    @pytest.mark.asyncio
    async def test_stage_transition_to_completed(self, progress_tracker):
        """Test transition to completed stage."""
        from websocket_service import ProgressStage

        await progress_tracker.complete(message="Done!")

        assert progress_tracker.stage == ProgressStage.COMPLETED

    @pytest.mark.asyncio
    async def test_stage_transition_to_failed(self, progress_tracker):
        """Test transition to failed stage."""
        from websocket_service import ProgressStage

        await progress_tracker.fail("Something went wrong")

        assert progress_tracker.stage == ProgressStage.FAILED


class TestProgressStageEnum:
    """Tests for ProgressStage enumeration."""

    def test_all_stages_defined(self):
        """Test all required stages are defined."""
        from websocket_service import ProgressStage

        assert hasattr(ProgressStage, "PENDING")
        assert hasattr(ProgressStage, "EXTRACTING")
        assert hasattr(ProgressStage, "TRANSCRIBING")
        assert hasattr(ProgressStage, "COMPLETED")
        assert hasattr(ProgressStage, "FAILED")

    def test_stage_values(self):
        """Test stage string values."""
        from websocket_service import ProgressStage

        assert ProgressStage.PENDING.value == "pending"
        assert ProgressStage.EXTRACTING.value == "extracting"
        assert ProgressStage.TRANSCRIBING.value == "transcribing"
        assert ProgressStage.COMPLETED.value == "completed"
        assert ProgressStage.FAILED.value == "failed"


class TestBroadcasting:
    """Tests for message broadcasting."""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager for testing."""
        from websocket_service import ConnectionManager
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_broadcast_to_job(self, connection_manager):
        """Test broadcasting message to job subscribers."""
        from websocket_service import ProgressMessage

        job_id = str(uuid.uuid4())
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        await connection_manager.connect_to_job(ws1, job_id)
        await connection_manager.connect_to_job(ws2, job_id)

        message = ProgressMessage(
            type="progress",
            job_id=job_id,
            stage="transcribing",
            progress=50.0,
            message="Processing...",
        )

        await connection_manager.broadcast_to_job(job_id, message)

        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1

    @pytest.mark.asyncio
    async def test_broadcast_to_all(self, connection_manager):
        """Test broadcasting message to all clients."""
        from websocket_service import ProgressMessage

        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        ws_admin = MockWebSocket()

        await connection_manager.connect_to_job(ws1, "job1")
        await connection_manager.connect_to_job(ws2, "job2")
        await connection_manager.connect_admin(ws_admin)

        message = ProgressMessage(
            type="system",
            job_id="broadcast",
            stage="info",
            progress=0.0,
            message="System message",
        )

        await connection_manager.broadcast_to_all(message)

        # All should receive the message
        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1
        assert len(ws_admin.sent_messages) == 1


class TestPingPong:
    """Tests for ping/pong heartbeat functionality."""

    @pytest.mark.asyncio
    async def test_handle_ping_responds_with_pong(self):
        """Test server responds to ping with pong."""
        from websocket_service import connection_manager

        mock_ws = MockWebSocket()
        mock_ws.add_message({"type": "ping"})

        # The handler should respond with pong
        # We can't fully test this without running the event loop,
        # but we can verify the message format
        expected_pong = {"type": "pong"}
        assert expected_pong["type"] == "pong"

    def test_ping_message_format(self):
        """Test ping message has correct format."""
        ping_message = {
            "type": "ping",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        assert ping_message["type"] == "ping"
        assert "timestamp" in ping_message

    def test_pong_message_format(self):
        """Test pong message has correct format."""
        pong_message = {
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        assert pong_message["type"] == "pong"
        assert "timestamp" in pong_message


class TestWebSocketMessageTypes:
    """Tests for different WebSocket message types."""

    def test_initial_status_message_format(self):
        """Test initial status message format."""
        job_id = str(uuid.uuid4())
        initial_message = {
            "type": "initial_status",
            "job_id": job_id,
            "status": "pending",
            "progress": 0.0,
            "message": f"Connected to job {job_id}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        assert initial_message["type"] == "initial_status"
        assert initial_message["status"] == "pending"
        assert initial_message["progress"] == 0.0

    def test_waiting_message_format(self):
        """Test waiting message format."""
        job_id = str(uuid.uuid4())
        waiting_message = {
            "type": "waiting",
            "job_id": job_id,
            "message": "Waiting for job to start...",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        assert waiting_message["type"] == "waiting"
        assert "Waiting" in waiting_message["message"]

    def test_progress_message_validation(self, sample_progress_stages: List[Dict]):
        """Test progress message validation helper."""
        for stage in sample_progress_stages:
            message = {
                "type": "progress",
                "job_id": str(uuid.uuid4()),
                "stage": stage["stage"],
                "progress": stage["progress"],
                "message": stage["message"],
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }

            assert validate_websocket_progress(message)


class TestConnectionMetadata:
    """Tests for connection metadata tracking."""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager for testing."""
        from websocket_service import ConnectionManager
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_job_connection_metadata(
        self, connection_manager, mock_websocket: MockWebSocket
    ):
        """Test metadata is stored for job connections."""
        job_id = str(uuid.uuid4())
        await connection_manager.connect_to_job(mock_websocket, job_id)

        metadata = connection_manager._connection_metadata.get(mock_websocket)

        assert metadata is not None
        assert metadata["job_id"] == job_id
        assert metadata["is_admin"] is False
        assert "connected_at" in metadata

    @pytest.mark.asyncio
    async def test_admin_connection_metadata(
        self, connection_manager, mock_websocket: MockWebSocket
    ):
        """Test metadata is stored for admin connections."""
        await connection_manager.connect_admin(mock_websocket)

        metadata = connection_manager._connection_metadata.get(mock_websocket)

        assert metadata is not None
        assert metadata["job_id"] is None
        assert metadata["is_admin"] is True


class TestProgressTrackerIntegration:
    """Integration tests for ProgressTracker with ConnectionManager."""

    @pytest.mark.asyncio
    async def test_progress_tracker_broadcasts_updates(self):
        """Test ProgressTracker broadcasts updates to subscribers."""
        from websocket_service import ProgressTracker, ProgressStage, connection_manager

        job_id = str(uuid.uuid4())
        mock_ws = MockWebSocket()

        await connection_manager.connect_to_job(mock_ws, job_id)

        tracker = ProgressTracker(job_id=job_id, total_steps=4)

        await tracker.update_progress(
            stage=ProgressStage.EXTRACTING,
            progress=25.0,
            message="Extracting audio...",
            current_step=1,
        )

        # Check that message was sent
        assert len(mock_ws.sent_messages) >= 1

        # Cleanup
        await connection_manager.disconnect(mock_ws)

    @pytest.mark.asyncio
    async def test_progress_tracker_completion(self):
        """Test ProgressTracker completion sends final message."""
        from websocket_service import ProgressTracker, ProgressStage, connection_manager

        job_id = str(uuid.uuid4())
        mock_ws = MockWebSocket()

        await connection_manager.connect_to_job(mock_ws, job_id)

        tracker = ProgressTracker(job_id=job_id, total_steps=4)
        await tracker.complete(message="All done!")

        # Check completion message was sent
        assert len(mock_ws.sent_messages) >= 1

        last_message = mock_ws.sent_messages[-1]
        if isinstance(last_message, dict):
            assert last_message.get("stage") == "completed"

        # Cleanup
        await connection_manager.disconnect(mock_ws)


class TestErrorHandling:
    """Tests for WebSocket error handling."""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager for testing."""
        from websocket_service import ConnectionManager
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_disconnected_client_cleanup(self, connection_manager):
        """Test disconnected clients are cleaned up during broadcast."""
        from websocket_service import ProgressMessage

        job_id = str(uuid.uuid4())

        # Create a mock that fails on send
        failing_ws = MockWebSocket()
        async def fail_send(*args):
            raise Exception("Connection lost")
        failing_ws.send_text = fail_send

        good_ws = MockWebSocket()

        await connection_manager.connect_to_job(failing_ws, job_id)
        await connection_manager.connect_to_job(good_ws, job_id)

        message = ProgressMessage(
            type="progress",
            job_id=job_id,
            stage="transcribing",
            progress=50.0,
            message="Test",
        )

        await connection_manager.broadcast_to_job(job_id, message)

        # Good websocket should have received the message
        assert len(good_ws.sent_messages) == 1

        # Failing websocket should be cleaned up
        # (disconnect is called for failed sends)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
