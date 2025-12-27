"""
FastAPI Backend for Video Transcription Service

This module provides a REST API for video transcription with:
- Async file upload handling
- Job queue pattern for background processing
- Proper error handling and CORS support
- Local file browsing for video selection
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# Load .env file from project root
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded .env from {env_path}")
    else:
        print(f"No .env file found at {env_path}, using defaults")
except ImportError:
    print("python-dotenv not installed, using environment variables only")

import aiofiles
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks, Query, WebSocket, WebSocketDisconnect, Request
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
    ProgressMessage,
)
from services.video_files_service import (
    video_files_service,
    VideoFilesListResponse,
    VideoFileDetailResponse,
    VideoFileMetadata,
)
from services.ffmpeg_service import FFmpegService, AudioFormat, ExtractionProgress
from services.whisper_service import WhisperService, TranscriptionResult
from services.render_service import (
    RenderService,
    RenderRequest,
    RenderProgress,
    RenderError,
    SubtitleConfig,
    AudioConfig,
    AudioMode,
    SubtitlePosition,
)
from models.transcription_moment import TranscriptionMoment
from services.json_storage import JSONFileStorage, EntityNotFoundError
from routers.projects import router as projects_router


# Logger
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

# Whisper model from environment (default: base)
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")


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


# =============================================================================
# Render Job Models and Store
# =============================================================================


class RenderJobStatus(str, Enum):
    """Render job status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RenderJob(BaseModel):
    """Model representing a render job."""
    job_id: str = Field(..., description="Unique job identifier")
    project_id: str = Field(..., description="Project ID")
    moment_id: str = Field(..., description="Moment ID to render")
    status: RenderJobStatus = Field(default=RenderJobStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    current_phase: str = Field(default="pending")
    message: str = Field(default="Waiting to start...")
    output_path: Optional[str] = None
    error: Optional[str] = None


class RenderEndpointRequest(BaseModel):
    """Request model for render endpoint."""
    project_id: str = Field(..., description="Project ID containing the moment")
    moment_id: str = Field(..., description="Moment ID to render")
    subtitle_config: Optional[dict] = Field(
        default=None,
        description="Optional subtitle configuration overrides"
    )
    audio_config: Optional[dict] = Field(
        default=None,
        description="Optional audio configuration overrides"
    )
    output_filename: Optional[str] = Field(
        default=None,
        description="Optional custom output filename"
    )


class RenderEndpointResponse(BaseModel):
    """Response model for render job creation."""
    job_id: str
    status: RenderJobStatus
    message: str
    websocket_url: str


class RenderJobStatusResponse(BaseModel):
    """Response model for render job status queries."""
    job_id: str
    project_id: str
    moment_id: str
    status: RenderJobStatus
    progress: float
    current_phase: str
    message: str
    created_at: datetime
    updated_at: datetime
    output_path: Optional[str] = None
    error: Optional[str] = None


# In-memory render job store
render_jobs_store: dict[str, RenderJob] = {}

# Initialize render service
render_service = RenderService()


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

# Include routers
app.include_router(projects_router)


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
    whisper_service = WhisperService(model_size=WHISPER_MODEL)
    logger.info(f"Initialized WhisperService with model: {WHISPER_MODEL}")

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
                    message="Extracting audio from video...",
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
            message=f"Loading Whisper model: {WHISPER_MODEL}...",
            current_step=2,
            eta_seconds=int(video_info.duration * 2),  # Rough ETA
        )
        logger.info(f"Loading Whisper model: {WHISPER_MODEL}")

        # Progress callback for Whisper - sends WebSocket updates with model name
        last_whisper_progress = 25.0

        def on_whisper_progress(progress: float, message: str) -> None:
            nonlocal last_whisper_progress
            # Map Whisper progress (0-100) to our progress (25-90)
            mapped_progress = 25.0 + (progress * 0.65)
            job.progress = mapped_progress
            job.updated_at = datetime.utcnow()

            # Send WebSocket update every 5% or when message changes
            if mapped_progress - last_whisper_progress >= 5.0 or progress >= 99:
                last_whisper_progress = mapped_progress
                # Include model name in progress message
                progress_msg = f"Transcribing with {WHISPER_MODEL} model... {int(progress)}%"
                asyncio.create_task(tracker.update_progress(
                    stage=ProgressStage.TRANSCRIBING,
                    progress=mapped_progress,
                    message=progress_msg,
                    current_step=2,
                ))

        # Run transcription with word-level timestamps
        transcription_result: TranscriptionResult = whisper_service.transcribe_with_word_timestamps(
            audio_path=str(audio_path),
            word_timestamps=True,
            progress_callback=on_whisper_progress,
        )

        # Log transcription result with model and language info
        logger.info(
            f"Transcription complete - Model: {WHISPER_MODEL}, "
            f"Detected language: {transcription_result.language}, "
            f"Segments: {len(transcription_result.segments)}, "
            f"Duration: {transcription_result.duration:.1f}s"
        )

        # Send progress update after transcription completes
        await tracker.update_progress(
            stage=ProgressStage.TRANSCRIBING,
            progress=85.0,
            message=f"Transcription complete (model: {WHISPER_MODEL}, lang: {transcription_result.language})",
            current_step=2,
            eta_seconds=None,
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
            "model": WHISPER_MODEL,
        }

        # Store results
        job.result = transcription_result.text
        job.result_data = result_data
        job.status = JobStatus.COMPLETED
        job.progress = 100.0

        logger.info(
            f"Transcription completed for job {job_id} - "
            f"Model: {WHISPER_MODEL}, Language: {transcription_result.language}, "
            f"Segments: {len(transcription_result.segments)}"
        )

        # Complete
        await tracker.complete(message=f"Transcription completed! (Model: {WHISPER_MODEL})")

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


