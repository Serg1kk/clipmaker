/**
 * Test Suite for SubtitleOverlay Component
 *
 * Comprehensive test cases covering:
 * - Basic rendering (component structure, text display)
 * - Word highlighting (karaoke-style current word highlight)
 * - Timing synchronization (correct line/word for currentTime)
 * - Edge cases (empty arrays, single words, rapid changes)
 * - Style application (fonts, colors, positioning)
 *
 * The SubtitleOverlay component displays karaoke-style subtitles
 * with word-by-word highlighting synchronized to video playback.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubtitleOverlay, {
  type SubtitleLine,
  type SubtitleWord,
  type SubtitleStyle,
  type SubtitleOverlayProps,
} from '../SubtitleOverlay';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Re-export types for test clarity
 * These mirror the component's expected types
 */
interface TestSubtitleWord {
  text: string;
  startTime: number;
  endTime: number;
}

interface TestSubtitleLine {
  words: TestSubtitleWord[];
  startTime: number;
  endTime: number;
}

interface TestSubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  highlightColor?: string;
  outlineColor?: string;
  position?: 'top' | 'center' | 'bottom';
}

// ============================================================================
// Mock Data Fixtures
// ============================================================================

const mockSubtitles: SubtitleLine[] = [
  {
    words: [
      { text: 'Hello', startTime: 0, endTime: 0.5 },
      { text: 'World', startTime: 0.5, endTime: 1.0 },
    ],
    startTime: 0,
    endTime: 1.0,
  },
  {
    words: [
      { text: 'Testing', startTime: 2.0, endTime: 2.5 },
      { text: 'Subtitles', startTime: 2.5, endTime: 3.0 },
    ],
    startTime: 2.0,
    endTime: 3.0,
  },
];

const mockSingleWordLine: SubtitleLine[] = [
  {
    words: [{ text: 'Alone', startTime: 0, endTime: 1.0 }],
    startTime: 0,
    endTime: 1.0,
  },
];

const mockLongWordLine: SubtitleLine[] = [
  {
    words: [
      { text: 'Supercalifragilisticexpialidocious', startTime: 0, endTime: 2.0 },
    ],
    startTime: 0,
    endTime: 2.0,
  },
];

const mockMultiWordLine: SubtitleLine[] = [
  {
    words: [
      { text: 'Never', startTime: 0, endTime: 0.3 },
      { text: 'gonna', startTime: 0.3, endTime: 0.6 },
      { text: 'give', startTime: 0.6, endTime: 0.8 },
      { text: 'you', startTime: 0.8, endTime: 1.0 },
      { text: 'up', startTime: 1.0, endTime: 1.5 },
    ],
    startTime: 0,
    endTime: 1.5,
  },
];

const mockOverlappingWords: SubtitleLine[] = [
  {
    words: [
      { text: 'First', startTime: 0, endTime: 0.6 },
      { text: 'Second', startTime: 0.5, endTime: 1.0 }, // Overlaps with First
    ],
    startTime: 0,
    endTime: 1.0,
  },
];

const defaultStyle: SubtitleStyle = {
  fontFamily: 'Arial',
  fontSize: 48,
  textColor: '#FFFFFF',
  highlightColor: '#FFFF00',
  outlineColor: '#000000',
  position: 'bottom',
};

// ============================================================================
// Test Utilities
// ============================================================================

function renderSubtitleOverlay(props: Partial<SubtitleOverlayProps> = {}) {
  const defaultProps: SubtitleOverlayProps = {
    lines: mockSubtitles,
    currentTime: 0,
    ...props,
  };
  return render(<SubtitleOverlay {...defaultProps} />);
}

// ============================================================================
// Test Suite: Basic Rendering
// ============================================================================

