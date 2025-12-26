/**
 * Subtitle type definitions for the SubtitleOverlay component
 */

/**
 * Represents a single word within a subtitle line with precise timing
 */
export interface SubtitleWord {
  /** The word text content */
  text: string;
  /** Start time in seconds when this word should begin highlighting */
  startTime: number;
  /** End time in seconds when this word highlighting should end */
  endTime: number;
}

/**
 * Represents a complete subtitle line containing multiple words
 */
export interface SubtitleLine {
  /** Array of words with individual timing */
  words: SubtitleWord[];
  /** Start time in seconds when the entire line appears */
  startTime: number;
  /** End time in seconds when the entire line disappears */
  endTime: number;
}

/**
 * Vertical position options for subtitle placement
 */
export type SubtitlePosition = 'top' | 'center' | 'bottom';

/**
 * Complete styling configuration for subtitle display
 */
export interface SubtitleStyle {
  /** Font family for subtitle text */
  fontFamily?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Default text color (hex format) */
  textColor?: string;
  /** Color for the currently active/highlighted word */
  highlightColor?: string;
  /** Background color behind the subtitle text */
  backgroundColor?: string;
  /** Vertical position of subtitles on the video */
  position?: SubtitlePosition;
  /** Text outline/stroke color for visibility */
  outlineColor?: string;
  /** Text outline/stroke width in pixels */
  outlineWidth?: number;
}

/**
 * Props for the SubtitleOverlay component
 */
export interface SubtitleOverlayProps {
  /** Array of subtitle lines with word-level timing */
  lines: SubtitleLine[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Optional styling configuration */
  style?: SubtitleStyle;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Return type for the useSubtitleSync hook
 */
export interface SubtitleSyncState {
  /** Current video playback time in seconds */
  currentTime: number;
  /** The currently active subtitle line, or null if none */
  currentLine: SubtitleLine | null;
  /** Index of the current line in the lines array, or -1 if none */
  currentLineIndex: number;
  /** Index of the currently active word within the current line, or -1 if none */
  currentWordIndex: number;
}

/**
 * Default subtitle style values
 */
export const DEFAULT_SUBTITLE_STYLE: Required<SubtitleStyle> = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 24,
  textColor: '#FFFFFF',
  highlightColor: '#FFFF00',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  position: 'bottom',
  outlineColor: '#000000',
  outlineWidth: 2,
};
