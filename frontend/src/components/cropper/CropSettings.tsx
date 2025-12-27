import { useState, useCallback, useMemo } from 'react';
import { NormalizedCropCoordinates, CropCoordinates } from './types';

/**
 * Props for the CropSettings component
 */
export interface CropSettingsProps {
  /** Normalized coordinates (0-1 range) for FFmpeg */
  normalizedCoordinates: NormalizedCropCoordinates[];
  /** Raw pixel coordinates */
  pixelCoordinates?: CropCoordinates[];
  /** Video dimensions for pixel display */
  videoDimensions?: { width: number; height: number };
  /** Optional CSS class name */
  className?: string;
  /** Whether the panel starts collapsed */
  defaultCollapsed?: boolean;
}

/**
 * Format a coordinate value for display
 */
const formatCoord = (value: number, decimals: number = 0): string => {
  return value.toFixed(decimals);
};

/**
 * Format normalized coordinate (0-1) for FFmpeg
 */
const formatNormalized = (value: number): string => {
  return value.toFixed(4);
};

/**
 * Get frame color class based on index
 */
const getFrameColorClass = (index: number): string => {
  const colors = ['text-blue-400', 'text-green-400', 'text-purple-400'];
  return colors[index % colors.length];
};

/**
 * Get frame border color class based on index
 */
const getFrameBorderClass = (index: number): string => {
  const colors = ['border-blue-500/30', 'border-green-500/30', 'border-purple-500/30'];
  return colors[index % colors.length];
};

/**
 * CropSettings - Displays crop coordinates in raw pixels and normalized format
 *
 * This collapsible panel shows the exact coordinates for each crop frame:
 * - Raw Coordinates: Pixel values (x, y, width, height)
 * - Normalized Coordinates: 0-1 range values for FFmpeg processing
 *
 * The panel updates in realtime as crop frames are dragged.
 */
const CropSettings = ({
  normalizedCoordinates,
  pixelCoordinates,
  videoDimensions,
  className = '',
  defaultCollapsed = true
}: CropSettingsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Calculate pixel coordinates from normalized if not provided directly
  const computedPixelCoords = useMemo(() => {
    if (pixelCoordinates && pixelCoordinates.length > 0) {
      return pixelCoordinates;
    }

    if (!videoDimensions || !normalizedCoordinates.length) {
      return [];
    }

    return normalizedCoordinates.map((coord, index) => ({
      id: coord.id || `crop-${index + 1}`,
      x: Math.round(coord.x * videoDimensions.width),
      y: Math.round(coord.y * videoDimensions.height),
      width: Math.round(coord.width * videoDimensions.width),
      height: Math.round(coord.height * videoDimensions.height),
    }));
  }, [normalizedCoordinates, pixelCoordinates, videoDimensions]);

  // Don't render if no coordinates
  if (!normalizedCoordinates || normalizedCoordinates.length === 0) {
    return null;
  }

  return (
    <div
      className={`crop-settings bg-gray-800 rounded-lg border border-gray-700 ${className}`}
      data-testid="crop-settings"
    >
      {/* Header with collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors rounded-lg"
        aria-expanded={!isCollapsed}
        aria-controls="crop-settings-content"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className="text-sm font-medium text-gray-300">Crop Settings</span>
          <span className="text-xs text-gray-500">
            ({normalizedCoordinates.length} frame{normalizedCoordinates.length !== 1 ? 's' : ''})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div
          id="crop-settings-content"
          className="px-3 pb-3 space-y-3"
          data-testid="crop-settings-content"
        >
          {normalizedCoordinates.map((coord, index) => {
            const pixelCoord = computedPixelCoords[index];
            const frameLabel = normalizedCoordinates.length === 1 ? 'Crop Area' : `Frame ${index + 1}`;
            const colorClass = getFrameColorClass(index);
            const borderClass = getFrameBorderClass(index);

            return (
              <div
                key={coord.id || index}
                className={`p-2 bg-gray-900/50 rounded-lg border ${borderClass}`}
                data-testid={`crop-frame-settings-${index}`}
              >
                {/* Frame header */}
                <div className={`text-xs font-medium mb-2 ${colorClass}`}>
                  {frameLabel}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Raw Pixel Coordinates */}
                  <div>
                    <div className="text-gray-500 mb-1 flex items-center gap-1">
                      <span>Raw (px)</span>
                      {videoDimensions && (
                        <span className="text-gray-600">
                          {videoDimensions.width}×{videoDimensions.height}
                        </span>
                      )}
                    </div>
                    {pixelCoord ? (
                      <div className="font-mono text-gray-300 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-gray-500">x:</span>
                          <span>{formatCoord(pixelCoord.x)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">y:</span>
                          <span>{formatCoord(pixelCoord.y)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">w:</span>
                          <span>{formatCoord(pixelCoord.width)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">h:</span>
                          <span>{formatCoord(pixelCoord.height)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-600 italic">No video loaded</div>
                    )}
                  </div>

                  {/* Normalized Coordinates (0-1) */}
                  <div>
                    <div className="text-gray-500 mb-1">Normalized (0-1)</div>
                    <div className="font-mono text-gray-300 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-gray-500">x:</span>
                        <span>{formatNormalized(coord.x)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">y:</span>
                        <span>{formatNormalized(coord.y)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">w:</span>
                        <span>{formatNormalized(coord.width)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">h:</span>
                        <span>{formatNormalized(coord.height)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* FFmpeg hint */}
          <div className="text-xs text-gray-600 pt-1 border-t border-gray-700/50">
            <span className="text-gray-500">FFmpeg:</span> Use normalized values with crop filter
          </div>
        </div>
      )}
    </div>
  );
};

export default CropSettings;