# =============================================================================
# Video Streaming Endpoint
# =============================================================================


@app.get(
    "/video-stream",
    summary="Stream video file",
    description="Stream a video file for playback in the browser with Range support",
    tags=["Video Files"],
)
async def stream_video(
    request: Request,
    path: str = Query(
        ...,
        description="Full path to the video file",
    ),
    download: bool = Query(
        False,
        description="If true, serve as attachment for download instead of inline",
    ),
):
    """
    Stream a video file for playback with HTTP Range support.

    This endpoint serves video files with proper streaming support
    for browser video players, including seek functionality.

    Args:
        request: FastAPI request object (for Range header)
        path: Full path to the video file

    Returns:
        StreamingResponse with Range support for video seeking

    Raises:
        HTTPException: 404 if file not found, 400 if invalid file type
    """
    from fastapi.responses import StreamingResponse
    import mimetypes

    video_path = Path(path)

    # Security: Check if file exists
    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Video file not found: {path}",
        )

    # Security: Verify it's a video file
    if video_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(str(video_path))
    if not mime_type:
        mime_type = "video/mp4"  # Default fallback

    # Get file size
    file_size = video_path.stat().st_size

    # Parse Range header for partial content requests
    range_header = request.headers.get("range")

    # Encode filename for HTTP headers (handle non-ASCII characters)
    from urllib.parse import quote
    encoded_filename = quote(video_path.name)

    if range_header:
        # Parse range like "bytes=0-1023"
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1

        # Ensure valid range
        if start >= file_size:
            raise HTTPException(status_code=416, detail="Range not satisfiable")

        end = min(end, file_size - 1)
        content_length = end - start + 1

        async def stream_range():
            async with aiofiles.open(video_path, "rb") as f:
                await f.seek(start)
                remaining = content_length
                chunk_size = 1024 * 1024  # 1MB chunks
                while remaining > 0:
                    chunk = await f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        disposition = "attachment" if download else "inline"
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded_filename}",
        }

        return StreamingResponse(
            stream_range(),
            status_code=206,
            media_type=mime_type,
            headers=headers,
        )

    # Full file request (no Range header)
    async def stream_full():
        async with aiofiles.open(video_path, "rb") as f:
            chunk_size = 1024 * 1024  # 1MB chunks
            while chunk := await f.read(chunk_size):
                yield chunk

    disposition = "attachment" if download else "inline"
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded_filename}",
    }

    return StreamingResponse(
        stream_full(),
        media_type=mime_type,
        headers=headers,
    )


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


# =============================================================================
# Render API Endpoints
# =============================================================================


class RenderProgressStage(str, Enum):
    """Render progress stage enumeration."""
    PENDING = "pending"
    LOADING = "loading"
    EXTRACTING = "extracting"
    COMPOSITING = "compositing"
    SUBTITLES = "subtitles"
    AUDIO = "audio"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"


