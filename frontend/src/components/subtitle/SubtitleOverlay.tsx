import { useMemo } from 'react';
import {
  SubtitleOverlayProps,
  SubtitleLine,
  SubtitleWord,
  SubtitleStyle,
  DEFAULT_SUBTITLE_STYLE,
} from './types';

/**
 * Binary search to find the active subtitle line for a given time
 * Returns the line that contains the time, or null if none
 * Note: End time is exclusive (line ends at endTime)
 */
function findActiveLine(lines: SubtitleLine[], time: number): SubtitleLine | null {
  if (lines.length === 0) return null;

  let left = 0;
  let right = lines.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const line = lines[mid];

    if (time >= line.startTime && time < line.endTime) {
      return line;
    }

    if (time < line.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}

/**
 * Determines if a word is currently active based on the current time
 * Note: End time is exclusive (word ends at endTime, next word starts at endTime)
 */
function isWordActive(word: SubtitleWord, time: number): boolean {
  return time >= word.startTime && time < word.endTime;
}

/**
 * Determines if a word has already been spoken
 */
function isWordSpoken(word: SubtitleWord, time: number): boolean {
  return time >= word.endTime;
}

/**
 * Generates CSS text-shadow for outline effect
 */
function generateTextShadow(color: string, width: number): string {
  const shadows: string[] = [];

  // Create outline effect by placing shadows at multiple angles
  for (let x = -width; x <= width; x++) {
    for (let y = -width; y <= width; y++) {
      if (x !== 0 || y !== 0) {
        shadows.push(`${x}px ${y}px 0 ${color}`);
      }
    }
  }

  return shadows.join(', ');
}

/**
 * SubtitleWord component - Renders a single word with appropriate styling
 */
const SubtitleWordDisplay = ({
  word,
  currentTime,
  textColor,
  highlightColor,
  fontFamily,
  isLast,
  index,
}: {
  word: SubtitleWord;
  currentTime: number;
  textColor: string;
  highlightColor: string;
  fontFamily: string;
  isLast: boolean;
  index: number;
}) => {
  const isActive = isWordActive(word, currentTime);
  const isSpoken = isWordSpoken(word, currentTime);

  // Determine the color based on word state
  // Active words get highlight color, spoken words keep text color
  const color = isActive ? highlightColor : textColor;

  return (
    <span
      className={`
        inline-block transition-colors duration-100
        ${isActive ? 'scale-105 subtitle-word-highlighted' : ''}
      `}
      style={{ color, fontFamily }}
      data-testid={`subtitle-word-${index}`}
      data-highlighted={isActive ? 'true' : 'false'}
      data-spoken={isSpoken ? 'true' : 'false'}
      aria-current={isActive ? 'true' : undefined}
    >
      {word.text}
      {!isLast && '\u00A0'}
    </span>
  );
};

/**
 * SubtitleOverlay - Displays synchronized subtitles over video content
 *
 * Features:
 * - Word-by-word highlighting synchronized with playback time
 * - Configurable styling (font, colors, position, outline)
 * - Text shadow/outline for visibility on any background
 * - Smooth transitions between words
 * - Efficient binary search for line lookup
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <video ref={videoRef} src="video.mp4" />
 *   <SubtitleOverlay
 *     lines={subtitleLines}
 *     currentTime={currentTime}
 *     style={{
 *       fontFamily: 'Arial',
 *       fontSize: 24,
 *       textColor: '#FFFFFF',
 *       highlightColor: '#FFFF00',
 *       position: 'bottom',
 *     }}
 *   />
 * </div>
 * ```
 */
const SubtitleOverlay = ({
  lines,
  currentTime,
  style,
  className = '',
}: SubtitleOverlayProps) => {
  // Merge provided style with defaults
  const mergedStyle: Required<SubtitleStyle> = useMemo(
    () => ({
      ...DEFAULT_SUBTITLE_STYLE,
      ...style,
    }),
    [style]
  );

  // Find the currently active line using binary search
  const activeLine = useMemo(
    () => findActiveLine(lines, currentTime),
    [lines, currentTime]
  );

  // Generate text shadow for outline effect
  const textShadow = useMemo(
    () => generateTextShadow(mergedStyle.outlineColor, mergedStyle.outlineWidth),
    [mergedStyle.outlineColor, mergedStyle.outlineWidth]
  );

  // Position classes based on style.position
  const positionClasses: Record<string, string> = {
    top: 'top-4',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-4',
  };

  return (
    <div
      className={`
        absolute left-0 right-0 flex justify-center
        pointer-events-none z-10
        subtitle-position-${mergedStyle.position}
        ${positionClasses[mergedStyle.position]}
        ${className}
      `}
      role="region"
      aria-label="Subtitles"
      aria-live="polite"
      data-testid="subtitle-overlay"
    >
      {activeLine && (
        <div
          className="inline-block px-4 py-2 rounded max-w-[90%] text-center"
          style={{
            fontFamily: mergedStyle.fontFamily,
            fontSize: `${mergedStyle.fontSize}px`,
            backgroundColor: mergedStyle.backgroundColor,
            textShadow,
          }}
          data-testid="subtitle-line"
        >
          {activeLine.words.map((word, index) => (
            <SubtitleWordDisplay
              key={`${word.text}-${word.startTime}-${index}`}
              word={word}
              currentTime={currentTime}
              textColor={mergedStyle.textColor}
              highlightColor={mergedStyle.highlightColor}
              fontFamily={mergedStyle.fontFamily}
              isLast={index === activeLine.words.length - 1}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SubtitleOverlay;
