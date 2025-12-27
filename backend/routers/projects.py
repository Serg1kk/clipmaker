"""
Projects API Router - FastAPI endpoints for project CRUD operations.

Provides REST API endpoints for:
- GET /projects - List all projects
- GET /projects/{id} - Get project by ID
- POST /projects - Create new project
- PUT /projects/{id} - Update existing project
- DELETE /projects/{id} - Delete project
- POST /projects/{id}/moments/find - Find AI moments in transcription

Uses JSONFileStorage for persistence to data/projects folder.
"""

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from models.project import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    ProjectListResponse,
    MomentData,
)
from services.json_storage import (
    JSONFileStorage,
    EntityNotFoundError,
    StorageError,
)
from services.engaging_moments import find_engaging_moments_async
from services.websocket_service import connection_manager, ProgressMessage

logger = logging.getLogger(__name__)


# Initialize router
router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
    responses={
        404: {"description": "Project not found"},
        500: {"description": "Internal server error"},
    },
)

# Initialize storage for projects
_project_storage: JSONFileStorage[Project] | None = None


def get_project_storage() -> JSONFileStorage[Project]:
    """Get or create the project storage instance."""
    global _project_storage
    if _project_storage is None:
        _project_storage = JSONFileStorage(
            base_path="data/projects_api",
            model_class=Project,
            auto_create_dir=True,
        )
    return _project_storage


# =============================================================================
# GET /projects - List all projects
# =============================================================================


@router.get(
    "",
    response_model=ProjectListResponse,
    summary="List all projects",
    description="Retrieve a list of all projects in the system",
)
async def list_projects() -> ProjectListResponse:
    """
    List all projects.

    Returns:
        ProjectListResponse with list of all projects and total count
    """
    storage = get_project_storage()

    try:
        projects = storage.list_all()
        return ProjectListResponse(
            projects=projects,
            total=len(projects),
        )
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list projects: {str(e)}",
        )


# =============================================================================
# GET /projects/{project_id} - Get project by ID
# =============================================================================


@router.get(
    "/{project_id}",
    response_model=Project,
    summary="Get project by ID",
    description="Retrieve a specific project by its unique identifier",
)
async def get_project(project_id: str) -> Project:
    """
    Get a project by ID.

    Args:
        project_id: The unique project identifier

    Returns:
        The requested Project

    Raises:
        HTTPException: 404 if project not found
    """
    storage = get_project_storage()

    try:
        return storage.load(project_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load project: {str(e)}",
        )


# =============================================================================
# POST /projects - Create new project
# =============================================================================


@router.post(
    "",
    response_model=Project,
    status_code=status.HTTP_201_CREATED,
    summary="Create new project",
    description="Create a new project with the provided data",
)
async def create_project(project_data: ProjectCreate) -> Project:
    """
    Create a new project.

    Args:
        project_data: Project creation data

    Returns:
        The created Project with generated ID and timestamps
    """
    storage = get_project_storage()

    # Create project instance with generated ID and timestamps
    project = Project(**project_data.model_dump())

    try:
        storage.save(project.id, project)
        return project
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}",
        )


# =============================================================================
# PUT /projects/{project_id} - Update existing project
# =============================================================================


@router.put(
    "/{project_id}",
    response_model=Project,
    summary="Update project",
    description="Update an existing project with partial or full data",
)
async def update_project(project_id: str, update_data: ProjectUpdate) -> Project:
    """
    Update an existing project.

    Supports partial updates - only provided fields will be updated.

    Args:
        project_id: The unique project identifier
        update_data: Fields to update

    Returns:
        The updated Project

    Raises:
        HTTPException: 404 if project not found
    """
    storage = get_project_storage()

    try:
        # Load existing project
        existing_project = storage.load(project_id)

        # Apply updates
        updated_project = existing_project.apply_update(update_data)

        # Save updated project
        storage.save(project_id, updated_project)

        return updated_project

    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project: {str(e)}",
        )


# =============================================================================
# DELETE /projects/{project_id} - Delete project
# =============================================================================


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete project",
    description="Delete a project by its unique identifier",
)
async def delete_project(project_id: str) -> None:
    """
    Delete a project.

    Args:
        project_id: The unique project identifier

    Raises:
        HTTPException: 404 if project not found
    """
    storage = get_project_storage()

    try:
        storage.delete(project_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}",
        )


# =============================================================================
# POST /projects/{project_id}/moments/find - Find AI moments
# =============================================================================


class FindMomentsRequest(BaseModel):
    """Request model for finding moments."""
    min_duration: float = Field(default=13.0, ge=5.0, description="Minimum moment duration")
    max_duration: float = Field(default=60.0, le=120.0, description="Maximum moment duration")


class FindMomentsResponse(BaseModel):
    """Response model for moments job creation."""
    job_id: str
    status: str
    message: str
    websocket_url: str


# In-memory moments job store
moments_jobs_store: dict[str, dict] = {}


