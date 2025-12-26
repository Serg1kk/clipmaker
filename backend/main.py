"""
FastAPI Backend for Video Transcription Service

This module provides a REST API for video transcription with:
- Async file upload handling
- Job queue pattern for background processing
- Proper error handling and CORS support
- Local file browsing for video selection
"""

import asyncio
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.file_browser_service import (
    FileBrowserService,
    BrowseResponse,
    RootDirectory,
    ValidationResult,
    FileItem,
    file_browser_service,
)
from services.websocket_service import (
    connection_manager,
    handle_websocket_messages,
    ProgressTracker,
    ProgressStage,
)
from services.video_files_service import (
    video_files_service,
    VideoFilesListResponse,
    VideoFileDetailResponse,
    VideoFileMetadata,
)
from services.ffmpeg_service import FFmpegService, AudioFormat, ExtractionProgress
from services.whisper_service import WhisperService, TranscriptionResult


# Configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


class JobStatus(str, Enum):
    """Transcription job status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptionJob(BaseModel):
    """Model representing a transcription job."""
    job_id: str = Field(..., description="Unique job identifier")
    status: JobStatus = Field(default=JobStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    result: Optional[str] = None  # Full transcription text
    result_data: Optional[dict] = None  # Structured result with word timestamps
    error: Optional[str] = None
    progress: float = Field(default=0.0, ge=0.0, le=100.0)


class TranscriptionRequest(BaseModel):
    """Request model for transcription via file path."""
    file_path: str = Field(..., description="Path to the video file")


class TranscriptionResponse(BaseModel):
    """Response model for transcription job creation."""
    job_id: str
    status: JobStatus
    message: str


class JobStatusResponse(BaseModel):
    """Response model for job status queries."""
    job_id: str
    status: JobStatus
    progress: float
    created_at: datetime
    updated_at: datetime
    result: Optional[str] = None
    result_data: Optional[dict] = None  # Structured result with word timestamps
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    timestamp: datetime
    version: str


# In-memory job store (replace with Redis/database in production)
jobs_store: dict[str, TranscriptionJob] = {}


# FastAPI Application
app = FastAPI(
    title="Video Transcription API",
    description="API for transcribing video files to text",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def process_transcription(job_id: str) -> None:
    """
    Background task to process video transcription.

    Uses FFmpegService for audio extraction and WhisperService for transcription.
    Sends real-time progress updates via WebSocket.

    Args:
        job_id: The unique identifier of the transcription job
    """
    import logging
    logger = logging.getLogger(__name__)

    job = jobs_store.get(job_id)
    if not job:
        return

    # Create progress tracker for WebSocket updates
    tracker = ProgressTracker(job_id=job_id, total_steps=4)

    # Initialize services
    ffmpeg_service = FFmpegService(output_dir=UPLOAD_DIR / "audio")
    whisper_service = WhisperService(model_size="base")

    audio_path: Optional[Path] = None

    try:
        job.status = JobStatus.PROCESSING
        job.updated_at = datetime.utcnow()

        # =====================================================================
        # Step 1: Extract audio from video (0-25%)
        # =====================================================================
        await tracker.update_progress(
            stage=ProgressStage.EXTRACTING,
            progress=0.0,
            message="Starting audio extraction...",
            current_step=1,
            eta_seconds=120,
        )

        # Get video info for duration estimation
        video_path = Path(job.file_path)
        video_info = await ffmpeg_service.get_video_info(video_path)

        # Callback for FFmpeg extraction progress
        last_extraction_progress = 0.0

        def on_extraction_progress(progress: ExtractionProgress) -> None:
            nonlocal last_extraction_progress
            # Map FFmpeg progress (0-100) to our progress (0-25)
            mapped_progress = progress.percent * 0.25
            if mapped_progress - last_extraction_progress >= 1.0:  # Update every 1%
                last_extraction_progress = mapped_progress
                asyncio.create_task(tracker.update_progress(
                    stage=ProgressStage.EXTRACTING,
                    progress=mapped_progress,
                    message=f"Extracting audio... {progress.percent:.0f}%",
                    current_step=1,
                    eta_seconds=int(progress.eta_seconds) if progress.eta_seconds else None,
                ))
                job.progress = mapped_progress
                job.updated_at = datetime.utcnow()

        # Extract audio to WAV format (optimal for Whisper)
        audio_path = await ffmpeg_service.extract_audio(
            video_path=video_path,
            format=AudioFormat.WAV,
            sample_rate=16000,  # Whisper optimal sample rate
            channels=1,  # Mono for speech
            progress_callback=on_extraction_progress,
        )

        job.progress = 25.0
        job.updated_at = datetime.utcnow()
        await tracker.update_progress(
            stage=ProgressStage.EXTRACTING,
            progress=25.0,
            message="Audio extraction complete",
            current_step=1,
            eta_seconds=0,
        )

        # =====================================================================
        # Step 2: Transcribe audio with word-level timestamps (25-90%)
        # =====================================================================
        await tracker.update_progress(
            stage=ProgressStage.TRANSCRIBING,
            progress=25.0,
            message="Loading transcription model...",
            current_step=2,
            eta_seconds=int(video_info.duration * 2),  # Rough ETA
        )

        # Whisper progress callback
        def on_whisper_progress(progress: float, message: str) -> None:
            # Map Whisper progress (0-100) to our progress (25-90)
            mapped_progress = 25.0 + (progress * 0.65)
            asyncio.create_task(tracker.update_progress(
                stage=ProgressStage.TRANSCRIBING,
                progress=mapped_progress,
                message=message,
                current_step=2,
                eta_seconds=None,
            ))
            job.progress = mapped_progress
            job.updated_at = datetime.utcnow()

        # Run transcription with word-level timestamps
        transcription_result: TranscriptionResult = whisper_service.transcribe_with_word_timestamps(
            audio_path=str(audio_path),
            word_timestamps=True,
            progress_callback=on_whisper_progress,
        )

        job.progress = 90.0
        job.updated_at = datetime.utcnow()

        # =====================================================================
        # Step 3: Process and format results (90-100%)
        # =====================================================================
        await tracker.update_progress(
            stage=ProgressStage.TRANSCRIBING,
            progress=90.0,
            message="Processing transcription results...",
            current_step=3,
            eta_seconds=5,
        )

        # Convert TranscriptionResult to the required JSON format
        result_data = {
            "text": transcription_result.text,
            "segments": [
                {
                    "id": seg.id,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "words": [
                        {
                            "word": word.word,
                            "start": word.start,
                            "end": word.end,
                            "probability": word.probability
                        }
                        for word in seg.words
                    ]
                }
                for seg in transcription_result.segments
            ],
            "language": transcription_result.language,
            "duration": video_info.duration,
        }

        # Store results
        job.result = transcription_result.text
        job.result_data = result_data
        job.status = JobStatus.COMPLETED
        job.progress = 100.0

        logger.info(f"Transcription completed for job {job_id}: {len(transcription_result.segments)} segments")

        # Complete
        await tracker.complete(message="Transcription completed successfully!")

    except FileNotFoundError as e:
        job.status = JobStatus.FAILED
        job.error = f"File not found: {str(e)}"
        logger.error(f"Transcription failed for job {job_id}: {job.error}")
        await tracker.fail(job.error)
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        logger.error(f"Transcription failed for job {job_id}: {job.error}")
        await tracker.fail(str(e))
    finally:
        job.updated_at = datetime.utcnow()

        # Cleanup: Remove temporary audio file
        if audio_path and audio_path.exists():
            try:
                audio_path.unlink()
                logger.debug(f"Cleaned up audio file: {audio_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup audio file: {cleanup_error}")

        # Unload Whisper model to free memory
        try:
            whisper_service.unload_model()
        except Exception:
            pass


def validate_file_extension(filename: str) -> bool:
    """Validate that the file has an allowed extension."""
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@app.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    status_code=202,
    summary="Submit video for transcription",
    description="Upload a video file or provide a file path to start transcription",
)
async def create_transcription(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None, description="Video file to transcribe"),
    file_path: Optional[str] = Form(None, description="Path to existing video file"),
) -> TranscriptionResponse:
    """
    Create a new transcription job.

    Accepts either:
    - A video file upload (multipart/form-data)
    - A path to an existing video file on the server

    Returns a job ID for tracking the transcription progress.
    """
    if not file and not file_path:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'file_path' must be provided",
        )

    job_id = str(uuid.uuid4())
    job = TranscriptionJob(job_id=job_id)

    if file:
        # Handle file upload
        if not file.filename:
            raise HTTPException(status_code=400, detail="File must have a filename")

        if not validate_file_extension(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        # Save uploaded file
        safe_filename = f"{job_id}_{file.filename}"
        file_destination = UPLOAD_DIR / safe_filename

        try:
            async with aiofiles.open(file_destination, "wb") as out_file:
                content = await file.read()
                if len(content) > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB",
                    )
                await out_file.write(content)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save uploaded file: {str(e)}",
            )

        job.file_path = str(file_destination)
        job.file_name = file.filename

    else:
        # Handle file path
        path = Path(file_path)  # type: ignore
        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {file_path}",
            )

        if not validate_file_extension(path.name):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        job.file_path = str(path.absolute())
        job.file_name = path.name

    # Store job and start background processing
    jobs_store[job_id] = job
    background_tasks.add_task(process_transcription, job_id)

    return TranscriptionResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message="Transcription job created successfully",
    )


@app.get(
    "/transcribe/{job_id}",
    response_model=JobStatusResponse,
    summary="Get transcription status",
    description="Retrieve the status and result of a transcription job",
)
async def get_transcription_status(job_id: str) -> JobStatusResponse:
    """
    Get the status of a transcription job.

    Args:
        job_id: The unique identifier of the transcription job

    Returns:
        Job status including progress and result if completed
    """
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}",
        )

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        created_at=job.created_at,
        updated_at=job.updated_at,
        result=job.result,
        result_data=job.result_data,
        error=job.error,
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Check if the API is running and healthy",
)
async def health_check() -> HealthResponse:
    """
    Health check endpoint for monitoring and load balancers.

    Returns:
        Health status with timestamp and version
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="1.0.0",
    )


