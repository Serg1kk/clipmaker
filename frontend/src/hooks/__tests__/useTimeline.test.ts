/**
 * Test suite for useTimeline hook
 */

import { describe, it, expect, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useTimeline } from '../useTimeline';
import { TimelineMarker, TimeRange } from '../../components/timeline/types';

const mockMarkers: TimelineMarker[] = [
  {
    id: 'marker-1',
    startTime: 10,
    endTime: 25,
    duration: 15,
    label: 'Moment 1',
    description: 'Great intro',
    confidence: 0.92,
    type: 'ai_detected',
  },
  {
    id: 'marker-2',
    startTime: 60,
    endTime: 90,
    duration: 30,
    label: 'Moment 2',
    description: 'Key insight',
    confidence: 0.85,
    type: 'ai_detected',
  },
];

const mockEngagingMoments = [
  { start: 10, end: 25, reason: 'Great intro', confidence: 0.92 },
  { start: 60, end: 90, reason: 'Key insight', confidence: 0.85 },
];

describe('useTimeline', () => {
  describe('initialization', () => {
    it('initializes with empty markers', () => {
      const { result } = renderHook(() => useTimeline());

      expect(result.current.markers).toEqual([]);
      expect(result.current.selectedRange).toBeNull();
      expect(result.current.selectedMarker).toBeNull();
      expect(result.current.hoveredMarker).toBeNull();
    });

    it('initializes with provided markers', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers })
      );

      expect(result.current.markers).toEqual(mockMarkers);
    });

    it('initializes with provided range', () => {
      const range: TimeRange = { start: 10, end: 20 };
      const { result } = renderHook(() =>
        useTimeline({ initialRange: range })
      );

      expect(result.current.selectedRange).toEqual(range);
    });
  });

  describe('setMarkers', () => {
    it('updates markers', () => {
      const { result } = renderHook(() => useTimeline());

      act(() => {
        result.current.setMarkers(mockMarkers);
      });

      expect(result.current.markers).toEqual(mockMarkers);
    });
  });

  describe('addMarker', () => {
    it('adds a marker and sorts by startTime', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: [mockMarkers[1]] })
      );

      act(() => {
        result.current.addMarker(mockMarkers[0]);
      });

      expect(result.current.markers).toHaveLength(2);
      expect(result.current.markers[0].id).toBe('marker-1');
      expect(result.current.markers[1].id).toBe('marker-2');
    });
  });

  describe('removeMarker', () => {
    it('removes a marker by id', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers })
      );

      act(() => {
        result.current.removeMarker('marker-1');
      });

      expect(result.current.markers).toHaveLength(1);
      expect(result.current.markers[0].id).toBe('marker-2');
    });

    it('clears selected marker when removed', () => {
      const onMarkerSelect = jest.fn();
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers, onMarkerSelect: onMarkerSelect as () => void })
      );

      // Select marker-1
      act(() => {
        result.current.handleMarkerClick(mockMarkers[0]);
      });

      expect(result.current.selectedMarker?.id).toBe('marker-1');

      // Remove marker-1
      act(() => {
        result.current.removeMarker('marker-1');
      });

      expect(result.current.selectedMarker).toBeNull();
      expect(onMarkerSelect).toHaveBeenLastCalledWith(null);
    });
  });

  describe('selectRange', () => {
    it('selects a range', () => {
      const { result } = renderHook(() => useTimeline());
      const range: TimeRange = { start: 10, end: 30 };

      act(() => {
        result.current.selectRange(range);
      });

      expect(result.current.selectedRange).toEqual(range);
    });

    it('calls onRangeChange callback', () => {
      const onRangeChange = jest.fn();
      const { result } = renderHook(() =>
        useTimeline({ onRangeChange: onRangeChange as () => void })
      );
      const range: TimeRange = { start: 10, end: 30 };

      act(() => {
        result.current.selectRange(range);
      });

      expect(onRangeChange).toHaveBeenCalledWith(range);
    });

    it('clears range when passed null', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialRange: { start: 10, end: 30 } })
      );

      act(() => {
        result.current.selectRange(null);
      });

      expect(result.current.selectedRange).toBeNull();
    });
  });

  describe('handleMarkerClick', () => {
    it('selects the marker', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers })
      );

      act(() => {
        result.current.handleMarkerClick(mockMarkers[0]);
      });

      expect(result.current.selectedMarker).toEqual(mockMarkers[0]);
    });

    it('calls onMarkerSelect callback', () => {
      const onMarkerSelect = jest.fn();
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers, onMarkerSelect: onMarkerSelect as () => void })
      );

      act(() => {
        result.current.handleMarkerClick(mockMarkers[0]);
      });

      expect(onMarkerSelect).toHaveBeenCalledWith(mockMarkers[0]);
    });

    it('also selects the marker time range', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers })
      );

      act(() => {
        result.current.handleMarkerClick(mockMarkers[0]);
      });

      expect(result.current.selectedRange).toEqual({
        start: mockMarkers[0].startTime,
        end: mockMarkers[0].endTime,
      });
    });
  });

  describe('handleMarkerHover', () => {
    it('sets hovered marker', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers })
      );

      act(() => {
        result.current.handleMarkerHover(mockMarkers[0]);
      });

      expect(result.current.hoveredMarker).toEqual(mockMarkers[0]);
    });

    it('clears hovered marker when passed null', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialMarkers: mockMarkers })
      );

      act(() => {
        result.current.handleMarkerHover(mockMarkers[0]);
      });

      act(() => {
        result.current.handleMarkerHover(null);
      });

      expect(result.current.hoveredMarker).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('clears both range and marker selection', () => {
      const { result } = renderHook(() =>
        useTimeline({
          initialMarkers: mockMarkers,
          initialRange: { start: 10, end: 30 },
        })
      );

      // Select a marker
      act(() => {
        result.current.handleMarkerClick(mockMarkers[0]);
      });

      // Clear all
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedRange).toBeNull();
      expect(result.current.selectedMarker).toBeNull();
    });

    it('calls both callbacks', () => {
      const onRangeChange = jest.fn();
      const onMarkerSelect = jest.fn();
      const { result } = renderHook(() =>
        useTimeline({
          initialMarkers: mockMarkers,
          onRangeChange: onRangeChange as () => void,
          onMarkerSelect: onMarkerSelect as () => void,
        })
      );

      act(() => {
        result.current.clearSelection();
      });

      expect(onRangeChange).toHaveBeenCalledWith(null);
      expect(onMarkerSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('loadEngagingMoments', () => {
    it('converts engaging moments to markers', () => {
      const { result } = renderHook(() => useTimeline());

      act(() => {
        result.current.loadEngagingMoments(mockEngagingMoments);
      });

      expect(result.current.markers).toHaveLength(2);
      expect(result.current.markers[0].startTime).toBe(10);
      expect(result.current.markers[0].endTime).toBe(25);
      expect(result.current.markers[0].type).toBe('ai_detected');
      expect(result.current.markers[0].description).toBe('Great intro');
    });

    it('generates correct IDs', () => {
      const { result } = renderHook(() => useTimeline());

      act(() => {
        result.current.loadEngagingMoments(mockEngagingMoments);
      });

      expect(result.current.markers[0].id).toBe('ai-moment-0');
      expect(result.current.markers[1].id).toBe('ai-moment-1');
    });
  });
});