async def process_find_moments(
    job_id: str,
    project_id: str,
    min_duration: float,
    max_duration: float,
) -> None:
    """
    Background task to find engaging moments in a project's transcription.
    """
    storage = get_project_storage()

    try:
        # Update job status
        moments_jobs_store[job_id]["status"] = "processing"
        moments_jobs_store[job_id]["message"] = "Loading transcription..."

        # Broadcast initial progress
        await connection_manager.broadcast_to_job(job_id, ProgressMessage(
            type="moments_progress",
            job_id=job_id,
            stage="loading",
            progress=5.0,
            message="Loading transcription data...",
        ))

        # Load project
        project = storage.load(project_id)

        if not project.transcription:
            raise ValueError("Project has no transcription. Transcribe the video first.")

        # Convert transcription to format expected by find_engaging_moments
        transcript_json = {
            "text": project.transcription.text,
            "segments": [
                {
                    "id": seg.id,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "words": seg.words,
                }
                for seg in project.transcription.segments
            ],
            "language": project.transcription.language,
            "duration": project.transcription.duration,
        }

        await connection_manager.broadcast_to_job(job_id, ProgressMessage(
            type="moments_progress",
            job_id=job_id,
            stage="analyzing",
            progress=20.0,
            message="Analyzing transcript with AI...",
        ))

        # Find engaging moments using Gemini
        moments = await find_engaging_moments_async(
            transcript_json,
            min_duration=min_duration,
            max_duration=max_duration,
        )

        await connection_manager.broadcast_to_job(job_id, ProgressMessage(
            type="moments_progress",
            job_id=job_id,
            stage="processing",
            progress=80.0,
            message=f"Found {len(moments)} engaging moments...",
        ))

        # Convert to MomentData and save to project
        moment_data_list = [
            MomentData(
                id=f"moment-{i+1}-{str(uuid.uuid4())[:8]}",
                start=m.start,
                end=m.end,
                reason=m.reason,
                text=m.text,
                confidence=m.confidence,
            )
            for i, m in enumerate(moments)
        ]

        # Update project with moments
        update = ProjectUpdate(moments=moment_data_list)
        updated_project = project.apply_update(update)
        storage.save(project_id, updated_project)

        # Update job as completed
        moments_jobs_store[job_id]["status"] = "completed"
        moments_jobs_store[job_id]["message"] = f"Found {len(moments)} moments"
        moments_jobs_store[job_id]["moments_count"] = len(moments)

        await connection_manager.broadcast_to_job(job_id, ProgressMessage(
            type="moments_progress",
            job_id=job_id,
            stage="completed",
            progress=100.0,
            message=f"Complete! Found {len(moments)} engaging moments.",
            details={"moments_count": len(moments)},
        ))

        logger.info(f"Found {len(moments)} moments for project {project_id}")

    except EntityNotFoundError:
        moments_jobs_store[job_id]["status"] = "failed"
        moments_jobs_store[job_id]["error"] = f"Project not found: {project_id}"
        await connection_manager.broadcast_to_job(job_id, ProgressMessage(
            type="moments_progress",
            job_id=job_id,
            stage="failed",
            progress=0.0,
            message=f"Error: Project not found",
        ))
    except Exception as e:
        logger.error(f"Failed to find moments: {e}")
        moments_jobs_store[job_id]["status"] = "failed"
        moments_jobs_store[job_id]["error"] = str(e)
        await connection_manager.broadcast_to_job(job_id, ProgressMessage(
            type="moments_progress",
            job_id=job_id,
            stage="failed",
            progress=0.0,
            message=f"Error: {str(e)}",
        ))


@router.post(
    "/{project_id}/moments/find",
    response_model=FindMomentsResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Find engaging moments",
    description="Analyze project transcription to find engaging moments using AI",
)
async def find_moments(
    project_id: str,
    background_tasks: BackgroundTasks,
    request: FindMomentsRequest = FindMomentsRequest(),
) -> FindMomentsResponse:
    """
    Start a background task to find engaging moments in the project's transcription.

    Requires the project to have a transcription. Returns a job ID for tracking progress
    via WebSocket at /ws/job/{job_id}.
    """
    storage = get_project_storage()

    # Validate project exists and has transcription
    try:
        project = storage.load(project_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )

    if not project.transcription:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no transcription. Transcribe the video first.",
        )

    # Create job
    job_id = str(uuid.uuid4())
    moments_jobs_store[job_id] = {
        "job_id": job_id,
        "project_id": project_id,
        "status": "pending",
        "message": "Starting AI analysis...",
    }

    # Start background task
    background_tasks.add_task(
        process_find_moments,
        job_id,
        project_id,
        request.min_duration,
        request.max_duration,
    )

    return FindMomentsResponse(
        job_id=job_id,
        status="pending",
        message="AI moment detection started",
        websocket_url=f"/ws/job/{job_id}",
    )


@router.get(
    "/{project_id}/moments/find/{job_id}",
    summary="Get moments job status",
    description="Get the status of a find moments job",
)
async def get_moments_job_status(project_id: str, job_id: str) -> dict:
    """Get the status of a find moments job."""
    job = moments_jobs_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}",
        )
    return job


@router.put(
    "/{project_id}/moments/{moment_id}",
    response_model=Project,
    summary="Update a moment",
    description="Update crop coordinates and subtitle settings for a specific moment",
)
async def update_moment(
    project_id: str,
    moment_id: str,
    update_data: dict,
) -> Project:
    """
    Update a specific moment's crop coordinates or subtitle settings.
    """
    storage = get_project_storage()

    try:
        project = storage.load(project_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found: {project_id}",
        )

    # Find and update the moment
    moment_found = False
    updated_moments = []
    for moment in project.moments:
        if moment.id == moment_id:
            moment_found = True
            # Update allowed fields
            if "crop_template" in update_data:
                moment.crop_template = update_data["crop_template"]
            if "crop_coordinates" in update_data:
                moment.crop_coordinates = update_data["crop_coordinates"]
            if "subtitle_config" in update_data:
                moment.subtitle_config = update_data["subtitle_config"]
            if "rendered_path" in update_data:
                moment.rendered_path = update_data["rendered_path"]
        updated_moments.append(moment)

    if not moment_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Moment not found: {moment_id}",
        )

    # Save updated project
    update = ProjectUpdate(moments=updated_moments)
    updated_project = project.apply_update(update)
    storage.save(project_id, updated_project)

    return updated_project
