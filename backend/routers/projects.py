"""
Projects API Router - FastAPI endpoints for project CRUD operations.

Provides REST API endpoints for:
- GET /projects - List all projects
- GET /projects/{id} - Get project by ID
- POST /projects - Create new project
- PUT /projects/{id} - Update existing project
- DELETE /projects/{id} - Delete project

Uses JSONFileStorage for persistence to data/projects folder.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from models.project import (
    Project,
    ProjectCreate,
    ProjectUpdate,
    ProjectListResponse,
)
from services.json_storage import (
    JSONFileStorage,
    EntityNotFoundError,
    StorageError,
)


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