@app.get("/jobs", summary="List all jobs")
async def list_jobs(
    status: Optional[JobStatus] = None,
    limit: int = 50,
) -> list[JobStatusResponse]:
    """
    List all transcription jobs with optional status filter.

    Args:
        status: Filter by job status
        limit: Maximum number of jobs to return

    Returns:
        List of job status responses
    """
    jobs = list(jobs_store.values())

    if status:
        jobs = [j for j in jobs if j.status == status]

    jobs = sorted(jobs, key=lambda x: x.created_at, reverse=True)[:limit]

    return [
        JobStatusResponse(
            job_id=j.job_id,
            status=j.status,
            progress=j.progress,
            created_at=j.created_at,
            updated_at=j.updated_at,
            result=j.result,
            result_data=j.result_data,
            error=j.error,
        )
        for j in jobs
    ]


@app.delete("/transcribe/{job_id}", summary="Cancel/delete a job")
async def delete_job(job_id: str) -> JSONResponse:
    """
    Cancel a pending job or delete a completed/failed job.

    Args:
        job_id: The unique identifier of the transcription job

    Returns:
        Confirmation message
    """
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}",
        )

    # Clean up uploaded file if exists
    if job.file_path:
        file_path = Path(job.file_path)
        if file_path.exists() and str(file_path).startswith(str(UPLOAD_DIR)):
            try:
                file_path.unlink()
            except Exception:
                pass  # Ignore cleanup errors

    del jobs_store[job_id]

    return JSONResponse(
        status_code=200,
        content={"message": f"Job {job_id} deleted successfully"},
    )


