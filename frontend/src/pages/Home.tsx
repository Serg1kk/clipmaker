import { useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import { useProjects } from '../hooks/useProjects';
import type { Project } from '../components/ProjectCard';

const Home = () => {
  const navigate = useNavigate();
  const { projects, loading, error, refetch, createProject, creating } = useProjects();

  // Sort projects by updated_at (most recent first) and take top 8
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);

  const handleProjectClick = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleNewProject = async () => {
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
      navigate(`/projects/${newProject.id}`);
    }
  };

  // Dummy delete handler (not used on home but required by ProjectCard)
  const handleDeleteClick = () => {
    // Navigate to projects page for deletion
    navigate('/projects');
  };

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Recent Projects
          </h1>
          <p className="text-gray-400">
            Continue working on your video projects
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
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
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </>
            )}
          </button>

          <button
            onClick={refetch}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden animate-pulse">
              <div className="p-6">
                <div className="w-12 h-12 bg-gray-700 rounded-lg mb-4" />
                <div className="h-5 bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <svg
            className="w-16 h-16 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            Failed to load projects
          </h3>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={refetch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && projects.length === 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
      )}

      {/* Recent projects grid */}
      {!loading && !error && recentProjects.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={handleProjectClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>

          {/* View all projects link */}
          {projects.length > 8 && (
            <div className="mt-8 text-center">
              <button
                onClick={() => navigate('/projects')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all {projects.length} projects →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
