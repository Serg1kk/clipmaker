import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  VideoTimelineProps,
  TimelineMarker,
  TimeRange,
  DragState,
  TooltipPosition,
  formatTime,
  formatTimeRange,
  getRangeDuration,
} from './types';

/**
 * VideoTimeline component that displays a timeline below the video player
 *
 * Features:
 * - Duration bar showing video length
 * - Current playback position indicator
 * - Clickable AI moment markers
 * - Drag-to-select for custom time ranges
 * - Hover tooltips for markers
 */
const VideoTimeline = ({
  duration,
  currentTime,
  markers = [],
  selectedRange,
  onSeek,
  onMarkerClick,
  onRangeSelect,
  onMarkerHover,
  disabled = false,
  className = '',
}: VideoTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startTime: 0,
    currentX: 0,
    currentTime: 0,
  });
  const [tooltip, setTooltip] = useState<TooltipPosition>({
    x: 0,
    y: 0,
    visible: false,
    marker: null,
  });
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Calculate position from time
  const timeToPercent = useCallback((time: number): number => {
    if (duration <= 0) return 0;
    return (time / duration) * 100;
  }, [duration]);

  // Calculate time from mouse position
  const getTimeFromMouseEvent = useCallback((e: React.MouseEvent | MouseEvent): number => {
    if (!timelineRef.current || duration <= 0) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return percent * duration;
  }, [duration]);

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || dragState.isDragging) return;

    // Don't seek if clicking on a marker
    const target = e.target as HTMLElement;
    if (target.closest('[data-marker]')) return;

    const time = getTimeFromMouseEvent(e);
    onSeek?.(time);
  }, [disabled, dragState.isDragging, getTimeFromMouseEvent, onSeek]);

  // Handle drag start for range selection
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Don't start drag on markers
    const target = e.target as HTMLElement;
    if (target.closest('[data-marker]')) return;

    e.preventDefault();
    const time = getTimeFromMouseEvent(e);

    setDragState({
      isDragging: true,
      startX: e.clientX,
      startTime: time,
      currentX: e.clientX,
      currentTime: time,
    });
  }, [disabled, getTimeFromMouseEvent]);

  // Handle drag movement
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromMouseEvent(e);
      setDragState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentTime: time,
      }));
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        const start = Math.min(dragState.startTime, dragState.currentTime);
        const end = Math.max(dragState.startTime, dragState.currentTime);

        // Only create range if it's meaningful (> 0.5 seconds)
        if (end - start > 0.5) {
          onRangeSelect?.({ start, end });
        } else {
          // It was just a click, seek to that position
          onSeek?.(dragState.startTime);
        }

        setDragState(prev => ({ ...prev, isDragging: false }));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, dragState.startTime, dragState.currentTime, getTimeFromMouseEvent, onRangeSelect, onSeek]);

  // Handle hover for time preview
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const time = getTimeFromMouseEvent(e);
    setHoverTime(time);
  }, [disabled, getTimeFromMouseEvent]);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  // Handle marker click
  const handleMarkerClick = useCallback((e: React.MouseEvent, marker: TimelineMarker) => {
    e.stopPropagation();
    if (disabled) return;
    onMarkerClick?.(marker);
  }, [disabled, onMarkerClick]);

  // Handle marker hover
  const handleMarkerEnter = useCallback((e: React.MouseEvent, marker: TimelineMarker) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: -10,
      visible: true,
      marker,
    });
    onMarkerHover?.(marker);
  }, [onMarkerHover]);

  const handleMarkerLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false, marker: null }));
    onMarkerHover?.(null);
  }, [onMarkerHover]);

  // Calculate drag selection range for display
  const dragRange = useMemo((): TimeRange | null => {
    if (!dragState.isDragging) return null;
    const start = Math.min(dragState.startTime, dragState.currentTime);
    const end = Math.max(dragState.startTime, dragState.currentTime);
    return { start, end };
  }, [dragState.isDragging, dragState.startTime, dragState.currentTime]);

  // Current progress percentage
  const progressPercent = timeToPercent(currentTime);

  // Clear selection handler
  const handleClearSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRangeSelect?.(null);
  }, [onRangeSelect]);

  return (
    <div className={`video-timeline relative select-none ${className}`}>
      {/* Main timeline container */}
      <div
        ref={timelineRef}
        className={`
          relative h-10 bg-gray-800 rounded-lg cursor-pointer
          border border-gray-700 overflow-hidden
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-600'}
        `}
        onClick={handleTimelineClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        data-testid="video-timeline"
      >
        {/* Background track */}
        <div className="absolute inset-0 bg-gray-700/50" />

        {/* Selected range highlight */}
        {selectedRange && (
          <div
            className="absolute top-0 bottom-0 bg-blue-500/30 border-x-2 border-blue-500"
            style={{
              left: `${timeToPercent(selectedRange.start)}%`,
              width: `${timeToPercent(selectedRange.end - selectedRange.start)}%`,
            }}
            data-testid="selected-range"
          >
            {/* Range duration label */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 rounded text-xs text-white whitespace-nowrap">
              {formatTimeRange(selectedRange)} ({formatTime(getRangeDuration(selectedRange))})
              <button
                onClick={handleClearSelection}
                className="ml-2 hover:text-red-300"
                aria-label="Clear selection"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Drag selection preview */}
        {dragRange && (
          <div
            className="absolute top-0 bottom-0 bg-blue-400/20 border-x border-blue-400/50"
            style={{
              left: `${timeToPercent(dragRange.start)}%`,
              width: `${timeToPercent(dragRange.end - dragRange.start)}%`,
            }}
            data-testid="drag-range"
          />
        )}

        {/* AI Moment markers */}
        {markers.map((marker) => {
          const leftPercent = timeToPercent(marker.startTime);
          const widthPercent = timeToPercent(marker.endTime - marker.startTime);

          return (
            <div
              key={marker.id}
              data-marker
              className={`
                absolute top-1 bottom-1 rounded cursor-pointer
                transition-all duration-150
                ${marker.type === 'ai_detected'
                  ? 'bg-amber-500/60 hover:bg-amber-500/80 border border-amber-400'
                  : marker.type === 'highlight'
                    ? 'bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400'
                    : 'bg-green-500/60 hover:bg-green-500/80 border border-green-400'
                }
              `}
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 0.5)}%`,
                minWidth: '8px',
              }}
              onClick={(e) => handleMarkerClick(e, marker)}
              onMouseEnter={(e) => handleMarkerEnter(e, marker)}
              onMouseLeave={handleMarkerLeave}
              role="button"
              aria-label={`${marker.label}: ${formatTime(marker.startTime)} - ${formatTime(marker.endTime)}`}
              data-testid={`marker-${marker.id}`}
            >
              {/* Confidence indicator */}
              {marker.confidence !== undefined && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black/30 rounded-b"
                  style={{ height: `${(1 - marker.confidence) * 100}%` }}
                />
              )}
            </div>
          );
        })}

        {/* Progress indicator (current playback position) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
          style={{ left: `${progressPercent}%` }}
          data-testid="playback-position"
        >
          {/* Playhead */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow" />
        </div>

        {/* Hover time indicator */}
        {hoverTime !== null && !dragState.isDragging && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400/50 pointer-events-none z-5"
            style={{ left: `${timeToPercent(hoverTime)}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gray-700 rounded text-xs text-white whitespace-nowrap">
              {formatTime(hoverTime)}
            </div>
          </div>
        )}
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
        <span data-testid="start-time">0:00</span>
        <span data-testid="current-time">{formatTime(currentTime)}</span>
        <span data-testid="duration-time">{formatTime(duration)}</span>
      </div>

      {/* Marker tooltip */}
      {tooltip.visible && tooltip.marker && (
        <div
          className="absolute bottom-full mb-2 px-3 py-2 bg-gray-900 rounded-lg shadow-lg text-sm z-20 max-w-xs pointer-events-none"
          style={{
            left: `${Math.min(Math.max(tooltip.x, 60), 240)}px`,
            transform: 'translateX(-50%)',
          }}
          data-testid="marker-tooltip"
        >
          <div className="font-medium text-white mb-1">{tooltip.marker.label}</div>
          <div className="text-gray-400 text-xs mb-1">
            {formatTime(tooltip.marker.startTime)} - {formatTime(tooltip.marker.endTime)}
            <span className="ml-2">({formatTime(tooltip.marker.duration)})</span>
          </div>
          {tooltip.marker.description && (
            <div className="text-gray-300 text-xs">{tooltip.marker.description}</div>
          )}
          {tooltip.marker.confidence !== undefined && (
            <div className="text-gray-500 text-xs mt-1">
              Confidence: {Math.round(tooltip.marker.confidence * 100)}%
            </div>
          )}
          {/* Arrow pointer */}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full">
            <div className="border-8 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}

      {/* Markers legend */}
      {markers.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500/60 border border-amber-400 rounded" />
            <span>AI Detected ({markers.filter(m => m.type === 'ai_detected').length})</span>
          </div>
          {markers.some(m => m.type === 'highlight') && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500/60 border border-purple-400 rounded" />
              <span>Highlights</span>
            </div>
          )}
          {markers.some(m => m.type === 'manual') && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500/60 border border-green-400 rounded" />
              <span>Manual</span>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-500 mt-1">
        Click to seek • Drag to select range • Click markers to view moments
      </div>
    </div>
  );
};

export default VideoTimeline;