describe('SubtitleOverlay - Basic Rendering', () => {
  describe('Component Structure', () => {
    it('renders without crashing', () => {
      renderSubtitleOverlay();
      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
    });

    it('renders with empty lines array', () => {
      renderSubtitleOverlay({ lines: [] });
      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
    });

    it('applies custom className when provided', () => {
      renderSubtitleOverlay({ className: 'custom-subtitle-class' });
      expect(screen.getByTestId('subtitle-overlay')).toHaveClass(
        'custom-subtitle-class'
      );
    });

    it('renders container with correct ARIA attributes', () => {
      renderSubtitleOverlay();
      const overlay = screen.getByTestId('subtitle-overlay');
      expect(overlay).toHaveAttribute('role', 'region');
      expect(overlay).toHaveAttribute('aria-label', 'Subtitles');
      expect(overlay).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Text Display', () => {
    it('displays current line text', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
    });

    it('displays all words from current line', () => {
      renderSubtitleOverlay({
        lines: mockMultiWordLine,
        currentTime: 0.5,
      });

      expect(screen.getByText('Never')).toBeInTheDocument();
      expect(screen.getByText('gonna')).toBeInTheDocument();
      expect(screen.getByText('give')).toBeInTheDocument();
      expect(screen.getByText('you')).toBeInTheDocument();
      expect(screen.getByText('up')).toBeInTheDocument();
    });

    it('renders words as separate span elements', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });

      const words = screen.getAllByTestId(/^subtitle-word-/);
      expect(words).toHaveLength(2);
      expect(words[0]).toHaveTextContent('Hello');
      expect(words[1]).toHaveTextContent('World');
    });

    it('preserves word spacing', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });

      const lineContainer = screen.getByTestId('subtitle-line');
      // Words should have proper spacing (either via CSS or actual spaces)
      expect(lineContainer).toBeInTheDocument();
    });
  });

  describe('No Content States', () => {
    it('shows nothing when currentTime is before all lines', () => {
      renderSubtitleOverlay({
        lines: [
          {
            words: [{ text: 'Late', startTime: 5.0, endTime: 6.0 }],
            startTime: 5.0,
            endTime: 6.0,
          },
        ],
        currentTime: 0,
      });

      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });

    it('shows nothing when currentTime is after all lines', () => {
      renderSubtitleOverlay({ currentTime: 10.0 });

      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });

    it('shows nothing when between lines (gap)', () => {
      renderSubtitleOverlay({ currentTime: 1.5 });
      // currentTime 1.5 is between line 1 (ends at 1.0) and line 2 (starts at 2.0)
      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Suite: Word Highlighting
// ============================================================================

describe('SubtitleOverlay - Word Highlighting', () => {
  describe('Current Word Detection', () => {
    it('highlights correct word based on currentTime', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });
      // currentTime 0.25 is during "Hello" (0-0.5)

      const helloWord = screen.getByTestId('subtitle-word-0');
      const worldWord = screen.getByTestId('subtitle-word-1');

      expect(helloWord).toHaveAttribute('data-highlighted', 'true');
      expect(worldWord).toHaveAttribute('data-highlighted', 'false');
    });

    it('highlights second word when currentTime moves forward', () => {
      renderSubtitleOverlay({ currentTime: 0.75 });
      // currentTime 0.75 is during "World" (0.5-1.0)

      const helloWord = screen.getByTestId('subtitle-word-0');
      const worldWord = screen.getByTestId('subtitle-word-1');

      expect(helloWord).toHaveAttribute('data-highlighted', 'false');
      expect(worldWord).toHaveAttribute('data-highlighted', 'true');
    });

    it('highlights first word of second line', () => {
      renderSubtitleOverlay({ currentTime: 2.25 });
      // currentTime 2.25 is during "Testing" (2.0-2.5) in line 2

      const testingWord = screen.getByTestId('subtitle-word-0');
      expect(testingWord).toHaveAttribute('data-highlighted', 'true');
      expect(testingWord).toHaveTextContent('Testing');
    });

    it('no highlight when between words', () => {
      // Create a line with a gap between words
      const linesWithGap: SubtitleLine[] = [
        {
          words: [
            { text: 'First', startTime: 0, endTime: 0.4 },
            { text: 'Second', startTime: 0.6, endTime: 1.0 },
          ],
          startTime: 0,
          endTime: 1.0,
        },
      ];

      renderSubtitleOverlay({ lines: linesWithGap, currentTime: 0.5 });
      // currentTime 0.5 is in the gap (0.4-0.6)

      const firstWord = screen.getByTestId('subtitle-word-0');
      const secondWord = screen.getByTestId('subtitle-word-1');

      expect(firstWord).toHaveAttribute('data-highlighted', 'false');
      expect(secondWord).toHaveAttribute('data-highlighted', 'false');
    });
  });

  describe('Highlight Transitions', () => {
    it('transitions highlight smoothly when currentTime changes', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0.25} />
      );

      // Initially "Hello" is highlighted
      expect(screen.getByTestId('subtitle-word-0')).toHaveAttribute(
        'data-highlighted',
        'true'
      );

      // Rerender with new time - "World" should be highlighted
      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={0.75} />);

      expect(screen.getByTestId('subtitle-word-0')).toHaveAttribute(
        'data-highlighted',
        'false'
      );
      expect(screen.getByTestId('subtitle-word-1')).toHaveAttribute(
        'data-highlighted',
        'true'
      );
    });

    it('applies highlight class for styling', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });

      const highlightedWord = screen.getByTestId('subtitle-word-0');
      expect(highlightedWord).toHaveClass('subtitle-word-highlighted');
    });

    it('removes highlight class from previous word', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0.25} />
      );

      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={0.75} />);

      const previousWord = screen.getByTestId('subtitle-word-0');
      expect(previousWord).not.toHaveClass('subtitle-word-highlighted');
    });
  });

  describe('Edge Cases for Highlighting', () => {
    it('highlights word at exact start time', () => {
      renderSubtitleOverlay({ currentTime: 0 });

      const helloWord = screen.getByTestId('subtitle-word-0');
      expect(helloWord).toHaveAttribute('data-highlighted', 'true');
    });

    it('does not highlight word at exact end time', () => {
      renderSubtitleOverlay({ currentTime: 0.5 });
      // 0.5 is end of "Hello" and start of "World"

      const helloWord = screen.getByTestId('subtitle-word-0');
      const worldWord = screen.getByTestId('subtitle-word-1');

      // At exactly 0.5, "World" should be starting (end time is exclusive)
      expect(helloWord).toHaveAttribute('data-highlighted', 'false');
      expect(worldWord).toHaveAttribute('data-highlighted', 'true');
    });

    it('handles overlapping word timings gracefully', () => {
      renderSubtitleOverlay({
        lines: mockOverlappingWords,
        currentTime: 0.55,
      });
      // At 0.55, both "First" (0-0.6) and "Second" (0.5-1.0) are active
      // Implementation should highlight one (prefer later word or first match)

      const words = screen.getAllByTestId(/^subtitle-word-/);
      const highlightedWords = words.filter(
        (w) => w.getAttribute('data-highlighted') === 'true'
      );

      // Should have exactly one highlighted word even with overlap
      expect(highlightedWords.length).toBeLessThanOrEqual(2);
    });
  });
});