class RenderProgressTracker:
    """
    Helper class for tracking and broadcasting render job progress.
    """

    def __init__(self, job_id: str):
        self.job_id = job_id

    async def update_progress(
        self,
        stage: str,
        progress: float,
        message: str,
        current_step: Optional[int] = None,
        total_steps: int = 5,
    ) -> None:
        """Update and broadcast render job progress."""
        details = {
            "current_step": current_step or 0,
            "total_steps": total_steps,
        }

        progress_message = ProgressMessage(
            type="render_progress",
            job_id=self.job_id,
            stage=stage,
            progress=progress,
            message=message,
            details=details,
        )

        await connection_manager.broadcast_to_job(self.job_id, progress_message)

    async def complete(self, output_path: str) -> None:
        """Mark render as completed and broadcast."""
        await self.update_progress(
            stage=RenderProgressStage.COMPLETED.value,
            progress=100.0,
            message=f"Render complete: {output_path}",
            current_step=5,
        )

    async def fail(self, error_message: str) -> None:
        """Mark render as failed and broadcast."""
        await self.update_progress(
            stage=RenderProgressStage.FAILED.value,
            progress=0.0,
            message=f"Error: {error_message}",
        )


# =============================================================================
# Render Helper Functions
# =============================================================================


def extract_subtitle_words(
    transcription: Optional["TranscriptionData"],
    start_time: float,
    end_time: float,
) -> Optional[list[dict]]:
    """
    Extract words from transcription segments that fall within the moment time range.

    Args:
        transcription: TranscriptionData with segments containing word-level timestamps
        start_time: Moment start time in seconds
        end_time: Moment end time in seconds

    Returns:
        List of word dicts with {word, start, end} or None if no words found
    """
    if not transcription or not transcription.segments:
        return None

    words = []
    for segment in transcription.segments:
        # Skip segments that don't overlap with the moment
        if segment.end < start_time or segment.start > end_time:
            continue

        for word_data in segment.words:
            word_start = word_data.get("start", 0)
            word_end = word_data.get("end", 0)
            word_text = word_data.get("word", "")

            # Include word if it overlaps with the moment range
            if word_end > start_time and word_start < end_time:
                words.append({
                    "word": word_text,
                    "start": word_start,
                    "end": word_end,
                })

    return words if words else None


def generate_output_path(
    project_id: str,
    moment_id: str,
    filename: Optional[str] = None,
) -> Path:
    """
    Generate structured output path: output/{project_id}/{moment_id}/{timestamp}/

    Args:
        project_id: Project identifier
        moment_id: Moment identifier
        filename: Optional output filename (auto-generated if not provided)

    Returns:
        Path to output file
    """
    from datetime import datetime

    # Create timestamp-based subdirectory to avoid overwriting
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Build output directory structure
    output_dir = Path("output") / project_id / moment_id / timestamp
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename if not provided
    if not filename:
        filename = f"render_{moment_id[:8]}.mp4"
    elif not filename.endswith(".mp4"):
        filename += ".mp4"

    return output_dir / filename


