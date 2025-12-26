import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import VideoCard from '../components/VideoCard';
import { useVideoFiles } from '../hooks/useVideoFiles';
import { startProject, type VideoFileMetadata } from '../services/api';

const Home = () => {
  const navigate = useNavigate();
  const { videos, totalCount, totalSize, isLoading, error, refetch } = useVideoFiles();
  const [startingProject, setStartingProject] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const handleVideoClick = async (video: VideoFileMetadata) => {
    setStartingProject(video.name);
    setStartError(null);

    try {
      const result = await startProject(video.full_path);
      // Navigate to projects page with the new job ID
      navigate(`/projects?job=${result.job_id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start project');
      setStartingProject(null);
    }
  };

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Select a Video
          </h1>
          <p className="text-gray-400">
            Choose a video file to start a new transcription project
          </p>
        </div>

        {/* Stats */}
        {!isLoading && !error && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{totalCount}</p>
              <p className="text-sm text-gray-400">Videos</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{totalSize}</p>
              <p className="text-sm text-gray-400">Total Size</p>
            </div>
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
        )}
      </div>

      {/* Error for starting project */}
      {startError && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-300">{startError}</span>
          </div>
          <button
            onClick={() => setStartError(null)}
            className="text-red-400 hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading overlay for project creation */}
      {startingProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Starting Project</h3>
            <p className="text-gray-400 truncate">{startingProject}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-700" />
              <div className="p-4">
                <div className="h-5 bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
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
            Failed to load videos
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
      {!isLoading && !error && videos.length === 0 && (
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
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            No videos found
          </h3>
          <p className="text-gray-500 mb-4">
            Add video files to the <code className="bg-gray-700 px-2 py-1 rounded text-sm">/videos</code> folder to get started.
          </p>
          <p className="text-gray-600 text-sm">
            Supported formats: MP4, MOV, AVI, MKV, WebM, M4V
          </p>
        </div>
      )}

      {/* Video grid */}
      {!isLoading && !error && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.path}
              video={video}
              onClick={handleVideoClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
