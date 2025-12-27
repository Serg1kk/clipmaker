import { useState, useEffect, useCallback, RefObject } from 'react';

/**
 * Format seconds to MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface VideoPlayControlsProps {
  /** Reference to the video element to control */
  videoRef: RefObject<HTMLVideoElement>;
  /** Current playback time in seconds */
  currentTime: number;
  /** Total video duration in seconds */
  duration: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * VideoPlayControls - Floating play/pause controls overlay
 *
 * This component provides play/pause controls that float above
 * other overlays (like CropOverlay) to ensure video playback
 * is always accessible. Positioned in top-left corner.
 */
const VideoPlayControls = ({
  videoRef,
  currentTime,
  duration,
  className = ''
}: VideoPlayControlsProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync with video play state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Initialize state
    setIsPlaying(!video.paused);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoRef]);

  // Toggle play/pause
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, [videoRef]);

  // Skip backward 5 seconds
  const handleSkipBack = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 5);
  }, [videoRef]);

  // Skip forward 5 seconds
  const handleSkipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
  }, [videoRef]);

  return (
    <div
      className={`absolute bottom-3 left-3 z-50 flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg ${className}`}
      data-testid="video-play-controls"
    >
      {/* Skip Back Button */}
      <button
        onClick={handleSkipBack}
        className="p-1.5 text-white/80 hover:text-white transition-colors rounded hover:bg-white/10"
        title="Skip back 5s"
        aria-label="Skip back 5 seconds"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          <text x="12" y="14" textAnchor="middle" fontSize="6" fill="currentColor">5</text>
        </svg>
      </button>

      {/* Play/Pause Button */}
      <button
        onClick={handleTogglePlay}
        className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Skip Forward Button */}
      <button
        onClick={handleSkipForward}
        className="p-1.5 text-white/80 hover:text-white transition-colors rounded hover:bg-white/10"
        title="Skip forward 5s"
        aria-label="Skip forward 5 seconds"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
          <text x="12" y="14" textAnchor="middle" fontSize="6" fill="currentColor">5</text>
        </svg>
      </button>

      {/* Time Display */}
      <div className="text-white text-xs font-mono ml-1 min-w-[80px]">
        <span className="text-white">{formatTime(currentTime)}</span>
        <span className="text-white/50"> / {formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default VideoPlayControls;
