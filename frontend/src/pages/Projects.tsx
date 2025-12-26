import { useState } from 'react';

interface Project {
  id: string;
  name: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'error';
  clipCount: number;
}

const Projects = () => {
  const [projects] = useState<Project[]>([]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Projects</h1>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
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
        </button>
      </div>

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
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-gray-600 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-medium text-white truncate">
                  {project.name}
                </h3>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    project.status === 'completed'
                      ? 'bg-green-900 text-green-300'
                      : project.status === 'processing'
                      ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-red-900 text-red-300'
                  }`}
                >
                  {project.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{project.clipCount} clips</span>
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
