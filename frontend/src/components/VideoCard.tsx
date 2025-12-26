import type { VideoFileMetadata } from '../services/api';

interface VideoCardProps {
  video: VideoFileMetadata;
  onClick: (video: VideoFileMetadata) => void;
}

/**
 * Format duration from seconds to HH:MM:SS or MM:SS
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) {
    return '--:--';
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get a color based on the video codec
 */
function getCodecColor(codec: string | null): string {
  if (!codec) return 'bg-gray-600';
  const lowerCodec = codec.toLowerCase();
  if (lowerCodec.includes('h264') || lowerCodec.includes('avc')) return 'bg-blue-600';
  if (lowerCodec.includes('h265') || lowerCodec.includes('hevc')) return 'bg-purple-600';
  if (lowerCodec.includes('vp9')) return 'bg-green-600';
  if (lowerCodec.includes('av1')) return 'bg-orange-600';
  return 'bg-gray-600';
}

const VideoCard = ({ video, onClick }: VideoCardProps) => {
  const handleClick = () => {
    onClick(video);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(video);
    }
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Start project with ${video.name}`}
      className="group bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
    >
      {/* Thumbnail placeholder with video icon */}
      <div className="relative aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent z-10" />

        {/* Video icon */}
        <svg
          className="w-16 h-16 text-gray-600 group-hover:text-blue-500 transition-colors z-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 z-20 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white">
          {formatDuration(video.duration_seconds)}
        </div>

        {/* Resolution badge */}
        {video.resolution && (
          <div className="absolute top-2 left-2 z-20 px-2 py-1 bg-black/80 rounded text-xs font-medium text-gray-300">
            {video.resolution}
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <svg
              className="w-7 h-7 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Video info */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-white font-medium truncate mb-2 group-hover:text-blue-400 transition-colors" title={video.name}>
          {video.name}
        </h3>

        {/* Metadata row */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{video.size_formatted}</span>

          {video.video_codec && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getCodecColor(video.video_codec)}`}>
              {video.video_codec.toUpperCase()}
            </span>
          )}
        </div>

        {/* Additional info */}
        {(video.frame_rate || video.has_audio !== null) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {video.frame_rate && (
              <span>{video.frame_rate} fps</span>
            )}
            {video.has_audio !== null && (
              <span className="flex items-center gap-1">
                {video.has_audio ? (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                    Audio
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                    No audio
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCard;
