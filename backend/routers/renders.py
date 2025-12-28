"""
Renders API Router.

Provides REST API endpoints for render history management:
- GET /renders - List all renders
- GET /renders/{id} - Get single render details
- DELETE /renders/{id} - Delete render (file + record)
- GET /renders/{id}/stream - Stream video file
- GET /renders/{id}/download - Download video file
"""

import mimetypes
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import JSONResponse, StreamingResponse

from models.render import Render, RenderListResponse
from services.storage_service import (
    get_render_storage,
    RenderNotFoundError,
    RenderStorageError,
)


router = APIRouter(
    prefix="/renders",
    tags=["Renders"],
    responses={404: {"description": "Render not found"}},
)


@router.get(
    "",
    response_model=RenderListResponse,
    summary="List all renders",
    description="Get a list of all rendered clips sorted by creation date (newest first)",
)
async def list_renders(
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of renders to return"),
    offset: int = Query(default=0, ge=0, description="Number of renders to skip"),
) -> RenderListResponse:
    """
    List all renders with pagination.

    Returns renders sorted by created_at descending (most recent first).
    """
    storage = get_render_storage()
    all_renders = storage.list_all()

    # Apply pagination
    total = len(all_renders)
    paginated = all_renders[offset:offset + limit]

    return RenderListResponse(
        renders=paginated,
        total=total,
    )


@router.get(
    "/{render_id}",
    response_model=Render,
    summary="Get render details",
    description="Get detailed information about a specific render",
)
async def get_render(render_id: str) -> Render:
    """
    Get a single render by ID.

    Args:
        render_id: The unique render identifier

    Returns:
        Render details

    Raises:
        HTTPException: 404 if render not found
    """
    storage = get_render_storage()

    try:
        return storage.load(render_id)
    except RenderNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Render not found: {render_id}",
        )
    except RenderStorageError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load render: {str(e)}",
        )


@router.delete(
    "/{render_id}",
    summary="Delete render",
    description="Delete a render and optionally its video file",
)
async def delete_render(
    render_id: str,
    delete_file: bool = Query(default=True, description="Also delete the rendered video file"),
) -> JSONResponse:
    """
    Delete a render from storage.

    Args:
        render_id: The unique render identifier
        delete_file: If True, also delete the rendered video file

    Returns:
        Confirmation message

    Raises:
        HTTPException: 404 if render not found
    """
    storage = get_render_storage()

    try:
        storage.delete(render_id, delete_file=delete_file)
        return JSONResponse(
            status_code=200,
            content={
                "message": f"Render {render_id} deleted successfully",
                "file_deleted": delete_file,
            },
        )
    except RenderNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Render not found: {render_id}",
        )
    except RenderStorageError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete render: {str(e)}",
        )


@router.get(
    "/{render_id}/stream",
    summary="Stream render video",
    description="Stream the rendered video file with Range support for seeking",
)
async def stream_render(
    request: Request,
    render_id: str,
):
    """
    Stream a rendered video file with HTTP Range support.

    Args:
        request: FastAPI request object (for Range header)
        render_id: The unique render identifier

    Returns:
        StreamingResponse with Range support for video seeking

    Raises:
        HTTPException: 404 if render or file not found
    """
    storage = get_render_storage()

    try:
        render = storage.load(render_id)
    except RenderNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Render not found: {render_id}",
        )

    video_path = Path(render.file_path)

    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Rendered video file not found: {render.file_path}",
        )

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(str(video_path))
    if not mime_type:
        mime_type = "video/mp4"

    # Get file size
    file_size = video_path.stat().st_size

    # Parse Range header for partial content requests
    range_header = request.headers.get("range")

    # Encode filename for HTTP headers
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

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}",
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

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}",
    }

    return StreamingResponse(
        stream_full(),
        media_type=mime_type,
        headers=headers,
    )


@router.get(
    "/{render_id}/download",
    summary="Download render video",
    description="Download the rendered video file as attachment",
)
async def download_render(
    request: Request,
    render_id: str,
):
    """
    Download a rendered video file as attachment.

    Args:
        request: FastAPI request object
        render_id: The unique render identifier

    Returns:
        StreamingResponse with Content-Disposition: attachment

    Raises:
        HTTPException: 404 if render or file not found
    """
    storage = get_render_storage()

    try:
        render = storage.load(render_id)
    except RenderNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Render not found: {render_id}",
        )

    video_path = Path(render.file_path)

    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Rendered video file not found: {render.file_path}",
        )

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(str(video_path))
    if not mime_type:
        mime_type = "video/mp4"

    # Get file size
    file_size = video_path.stat().st_size

    # Encode filename for HTTP headers
    from urllib.parse import quote
    encoded_filename = quote(video_path.name)

    async def stream_file():
        async with aiofiles.open(video_path, "rb") as f:
            chunk_size = 1024 * 1024  # 1MB chunks
            while chunk := await f.read(chunk_size):
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
    }

    return StreamingResponse(
        stream_file(),
        media_type=mime_type,
        headers=headers,
    )