def build_composite_request(
    source_video_path: str,
    crop_template: str,
    crop_coordinates: list[dict],
    video_width: int,
    video_height: int,
    moment_start: float,
    moment_end: float,
    output_path: str,
) -> Optional["CompositeRequest"]:
    """
    Build a CompositeRequest for 2-frame or 3-frame templates.

    Args:
        source_video_path: Path to source video
        crop_template: Template type ("1-frame", "2-frame", "3-frame")
        crop_coordinates: List of normalized crop coordinates (0-1)
        video_width: Source video width in pixels
        video_height: Source video height in pixels
        moment_start: Moment start time
        moment_end: Moment end time
        output_path: Output file path

    Returns:
        CompositeRequest for multi-frame templates, None for 1-frame
    """
    from models.composite_schemas import (
        CompositeRequest,
        CompositeTemplate,
        TemplateSlot,
        VideoSource,
        SourceRegion,
        ScaleMode,
        AudioMixMode,
    )

    if crop_template == "1-frame" or not crop_coordinates:
        return None

    # Output dimensions (9:16 vertical)
    output_width = 1080
    output_height = 1920

    # Determine slot configuration based on template
    if crop_template == "2-frame":
        # 2 slots stacked vertically, each 1080x960
        slot_height = 960
        slot_count = 2
        slot_configs = [
            {"slot_id": "top", "name": "Top Video", "y": 0},
            {"slot_id": "bottom", "name": "Bottom Video", "y": 960},
        ]
    elif crop_template == "3-frame":
        # 3 slots stacked vertically, each 1080x640
        slot_height = 640
        slot_count = 3
        slot_configs = [
            {"slot_id": "top", "name": "Top Video", "y": 0},
            {"slot_id": "middle", "name": "Middle Video", "y": 640},
            {"slot_id": "bottom", "name": "Bottom Video", "y": 1280},
        ]
    else:
        return None

    # Create template slots
    slots = []
    for cfg in slot_configs:
        slots.append(TemplateSlot(
            slot_id=cfg["slot_id"],
            name=cfg["name"],
            x=0,
            y=cfg["y"],
            width=output_width,
            height=slot_height,
            z_order=0,
            scale_mode=ScaleMode.FILL,
        ))

    # Create template
    template = CompositeTemplate(
        template_id=f"tpl-{crop_template}",
        name=f"{crop_template.replace('-', ' ').title()} Layout",
        description=f"Auto-generated {crop_template} composite layout",
        output_width=output_width,
        output_height=output_height,
        output_fps=30.0,
        background_color="#000000",
        slots=slots,
    )

    # Create video sources from crop coordinates
    sources = []
    for i, slot_cfg in enumerate(slot_configs):
        # Get crop coordinates for this slot (use index if available, else first)
        crop_idx = i if i < len(crop_coordinates) else 0
        crop = crop_coordinates[crop_idx]

        # Convert normalized coordinates (0-1) to pixels
        norm_x = crop.get("x", 0)
        norm_y = crop.get("y", 0)
        norm_width = crop.get("width", 1)
        norm_height = crop.get("height", 1)

        crop_x = int(norm_x * video_width)
        crop_y = int(norm_y * video_height)
        crop_width = int(norm_width * video_width)
        crop_height = int(norm_height * video_height)

        # Create source region with crop
        source_region = SourceRegion(
            source_path=source_video_path,
            crop_x=crop_x,
            crop_y=crop_y,
            crop_width=crop_width,
            crop_height=crop_height,
            start_time=moment_start,
            end_time=moment_end,
            source_width=video_width,
            source_height=video_height,
        )

        # Only enable audio for the first slot to avoid duplication
        audio_enabled = (i == 0)

        sources.append(VideoSource(
            source_id=f"src-{slot_cfg['slot_id']}",
            source_region=source_region,
            slot_id=slot_cfg["slot_id"],
            audio_enabled=audio_enabled,
            audio_volume=1.0,
            label=slot_cfg["name"],
        ))

    # Build composite request
    return CompositeRequest(
        template=template,
        sources=sources,
        output_path=output_path,
        audio_source=sources[0].source_id if sources else None,
        audio_mix_mode=AudioMixMode.SINGLE,
        output_codec="h264",
        output_bitrate=8000,
        output_preset="medium",
    )


