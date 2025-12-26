import { useRef, useState, useEffect, useCallback } from 'react';
import VideoPlayer, { VideoPlayerProps } from './VideoPlayer';
import { VideoTimeline, TimelineMarker, TimeRange } from './timeline';
import { useTimeline } from '../hooks/useTimeline';

/**
 * Extended props for VideoPlayerWithTimeline
 */
export interface VideoPlayerWithTimelineProps extends VideoPlayerProps {
  /** AI-detected engaging moments to display as markers */
  engagingMoments?: Array<{
    start: number;
    end: number;
    reason: string;
    text?: string;
    confidence?: number;
  }>;
  /** Callback when a time range is selected */
  onRangeSelect?: (range: TimeRange | null) => void;
  /** Callback when a marker is clicked */
  onMomentSelect?: (marker: TimelineMarker | null) => void;
  /** Whether to show the timeline */
  showTimeline?: boolean;
}

/**
 * VideoPlayerWithTimeline combines the VideoPlayer with an interactive timeline
 *
 * Features:
 * - All VideoPlayer features (play/pause, volume, etc.)
 * - Timeline showing video duration
 * - AI-detected moment markers
 * - Drag-to-select time ranges
 * - Synchronized seeking between player and timeline
 *
 * @example
 * ```tsx
 * <VideoPlayerWithTimeline
 *   url="/path/to/video.mp4"
 *   engagingMoments={[
 *     { start: 10, end: 25, reason: "Great intro hook" },
 *     { start: 120, end: 150, reason: "Key insight" },
 *   ]}
 *   onRangeSelect={(range) => console.log('Selected:', range)}
 * />
 * ```
 */
const VideoPlayerWithTimeline = ({
  engagingMoments = [],
  onRangeSelect,
  onMomentSelect,
  showTimeline = true,
  className = '',
  ...playerProps
}: VideoPlayerWithTimelineProps) => {
  // Video element ref for controlling playback
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Video state (synced with the internal player)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Timeline state management
  const {
    markers,
    selectedRange,
    selectRange,
    handleMarkerClick,
    handleMarkerHover,
    loadEngagingMoments,
  } = useTimeline({
    onRangeChange: onRangeSelect,
    onMarkerSelect: onMomentSelect,
  });

  // Load engaging moments when they change
  useEffect(() => {
    if (engagingMoments.length > 0) {
      loadEngagingMoments(engagingMoments);
    }
  }, [engagingMoments, loadEngagingMoments]);

  // Find the video element inside VideoPlayer after render
  useEffect(() => {
    const findVideo = () => {
      if (containerRef.current) {
        const video = containerRef.current.querySelector('video');
        if (video) {
          videoRef.current = video;

          // Set up event listeners
          const handleTimeUpdate = () => setCurrentTime(video.currentTime);
          const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setIsReady(true);
          };
          const handleDurationChange = () => setDuration(video.duration);

          video.addEventListener('timeupdate', handleTimeUpdate);
          video.addEventListener('loadedmetadata', handleLoadedMetadata);
          video.addEventListener('durationchange', handleDurationChange);

          // If metadata already loaded
          if (video.duration) {
            setDuration(video.duration);
            setIsReady(true);
          }

          return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('durationchange', handleDurationChange);
          };
        }
      }
    };

    // Small delay to ensure VideoPlayer has mounted
    const timer = setTimeout(findVideo, 100);
    return () => clearTimeout(timer);
  }, [playerProps.url]);

  // Handle seeking from timeline
  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Handle range selection - also seek to start of range
  const handleRangeSelect = useCallback((range: TimeRange | null) => {
    selectRange(range);
    if (range && videoRef.current) {
      videoRef.current.currentTime = range.start;
      setCurrentTime(range.start);
    }
  }, [selectRange]);

  // Handle marker click - seek to marker start
  const handleMarkerClickWithSeek = useCallback((marker: TimelineMarker) => {
    handleMarkerClick(marker);
    if (videoRef.current) {
      videoRef.current.currentTime = marker.startTime;
      setCurrentTime(marker.startTime);
    }
  }, [handleMarkerClick]);

  return (
    <div ref={containerRef} className={`video-player-with-timeline ${className}`}>
      {/* Video Player */}
      <VideoPlayer {...playerProps} />

      {/* Timeline */}
      {showTimeline && isReady && (
        <div className="mt-4">
          <VideoTimeline
            duration={duration}
            currentTime={currentTime}
            markers={markers}
            selectedRange={selectedRange}
            onSeek={handleSeek}
            onMarkerClick={handleMarkerClickWithSeek}
            onRangeSelect={handleRangeSelect}
            onMarkerHover={handleMarkerHover}
          />
        </div>
      )}

      {/* Loading state for timeline */}
      {showTimeline && !isReady && (
        <div className="mt-4 h-10 bg-gray-800 rounded-lg animate-pulse" />
      )}
    </div>
  );
};

export default VideoPlayerWithTimeline;
