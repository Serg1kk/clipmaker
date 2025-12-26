import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Props for the VideoPlayer component
 */
export interface VideoPlayerProps {
  /** Video source URL (required) */
  url: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional poster image URL */
  poster?: string;
  /** Whether to auto-play the video */
  autoPlay?: boolean;
  /** Callback when video ends */
  onEnded?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) {
    return '0:00';
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');
    return hrs + ':' + minsStr + ':' + secsStr;
  }
  return mins + ':' + secs.toString().padStart(2, '0');
}

/**
 * VideoPlayer component with custom controls
 *
 * Features:
 * - Play/pause control
 * - Seek via progress bar
 * - Time display (current / duration)
 * - Volume control with slider
 * - Mute toggle
 * - Keyboard accessibility (Space to play/pause)
 * - Error handling
 */
const VideoPlayer = ({
  url,
  className = '',
  poster,
  autoPlay = false,
  onEnded,
  onError,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle play/pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || hasError) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => {
        console.error('Play failed:', err);
      });
    }
  }, [isPlaying, hasError]);

  // Handle seeking via progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progressBar = progressRef.current;
    if (!video || !progressBar || hasError) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration, hasError]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);

    if (newVolume > 0 && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      togglePlay();
    }
  }, [togglePlay]);

  // Sync video state with component state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setCurrentTime(0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleError = () => {
      setHasError(true);
      const errorMsg = 'Failed to load video';
      setErrorMessage(errorMsg);
      onError?.(new Error(errorMsg));
    };
    const handleVolumeUpdate = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('volumechange', handleVolumeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('volumechange', handleVolumeUpdate);
    };
  }, [onEnded, onError]);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={'video-player relative bg-black rounded-lg overflow-hidden ' + className}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Video player"
      data-testid="video-player"
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        autoPlay={autoPlay}
        className="w-full h-auto"
        data-testid="video-element"
        playsInline
      />

      {/* Error overlay */}
      {hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/80"
          data-testid="error-overlay"
        >
          <div className="text-center text-white">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p data-testid="error-message">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {!hasError && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
          data-testid="controls"
        >
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="h-1 bg-gray-600 rounded cursor-pointer mb-3"
            onClick={handleProgressClick}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            data-testid="progress-bar"
          >
            <div
              className="h-full bg-blue-500 rounded"
              style={{ width: progressPercent + '%' }}
              data-testid="progress-fill"
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play/Pause button */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                data-testid="play-pause-button"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Time display */}
              <div className="text-white text-sm" data-testid="time-display">
                <span data-testid="current-time">{formatTime(currentTime)}</span>
                <span className="mx-1">/</span>
                <span data-testid="duration">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Volume control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-blue-400 transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  data-testid="mute-button"
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                  aria-label="Volume"
                  data-testid="volume-slider"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