async def process_render(job_id: str, request: RenderEndpointRequest) -> None:
    """
    Background task to process video rendering.

    Handles:
    - Subtitle extraction from project transcription
    - Multi-frame composite layouts (2-frame, 3-frame)
    - Structured output paths (output/{project_id}/{moment_id}/{timestamp}/)

    Args:
        job_id: The unique identifier of the render job
        request: The render request with project_id and moment_id
    """
    import logging
    logger = logging.getLogger(__name__)

    job = render_jobs_store.get(job_id)
    if not job:
        return

    # Create progress tracker for WebSocket updates
    tracker = RenderProgressTracker(job_id=job_id)

    try:
        job.status = RenderJobStatus.PROCESSING
        job.current_phase = RenderProgressStage.LOADING.value
        job.message = "Loading project data..."
        job.updated_at = datetime.utcnow()

        await tracker.update_progress(
            stage=RenderProgressStage.LOADING.value,
            progress=0.0,
            message="Loading project and moment data...",
            current_step=1,
        )

        # Load project from storage (use same path as projects API)
        from models.project import Project, MomentData

        project_storage = JSONFileStorage(
            base_path="data/projects_api",
            model_class=Project,
            auto_create_dir=True,
        )

        try:
            project = project_storage.load(request.project_id)
        except EntityNotFoundError:
            raise ValueError(f"Project not found: {request.project_id}")

        # Find the moment by ID
        moment_data: MomentData | None = None
        for m in project.moments:
            if m.id == request.moment_id:
                moment_data = m
                break

        if not moment_data:
            raise ValueError(f"Moment not found: {request.moment_id}")

        # Get video path from project
        if not project.video_path:
            raise ValueError("Project has no video path configured")

        source_video_path = project.video_path

        job.progress = 10.0
        job.message = "Project loaded, preparing render..."
        job.updated_at = datetime.utcnow()

        await tracker.update_progress(
            stage=RenderProgressStage.LOADING.value,
            progress=10.0,
            message=f"Loaded moment: {moment_data.text[:50]}..." if moment_data.text else "Loaded moment",
            current_step=1,
        )

        # =================================================================
        # Extract subtitle words from project transcription
        # =================================================================
        subtitle_words = extract_subtitle_words(
            transcription=project.transcription,
            start_time=moment_data.start,
            end_time=moment_data.end,
        )

        if subtitle_words:
            logger.info(f"Extracted {len(subtitle_words)} words for subtitles")
        else:
            logger.info("No transcription words found for this moment")

        # =================================================================
        # Build subtitle config from moment_data (priority) or request
        # =================================================================
        subtitle_cfg = SubtitleConfig()
        if moment_data.subtitle_config:
            # Use moment-level subtitle config
            try:
                subtitle_cfg = SubtitleConfig(**moment_data.subtitle_config)
                logger.info("Using subtitle config from moment data")
            except Exception as e:
                logger.warning(f"Invalid moment subtitle_config, using defaults: {e}")
        elif request.subtitle_config:
            # Fall back to request-level config
            subtitle_cfg = SubtitleConfig(**request.subtitle_config)

        # Build audio config
        audio_cfg = AudioConfig()
        if request.audio_config:
            audio_cfg = AudioConfig(**request.audio_config)

        # =================================================================
        # Generate structured output path
        # =================================================================
        output_file_path = generate_output_path(
            project_id=request.project_id,
            moment_id=request.moment_id,
            filename=request.output_filename,
        )
        logger.info(f"Output path: {output_file_path}")

        # =================================================================
        # Get video info for composite calculations
        # =================================================================
        video_info = await render_service.get_video_info(source_video_path)
        video_width = video_info.width
        video_height = video_info.height
        logger.info(f"Source video: {video_width}x{video_height}")

        # =================================================================
        # Build CompositeRequest for multi-frame templates
        # =================================================================
        composite_request = None
        enable_composite = False
        crop_template = moment_data.crop_template or "1-frame"

        if crop_template in ("2-frame", "3-frame") and moment_data.crop_coordinates:
            composite_request = build_composite_request(
                source_video_path=source_video_path,
                crop_template=crop_template,
                crop_coordinates=moment_data.crop_coordinates,
                video_width=video_width,
                video_height=video_height,
                moment_start=moment_data.start,
                moment_end=moment_data.end,
                output_path=str(output_file_path),
            )
            if composite_request:
                enable_composite = True
                logger.info(f"Built composite request for {crop_template} template")

        # Convert MomentData to TranscriptionMoment for RenderService
        # segment_id is required - default to 0 since MomentData doesn't track segments
        render_moment = TranscriptionMoment(
            id=moment_data.id,
            start_time=moment_data.start,
            end_time=moment_data.end,
            text=moment_data.text,
            segment_id=0,
        )

        # =================================================================
        # Create render request with all configurations
        # =================================================================
        render_request = RenderRequest(
            moment=render_moment,
            source_video_path=source_video_path,
            subtitle_words=subtitle_words,
            subtitle_config=subtitle_cfg,
            audio_config=audio_cfg,
            output_filename=str(output_file_path),  # Pass full path for structured output
            enable_composite=enable_composite,
            composite_request=composite_request,
        )

        # Progress callback that updates job and broadcasts
        def on_render_progress(progress: RenderProgress) -> None:
            phase_map = {
                "extracting": RenderProgressStage.EXTRACTING.value,
                "compositing": RenderProgressStage.COMPOSITING.value,
                "subtitles": RenderProgressStage.SUBTITLES.value,
                "audio": RenderProgressStage.AUDIO.value,
                "complete": RenderProgressStage.FINALIZING.value,
            }
            stage = phase_map.get(progress.phase, progress.phase)

            # Map progress to overall percentage (10-90% for render phases)
            overall_progress = 10.0 + (progress.percent * 0.8)

            job.progress = overall_progress
            job.current_phase = stage
            job.message = progress.message
            job.updated_at = datetime.utcnow()

            # Use asyncio to broadcast
            asyncio.create_task(tracker.update_progress(
                stage=stage,
                progress=overall_progress,
                message=progress.message,
                current_step=progress.current_step + 1,
            ))

        # Execute render
        output_path = await render_service.render_final_clip(
            request=render_request,
            progress_callback=on_render_progress,
        )

        # Use the structured output path if render_service returned different path
        final_output_path = output_file_path if output_file_path.exists() else Path(output_path)

        # Update job as completed
        job.status = RenderJobStatus.COMPLETED
        job.progress = 100.0
        job.current_phase = RenderProgressStage.COMPLETED.value
        job.message = "Render completed successfully"
        job.output_path = str(final_output_path)
        job.updated_at = datetime.utcnow()

        # Save rendered_path back to the moment in project
        try:
            from models.project import ProjectUpdate
            # Update the moment's rendered_path
            for m in project.moments:
                if m.id == request.moment_id:
                    m.rendered_path = str(final_output_path)
                    break
            # Save updated project
            update = ProjectUpdate(moments=project.moments)
            updated_project = project.apply_update(update)
            project_storage.save(request.project_id, updated_project)
            logger.info(f"Saved rendered_path to moment {request.moment_id}")
        except Exception as save_err:
            logger.warning(f"Failed to save rendered_path to project: {save_err}")

        logger.info(f"Render completed for job {job_id}: {final_output_path}")

        await tracker.complete(str(final_output_path))

    except Exception as e:
        job.status = RenderJobStatus.FAILED
        job.current_phase = RenderProgressStage.FAILED.value
        job.message = str(e)
        job.error = str(e)
        job.updated_at = datetime.utcnow()

        logger.error(f"Render failed for job {job_id}: {e}")
        await tracker.fail(str(e))


