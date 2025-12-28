import { useState } from 'react';
import type { Render } from '../hooks/useRenders';

interface RenderCardProps {
  render: Render;
  onView: (render: Render) => void;
  onDownload: (render: Render) => void;
  onDelete: (render: Render) => void;
}

/**
 * Formats a date string to a readable format with time
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats duration in seconds to mm:ss format
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const RenderCard = ({ render, onView, onDownload, onDelete }: RenderCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(render);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload(render);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(render);
  };

  const createdDate = formatDate(render.created_at);
  const duration = formatDuration(render.duration_seconds);

  return (
    <div
      className="relative bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition-all cursor-pointer group"
      onClick={() => onView(render)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Action buttons - appear on hover */}
      <div
        className={`absolute top-3 right-3 flex gap-2 transition-all ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* View button */}
        <button
          onClick={handleView}
          className="p-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-all"
          aria-label="View render"
          title="View"
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
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </button>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="p-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-white transition-all"
          aria-label="Download render"
          title="Download"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-all"
          aria-label="Delete render"
          title="Delete"
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
      </div>

      {/* Video icon with duration badge */}
      <div className="relative w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {/* Duration badge */}
        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded font-medium">
          {duration}
        </span>
      </div>

      {/* Project name */}
      <h3 className="text-lg font-semibold text-white mb-1 truncate pr-24">
        {render.project_name}
      </h3>

      {/* Moment reason */}
      {render.moment_reason && (
        <p className="text-sm text-gray-400 mb-2 line-clamp-2" title={render.moment_reason}>
          {render.moment_reason}
        </p>
      )}

      {/* File size and crop template */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
        {/* File size */}
        <div className="flex items-center gap-1">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>{render.file_size_formatted}</span>
        </div>

        {/* Crop template */}
        <div className="flex items-center gap-1">
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
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
          <span>{render.crop_template}</span>
        </div>
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
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    </div>
  );
};

export default RenderCard;