# =============================================================================
# File Browser API Endpoints
# =============================================================================


@app.get(
    "/api/browse",
    response_model=BrowseResponse,
    summary="Browse directory",
    description="Browse a directory and return its contents with optional filters",
    tags=["File Browser"],
)
async def browse_directory(
    path: Optional[str] = Query(
        None,
        description="Directory path to browse. Defaults to home directory.",
        example="/Users/user/Videos"
    ),
    show_hidden: bool = Query(
        False,
        description="Whether to show hidden files and directories"
    ),
    video_only: bool = Query(
        False,
        description="Whether to show only video files (directories are always shown)"
    ),
) -> BrowseResponse:
    """
    Browse a directory and return its contents.

    Security features:
    - Path traversal protection
    - Restricted to user-accessible directories
    - Hidden files filtered by default

    Args:
        path: Directory path to browse
        show_hidden: Include hidden files/directories
        video_only: Filter to only show video files

    Returns:
        BrowseResponse with directory contents
    """
    return file_browser_service.browse_directory(
        path_str=path,
        show_hidden=show_hidden,
        video_only=video_only
    )


@app.get(
    "/api/browse/roots",
    response_model=list[RootDirectory],
    summary="Get root directories",
    description="Get list of available root directories for browsing",
    tags=["File Browser"],
)
async def get_root_directories() -> list[RootDirectory]:
    """
    Get available root directories for the file browser.

    Returns commonly used directories:
    - Home
    - Desktop
    - Downloads
    - Documents
    - Videos/Movies

    Returns:
        List of RootDirectory objects with path and existence info
    """
    return file_browser_service.get_root_directories()


