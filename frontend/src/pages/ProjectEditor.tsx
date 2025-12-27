import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../components/ProjectCard';
import VideoFilePicker from '../components/VideoFilePicker';
import VideoPlayer from '../components/VideoPlayer';
import type { VideoFileMetadata } from '../services/api';

const API_BASE = '';

const ProjectEditor = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Project not found');
          }
          throw new Error(`Failed to fetch project: ${response.statusText}`);
        }

        const data: Project = await response.json();
        setProject(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  const handleBack = () => {
    navigate('/projects');
  };

  const handleVideoSelect = useCallback(async (video: VideoFileMetadata) => {
    if (!projectId || !project) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_path: video.full_path,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.statusText}`);
      }

      const updatedProject: Project = await response.json();
      setProject(updatedProject);
      setShowVideoPicker(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save video selection';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [projectId, project]);

  const handleClearVideo = useCallback(async () => {
    if (!projectId || !project) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_path: null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.statusText}`);
      }

      const updatedProject: Project = await response.json();
      setProject(updatedProject);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear video';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [projectId, project]);

  /**
   * Convert local file path to a URL that the video player can load.
   * The backend serves video files via the /video-stream endpoint.
   */
  const getVideoUrl = (videoPath: string): string => {
    // Encode the path for URL safety
    const encodedPath = encodeURIComponent(videoPath);
    return `${API_BASE}/video-stream?path=${encodedPath}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
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
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          aria-label="Back to projects"
        >
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-gray-400 text-sm">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Project details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Video Source
            </h2>
            {project.video_path && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowVideoPicker(true)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={handleClearVideo}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {showVideoPicker ? (
            <VideoFilePicker
              selectedPath={project.video_path}
              onSelect={handleVideoSelect}
              onCancel={() => setShowVideoPicker(false)}
            />
          ) : project.video_path ? (
            <div>
              {/* Video Player */}
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden mb-3">
                <VideoPlayer
                  url={getVideoUrl(project.video_path)}
                  className="w-full h-full"
                />
              </div>
              {/* Video path info */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
                <span className="truncate" title={project.video_path}>
                  {project.video_path.split('/').pop()}
                </span>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg
                  className="w-16 h-16 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
                <p className="mb-4">No video attached</p>
                <button
                  onClick={() => setShowVideoPicker(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  Select Video
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project info */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Details</h3>

            {project.description && (
              <div className="mb-4">
                <label className="text-sm text-gray-500">Description</label>
                <p className="text-gray-300">{project.description}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm text-gray-500">Last Updated</label>
              <p className="text-gray-300">
                {new Date(project.updated_at).toLocaleString()}
              </p>
            </div>

            {project.tags.length > 0 && (
              <div>
                <label className="text-sm text-gray-500">Tags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowVideoPicker(true)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {project.video_path ? 'Change Video' : 'Select Video'}
              </button>
              <button className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-4">
            <svg
              className="w-6 h-6 text-blue-500 animate-spin"
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
            <span className="text-white">Saving...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectEditor;
