/**
 * Test suite for useSubtitleSync hook
 *
 * Tests cover:
 * - Hook initialization
 * - Event listener management
 * - Line detection via binary search
 * - Word detection within lines
 * - Empty lines handling
 * - Lines prop changes
 */

import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { useSubtitleSync } from '../useSubtitleSync';
import { SubtitleLine } from '../types';

// ============================================================================
// Mock Data
// ============================================================================

const sampleLines: SubtitleLine[] = [
  {
    words: [
      { text: 'Hello', startTime: 0, endTime: 0.5 },
      { text: 'world', startTime: 0.5, endTime: 1.0 },
    ],
    startTime: 0,
    endTime: 1.0,
  },
  {
    words: [
      { text: 'This', startTime: 2.0, endTime: 2.3 },
      { text: 'is', startTime: 2.3, endTime: 2.5 },
      { text: 'a', startTime: 2.5, endTime: 2.6 },
      { text: 'test', startTime: 2.6, endTime: 3.0 },
    ],
    startTime: 2.0,
    endTime: 3.0,
  },
];

// ============================================================================
// Mock Video Element Factory
// ============================================================================

type EventCallback = () => void;

interface MockVideoElement extends HTMLVideoElement {
  _triggerEvent: (event: string) => void;
}

function createMockVideoElement(initialTime = 0): MockVideoElement {
  const listeners: Record<string, EventCallback[]> = {};

  return {
    currentTime: initialTime,
    readyState: 4,
    addEventListener: jest.fn((event: string, callback: EventCallback) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    removeEventListener: jest.fn((event: string, callback: EventCallback) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      }
    }),
    // Helper to trigger events
    _triggerEvent: (event: string) => {
      listeners[event]?.forEach(cb => cb());
    },
  } as unknown as MockVideoElement;
}

// ============================================================================
// Initialization Tests
// ============================================================================

