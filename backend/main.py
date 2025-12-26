"""
FastAPI Backend for Video Transcription Service

This module provides a REST API for video transcription with:
- Async file upload handling
- Job queue pattern for background processing
- Proper error handling and CORS support
"""

import asyncio
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


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
    result: Optional[str] = None
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

    This is a placeholder that simulates transcription processing.
    Replace with actual transcription logic (e.g., Whisper, AssemblyAI).

    Args:
        job_id: The unique identifier of the transcription job
    """
    job = jobs_store.get(job_id)
    if not job:
        return

    try:
        job.status = JobStatus.PROCESSING
        job.updated_at = datetime.utcnow()

        # Simulate transcription progress
        # Replace this with actual transcription implementation
        for progress in range(0, 101, 10):
            await asyncio.sleep(0.5)  # Simulate processing time
            job.progress = float(progress)
            job.updated_at = datetime.utcnow()

        # Placeholder result
        job.result = f"[Transcription placeholder for {job.file_name or job.file_path}]\n\nReplace this with actual Whisper/transcription output."
        job.status = JobStatus.COMPLETED
        job.progress = 100.0

    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
    finally:
        job.updated_at = datetime.utcnow()


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