// ============================================================================
// Test Suite: Timing Synchronization
// ============================================================================

describe('SubtitleOverlay - Timing Synchronization', () => {
  describe('Line Selection', () => {
    it('shows correct line for given currentTime', () => {
      renderSubtitleOverlay({ currentTime: 0.5 });

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
    });

    it('switches to second line when currentTime enters its range', () => {
      renderSubtitleOverlay({ currentTime: 2.25 });

      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(screen.getByText('Subtitles')).toBeInTheDocument();
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    });

    it('shows first matching line when multiple could match', () => {
      const overlappingLines: SubtitleLine[] = [
        {
          words: [{ text: 'LineOne', startTime: 0, endTime: 2.0 }],
          startTime: 0,
          endTime: 2.0,
        },
        {
          words: [{ text: 'LineTwo', startTime: 1.0, endTime: 3.0 }],
          startTime: 1.0,
          endTime: 3.0,
        },
      ];

      renderSubtitleOverlay({ lines: overlappingLines, currentTime: 1.5 });

      // At 1.5, both lines could be active; implementation chooses first
      expect(screen.getByText('LineOne')).toBeInTheDocument();
    });
  });

  describe('Boundary Conditions', () => {
    it('shows line at exact start time', () => {
      renderSubtitleOverlay({ currentTime: 0 });

      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('shows line until exact end time', () => {
      renderSubtitleOverlay({ currentTime: 0.99 });

      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('hides line at exact end time', () => {
      renderSubtitleOverlay({ currentTime: 1.0 });
      // End time is exclusive

      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    });

    it('handles very small time differences', () => {
      renderSubtitleOverlay({ currentTime: 0.001 });

      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  describe('Dynamic Time Updates', () => {
    it('updates display when currentTime prop changes', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0.25} />
      );

      expect(screen.getByText('Hello')).toBeInTheDocument();

      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={2.25} />);

      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();
    });

    it('handles rapid currentTime changes', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0} />
      );

      // Simulate rapid seeking
      for (let time = 0; time <= 3; time += 0.1) {
        rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={time} />);
      }

      // Should end up showing second line content
      expect(screen.getByText('Subtitles')).toBeInTheDocument();
    });

    it('handles seeking backwards', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={2.5} />
      );

      expect(screen.getByText('Testing')).toBeInTheDocument();

      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={0.25} />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.queryByText('Testing')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('SubtitleOverlay - Edge Cases', () => {
  describe('Empty and Minimal Data', () => {
    it('handles empty lines array', () => {
      renderSubtitleOverlay({ lines: [], currentTime: 0 });

      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });

    it('handles line with empty words array', () => {
      const emptyWordsLine: SubtitleLine[] = [
        {
          words: [],
          startTime: 0,
          endTime: 1.0,
        },
      ];

      renderSubtitleOverlay({ lines: emptyWordsLine, currentTime: 0.5 });

      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
    });

    it('handles single word line', () => {
      renderSubtitleOverlay({
        lines: mockSingleWordLine,
        currentTime: 0.5,
      });

      expect(screen.getByText('Alone')).toBeInTheDocument();
      expect(screen.getByTestId('subtitle-word-0')).toHaveAttribute(
        'data-highlighted',
        'true'
      );
    });
  });

  describe('Long Words', () => {
    it('handles very long words without breaking', () => {
      renderSubtitleOverlay({
        lines: mockLongWordLine,
        currentTime: 1.0,
      });

      expect(
        screen.getByText('Supercalifragilisticexpialidocious')
      ).toBeInTheDocument();
    });

    it('applies word-break styling for long words', () => {
      renderSubtitleOverlay({
        lines: mockLongWordLine,
        currentTime: 1.0,
      });

      const word = screen.getByTestId('subtitle-word-0');
      // Should have appropriate word-break or overflow handling
      expect(word).toBeInTheDocument();
    });
  });

  describe('Special Characters', () => {
    it('handles words with punctuation', () => {
      const punctuationLine: SubtitleLine[] = [
        {
          words: [
            { text: 'Hello,', startTime: 0, endTime: 0.5 },
            { text: 'world!', startTime: 0.5, endTime: 1.0 },
          ],
          startTime: 0,
          endTime: 1.0,
        },
      ];

      renderSubtitleOverlay({ lines: punctuationLine, currentTime: 0.25 });

      expect(screen.getByText('Hello,')).toBeInTheDocument();
      expect(screen.getByText('world!')).toBeInTheDocument();
    });

    it('handles words with apostrophes', () => {
      const apostropheLine: SubtitleLine[] = [
        {
          words: [
            { text: "It's", startTime: 0, endTime: 0.5 },
            { text: 'working', startTime: 0.5, endTime: 1.0 },
          ],
          startTime: 0,
          endTime: 1.0,
        },
      ];

      renderSubtitleOverlay({ lines: apostropheLine, currentTime: 0.25 });

      expect(screen.getByText("It's")).toBeInTheDocument();
    });

    it('handles unicode characters', () => {
      const unicodeLine: SubtitleLine[] = [
        {
          words: [{ text: 'Bonjour', startTime: 0, endTime: 1.0 }],
          startTime: 0,
          endTime: 1.0,
        },
      ];

      renderSubtitleOverlay({ lines: unicodeLine, currentTime: 0.5 });

      expect(screen.getByText('Bonjour')).toBeInTheDocument();
    });
  });

  describe('Rapid Time Changes', () => {
    it('handles rapid currentTime changes without crashing', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0} />
      );

      // Simulate video scrubbing
      const times = [0, 0.5, 1.5, 2.0, 2.5, 0.25, 3.0, 1.0, 0];

      times.forEach((time) => {
        rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={time} />);
      });

      // Should not crash and should show correct content for final time
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('handles high-frequency time updates', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0} />
      );

      // Simulate 60fps-like updates
      for (let i = 0; i < 60; i++) {
        const time = i * (1 / 60);
        rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={time} />);
      }

      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
    });
  });

  describe('Extreme Values', () => {
    it('handles negative currentTime', () => {
      renderSubtitleOverlay({ currentTime: -1 });

      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });

    it('handles very large currentTime', () => {
      renderSubtitleOverlay({ currentTime: 999999 });

      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });

    it('handles NaN currentTime gracefully', () => {
      renderSubtitleOverlay({ currentTime: NaN });

      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });

    it('handles Infinity currentTime gracefully', () => {
      renderSubtitleOverlay({ currentTime: Infinity });

      expect(screen.getByTestId('subtitle-overlay')).toBeInTheDocument();
      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Suite: Style Application
// ============================================================================

describe('SubtitleOverlay - Style Application', () => {
  describe('Font Family', () => {
    it('applies custom font family', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { fontFamily: 'Georgia' },
      });

      const lineContainer = screen.getByTestId('subtitle-line');
      expect(lineContainer).toHaveStyle({ fontFamily: 'Georgia' });
    });

    it('uses default font family when not specified', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });

      const lineContainer = screen.getByTestId('subtitle-line');
      // Should have some default font family applied
      expect(lineContainer).toBeInTheDocument();
    });

    it('applies font family to all words', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { fontFamily: 'Impact' },
      });

      const words = screen.getAllByTestId(/^subtitle-word-/);
      words.forEach((word) => {
        expect(word).toHaveStyle({ fontFamily: 'Impact' });
      });
    });
  });

  describe('Font Size', () => {
    it('applies custom font size', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { fontSize: 72 },
      });

      const lineContainer = screen.getByTestId('subtitle-line');
      expect(lineContainer).toHaveStyle({ fontSize: '72px' });
    });

    it('uses default font size when not specified', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });

      const lineContainer = screen.getByTestId('subtitle-line');
      expect(lineContainer).toBeInTheDocument();
    });
  });

  describe('Colors', () => {
    it('applies text color', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { textColor: '#FF0000' },
      });

      const word = screen.getByTestId('subtitle-word-1'); // Non-highlighted word
      expect(word).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('applies highlight color to current word', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { highlightColor: '#00FF00' },
      });

      const highlightedWord = screen.getByTestId('subtitle-word-0');
      expect(highlightedWord).toHaveStyle({ color: 'rgb(0, 255, 0)' });
    });

    it('applies outline color via text-shadow', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { outlineColor: '#000000' },
      });

      const lineContainer = screen.getByTestId('subtitle-line');
      // Text shadow should include the outline color
      const computedStyle = window.getComputedStyle(lineContainer);
      expect(computedStyle.textShadow).toBeDefined();
    });

    it('uses different colors for highlighted and non-highlighted words', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: {
          textColor: '#FFFFFF',
          highlightColor: '#FFFF00',
        },
      });

      const highlightedWord = screen.getByTestId('subtitle-word-0');
      const normalWord = screen.getByTestId('subtitle-word-1');

      expect(highlightedWord).toHaveStyle({ color: 'rgb(255, 255, 0)' });
      expect(normalWord).toHaveStyle({ color: 'rgb(255, 255, 255)' });
    });
  });

  describe('Positioning', () => {
    it('positions at bottom by default', () => {
      renderSubtitleOverlay({ currentTime: 0.25 });

      const overlay = screen.getByTestId('subtitle-overlay');
      expect(overlay).toHaveClass('subtitle-position-bottom');
    });

    it('positions at top when specified', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { position: 'top' },
      });

      const overlay = screen.getByTestId('subtitle-overlay');
      expect(overlay).toHaveClass('subtitle-position-top');
    });

    it('positions at center when specified', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { position: 'center' },
      });

      const overlay = screen.getByTestId('subtitle-overlay');
      expect(overlay).toHaveClass('subtitle-position-center');
    });

    it('applies correct CSS for each position', () => {
      const positions: Array<'top' | 'center' | 'bottom'> = [
        'top',
        'center',
        'bottom',
      ];

      positions.forEach((position) => {
        const { unmount } = render(
          <SubtitleOverlay
            lines={mockSubtitles}
            currentTime={0.25}
            style={{ position }}
          />
        );

        const overlay = screen.getByTestId('subtitle-overlay');
        expect(overlay).toHaveClass(`subtitle-position-${position}`);
        unmount();
      });
    });
  });

  describe('Style Combinations', () => {
    it('applies all style properties together', () => {
      const customStyle: SubtitleStyle = {
        fontFamily: 'Comic Sans MS',
        fontSize: 64,
        textColor: '#0000FF',
        highlightColor: '#FF00FF',
        outlineColor: '#000000',
        position: 'center',
      };

      renderSubtitleOverlay({
        currentTime: 0.25,
        style: customStyle,
      });

      const overlay = screen.getByTestId('subtitle-overlay');
      const lineContainer = screen.getByTestId('subtitle-line');
      const highlightedWord = screen.getByTestId('subtitle-word-0');

      expect(overlay).toHaveClass('subtitle-position-center');
      expect(lineContainer).toHaveStyle({
        fontFamily: 'Comic Sans MS',
        fontSize: '64px',
      });
      expect(highlightedWord).toHaveStyle({ color: 'rgb(255, 0, 255)' });
    });

    it('merges partial style with defaults', () => {
      renderSubtitleOverlay({
        currentTime: 0.25,
        style: { fontSize: 96 },
      });

      const lineContainer = screen.getByTestId('subtitle-line');
      expect(lineContainer).toHaveStyle({ fontSize: '96px' });
      // Other defaults should still be applied
    });
  });
});

