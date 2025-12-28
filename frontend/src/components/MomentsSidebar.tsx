import { useCallback } from 'react';
import { TimelineMarker, formatTime } from './timeline/types';

/**
 * Props for the MomentsSidebar component
 */
export interface MomentsSidebarProps {
  /** Array of moments to display */
  moments: TimelineMarker[];
  /** Currently selected moment ID */
  selectedMomentId?: string | null;
  /** Callback when user clicks on a moment row */
  onMomentClick?: (marker: TimelineMarker) => void;
  /** Callback when user deletes a moment */
  onMomentDelete?: (markerId: string) => void;
  /** Callback when user clicks Find More button */
  onFindMore?: () => void;
  /** Whether find-more is currently loading */
  findMoreLoading?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Whether the sidebar is disabled */
  disabled?: boolean;
}

/**
 * Get confidence level label and color based on score
 */
function getConfidenceInfo(confidence: number): { label: string; color: string; percent: number } {
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.8) {
    return { label: 'High', color: 'bg-green-500', percent };
  } else if (confidence >= 0.5) {
    return { label: 'Medium', color: 'bg-yellow-500', percent };
  }
  return { label: 'Low', color: 'bg-red-500', percent };
}

/**
 * Format duration in seconds to a human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * MomentsSidebar component displays a scrollable list of AI-detected moments
 *
 * Features:
 * - Scrollable list of moments
 * - Time range display (formatted)
 * - AI reason/description
 * - Duration badge
 * - Confidence indicator
 * - Click to seek
 * - Delete button
 * - Selected state highlighting
 * - Empty state
 */
