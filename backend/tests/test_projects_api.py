"""
Comprehensive tests for the Projects API endpoints.

Tests cover:
- GET /projects - List all projects
- GET /projects/{id} - Get project by ID
- POST /projects - Create new project
- PUT /projects/{id} - Update existing project
- DELETE /projects/{id} - Delete project
"""

import pytest
import shutil
from pathlib import Path
from fastapi.testclient import TestClient

# Import the FastAPI app
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from routers.projects import get_project_storage


# Test client
client = TestClient(app)

# Test data directory
TEST_DATA_DIR = Path("data/projects_api_test")


@pytest.fixture(autouse=True)
def setup_and_teardown():
    """Setup and teardown test data directory for each test."""
    from routers import projects

    # Reset storage singleton to ensure fresh state
    projects._project_storage = None

    # Get the actual storage path used by the router
    storage = projects.get_project_storage()
    storage_path = storage.base_path

    # Clear all existing projects for test isolation
    for project_file in storage_path.glob("*.json"):
        project_file.unlink()

    yield

    # Teardown: Reset singleton and clean up
    projects._project_storage = None


class TestListProjects:
    """Tests for GET /projects endpoint."""

    def test_list_projects_empty(self):
        """Test listing projects when no projects exist."""
        response = client.get("/projects")
        assert response.status_code == 200
        data = response.json()
        assert data["projects"] == []
        assert data["total"] == 0

    def test_list_projects_with_data(self):
        """Test listing projects after creating some."""
        # Create multiple projects
        projects_to_create = [
            {"name": "Project 1", "description": "First project"},
            {"name": "Project 2", "description": "Second project"},
            {"name": "Project 3", "description": "Third project"},
        ]

        for project in projects_to_create:
            client.post("/projects", json=project)

        response = client.get("/projects")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["projects"]) == 3


