/**
 * TypeScript type definitions for the VideoTimeline component
 */

/**
 * Represents an AI-detected engaging moment to display as a marker
 */
export interface TimelineMarker {
  /** Unique identifier for the marker */
  id: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Duration in seconds (computed) */
  duration: number;
  /** Label/title for the marker */
  label: string;
  /** Detailed description or reason */
  description?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Type of moment (for styling) */
  type: 'ai_detected' | 'manual' | 'highlight';
  /** Associated transcript text */
  text?: string;
}

/**
 * Represents a user-selected time range on the timeline
 */
export interface TimeRange {
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

/**
 * Props for the VideoTimeline component
 */
export interface VideoTimelineProps {
  /** Total duration of the video in seconds */
  duration: number;
  /** Current playback time in seconds */
  currentTime: number;
  /** Array of AI-detected moment markers to display */
  markers?: TimelineMarker[];
  /** Currently selected time range */
  selectedRange?: TimeRange | null;
  /** Callback when user clicks on the timeline to seek */
  onSeek?: (time: number) => void;
  /** Callback when user clicks on a marker */
  onMarkerClick?: (marker: TimelineMarker) => void;
  /** Callback when user selects a time range via drag */
  onRangeSelect?: (range: TimeRange | null) => void;
  /** Callback when user hovers over a marker */
  onMarkerHover?: (marker: TimelineMarker | null) => void;
  /** Whether the timeline is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Internal state for drag selection
 */
export interface DragState {
  isDragging: boolean;
  startX: number;
  startTime: number;
  currentX: number;
  currentTime: number;
}

/**
 * Marker tooltip position
 */
export interface TooltipPosition {
  x: number;
  y: number;
  visible: boolean;
  marker: TimelineMarker | null;
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) {
    return '0:00';
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');
    return `${hrs}:${minsStr}:${secsStr}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a time range as a string
 */
export function formatTimeRange(range: TimeRange): string {
  return `${formatTime(range.start)} - ${formatTime(range.end)}`;
}

/**
 * Calculate duration of a time range
 */
export function getRangeDuration(range: TimeRange): number {
  return range.end - range.start;
}

/**
 * Check if a time is within a range
 */
export function isTimeInRange(time: number, range: TimeRange): boolean {
  return time >= range.start && time <= range.end;
}

/**
 * Convert an EngagingMoment from the backend to a TimelineMarker
 */
export function engagingMomentToMarker(moment: {
  id?: string;
  start: number;
  end: number;
  reason: string;
  text?: string;
  confidence?: number;
}, index: number): TimelineMarker {
  return {
    id: moment.id || `ai-moment-${index}`,
    startTime: moment.start,
    endTime: moment.end,
    duration: moment.end - moment.start,
    label: `Moment ${index + 1}`,
    description: moment.reason,
    confidence: moment.confidence ?? 0.8,
    type: 'ai_detected',
    text: moment.text,
  };
}