@app.post(
    "/render",
    response_model=RenderEndpointResponse,
    status_code=202,
    summary="Submit render job",
    description="Submit a moment for rendering with optional subtitle and audio configuration",
    tags=["Render"],
)
async def create_render_job(
    background_tasks: BackgroundTasks,
    request: RenderEndpointRequest,
) -> RenderEndpointResponse:
    """
    Create a new render job for a moment.

    Accepts project_id and moment_id, loads the project data,
    and initiates background rendering with real-time progress via WebSocket.

    Returns a job ID for tracking the render progress.
    """
    job_id = str(uuid.uuid4())

    # Create job record
    job = RenderJob(
        job_id=job_id,
        project_id=request.project_id,
        moment_id=request.moment_id,
    )

    # Store job and start background processing
    render_jobs_store[job_id] = job
    background_tasks.add_task(process_render, job_id, request)

    return RenderEndpointResponse(
        job_id=job_id,
        status=RenderJobStatus.PENDING,
        message="Render job created successfully",
        websocket_url=f"/ws/render/{job_id}",
    )


@app.get(
    "/render/{job_id}",
    response_model=RenderJobStatusResponse,
    summary="Get render job status",
    description="Retrieve the status and result of a render job",
    tags=["Render"],
)
async def get_render_job_status(job_id: str) -> RenderJobStatusResponse:
    """
    Get the status of a render job.

    Args:
        job_id: The unique identifier of the render job

    Returns:
        Job status including progress and output path if completed
    """
    job = render_jobs_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Render job not found: {job_id}",
        )

    return RenderJobStatusResponse(
        job_id=job.job_id,
        project_id=job.project_id,
        moment_id=job.moment_id,
        status=job.status,
        progress=job.progress,
        current_phase=job.current_phase,
        message=job.message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        output_path=job.output_path,
        error=job.error,
    )