const MomentsSidebar = ({
  moments,
  selectedMomentId,
  onMomentClick,
  onMomentDelete,
  onFindMore,
  findMoreLoading = false,
  className = '',
  disabled = false,
}: MomentsSidebarProps) => {
  // Handle moment row click
  const handleMomentClick = useCallback(
    (marker: TimelineMarker) => {
      if (disabled) return;
      onMomentClick?.(marker);
    },
    [disabled, onMomentClick]
  );

  // Handle delete button click
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, markerId: string) => {
      e.stopPropagation(); // Prevent triggering row click
      if (disabled) return;
      onMomentDelete?.(markerId);
    },
    [disabled, onMomentDelete]
  );

  // Handle keyboard navigation for moments
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, marker: TimelineMarker) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleMomentClick(marker);
      }
    },
    [handleMomentClick]
  );

  // Handle keyboard for delete button
  const handleDeleteKeyDown = useCallback(
    (e: React.KeyboardEvent, markerId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          onMomentDelete?.(markerId);
        }
      }
    },
    [disabled, onMomentDelete]
  );

  return (
    <div
      className={`moments-sidebar bg-gray-800 rounded-lg flex flex-col ${className}`}
      data-testid="moments-sidebar"
      role="region"
      aria-label="AI-detected moments"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700" data-testid="moments-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">AI Moments</h2>
            <p className="text-gray-400 text-sm">
              {moments.length} {moments.length === 1 ? 'moment' : 'moments'} detected
            </p>
          </div>
          {/* Find More button in header */}
          {onFindMore && moments.length > 0 && (
            <button
              onClick={onFindMore}
              disabled={findMoreLoading || disabled}
              className={`
                p-2 rounded-lg transition-colors flex items-center gap-1
                ${findMoreLoading || disabled
                  ? 'bg-gray-600 cursor-not-allowed opacity-60'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
                }
              `}
              title="Find more moments"
              data-testid="find-more-header-button"
            >
              {findMoreLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              <span className="text-sm font-medium">More</span>
            </button>
          )}
        </div>
      </div>

      {/* Moments list or Empty state */}
      {moments.length === 0 ? (
        // Empty state
        <div
          className="flex flex-col items-center justify-center flex-1 p-8 text-center"
          data-testid="empty-state"
        >
          <svg
            className="w-16 h-16 text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-400 text-sm">
            No moments detected yet.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Upload a video and analyze it to find engaging moments.
          </p>
        </div>
      ) : (
        <>
        {/* Moments list */}
        <div
          className="flex-1 overflow-y-auto"
          data-testid="moments-list"
          role="list"
        >
          {moments.map((marker, index) => {
            const isSelected = selectedMomentId === marker.id;
            const confidenceInfo = marker.confidence !== undefined
              ? getConfidenceInfo(marker.confidence)
              : null;

            return (
              <div
                key={marker.id}
                className={`
                  px-4 py-3 cursor-pointer transition-colors
                  ${isSelected
                    ? 'bg-blue-600/30 border-l-4 border-blue-500 selected'
                    : 'hover:bg-gray-700/50 border-l-4 border-transparent'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                onClick={() => handleMomentClick(marker)}
                onKeyDown={(e) => handleKeyDown(e, marker)}
                tabIndex={disabled ? -1 : 0}
                role="button"
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`Moment ${index + 1}: ${marker.description || marker.label}`}
                data-testid={`moment-item-${marker.id}`}
                data-selected={isSelected ? 'true' : 'false'}
              >
                {/* Label */}
                <div className="text-white font-medium mb-1">{marker.label}</div>

                {/* Top row: Time range and duration badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-gray-300 font-mono text-sm"
                      data-testid="moment-time"
                    >
                      {formatTime(marker.startTime)} - {formatTime(marker.endTime)}
                    </span>
                    <span
                      className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded-full"
                      data-testid="moment-duration"
                    >
                      {formatDuration(marker.duration)}
                    </span>
                  </div>

                  {/* Delete button */}
                  {onMomentDelete && (
                    <button
                      onClick={(e) => handleDeleteClick(e, marker.id)}
                      onKeyDown={(e) => handleDeleteKeyDown(e, marker.id)}
                      className={`
                        p-1 rounded text-gray-400 hover:text-red-400 hover:bg-gray-600
                        transition-colors
                        ${disabled ? 'pointer-events-none' : ''}
                      `}
                      aria-label={`delete moment ${index + 1}`}
                      data-testid="moment-delete-button"
                      disabled={disabled}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* AI reason/description */}
                {marker.description ? (
                  <p
                    className="text-gray-300 text-sm line-clamp-2 mb-2"
                    data-testid="moment-description"
                  >
                    {marker.description}
                  </p>
                ) : (
                  <p data-testid="moment-description" className="hidden" />
                )}

                {/* Bottom row: Confidence indicator and type badge */}
                <div className="flex items-center gap-2">
                  {confidenceInfo && (
                    <div
                      className="flex items-center gap-1"
                      data-testid="moment-confidence"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${confidenceInfo.color}`}
                      />
                      <span className="text-gray-400 text-xs">
                        {confidenceInfo.percent}%
                      </span>
                    </div>
                  )}

                  {marker.type === 'ai_detected' && (
                    <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded">
                      AI
                    </span>
                  )}
                  {marker.type === 'manual' && (
                    <span className="px-2 py-0.5 bg-blue-600/30 text-blue-300 text-xs rounded">
                      Manual
                    </span>
                  )}
                  {marker.type === 'highlight' && (
                    <span className="px-2 py-0.5 bg-yellow-600/30 text-yellow-300 text-xs rounded">
                      Highlight
                    </span>
                  )}
                </div>

                {/* Transcript text preview (if available) */}
                {marker.text && (
                  <p
                    className="text-gray-500 text-xs mt-2 italic line-clamp-1"
                    data-testid="moment-text"
                  >
                    "{marker.text}"
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Find More Moments button below list */}
        {onFindMore && (
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={onFindMore}
              disabled={findMoreLoading || disabled}
              className={`
                w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                ${findMoreLoading || disabled
                  ? 'bg-gray-600 cursor-not-allowed opacity-60 text-gray-400'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
                }
              `}
              data-testid="find-more-button"
            >
              {findMoreLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Finding more moments...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Find More Moments
                </>
              )}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default MomentsSidebar;
