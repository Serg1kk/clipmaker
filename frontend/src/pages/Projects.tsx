import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useProjects } from '../hooks/useProjects';
import type { Project } from '../components/ProjectCard';

const Projects = () => {
  const navigate = useNavigate();
  const { projects, loading, creating, error, refetch, createProject, deleteProject } = useProjects();

  // Delete modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create error state (separate from loading error)
  const [createError, setCreateError] = useState<string | null>(null);

  const handleProjectClick = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    const success = await deleteProject(projectToDelete.id);
    setIsDeleting(false);

    if (success) {
      setProjectToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setProjectToDelete(null);
    }
  };

  const handleNewProject = async () => {
    setCreateError(null);

    // Generate a default project name with timestamp
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const defaultName = `New Project - ${timestamp}`;

    const newProject = await createProject({
      name: defaultName,
      description: '',
      tags: [],
    });

    if (newProject) {
      // Navigate to the new project's editor page
      navigate(`/projects/${newProject.id}`);
    } else {
      setCreateError('Failed to create project. Please try again.');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Projects</h1>
        </div>

        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <svg
              className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-gray-400">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Projects</h1>
        </div>

        <div className="bg-red-900/30 border border-red-700 rounded-lg p-8 text-center">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-xl font-medium text-white mb-2">
            Failed to load projects
          </h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Projects</h1>

        <button
          onClick={handleNewProject}
          disabled={creating}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            creating
              ? 'bg-blue-600/50 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          {creating ? (
            <>
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Project
            </>
          )}
        </button>
      </div>

      {/* Create error notification */}
      {createError && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-200">{createError}</span>
          </div>
          <button
            onClick={() => setCreateError(null)}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Sort projects by created_at (newest first) */}
      {projects.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            No projects yet
          </h3>
          <p className="text-gray-500 mb-6">
            Create your first project to start transcribing videos and generating clips.
          </p>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className={`px-6 py-2 rounded-lg transition-colors ${
              creating
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...projects]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={handleProjectClick}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={projectToDelete !== null}
        projectName={projectToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Projects;