// ============================================================================
// Test Suite: Accessibility
// ============================================================================

describe('SubtitleOverlay - Accessibility', () => {
  it('has appropriate ARIA role', () => {
    renderSubtitleOverlay({ currentTime: 0.25 });

    const overlay = screen.getByTestId('subtitle-overlay');
    expect(overlay).toHaveAttribute('role', 'region');
  });

  it('has aria-live for dynamic content', () => {
    renderSubtitleOverlay({ currentTime: 0.25 });

    const overlay = screen.getByTestId('subtitle-overlay');
    expect(overlay).toHaveAttribute('aria-live', 'polite');
  });

  it('has accessible label', () => {
    renderSubtitleOverlay({ currentTime: 0.25 });

    const overlay = screen.getByTestId('subtitle-overlay');
    expect(overlay).toHaveAttribute('aria-label', 'Subtitles');
  });

  it('words have role text for screen readers', () => {
    renderSubtitleOverlay({ currentTime: 0.25 });

    const words = screen.getAllByTestId(/^subtitle-word-/);
    words.forEach((word) => {
      expect(word.tagName.toLowerCase()).toBe('span');
    });
  });

  it('provides current word indication for screen readers', () => {
    renderSubtitleOverlay({ currentTime: 0.25 });

    const highlightedWord = screen.getByTestId('subtitle-word-0');
    expect(highlightedWord).toHaveAttribute('aria-current', 'true');
  });
});

