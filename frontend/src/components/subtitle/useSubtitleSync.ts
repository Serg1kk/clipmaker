import { useState, useEffect, useRef, RefObject } from 'react';
import { SubtitleLine, SubtitleSyncState } from './types';

/**
 * Binary search to find the active subtitle line for a given time
 * Returns the index of the line that contains the time, or -1 if none
 */
function findActiveLineIndex(lines: SubtitleLine[], time: number): number {
  if (lines.length === 0) return -1;

  let left = 0;
  let right = lines.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const line = lines[mid];

    if (time >= line.startTime && time <= line.endTime) {
      return mid;
    }

    if (time < line.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}

/**
 * Binary search to find the active word index within a line for a given time
 * Returns the index of the word that contains the time, or -1 if none
 */
function findActiveWordIndex(line: SubtitleLine, time: number): number {
  const { words } = line;
  if (words.length === 0) return -1;

  let left = 0;
  let right = words.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const word = words[mid];

    if (time >= word.startTime && time <= word.endTime) {
      return mid;
    }

    if (time < word.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // If no exact match, find the word that was just spoken
  // (useful for the transition between words)
  for (let i = words.length - 1; i >= 0; i--) {
    if (time >= words[i].startTime) {
      return i;
    }
  }

  return -1;
}

/**
 * Custom hook for synchronizing subtitle display with video playback
 *
 * Features:
 * - Listens to video timeupdate events
 * - Uses binary search for efficient line/word lookup
 * - Returns current line and word indices for highlighting
 *
 * @param videoRef - Reference to the HTML video element
 * @param lines - Array of subtitle lines with word-level timing
 * @returns SubtitleSyncState with current time, line, and word information
 *
 * @example
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null);
 * const { currentTime, currentLine, currentWordIndex } = useSubtitleSync(videoRef, subtitleLines);
 * ```
 */
export function useSubtitleSync(
  videoRef: RefObject<HTMLVideoElement | null>,
  lines: SubtitleLine[]
): SubtitleSyncState {
  const [state, setState] = useState<SubtitleSyncState>({
    currentTime: 0,
    currentLine: null,
    currentLineIndex: -1,
    currentWordIndex: -1,
  });

  // Use ref to avoid stale closure issues and infinite loops
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Listen to video timeupdate events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSubtitleState = (time: number) => {
      const currentLines = linesRef.current;
      const lineIndex = findActiveLineIndex(currentLines, time);
      const line = lineIndex >= 0 ? currentLines[lineIndex] : null;
      const wordIndex = line ? findActiveWordIndex(line, time) : -1;

      setState((prev) => {
        // Only update if values actually changed to prevent unnecessary re-renders
        if (
          prev.currentTime === time &&
          prev.currentLineIndex === lineIndex &&
          prev.currentWordIndex === wordIndex
        ) {
          return prev;
        }
        return {
          currentTime: time,
          currentLine: line,
          currentLineIndex: lineIndex,
          currentWordIndex: wordIndex,
        };
      });
    };

    const handleTimeUpdate = () => {
      updateSubtitleState(video.currentTime);
    };

    const handleSeeked = () => {
      updateSubtitleState(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);

    // Initialize with current time if video is already loaded
    if (video.readyState >= 1) {
      updateSubtitleState(video.currentTime);
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [videoRef]);

  return state;
}

export default useSubtitleSync;
