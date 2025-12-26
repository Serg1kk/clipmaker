"""
WebSocket Service for Real-Time Progress Tracking

This module provides WebSocket-based real-time progress updates for transcription jobs.
Features:
- Connection manager for multiple clients
- Job-specific subscriptions
- Heartbeat/ping-pong for connection health
- Thread-safe connection management
- Auto-reconnect support
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Set
from dataclasses import dataclass, field
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect


# Configure logging
logger = logging.getLogger(__name__)


class ProgressStage(str, Enum):
    """Progress stage enumeration."""
    PENDING = "pending"
    EXTRACTING = "extracting"
    TRANSCRIBING = "transcribing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ProgressMessage:
    """Structure for progress update messages."""
    type: str
    job_id: str
    stage: str
    progress: float
    message: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    details: Optional[Dict] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "type": self.type,
            "job_id": self.job_id,
            "stage": self.stage,
            "progress": self.progress,
            "message": self.message,
            "timestamp": self.timestamp,
            "details": self.details or {},
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())


class ConnectionManager:
    """
    WebSocket Connection Manager for handling multiple client connections.

    Features:
    - Track connections per job ID
    - Track admin connections (subscribed to all jobs)
    - Thread-safe connection management
    - Heartbeat monitoring
    - Maximum connections limit
    """

    MAX_CONNECTIONS = 100
    HEARTBEAT_INTERVAL = 30  # seconds
    CONNECTION_TIMEOUT = 120  # seconds

    def __init__(self):
        # Job-specific connections: job_id -> set of websockets
        self._job_connections: Dict[str, Set[WebSocket]] = {}
        # Admin connections (subscribed to all jobs)
        self._admin_connections: Set[WebSocket] = set()
        # Connection metadata: websocket -> metadata dict
        self._connection_metadata: Dict[WebSocket, Dict] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        # Heartbeat tasks
        self._heartbeat_tasks: Dict[WebSocket, asyncio.Task] = {}

    @property
    def total_connections(self) -> int:
        """Get total number of active connections."""
        job_conns = sum(len(conns) for conns in self._job_connections.values())
        return job_conns + len(self._admin_connections)

    async def connect_to_job(self, websocket: WebSocket, job_id: str) -> bool:
        """
        Connect a client to receive updates for a specific job.

        Args:
            websocket: The WebSocket connection
            job_id: The job ID to subscribe to

        Returns:
            True if connection successful, False if limit reached
        """
        async with self._lock:
            if self.total_connections >= self.MAX_CONNECTIONS:
                logger.warning(f"Connection limit reached: {self.MAX_CONNECTIONS}")
                return False

            await websocket.accept()

            if job_id not in self._job_connections:
                self._job_connections[job_id] = set()

            self._job_connections[job_id].add(websocket)
            self._connection_metadata[websocket] = {
                "job_id": job_id,
                "connected_at": datetime.utcnow().isoformat(),
                "is_admin": False,
            }

            logger.info(f"Client connected to job {job_id}. Total connections: {self.total_connections}")

            # Start heartbeat for this connection
            self._start_heartbeat(websocket)

            return True

    async def connect_admin(self, websocket: WebSocket) -> bool:
        """
        Connect an admin client to receive updates for all jobs.

        Args:
            websocket: The WebSocket connection

        Returns:
            True if connection successful, False if limit reached
        """
        async with self._lock:
            if self.total_connections >= self.MAX_CONNECTIONS:
                logger.warning(f"Connection limit reached: {self.MAX_CONNECTIONS}")
                return False

            await websocket.accept()

            self._admin_connections.add(websocket)
            self._connection_metadata[websocket] = {
                "job_id": None,
                "connected_at": datetime.utcnow().isoformat(),
                "is_admin": True,
            }

            logger.info(f"Admin client connected. Total connections: {self.total_connections}")

            # Start heartbeat for this connection
            self._start_heartbeat(websocket)

            return True

    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Disconnect a client and clean up resources.

        Args:
            websocket: The WebSocket connection to disconnect
        """
        async with self._lock:
            # Stop heartbeat task
            self._stop_heartbeat(websocket)

            # Get metadata before cleanup
            metadata = self._connection_metadata.get(websocket, {})

            # Remove from job connections
            if metadata.get("job_id"):
                job_id = metadata["job_id"]
                if job_id in self._job_connections:
                    self._job_connections[job_id].discard(websocket)
                    if not self._job_connections[job_id]:
                        del self._job_connections[job_id]

            # Remove from admin connections
            self._admin_connections.discard(websocket)

            # Remove metadata
            self._connection_metadata.pop(websocket, None)

            logger.info(f"Client disconnected. Total connections: {self.total_connections}")

    async def broadcast_to_job(self, job_id: str, message: ProgressMessage) -> None:
        """
        Broadcast a message to all clients subscribed to a specific job.

        Args:
            job_id: The job ID to broadcast to
            message: The progress message to send
        """
        json_message = message.to_json()
        disconnected = []

        # Send to job-specific subscribers
        async with self._lock:
            connections = self._job_connections.get(job_id, set()).copy()

        for websocket in connections:
            try:
                await websocket.send_text(json_message)
            except Exception as e:
                logger.warning(f"Failed to send to job subscriber: {e}")
                disconnected.append(websocket)

        # Send to admin subscribers
        async with self._lock:
            admin_connections = self._admin_connections.copy()

        for websocket in admin_connections:
            try:
                await websocket.send_text(json_message)
            except Exception as e:
                logger.warning(f"Failed to send to admin subscriber: {e}")
                disconnected.append(websocket)

        # Clean up disconnected clients
        for websocket in disconnected:
            await self.disconnect(websocket)

    async def broadcast_to_all(self, message: ProgressMessage) -> None:
        """
        Broadcast a message to all connected clients.

        Args:
            message: The progress message to send
        """
        json_message = message.to_json()
        disconnected = []

        # Send to all job subscribers
        async with self._lock:
            all_job_connections = set()
            for connections in self._job_connections.values():
                all_job_connections.update(connections)
            admin_connections = self._admin_connections.copy()

        for websocket in all_job_connections.union(admin_connections):
            try:
                await websocket.send_text(json_message)
            except Exception as e:
                logger.warning(f"Failed to broadcast: {e}")
                disconnected.append(websocket)

        # Clean up disconnected clients
        for websocket in disconnected:
            await self.disconnect(websocket)

    def _start_heartbeat(self, websocket: WebSocket) -> None:
        """Start heartbeat task for a connection."""
        task = asyncio.create_task(self._heartbeat_loop(websocket))
        self._heartbeat_tasks[websocket] = task

    def _stop_heartbeat(self, websocket: WebSocket) -> None:
        """Stop heartbeat task for a connection."""
        task = self._heartbeat_tasks.pop(websocket, None)
        if task:
            task.cancel()

    async def _heartbeat_loop(self, websocket: WebSocket) -> None:
        """
        Send periodic heartbeat pings to keep connection alive.

        Args:
            websocket: The WebSocket connection
        """
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)
                try:
                    # Send ping message
                    ping_message = json.dumps({
                        "type": "ping",
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                    })
                    await websocket.send_text(ping_message)
                except Exception:
                    # Connection lost, will be cleaned up elsewhere
                    break
        except asyncio.CancelledError:
            pass

    async def send_personal_message(self, websocket: WebSocket, message: Dict) -> bool:
        """
        Send a message to a specific client.

        Args:
            websocket: The target WebSocket connection
            message: The message dictionary to send

        Returns:
            True if sent successfully, False otherwise
        """
        try:
            await websocket.send_text(json.dumps(message))
            return True
        except Exception as e:
            logger.warning(f"Failed to send personal message: {e}")
            await self.disconnect(websocket)
            return False

    def get_job_subscribers(self, job_id: str) -> int:
        """Get the number of subscribers for a specific job."""
        return len(self._job_connections.get(job_id, set()))

    def get_connection_info(self) -> Dict:
        """Get connection statistics."""
        return {
            "total_connections": self.total_connections,
            "job_connections": {
                job_id: len(conns) for job_id, conns in self._job_connections.items()
            },
            "admin_connections": len(self._admin_connections),
            "max_connections": self.MAX_CONNECTIONS,
        }