@app.get(
    "/api/browse/validate",
    response_model=ValidationResult,
    summary="Validate file path",
    description="Validate a file path and check if it's a valid video file",
    tags=["File Browser"],
)
async def validate_path(
    path: str = Query(
        ...,
        description="File path to validate",
        example="/Users/user/Videos/video.mp4"
    ),
) -> ValidationResult:
    """
    Validate a file path for security and video compatibility.

    Checks:
    - Path exists and is accessible
    - Path is within allowed directories
    - If file, checks if it's a valid video
    - Basic file integrity verification

    Args:
        path: The file path to validate

    Returns:
        ValidationResult with validation status and file info
    """
    return file_browser_service.validate_path(path)


@app.get(
    "/api/browse/videos",
    response_model=BrowseResponse,
    summary="Get video files",
    description="Get only video files from a directory",
    tags=["File Browser"],
)
async def get_video_files(
    path: str = Query(
        ...,
        description="Directory path to search for videos",
        example="/Users/user/Videos"
    ),
) -> BrowseResponse:
    """
    Get only video files from a directory.

    Filters to supported video formats:
    - .mp4, .mov, .avi, .mkv, .webm, .m4v

    Args:
        path: Directory to search for videos

    Returns:
        BrowseResponse with only video files and directories
    """
    return file_browser_service.get_video_files(path)


@app.get(
    "/api/browse/file",
    response_model=FileItem,
    summary="Get file info",
    description="Get detailed information about a specific file",
    tags=["File Browser"],
)
async def get_file_info(
    path: str = Query(
        ...,
        description="File path to get info for",
        example="/Users/user/Videos/video.mp4"
    ),
) -> FileItem:
    """
    Get detailed information about a file.

    Returns:
    - File name and path
    - Size (bytes and formatted)
    - Modification date
    - Video status and extension

    Args:
        path: Path to the file

    Returns:
        FileItem with detailed file information

    Raises:
        HTTPException: If file is not found or not accessible
    """
    # First validate the path
    validation = file_browser_service.validate_path(path)
    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail=validation.error or "Invalid path"
        )

    file_info = file_browser_service.get_file_info(path)
    if not file_info:
        raise HTTPException(
            status_code=404,
            detail=f"File not found or not accessible: {path}"
        )

    return file_info


# =============================================================================
# Video Files API Endpoints (/files)
# =============================================================================


@app.get(
    "/files",
    response_model=VideoFilesListResponse,
    summary="List video files",
    description="List all video files in the /videos folder with metadata including duration, size, and format",
    tags=["Video Files"],
)
async def list_video_files(
    include_metadata: bool = Query(
        True,
        description="Include FFmpeg metadata (duration, codec, resolution). Set to false for faster response.",
    ),
) -> VideoFilesListResponse:
    """
    List all video files in the /videos folder.

    Returns video files with rich metadata including:
    - File name, path, size
    - Duration (requires FFmpeg)
    - Resolution and codec information (requires FFmpeg)
    - Format and bitrate

    Args:
        include_metadata: Whether to extract FFmpeg metadata (slower but more info)

    Returns:
        VideoFilesListResponse with list of video files and their metadata
    """
    return await video_files_service.list_video_files(include_metadata=include_metadata)


