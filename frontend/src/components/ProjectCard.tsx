import { useState } from 'react';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  video_path: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
  onDelete: (project: Project) => void;
}

/**
 * Extracts the video filename from a full path
 */
const getVideoName = (videoPath: string | null): string => {
  if (!videoPath) return 'No video';
  const parts = videoPath.split('/');
  return parts[parts.length - 1] || 'Unknown video';
};

/**
 * Formats a date string to a readable format
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const ProjectCard = ({ project, onClick, onDelete }: ProjectCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(project);
  };

  const videoName = getVideoName(project.video_path);
  const createdDate = formatDate(project.created_at);

  return (
    <div
      className="relative bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition-all cursor-pointer group"
      onClick={() => onClick(project)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete button - appears on hover */}
      <button
        onClick={handleDelete}
        className={`absolute top-3 right-3 p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-all ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Delete project"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      {/* Video icon */}
      <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Project name */}
      <h3 className="text-lg font-semibold text-white mb-2 truncate pr-8">
        {project.name}
      </h3>

      {/* Video source name */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
        <span className="truncate" title={videoName}>
          {videoName}
        </span>
      </div>

      {/* Date created */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span>{createdDate}</span>
      </div>

      {/* Tags (if any) */}
      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {project.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
          {project.tags.length > 3 && (
            <span className="px-2 py-0.5 text-gray-500 text-xs">
              +{project.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Hover indicator */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg
          className="w-5 h-5 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </div>
  );
};

export default ProjectCard;
