/**
 * Test suite for VideoTimeline component
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoTimeline from '../VideoTimeline';
import { TimelineMarker, TimeRange, formatTime, engagingMomentToMarker } from '../types';

// Mock markers for testing
const mockMarkers: TimelineMarker[] = [
  {
    id: 'marker-1',
    startTime: 10,
    endTime: 25,
    duration: 15,
    label: 'Moment 1',
    description: 'Great intro hook',
    confidence: 0.92,
    type: 'ai_detected',
    text: 'This is the intro text',
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
    text: 'Key insight text',
  },
  {
    id: 'marker-3',
    startTime: 120,
    endTime: 140,
    duration: 20,
    label: 'Highlight',
    description: 'User highlight',
    type: 'highlight',
  },
];

const mockRange: TimeRange = {
  start: 30,
  end: 50,
};

describe('VideoTimeline', () => {
  const defaultProps = {
    duration: 300, // 5 minutes
    currentTime: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the timeline container', () => {
      render(<VideoTimeline {...defaultProps} />);
      expect(screen.getByTestId('video-timeline')).toBeInTheDocument();
    });

    it('displays time labels', () => {
      render(<VideoTimeline {...defaultProps} currentTime={60} />);
      expect(screen.getByTestId('start-time')).toHaveTextContent('0:00');
      expect(screen.getByTestId('current-time')).toHaveTextContent('1:00');
      expect(screen.getByTestId('duration-time')).toHaveTextContent('5:00');
    });

    it('renders playback position indicator', () => {
      render(<VideoTimeline {...defaultProps} currentTime={150} />);
      const position = screen.getByTestId('playback-position');
      expect(position).toBeInTheDocument();
      // Should be at 50% (150/300)
      expect(position).toHaveStyle({ left: '50%' });
    });

    it('renders with markers', () => {
      render(<VideoTimeline {...defaultProps} markers={mockMarkers} />);
      expect(screen.getByTestId('marker-marker-1')).toBeInTheDocument();
      expect(screen.getByTestId('marker-marker-2')).toBeInTheDocument();
      expect(screen.getByTestId('marker-marker-3')).toBeInTheDocument();
    });

    it('renders markers legend when markers present', () => {
      render(<VideoTimeline {...defaultProps} markers={mockMarkers} />);
      expect(screen.getByText(/AI Detected/)).toBeInTheDocument();
      expect(screen.getByText(/Highlights/)).toBeInTheDocument();
    });

    it('renders selected range when provided', () => {
      render(<VideoTimeline {...defaultProps} selectedRange={mockRange} />);
      expect(screen.getByTestId('selected-range')).toBeInTheDocument();
    });

    it('applies disabled styling', () => {
      render(<VideoTimeline {...defaultProps} disabled />);
      const timeline = screen.getByTestId('video-timeline');
      expect(timeline).toHaveClass('opacity-50');
      expect(timeline).toHaveClass('cursor-not-allowed');
    });

    it('applies custom className', () => {
      render(<VideoTimeline {...defaultProps} className="custom-class" />);
      const container = screen.getByTestId('video-timeline').parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('seeking', () => {
    it('calls onSeek when clicking on timeline', () => {
      const onSeek = jest.fn();
      render(<VideoTimeline {...defaultProps} onSeek={onSeek as () => void} />);

      const timeline = screen.getByTestId('video-timeline');

      // Mock getBoundingClientRect
      timeline.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        width: 300,
        top: 0,
        right: 300,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => {},
      })) as unknown as () => DOMRect;

      fireEvent.click(timeline, { clientX: 150 });

      expect(onSeek).toHaveBeenCalled();
    });

    it('does not seek when disabled', () => {
      const onSeek = jest.fn();
      render(<VideoTimeline {...defaultProps} onSeek={onSeek as () => void} disabled />);

      const timeline = screen.getByTestId('video-timeline');
      fireEvent.click(timeline);

      expect(onSeek).not.toHaveBeenCalled();
    });

    it('does not seek when clicking on marker', () => {
      const onSeek = jest.fn();
      render(<VideoTimeline {...defaultProps} markers={mockMarkers} onSeek={onSeek as () => void} />);

      const marker = screen.getByTestId('marker-marker-1');
      fireEvent.click(marker);

      expect(onSeek).not.toHaveBeenCalled();
    });
  });

  describe('marker interaction', () => {
    it('calls onMarkerClick when clicking a marker', () => {
      const onMarkerClick = jest.fn();
      render(
        <VideoTimeline
          {...defaultProps}
          markers={mockMarkers}
          onMarkerClick={onMarkerClick as () => void}
        />
      );

      const marker = screen.getByTestId('marker-marker-1');
      fireEvent.click(marker);

      expect(onMarkerClick).toHaveBeenCalledWith(mockMarkers[0]);
    });

    it('shows tooltip on marker hover', async () => {
      const onMarkerHover = jest.fn();
      render(
        <VideoTimeline
          {...defaultProps}
          markers={mockMarkers}
          onMarkerHover={onMarkerHover as () => void}
        />
      );

      const marker = screen.getByTestId('marker-marker-1');

      // Mock getBoundingClientRect for the timeline
      const timeline = screen.getByTestId('video-timeline');
      timeline.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        width: 300,
        top: 100,
        right: 300,
        bottom: 140,
        height: 40,
        x: 0,
        y: 100,
        toJSON: () => {},
      })) as unknown as () => DOMRect;

      fireEvent.mouseEnter(marker, { clientX: 50 });

      await waitFor(() => {
        expect(screen.getByTestId('marker-tooltip')).toBeInTheDocument();
      });

      expect(screen.getByText('Moment 1')).toBeInTheDocument();
      expect(screen.getByText('Great intro hook')).toBeInTheDocument();
      expect(screen.getByText(/Confidence: 92%/)).toBeInTheDocument();
    });

    it('hides tooltip on marker leave', async () => {
      render(<VideoTimeline {...defaultProps} markers={mockMarkers} />);

      const marker = screen.getByTestId('marker-marker-1');
      const timeline = screen.getByTestId('video-timeline');

      timeline.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        width: 300,
        top: 100,
        right: 300,
        bottom: 140,
        height: 40,
        x: 0,
        y: 100,
        toJSON: () => {},
      })) as unknown as () => DOMRect;

      fireEvent.mouseEnter(marker, { clientX: 50 });

      await waitFor(() => {
        expect(screen.getByTestId('marker-tooltip')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(marker);

      await waitFor(() => {
        expect(screen.queryByTestId('marker-tooltip')).not.toBeInTheDocument();
      });
    });

    it('has correct accessibility attributes on markers', () => {
      render(<VideoTimeline {...defaultProps} markers={mockMarkers} />);

      const marker = screen.getByTestId('marker-marker-1');
      expect(marker).toHaveAttribute('role', 'button');
      expect(marker).toHaveAttribute('aria-label');
    });
  });

  describe('range selection', () => {
    it('displays selected range with correct styling', () => {
      render(<VideoTimeline {...defaultProps} selectedRange={mockRange} />);

      const range = screen.getByTestId('selected-range');
      expect(range).toHaveClass('bg-blue-500/30');
    });

    it('shows range duration label', () => {
      render(<VideoTimeline {...defaultProps} selectedRange={mockRange} />);

      // Should show "0:30 - 0:50"
      expect(screen.getByText(/0:30 - 0:50/)).toBeInTheDocument();
    });

    it('calls onRangeSelect with null when clearing selection', () => {
      const onRangeSelect = jest.fn();
      render(
        <VideoTimeline
          {...defaultProps}
          selectedRange={mockRange}
          onRangeSelect={onRangeSelect as () => void}
        />
      );

      // Click the × button to clear
      const clearButton = screen.getByRole('button', { name: /clear selection/i });
      fireEvent.click(clearButton);

      expect(onRangeSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('drag selection', () => {
    it('shows drag preview during drag', async () => {
      render(<VideoTimeline {...defaultProps} />);
      const timeline = screen.getByTestId('video-timeline');

      timeline.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        width: 300,
        top: 0,
        right: 300,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => {},
      })) as unknown as () => DOMRect;

      // Start drag
      fireEvent.mouseDown(timeline, { clientX: 50 });

      // Move
      fireEvent.mouseMove(document, { clientX: 150 });

      await waitFor(() => {
        expect(screen.getByTestId('drag-range')).toBeInTheDocument();
      });
    });

    it('calls onRangeSelect after drag', async () => {
      const onRangeSelect = jest.fn();
      render(<VideoTimeline {...defaultProps} onRangeSelect={onRangeSelect as () => void} />);
      const timeline = screen.getByTestId('video-timeline');

      timeline.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        width: 300,
        top: 0,
        right: 300,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => {},
      })) as unknown as () => DOMRect;

      // Start drag at 50px
      fireEvent.mouseDown(timeline, { clientX: 50 });

      // Move to 150px
      fireEvent.mouseMove(document, { clientX: 150 });

      // End drag
      fireEvent.mouseUp(document);

      expect(onRangeSelect).toHaveBeenCalled();
      const range = (onRangeSelect as jest.Mock).mock.calls[0][0] as TimeRange;
      expect(range).toHaveProperty('start');
      expect(range).toHaveProperty('end');
      expect(range.end).toBeGreaterThan(range.start);
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<VideoTimeline {...defaultProps} currentTime={60} />);

      const timeline = screen.getByTestId('video-timeline');
      expect(timeline).toHaveAttribute('role', 'slider');
      expect(timeline).toHaveAttribute('aria-label', 'Video timeline');
      expect(timeline).toHaveAttribute('aria-valuemin', '0');
      expect(timeline).toHaveAttribute('aria-valuemax', '300');
      expect(timeline).toHaveAttribute('aria-valuenow', '60');
    });
  });
});

describe('formatTime', () => {
  it('formats seconds correctly', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(30)).toBe('0:30');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('handles invalid input', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});

describe('engagingMomentToMarker', () => {
  it('converts engaging moment to marker', () => {
    const moment = {
      start: 10,
      end: 25,
      reason: 'Great hook',
      text: 'Some text',
      confidence: 0.9,
    };

    const marker = engagingMomentToMarker(moment, 0);

    expect(marker.id).toBe('ai-moment-0');
    expect(marker.startTime).toBe(10);
    expect(marker.endTime).toBe(25);
    expect(marker.duration).toBe(15);
    expect(marker.label).toBe('Moment 1');
    expect(marker.description).toBe('Great hook');
    expect(marker.confidence).toBe(0.9);
    expect(marker.type).toBe('ai_detected');
    expect(marker.text).toBe('Some text');
  });

  it('uses default confidence when not provided', () => {
    const moment = {
      start: 10,
      end: 25,
      reason: 'Hook',
    };

    const marker = engagingMomentToMarker(moment, 0);
    expect(marker.confidence).toBe(0.8);
  });
});