# Singleton instance
connection_manager = ConnectionManager()


class ProgressTracker:
    """
    Helper class for tracking and broadcasting job progress.

    Integrates with the ConnectionManager to send real-time updates.
    """

    def __init__(self, job_id: str, total_steps: int = 4):
        self.job_id = job_id
        self.total_steps = total_steps
        self.current_step = 0
        self.stage = ProgressStage.PENDING

    async def update_progress(
        self,
        stage: ProgressStage,
        progress: float,
        message: str,
        current_step: Optional[int] = None,
        eta_seconds: Optional[int] = None,
    ) -> None:
        """
        Update and broadcast job progress.

        Args:
            stage: Current processing stage
            progress: Progress percentage (0-100)
            message: Human-readable status message
            current_step: Current step number (optional)
            eta_seconds: Estimated time remaining in seconds (optional)
        """
        self.stage = stage
        if current_step is not None:
            self.current_step = current_step

        details = {
            "current_step": self.current_step,
            "total_steps": self.total_steps,
        }
        if eta_seconds is not None:
            details["eta_seconds"] = eta_seconds

        progress_message = ProgressMessage(
            type="progress",
            job_id=self.job_id,
            stage=stage.value,
            progress=progress,
            message=message,
            details=details,
        )

        await connection_manager.broadcast_to_job(self.job_id, progress_message)

    async def complete(self, message: str = "Transcription completed successfully") -> None:
        """Mark job as completed and broadcast."""
        await self.update_progress(
            stage=ProgressStage.COMPLETED,
            progress=100.0,
            message=message,
            current_step=self.total_steps,
        )

    async def fail(self, error_message: str) -> None:
        """Mark job as failed and broadcast."""
        await self.update_progress(
            stage=ProgressStage.FAILED,
            progress=self.current_step / self.total_steps * 100,
            message=f"Error: {error_message}",
        )


async def handle_websocket_messages(websocket: WebSocket) -> None:
    """
    Handle incoming WebSocket messages (ping/pong, etc.).

    Args:
        websocket: The WebSocket connection
    """
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "pong":
                    # Client responded to ping
                    logger.debug("Received pong from client")
                elif msg_type == "ping":
                    # Client sent ping, respond with pong
                    await connection_manager.send_personal_message(
                        websocket,
                        {
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                        },
                    )
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {data}")
    except WebSocketDisconnect:
        await connection_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await connection_manager.disconnect(websocket)