@app.get(
    "/files/{file_path:path}",
    response_model=VideoFileDetailResponse,
    summary="Get video file info",
    description="Get detailed information about a specific video file",
    tags=["Video Files"],
)
async def get_video_file_info(
    file_path: str,
) -> VideoFileDetailResponse:
    """
    Get detailed information about a specific video file.

    The path can be:
    - A filename (e.g., "video.mp4") - looked up in /videos folder
    - A relative path (e.g., "subfolder/video.mp4") - relative to /videos
    - Security restricted to files within the /videos folder

    Returns:
    - Complete file metadata including name, size, modification date
    - Video metadata: duration, resolution, codec, bitrate (requires FFmpeg)
    - Error message if file not found or access denied

    Args:
        file_path: Path to the video file (relative to /videos folder)

    Returns:
        VideoFileDetailResponse with file metadata or error
    """
    response = await video_files_service.get_file_info(file_path)

    if not response.exists:
        raise HTTPException(
            status_code=404,
            detail=response.error or f"File not found: {file_path}",
        )

    if response.error:
        raise HTTPException(
            status_code=400,
            detail=response.error,
        )

    return response


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    """Global exception handler for unhandled errors."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred",
            "type": type(exc).__name__,
        },
    )


# ============================================================================
# WebSocket Endpoints
# ============================================================================


@app.websocket("/ws/job/{job_id}")
async def websocket_job_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for subscribing to a specific job's progress updates.

    Args:
        websocket: The WebSocket connection
        job_id: The job ID to subscribe to

    Messages sent to client:
        - Progress updates: {"type": "progress", "job_id": "...", "stage": "...", ...}
        - Ping messages: {"type": "ping", "timestamp": "..."}

    Messages accepted from client:
        - Pong responses: {"type": "pong"}
        - Ping requests: {"type": "ping"} (server responds with pong)
    """
    # Validate job exists (optional - can also allow subscription to future jobs)
    job = jobs_store.get(job_id)

    # Connect to the job's progress channel
    connected = await connection_manager.connect_to_job(websocket, job_id)
    if not connected:
        await websocket.close(code=1013, reason="Connection limit reached")
        return

    try:
        # Send initial status if job exists
        if job:
            initial_message = {
                "type": "initial_status",
                "job_id": job.job_id,
                "status": job.status.value,
                "progress": job.progress,
                "message": f"Connected to job {job_id}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            await websocket.send_json(initial_message)
        else:
            # Job doesn't exist yet, send waiting message
            await websocket.send_json({
                "type": "waiting",
                "job_id": job_id,
                "message": "Waiting for job to start...",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })

        # Handle incoming messages (ping/pong, etc.)
        await handle_websocket_messages(websocket)

    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(websocket)


@app.websocket("/ws/all")
async def websocket_all_jobs(websocket: WebSocket):
    """
    WebSocket endpoint for admin clients to receive all job updates.

    This endpoint broadcasts progress updates for ALL jobs to connected clients.
    Useful for admin dashboards and monitoring.

    Messages sent to client:
        - Progress updates for any job
        - Ping messages for connection health

    Messages accepted from client:
        - Pong responses
        - Ping requests
    """
    connected = await connection_manager.connect_admin(websocket)
    if not connected:
        await websocket.close(code=1013, reason="Connection limit reached")
        return

    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to all jobs stream",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "connection_info": connection_manager.get_connection_info(),
        })

        # Handle incoming messages
        await handle_websocket_messages(websocket)

    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(websocket)


@app.get("/ws/info", summary="Get WebSocket connection info")
async def websocket_info():
    """
    Get information about current WebSocket connections.

    Returns connection statistics including total connections,
    per-job connections, and admin connections.
    """
    return connection_manager.get_connection_info()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