@app.get(
    "/render",
    response_model=list[RenderJobStatusResponse],
    summary="List render jobs",
    description="List all render jobs with optional status filter",
    tags=["Render"],
)
async def list_render_jobs(
    status: Optional[RenderJobStatus] = None,
    limit: int = 50,
) -> list[RenderJobStatusResponse]:
    """
    List all render jobs with optional status filter.

    Args:
        status: Filter by job status
        limit: Maximum number of jobs to return

    Returns:
        List of render job status responses
    """
    jobs = list(render_jobs_store.values())

    if status:
        jobs = [j for j in jobs if j.status == status]

    jobs = sorted(jobs, key=lambda x: x.created_at, reverse=True)[:limit]

    return [
        RenderJobStatusResponse(
            job_id=j.job_id,
            project_id=j.project_id,
            moment_id=j.moment_id,
            status=j.status,
            progress=j.progress,
            current_phase=j.current_phase,
            message=j.message,
            created_at=j.created_at,
            updated_at=j.updated_at,
            output_path=j.output_path,
            error=j.error,
        )
        for j in jobs
    ]


@app.delete(
    "/render/{job_id}",
    summary="Cancel/delete a render job",
    tags=["Render"],
)
async def delete_render_job(job_id: str) -> JSONResponse:
    """
    Cancel a pending render job or delete a completed/failed job.

    Args:
        job_id: The unique identifier of the render job

    Returns:
        Confirmation message
    """
    job = render_jobs_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Render job not found: {job_id}",
        )

    del render_jobs_store[job_id]

    return JSONResponse(
        status_code=200,
        content={"message": f"Render job {job_id} deleted successfully"},
    )


# ============================================================================
# WebSocket Endpoints
# ============================================================================


@app.websocket("/ws/render/{job_id}")
async def websocket_render_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for subscribing to render job progress updates.

    Args:
        websocket: The WebSocket connection
        job_id: The render job ID to subscribe to

    Messages sent to client:
        - Progress updates: {"type": "render_progress", "job_id": "...", "stage": "...", ...}
        - Ping messages: {"type": "ping", "timestamp": "..."}

    Messages accepted from client:
        - Pong responses: {"type": "pong"}
        - Ping requests: {"type": "ping"} (server responds with pong)
    """
    # Check if render job exists
    job = render_jobs_store.get(job_id)

    # Connect to the job's progress channel
    connected = await connection_manager.connect_to_job(websocket, job_id)
    if not connected:
        await websocket.close(code=1013, reason="Connection limit reached")
        return

    try:
        # Send initial status if job exists
        if job:
            initial_message = {
                "type": "initial_render_status",
                "job_id": job.job_id,
                "project_id": job.project_id,
                "moment_id": job.moment_id,
                "status": job.status.value,
                "progress": job.progress,
                "current_phase": job.current_phase,
                "message": job.message,
                "output_path": job.output_path,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            await websocket.send_json(initial_message)
        else:
            await websocket.send_json({
                "type": "waiting",
                "job_id": job_id,
                "message": "Waiting for render job to start...",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })

        # Handle incoming messages (ping/pong, etc.)
        await handle_websocket_messages(websocket)

    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(websocket)


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
    # Check transcription jobs store
    job = jobs_store.get(job_id)

    # Also check moments jobs store (from projects router)
    from routers.projects import moments_jobs_store
    moments_job = moments_jobs_store.get(job_id)

    # Connect to the job's progress channel
    connected = await connection_manager.connect_to_job(websocket, job_id)
    if not connected:
        await websocket.close(code=1013, reason="Connection limit reached")
        return

    try:
        # Send initial status if transcription job exists
        if job:
            # Map job status to stage for frontend consistency
            stage_map = {
                "pending": "starting",
                "processing": "transcribing",
                "completed": "completed",
                "failed": "failed",
            }
            stage = stage_map.get(job.status.value, "processing")
            initial_message = {
                "type": "progress",
                "job_id": job.job_id,
                "stage": stage,
                "progress": job.progress,
                "message": job.message if hasattr(job, 'message') else f"Processing...",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            await websocket.send_json(initial_message)
        # Send initial status if moments job exists
        elif moments_job:
            await websocket.send_json({
                "type": "moments_progress",
                "job_id": job_id,
                "stage": moments_job.get("status", "pending"),
                "progress": 0.0,
                "message": moments_job.get("message", "Starting AI analysis..."),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        else:
            # Job doesn't exist yet, send waiting message with progress format
            await websocket.send_json({
                "type": "progress",
                "job_id": job_id,
                "stage": "starting",
                "progress": 0.0,
                "message": "Initializing...",
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