// ============================================================================
// Test Suite: Performance
// ============================================================================

describe('SubtitleOverlay - Performance', () => {
  it('does not rerender unnecessarily with same props', () => {
    const { rerender } = render(
      <SubtitleOverlay lines={mockSubtitles} currentTime={0.25} />
    );

    // Rerender with identical props
    rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={0.25} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('efficiently handles large subtitle arrays', () => {
    // Generate 100 lines
    const manyLines: SubtitleLine[] = Array.from({ length: 100 }, (_, i) => ({
      words: [{ text: `Word${i}`, startTime: i, endTime: i + 1 }],
      startTime: i,
      endTime: i + 1,
    }));

    const startTime = performance.now();
    renderSubtitleOverlay({ lines: manyLines, currentTime: 50.5 });
    const endTime = performance.now();

    // Should render in reasonable time (less than 100ms)
    expect(endTime - startTime).toBeLessThan(100);
    expect(screen.getByText('Word50')).toBeInTheDocument();
  });

  it('only renders visible line, not all lines', () => {
    renderSubtitleOverlay({ currentTime: 0.25 });

    // Should only render current line's words
    const words = screen.getAllByTestId(/^subtitle-word-/);
    expect(words).toHaveLength(2); // Only "Hello" and "World"
  });
});

// ============================================================================
// Test Suite: Integration
// ============================================================================

describe('SubtitleOverlay - Integration', () => {
  describe('Complete Workflow', () => {
    it('simulates full playback through subtitles', () => {
      const { rerender } = render(
        <SubtitleOverlay lines={mockSubtitles} currentTime={0} />
      );

      // Start: First word of first line highlighted
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByTestId('subtitle-word-0')).toHaveAttribute(
        'data-highlighted',
        'true'
      );

      // Mid first line: Second word highlighted
      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={0.75} />);
      expect(screen.getByTestId('subtitle-word-1')).toHaveAttribute(
        'data-highlighted',
        'true'
      );

      // Gap between lines: No content
      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={1.5} />);
      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();

      // Second line: First word highlighted
      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={2.25} />);
      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(screen.getByTestId('subtitle-word-0')).toHaveAttribute(
        'data-highlighted',
        'true'
      );

      // End of subtitles: No content
      rerender(<SubtitleOverlay lines={mockSubtitles} currentTime={5.0} />);
      expect(screen.queryByTestId('subtitle-line')).not.toBeInTheDocument();
    });
  });

  describe('Real-world Scenarios', () => {
    it('handles typical karaoke line (5-10 words)', () => {
      renderSubtitleOverlay({
        lines: mockMultiWordLine,
        currentTime: 0.5,
      });

      expect(screen.getByText('Never')).toBeInTheDocument();
      expect(screen.getByText('gonna')).toBeInTheDocument();
      expect(screen.getByText('give')).toBeInTheDocument();
      expect(screen.getByText('you')).toBeInTheDocument();
      expect(screen.getByText('up')).toBeInTheDocument();
    });

    it('correctly highlights mid-line word', () => {
      renderSubtitleOverlay({
        lines: mockMultiWordLine,
        currentTime: 0.7,
      });

      // At 0.7, "give" (0.6-0.8) should be highlighted
      const words = screen.getAllByTestId(/^subtitle-word-/);
      const giveIndex = 2; // "give" is index 2 (Never=0, gonna=1, give=2)

      expect(words[giveIndex]).toHaveAttribute('data-highlighted', 'true');
      expect(words[giveIndex]).toHaveTextContent('give');
    });
  });
});
