import { useState, useEffect, useCallback } from 'react';
import { fetchVideoFiles, VideoFileMetadata } from '../services/api';

interface VideoFilePickerProps {
  selectedPath: string | null;
  onSelect: (videoFile: VideoFileMetadata) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * VideoFilePicker component for selecting videos from the /videos folder.
 *
 * Fetches available videos from the /files API and displays them
 * in a grid for selection.
 */
const VideoFilePicker = ({
  selectedPath,
  onSelect,
  onCancel,
  className = '',
}: VideoFilePickerProps) => {
  const [videos, setVideos] = useState<VideoFileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoFileMetadata | null>(null);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchVideoFiles(true);

      if (response.error) {
        setError(response.error);
      } else {
        setVideos(response.files);

        // Pre-select if there's a matching path
        if (selectedPath) {
          const match = response.files.find(
            (f) => f.full_path === selectedPath || f.path === selectedPath
          );
          if (match) {
            setSelectedVideo(match);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load videos';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedPath]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleSelect = (video: VideoFileMetadata) => {
    setSelectedVideo(video);
  };

  const handleConfirm = () => {
    if (selectedVideo) {
      onSelect(selectedVideo);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 p-6 ${className}`}>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <svg
              className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3"
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
            <p className="text-gray-400 text-sm">Loading videos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 p-6 ${className}`}>
        <div className="text-center min-h-[200px] flex flex-col items-center justify-center">
          <svg
            className="w-10 h-10 text-red-400 mx-auto mb-3"
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
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={loadVideos}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 p-6 ${className}`}>
        <div className="text-center min-h-[200px] flex flex-col items-center justify-center">
          <svg
            className="w-12 h-12 text-gray-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          <p className="text-gray-400 mb-2">No videos available</p>
          <p className="text-gray-500 text-sm mb-4">
            Add video files to the <code className="bg-gray-700 px-1 rounded">/videos</code> folder
          </p>
          <button
            onClick={loadVideos}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Select Video</h3>
        <button
          onClick={loadVideos}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Refresh list"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Video grid */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {videos.map((video) => {
            const isSelected = selectedVideo?.full_path === video.full_path;

            return (
              <button
                key={video.full_path}
                onClick={() => handleSelect(video)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-700/30 hover:border-gray-600 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Video icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'
                  }`}>
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

                  {/* Video info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${
                      isSelected ? 'text-white' : 'text-gray-200'
                    }`}>
                      {video.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{video.size_formatted}</span>
                      {video.duration_seconds && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(video.duration_seconds)}</span>
                        </>
                      )}
                      {video.resolution && (
                        <>
                          <span>•</span>
                          <span>{video.resolution}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="flex-shrink-0 text-blue-400">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selectedVideo}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedVideo
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Select Video
        </button>
      </div>
    </div>
  );
};

export default VideoFilePicker;