class TestGetProject:
    """Tests for GET /projects/{id} endpoint."""

    def test_get_project_success(self):
        """Test getting a project by ID."""
        # Create a project first
        create_response = client.post(
            "/projects",
            json={"name": "Test Project", "description": "Test description"}
        )
        created = create_response.json()
        project_id = created["id"]

        # Get the project
        response = client.get(f"/projects/{project_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == "Test Project"
        assert data["description"] == "Test description"

    def test_get_project_not_found(self):
        """Test getting a non-existent project."""
        response = client.get("/projects/non-existent-id")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_project_with_all_fields(self):
        """Test getting a project with all fields populated."""
        project_data = {
            "name": "Full Project",
            "description": "A complete project",
            "video_path": "/path/to/video.mp4",
            "tags": ["tag1", "tag2"],
            "metadata": {"key": "value", "nested": {"a": 1}}
        }
        create_response = client.post("/projects", json=project_data)
        created = create_response.json()

        response = client.get(f"/projects/{created['id']}")
        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Full Project"
        assert data["description"] == "A complete project"
        assert data["video_path"] == "/path/to/video.mp4"
        assert data["tags"] == ["tag1", "tag2"]
        assert data["metadata"] == {"key": "value", "nested": {"a": 1}}
        assert "created_at" in data
        assert "updated_at" in data


class TestCreateProject:
    """Tests for POST /projects endpoint."""

    def test_create_project_minimal(self):
        """Test creating a project with minimal data."""
        response = client.post(
            "/projects",
            json={"name": "Minimal Project"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Project"
        assert data["description"] is None
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_project_full(self):
        """Test creating a project with all fields."""
        project_data = {
            "name": "Full Project",
            "description": "A complete project with all fields",
            "video_path": "/videos/sample.mp4",
            "tags": ["tutorial", "demo"],
            "metadata": {"duration": 3600, "format": "mp4"}
        }
        response = client.post("/projects", json=project_data)
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == "Full Project"
        assert data["description"] == "A complete project with all fields"
        assert data["video_path"] == "/videos/sample.mp4"
        assert data["tags"] == ["tutorial", "demo"]
        assert data["metadata"]["duration"] == 3600

    def test_create_project_invalid_empty_name(self):
        """Test creating a project with empty name fails."""
        response = client.post(
            "/projects",
            json={"name": ""}
        )
        assert response.status_code == 422  # Validation error

    def test_create_project_missing_name(self):
        """Test creating a project without name fails."""
        response = client.post(
            "/projects",
            json={"description": "No name provided"}
        )
        assert response.status_code == 422  # Validation error

    def test_create_project_generates_unique_id(self):
        """Test that each created project has a unique ID."""
        ids = set()
        for i in range(5):
            response = client.post(
                "/projects",
                json={"name": f"Project {i}"}
            )
            assert response.status_code == 201
            ids.add(response.json()["id"])

        assert len(ids) == 5  # All IDs should be unique


class TestUpdateProject:
    """Tests for PUT /projects/{id} endpoint."""

    def test_update_project_name(self):
        """Test updating only the project name."""
        # Create project
        create_response = client.post(
            "/projects",
            json={"name": "Original Name", "description": "Original description"}
        )
        project_id = create_response.json()["id"]

        # Update name only
        response = client.put(
            f"/projects/{project_id}",
            json={"name": "Updated Name"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Original description"  # Unchanged

    def test_update_project_description(self):
        """Test updating the description."""
        create_response = client.post(
            "/projects",
            json={"name": "Test", "description": "Original"}
        )
        project_id = create_response.json()["id"]

        response = client.put(
            f"/projects/{project_id}",
            json={"description": "Updated description"}
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Updated description"

    def test_update_project_multiple_fields(self):
        """Test updating multiple fields at once."""
        create_response = client.post(
            "/projects",
            json={"name": "Original", "description": "Original desc"}
        )
        project_id = create_response.json()["id"]

        response = client.put(
            f"/projects/{project_id}",
            json={
                "name": "Updated Name",
                "description": "Updated desc",
                "tags": ["new-tag"],
                "video_path": "/new/path.mp4"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated desc"
        assert data["tags"] == ["new-tag"]
        assert data["video_path"] == "/new/path.mp4"

    def test_update_project_not_found(self):
        """Test updating a non-existent project."""
        response = client.put(
            "/projects/non-existent-id",
            json={"name": "Updated"}
        )
        assert response.status_code == 404

    def test_update_project_updates_timestamp(self):
        """Test that updated_at timestamp changes on update."""
        create_response = client.post(
            "/projects",
            json={"name": "Test"}
        )
        created = create_response.json()
        original_updated_at = created["updated_at"]

        # Small delay to ensure timestamp difference
        import time
        time.sleep(0.1)

        response = client.put(
            f"/projects/{created['id']}",
            json={"name": "Updated"}
        )
        updated = response.json()
        assert updated["updated_at"] != original_updated_at

    def test_update_project_empty_body(self):
        """Test update with empty body (no changes)."""
        create_response = client.post(
            "/projects",
            json={"name": "Test", "description": "Original"}
        )
        project_id = create_response.json()["id"]

        response = client.put(
            f"/projects/{project_id}",
            json={}
        )
        assert response.status_code == 200
        # Project should remain unchanged (except updated_at)
        data = response.json()
        assert data["name"] == "Test"
        assert data["description"] == "Original"


class TestDeleteProject:
    """Tests for DELETE /projects/{id} endpoint."""

    def test_delete_project_success(self):
        """Test successfully deleting a project."""
        # Create project
        create_response = client.post(
            "/projects",
            json={"name": "To Delete"}
        )
        project_id = create_response.json()["id"]

        # Verify it exists
        get_response = client.get(f"/projects/{project_id}")
        assert get_response.status_code == 200

        # Delete it
        delete_response = client.delete(f"/projects/{project_id}")
        assert delete_response.status_code == 204

        # Verify it's gone
        get_after_delete = client.get(f"/projects/{project_id}")
        assert get_after_delete.status_code == 404

    def test_delete_project_not_found(self):
        """Test deleting a non-existent project."""
        response = client.delete("/projects/non-existent-id")
        assert response.status_code == 404

    def test_delete_project_removes_from_list(self):
        """Test that deleted project is removed from list."""
        # Create multiple projects
        ids = []
        for i in range(3):
            response = client.post(
                "/projects",
                json={"name": f"Project {i}"}
            )
            ids.append(response.json()["id"])

        # Verify all exist
        list_response = client.get("/projects")
        assert list_response.json()["total"] == 3

        # Delete middle one
        client.delete(f"/projects/{ids[1]}")

        # Verify count decreased
        list_after = client.get("/projects")
        assert list_after.json()["total"] == 2

        # Verify correct ones remain
        remaining_ids = [p["id"] for p in list_after.json()["projects"]]
        assert ids[0] in remaining_ids
        assert ids[1] not in remaining_ids
        assert ids[2] in remaining_ids


class TestEdgeCases:
    """Tests for edge cases and special scenarios."""

    def test_special_characters_in_name(self):
        """Test project name with special characters."""
        response = client.post(
            "/projects",
            json={"name": "Project with 'quotes' and \"double quotes\""}
        )
        assert response.status_code == 201
        assert "quotes" in response.json()["name"]

    def test_unicode_in_name(self):
        """Test project name with unicode characters."""
        response = client.post(
            "/projects",
            json={"name": "项目名称 Projekt"}
        )
        assert response.status_code == 201
        assert response.json()["name"] == "项目名称 Projekt"

    def test_long_description(self):
        """Test project with long description."""
        long_desc = "A" * 2000
        response = client.post(
            "/projects",
            json={"name": "Long Desc", "description": long_desc}
        )
        assert response.status_code == 201
        assert len(response.json()["description"]) == 2000

    def test_nested_metadata(self):
        """Test project with deeply nested metadata."""
        nested = {"level1": {"level2": {"level3": {"value": 42}}}}
        response = client.post(
            "/projects",
            json={"name": "Nested", "metadata": nested}
        )
        assert response.status_code == 201
        assert response.json()["metadata"]["level1"]["level2"]["level3"]["value"] == 42

    def test_empty_tags_list(self):
        """Test project with empty tags list."""
        response = client.post(
            "/projects",
            json={"name": "No Tags", "tags": []}
        )
        assert response.status_code == 201
        assert response.json()["tags"] == []

    def test_many_tags(self):
        """Test project with many tags."""
        many_tags = [f"tag{i}" for i in range(50)]
        response = client.post(
            "/projects",
            json={"name": "Many Tags", "tags": many_tags}
        )
        assert response.status_code == 201
        assert len(response.json()["tags"]) == 50
