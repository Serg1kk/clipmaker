import { useState, useCallback, useMemo } from 'react';
import { TimelineMarker, TimeRange, engagingMomentToMarker } from '../components/timeline/types';

/**
 * Configuration for the useTimeline hook
 */
export interface UseTimelineConfig {
  /** Initial markers to display */
  initialMarkers?: TimelineMarker[];
  /** Initial selected range */
  initialRange?: TimeRange | null;
  /** Callback when range is selected */
  onRangeChange?: (range: TimeRange | null) => void;
  /** Callback when a marker is selected */
  onMarkerSelect?: (marker: TimelineMarker | null) => void;
}

/**
 * Return type for useTimeline hook
 */
export interface UseTimelineReturn {
  /** Current list of markers */
  markers: TimelineMarker[];
  /** Currently selected time range */
  selectedRange: TimeRange | null;
  /** Currently selected/focused marker */
  selectedMarker: TimelineMarker | null;
  /** Currently hovered marker */
  hoveredMarker: TimelineMarker | null;
  /** Set markers from backend response */
  setMarkers: (markers: TimelineMarker[]) => void;
  /** Add a single marker */
  addMarker: (marker: TimelineMarker) => void;
  /** Remove a marker by ID */
  removeMarker: (id: string) => void;
  /** Set the selected time range */
  selectRange: (range: TimeRange | null) => void;
  /** Handle marker click */
  handleMarkerClick: (marker: TimelineMarker) => void;
  /** Handle marker hover */
  handleMarkerHover: (marker: TimelineMarker | null) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Load markers from engaging moments response */
  loadEngagingMoments: (moments: EngagingMoment[]) => void;
}

/**
 * Engaging moment structure from backend
 */
interface EngagingMoment {
  start: number;
  end: number;
  reason: string;
  text?: string;
  confidence?: number;
}

/**
 * Custom hook for managing timeline state
 *
 * Provides state management for:
 * - AI-detected moment markers
 * - User-selected time ranges
 * - Marker selection and hover states
 *
 * @example
 * ```tsx
 * const {
 *   markers,
 *   selectedRange,
 *   selectRange,
 *   handleMarkerClick,
 *   loadEngagingMoments,
 * } = useTimeline({
 *   onRangeChange: (range) => console.log('Range selected:', range),
 * });
 *
 * // Load moments from API
 * useEffect(() => {
 *   fetchMoments().then(loadEngagingMoments);
 * }, []);
 *
 * return (
 *   <VideoTimeline
 *     markers={markers}
 *     selectedRange={selectedRange}
 *     onRangeSelect={selectRange}
 *     onMarkerClick={handleMarkerClick}
 *   />
 * );
 * ```
 */
export function useTimeline(config: UseTimelineConfig = {}): UseTimelineReturn {
  const {
    initialMarkers = [],
    initialRange = null,
    onRangeChange,
    onMarkerSelect,
  } = config;

  // State
  const [markers, setMarkersState] = useState<TimelineMarker[]>(initialMarkers);
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(initialRange);
  const [selectedMarker, setSelectedMarker] = useState<TimelineMarker | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null);

  // Set markers
  const setMarkers = useCallback((newMarkers: TimelineMarker[]) => {
    setMarkersState(newMarkers);
  }, []);

  // Add a single marker
  const addMarker = useCallback((marker: TimelineMarker) => {
    setMarkersState(prev => [...prev, marker].sort((a, b) => a.startTime - b.startTime));
  }, []);

  // Remove a marker
  const removeMarker = useCallback((id: string) => {
    setMarkersState(prev => prev.filter(m => m.id !== id));
    if (selectedMarker?.id === id) {
      setSelectedMarker(null);
      onMarkerSelect?.(null);
    }
  }, [selectedMarker, onMarkerSelect]);

  // Select a range
  const selectRange = useCallback((range: TimeRange | null) => {
    setSelectedRange(range);
    onRangeChange?.(range);
  }, [onRangeChange]);

  // Handle marker click
  const handleMarkerClick = useCallback((marker: TimelineMarker) => {
    setSelectedMarker(marker);
    onMarkerSelect?.(marker);
    // Also select the marker's time range
    selectRange({
      start: marker.startTime,
      end: marker.endTime,
    });
  }, [onMarkerSelect, selectRange]);

  // Handle marker hover
  const handleMarkerHover = useCallback((marker: TimelineMarker | null) => {
    setHoveredMarker(marker);
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedRange(null);
    setSelectedMarker(null);
    onRangeChange?.(null);
    onMarkerSelect?.(null);
  }, [onRangeChange, onMarkerSelect]);

  // Load engaging moments from backend
  const loadEngagingMoments = useCallback((moments: EngagingMoment[]) => {
    const newMarkers = moments.map((moment, index) => engagingMomentToMarker(moment, index));
    setMarkersState(newMarkers);
  }, []);

  return {
    markers,
    selectedRange,
    selectedMarker,
    hoveredMarker,
    setMarkers,
    addMarker,
    removeMarker,
    selectRange,
    handleMarkerClick,
    handleMarkerHover,
    clearSelection,
    loadEngagingMoments,
  };
}

export default useTimeline;