describe('useSubtitleSync', () => {
  let mockVideo: MockVideoElement;

  beforeEach(() => {
    mockVideo = createMockVideoElement();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with default state when video has no time and no matching line', () => {
      // Video at time 0 but lines start at 5.0
      const linesStartingLater: SubtitleLine[] = [
        {
          words: [{ text: 'Test', startTime: 5, endTime: 6 }],
          startTime: 5,
          endTime: 6,
        },
      ];
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, linesStartingLater));

      expect(result.current.currentTime).toBe(0);
      expect(result.current.currentLine).toBeNull();
      expect(result.current.currentLineIndex).toBe(-1);
      expect(result.current.currentWordIndex).toBe(-1);
    });

    it('initializes with first line when video starts at time 0 and line starts at 0', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      // Video at time 0, first line also starts at 0 - should match
      expect(result.current.currentTime).toBe(0);
      expect(result.current.currentLine).toEqual(sampleLines[0]);
      expect(result.current.currentLineIndex).toBe(0);
    });

    it('initializes with current video time if video is loaded', () => {
      mockVideo.currentTime = 0.3;
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      expect(result.current.currentTime).toBe(0.3);
      expect(result.current.currentLine).toEqual(sampleLines[0]);
      expect(result.current.currentLineIndex).toBe(0);
    });

    it('handles null video ref', () => {
      const videoRef = { current: null };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      expect(result.current.currentTime).toBe(0);
      expect(result.current.currentLine).toBeNull();
    });
  });

  // ============================================================================
  // Event Listener Tests
  // ============================================================================

  describe('Event listeners', () => {
    it('adds timeupdate and seeked event listeners', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      renderHook(() => useSubtitleSync(videoRef, sampleLines));

      expect(mockVideo.addEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
      expect(mockVideo.addEventListener).toHaveBeenCalledWith('seeked', expect.any(Function));
    });

    it('removes event listeners on unmount', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { unmount } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      unmount();

      expect(mockVideo.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
      expect(mockVideo.removeEventListener).toHaveBeenCalledWith('seeked', expect.any(Function));
    });

    it('updates state on timeupdate event', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      act(() => {
        mockVideo.currentTime = 2.4;
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentTime).toBe(2.4);
      expect(result.current.currentLine).toEqual(sampleLines[1]);
      expect(result.current.currentLineIndex).toBe(1);
    });

    it('updates state on seeked event', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      act(() => {
        mockVideo.currentTime = 0.7;
        mockVideo._triggerEvent('seeked');
      });

      expect(result.current.currentTime).toBe(0.7);
      expect(result.current.currentLine).toEqual(sampleLines[0]);
    });
  });

  // ============================================================================
  // Line Detection Tests
  // ============================================================================

  describe('Line detection', () => {
    it('finds correct line when time is within line bounds', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      act(() => {
        mockVideo.currentTime = 0.5;
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentLineIndex).toBe(0);
      expect(result.current.currentLine).toEqual(sampleLines[0]);
    });

    it('returns null line when time is between lines', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      act(() => {
        mockVideo.currentTime = 1.5;
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentLineIndex).toBe(-1);
      expect(result.current.currentLine).toBeNull();
    });

    it('returns null line when time is before all lines', () => {
      const linesStartingLater: SubtitleLine[] = [
        {
          words: [{ text: 'Test', startTime: 5, endTime: 6 }],
          startTime: 5,
          endTime: 6,
        },
      ];

      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, linesStartingLater));

      expect(result.current.currentLineIndex).toBe(-1);
      expect(result.current.currentLine).toBeNull();
    });
  });

  // ============================================================================
  // Word Detection Tests
  // ============================================================================

  describe('Word detection', () => {
    it('finds correct word index when time matches word', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      act(() => {
        mockVideo.currentTime = 0.3; // Within 'Hello' (0-0.5)
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentWordIndex).toBe(0);
    });

    it('updates word index as time progresses', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      // First word
      act(() => {
        mockVideo.currentTime = 0.3;
        mockVideo._triggerEvent('timeupdate');
      });
      expect(result.current.currentWordIndex).toBe(0);

      // Second word
      act(() => {
        mockVideo.currentTime = 0.7;
        mockVideo._triggerEvent('timeupdate');
      });
      expect(result.current.currentWordIndex).toBe(1);
    });

    it('finds correct word in multi-word line', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      // "This" at 2.0-2.3
      act(() => {
        mockVideo.currentTime = 2.1;
        mockVideo._triggerEvent('timeupdate');
      });
      expect(result.current.currentWordIndex).toBe(0);

      // "is" at 2.3-2.5
      act(() => {
        mockVideo.currentTime = 2.4;
        mockVideo._triggerEvent('timeupdate');
      });
      expect(result.current.currentWordIndex).toBe(1);

      // "a" at 2.5-2.6
      act(() => {
        mockVideo.currentTime = 2.55;
        mockVideo._triggerEvent('timeupdate');
      });
      expect(result.current.currentWordIndex).toBe(2);

      // "test" at 2.6-3.0
      act(() => {
        mockVideo.currentTime = 2.8;
        mockVideo._triggerEvent('timeupdate');
      });
      expect(result.current.currentWordIndex).toBe(3);
    });

    it('returns -1 word index when no line is active', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, sampleLines));

      act(() => {
        mockVideo.currentTime = 1.5; // Between lines
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentWordIndex).toBe(-1);
    });
  });

  // ============================================================================
  // Empty Lines Handling Tests
  // ============================================================================

  describe('Empty lines handling', () => {
    it('handles empty lines array', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      const { result } = renderHook(() => useSubtitleSync(videoRef, []));

      act(() => {
        mockVideo.currentTime = 1.0;
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentLine).toBeNull();
      expect(result.current.currentLineIndex).toBe(-1);
      expect(result.current.currentWordIndex).toBe(-1);
    });
  });

  // ============================================================================
  // Lines Change Handling Tests
  // ============================================================================

  describe('Lines change handling', () => {
    it('uses new lines on next timeupdate event after lines prop changes', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      // Start at time 10.0 - outside the original sampleLines range
      mockVideo.currentTime = 10.0;

      const { result, rerender } = renderHook(
        ({ lines }) => useSubtitleSync(videoRef, lines),
        { initialProps: { lines: sampleLines } }
      );

      // Initial state: no matching line at time 10.0
      expect(result.current.currentLine).toBeNull();

      // Change to new lines that DO match time 10.0
      const newLines: SubtitleLine[] = [
        {
          words: [{ text: 'New', startTime: 9.5, endTime: 10.5 }],
          startTime: 9.5,
          endTime: 10.5,
        },
      ];

      rerender({ lines: newLines });

      // Trigger update with timeupdate event - the hook uses the new lines via ref
      act(() => {
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentLine).toEqual(newLines[0]);
    });

    it('returns null line when new lines do not match current time', () => {
      const videoRef = { current: mockVideo as HTMLVideoElement };
      mockVideo.currentTime = 5.0; // Time outside both line sets

      const { result, rerender } = renderHook(
        ({ lines }) => useSubtitleSync(videoRef, lines),
        { initialProps: { lines: sampleLines } }
      );

      expect(result.current.currentLine).toBeNull();

      // Change to new lines that also don't match current time
      const newLines: SubtitleLine[] = [
        {
          words: [{ text: 'New', startTime: 0.4, endTime: 0.6 }],
          startTime: 0.4,
          endTime: 0.6,
        },
      ];

      rerender({ lines: newLines });

      act(() => {
        mockVideo._triggerEvent('timeupdate');
      });

      expect(result.current.currentLine).toBeNull();
    });
  });
});
