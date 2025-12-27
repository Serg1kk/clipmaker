import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import CropRectangle from './CropRectangle';
import {
  CropCoordinates,
  NormalizedCropCoordinates,
  getTemplateConfig,
  getRectangleColor,
  generateDefaultCropAreas,
} from './types';
import { TemplateType } from '../TemplateSelector';
import { TEMPLATE_CONFIGS } from '../../constants/templates';

/**
 * Convert aspect ratio number to human-readable badge string
 */
function getAspectRatioBadge(aspectRatio: number | undefined): string {
  // Guard against undefined or invalid aspect ratios
  if (aspectRatio === undefined || aspectRatio === null || !isFinite(aspectRatio) || aspectRatio <= 0) {
    return 'N/A';
  }

  const ratioMap: Array<{ ratio: number; label: string }> = [
    { ratio: 9 / 16, label: '9:16' },
    { ratio: 16 / 9, label: '16:9' },
    { ratio: 9 / 8, label: '9:8' },
    { ratio: 1, label: '1:1' },
    { ratio: 4 / 3, label: '4:3' },
    { ratio: 3 / 4, label: '3:4' },
    { ratio: 3 / 2, label: '3:2' },
    { ratio: 2 / 3, label: '2:3' },
    { ratio: 21 / 9, label: '21:9' },
    { ratio: 1080 / 1440, label: '3:4' },
  ];

  for (const { ratio, label } of ratioMap) {
    if (Math.abs(aspectRatio - ratio) / ratio < 0.05) {
      return label;
    }
  }

  for (let denominator = 1; denominator <= 20; denominator++) {
    const numerator = Math.round(aspectRatio * denominator);
    if (Math.abs(numerator / denominator - aspectRatio) < 0.02) {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const d = gcd(numerator, denominator);
      return `${numerator / d}:${denominator / d}`;
    }
  }

  return aspectRatio.toFixed(2);
}

/**
 * Generate initial coordinates based on template and container size
 */
function generateInitialCoordinates(
  template: string,
  containerWidth: number,
  containerHeight: number
): CropCoordinates[] {
  const cropAreas = generateDefaultCropAreas(
    template as TemplateType,
    containerWidth,
    containerHeight
  );

  return cropAreas.map((area, index) => ({
    id: `frame-${index + 1}`,
    x: Math.round(area.x * containerWidth),
    y: Math.round(area.y * containerHeight),
    width: Math.round(area.width * containerWidth),
    height: Math.round(area.height * containerHeight),
  }));
}

/**
 * Video bounds type for actual video visual area within container
 */
interface VideoBoundsType {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Normalize coordinates to 0-1 range relative to VIDEO bounds (not container)
 * This ensures normalized values are consistent regardless of letterboxing
 */
function normalizeCoordinatesToVideoBounds(
  coords: CropCoordinates[],
  videoBounds: VideoBoundsType
): NormalizedCropCoordinates[] {
  const { width: boundsWidth, height: boundsHeight, offsetX, offsetY } = videoBounds;

  return coords.map((coord) => {
    // Convert from container-relative pixels to video-relative normalized (0-1)
    // First subtract the video offset, then divide by video dimensions
    const relativeX = coord.x - offsetX;
    const relativeY = coord.y - offsetY;

    // Clamp to video bounds before normalizing
    const clampedX = Math.max(0, Math.min(relativeX, boundsWidth - coord.width));
    const clampedY = Math.max(0, Math.min(relativeY, boundsHeight - coord.height));
    const clampedWidth = Math.min(coord.width, boundsWidth - clampedX);
    const clampedHeight = Math.min(coord.height, boundsHeight - clampedY);

    return {
      id: coord.id,
      x: boundsWidth > 0 ? clampedX / boundsWidth : 0,
      y: boundsHeight > 0 ? clampedY / boundsHeight : 0,
      width: boundsWidth > 0 ? clampedWidth / boundsWidth : 0,
      height: boundsHeight > 0 ? clampedHeight / boundsHeight : 0
    };
  });
}

/**
 * Normalize coordinates to 0-1 range, clamping to valid bounds (legacy for debug display)
 */
function normalizeCoordinates(
  coords: CropCoordinates[],
  containerWidth: number,
  containerHeight: number
): NormalizedCropCoordinates[] {
  return coords.map((coord) => {
    // Clamp pixel coordinates to container bounds before normalizing
    const clampedX = Math.max(0, Math.min(coord.x, containerWidth - coord.width));
    const clampedY = Math.max(0, Math.min(coord.y, containerHeight - coord.height));
    const clampedWidth = Math.min(coord.width, containerWidth - clampedX);
    const clampedHeight = Math.min(coord.height, containerHeight - clampedY);

    return {
      id: coord.id,
      x: containerWidth > 0 ? clampedX / containerWidth : 0,
      y: containerHeight > 0 ? clampedY / containerHeight : 0,
      width: containerWidth > 0 ? clampedWidth / containerWidth : 0,
      height: containerHeight > 0 ? clampedHeight / containerHeight : 0
    };
  });
}

/**
 * Props for the CropOverlay component
 */
export interface CropOverlayProps {
  /** Template type for crop rectangles (1-frame, 2-frame, 3-frame) */
  template: TemplateType;
  /** Initial normalized coordinates (optional) */
  initialCoordinates?: NormalizedCropCoordinates[];
  /** Callback when normalized crop coordinates change */
  onNormalizedCropChange?: (coordinates: NormalizedCropCoordinates[]) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether the overlay is disabled */
  disabled?: boolean;
  /** Show coordinate debug display */
  showCoordinates?: boolean;
  /** Video element dimensions for proper scaling */
  videoDimensions?: { width: number; height: number };
  /** Reference to video element to get actual visual bounds (for object-contain) */
  videoRef?: React.RefObject<HTMLVideoElement>;
}

/**
 * CropOverlay component - Overlay with draggable crop rectangles
 *
 * This component renders draggable crop rectangles that can be positioned
 * absolutely over a video element. It manages crop coordinates and reports
 * normalized (0-1) coordinates for use in video processing.
 *
 * Features:
 * - Template-based rectangle count (1, 2, or 3 frames)
 * - Draggable and resizable rectangles
 * - Aspect ratio locking per frame
 * - Normalized coordinate output
 * - Responsive to container size changes
 */
const CropOverlay = ({
  template,
  initialCoordinates,
  onNormalizedCropChange,
  className = '',
  disabled = false,
  showCoordinates = false,
  videoDimensions,
  videoRef
}: CropOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // videoBounds represents the actual video visual area within the container
  // This accounts for letterboxing when video uses object-contain
  const [videoBounds, setVideoBounds] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const [coordinates, setCoordinates] = useState<CropCoordinates[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Get template configuration
  const templateConfig = useMemo(() => getTemplateConfig(template), [template]);

  // Get aspect ratios for each frame from template config
  const frameAspectRatios = useMemo(() => {
    const config = TEMPLATE_CONFIGS[template];
    return config.frames.map(frame => frame.aspectRatio);
  }, [template]);

  // Calculate source aspect ratio
  const sourceAspectRatio = useMemo(() => {
    if (videoDimensions && videoDimensions.width > 0 && videoDimensions.height > 0) {
      return videoDimensions.width / videoDimensions.height;
    }
    return containerSize.width > 0 && containerSize.height > 0
      ? containerSize.width / containerSize.height
      : 16 / 9;
  }, [containerSize.width, containerSize.height, videoDimensions]);

  /**
   * Calculate the actual video visual bounds within the container.
   * When video uses object-contain, the video may be letterboxed
   * and not fill the entire container.
   */
  const calculateVideoBounds = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    setContainerSize({ width: containerWidth, height: containerHeight });

    // If we have a video ref with dimensions, calculate the actual video visual area
    if (videoRef?.current && videoDimensions) {
      const videoAspect = videoDimensions.width / videoDimensions.height;
      const containerAspect = containerWidth / containerHeight;

      let actualWidth: number;
      let actualHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (videoAspect > containerAspect) {
        // Video is wider - letterboxed top/bottom
        actualWidth = containerWidth;
        actualHeight = containerWidth / videoAspect;
        offsetY = (containerHeight - actualHeight) / 2;
      } else {
        // Video is taller - letterboxed left/right
        actualHeight = containerHeight;
        actualWidth = containerHeight * videoAspect;
        offsetX = (containerWidth - actualWidth) / 2;
      }

      setVideoBounds({
        width: actualWidth,
        height: actualHeight,
        offsetX,
        offsetY
      });
    } else {
      // No video ref or dimensions - use full container
      setVideoBounds({
        width: containerWidth,
        height: containerHeight,
        offsetX: 0,
        offsetY: 0
      });
    }
  }, [videoRef, videoDimensions]);

  // Update container size and video bounds on mount and resize
  useEffect(() => {
    calculateVideoBounds();

    const resizeObserver = new ResizeObserver(calculateVideoBounds);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen to window resize for browser height changes
    window.addEventListener('resize', calculateVideoBounds);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateVideoBounds);
    };
  }, [calculateVideoBounds]);

  // Recalculate when video dimensions change
  useEffect(() => {
    calculateVideoBounds();
  }, [videoDimensions, calculateVideoBounds]);

  // Initialize coordinates when template or video bounds change
  useEffect(() => {
    // Use videoBounds for actual video area, which accounts for letterboxing
    const boundsWidth = videoBounds.width;
    const boundsHeight = videoBounds.height;

    if (boundsWidth === 0 || boundsHeight === 0) return;

    if (initialCoordinates && initialCoordinates.length === templateConfig.count) {
      // Convert normalized coordinates to pixel coordinates with bounds clamping
      // Normalized coords are relative to video content area, not container
      const pixelCoords = initialCoordinates.map((coord, index) => {
        const rawX = coord.x * boundsWidth + videoBounds.offsetX;
        const rawY = coord.y * boundsHeight + videoBounds.offsetY;
        const rawWidth = coord.width * boundsWidth;
        const rawHeight = coord.height * boundsHeight;

        // Clamp to ensure crop stays within video bounds (not container)
        const clampedWidth = Math.min(rawWidth, boundsWidth);
        const clampedHeight = Math.min(rawHeight, boundsHeight);
        const clampedX = Math.max(videoBounds.offsetX, Math.min(rawX, videoBounds.offsetX + boundsWidth - clampedWidth));
        const clampedY = Math.max(videoBounds.offsetY, Math.min(rawY, videoBounds.offsetY + boundsHeight - clampedHeight));

        return {
          id: coord.id || `crop-${index + 1}`,
          x: clampedX,
          y: clampedY,
          width: clampedWidth,
          height: clampedHeight,
        };
      });
      setCoordinates(pixelCoords);
    } else {
      // Generate initial coordinates within video bounds
      const newCoords = generateInitialCoordinates(
        template,
        boundsWidth,
        boundsHeight
      ).map(coord => ({
        ...coord,
        // Offset by video bounds origin
        x: coord.x + videoBounds.offsetX,
        y: coord.y + videoBounds.offsetY,
      }));
      setCoordinates(newCoords);

      // Notify parent of initial coordinates (normalized to video area, not container)
      onNormalizedCropChange?.(
        normalizeCoordinatesToVideoBounds(newCoords, videoBounds)
      );
    }
  }, [template, videoBounds, templateConfig.count, initialCoordinates, onNormalizedCropChange]);

  // Handle coordinate changes with bounds enforcement (constrained to VIDEO area, not container)
  const handleCoordinateChange = useCallback(
    (updatedCoord: CropCoordinates) => {
      setCoordinates((prev) => {
        const newCoords = prev.map((coord) => {
          if (coord.id !== updatedCoord.id) return coord;

          // Enforce bounds: crop must stay fully inside VIDEO bounds (not container)
          // This prevents dragging crop frames into letterbox areas
          const maxWidth = videoBounds.width;
          const maxHeight = videoBounds.height;
          const minX = videoBounds.offsetX;
          const minY = videoBounds.offsetY;
          const maxX = videoBounds.offsetX + videoBounds.width;
          const maxY = videoBounds.offsetY + videoBounds.height;

          const clampedWidth = Math.min(updatedCoord.width, maxWidth);
          const clampedHeight = Math.min(updatedCoord.height, maxHeight);
          const clampedX = Math.max(minX, Math.min(updatedCoord.x, maxX - clampedWidth));
          const clampedY = Math.max(minY, Math.min(updatedCoord.y, maxY - clampedHeight));

          return {
            ...updatedCoord,
            x: clampedX,
            y: clampedY,
            width: clampedWidth,
            height: clampedHeight,
          };
        });

        // Notify parent components with normalized coords relative to video area
        onNormalizedCropChange?.(
          normalizeCoordinatesToVideoBounds(newCoords, videoBounds)
        );

        return newCoords;
      });
    },
    [videoBounds, onNormalizedCropChange]
  );

  // Handle rectangle selection
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Handle click outside rectangles to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setSelectedId(null);
    }
  }, []);

  // Get labels for rectangles
  const getLabel = (index: number): string => {
    if (templateConfig.count === 1) return 'Crop Area';
    return `Frame ${index + 1}`;
  };

  return (
    <div
      ref={containerRef}
      className={`crop-overlay absolute inset-0 ${className}`}
      onClick={handleContainerClick}
      data-testid="crop-overlay"
    >
      {/* Crop rectangles - use videoBounds for constraints, not containerSize */}
      {videoBounds.width > 0 && coordinates.map((coord, index) => (
        <CropRectangle
          key={coord.id}
          id={coord.id}
          coordinates={coord}
          containerBounds={{
            width: videoBounds.width,
            height: videoBounds.height,
            offsetX: videoBounds.offsetX,
            offsetY: videoBounds.offsetY
          }}
          isSelected={selectedId === coord.id}
          onSelect={handleSelect}
          onChange={handleCoordinateChange}
          label={getLabel(index)}
          color={getRectangleColor(index)}
          disabled={disabled}
          aspectRatio={frameAspectRatios[index]}
          sourceAspectRatio={sourceAspectRatio}
          aspectRatioBadge={getAspectRatioBadge(frameAspectRatios[index])}
        />
      ))}

      {/* Coordinates display for debugging */}
      {showCoordinates && coordinates.length > 0 && (
        <div
          className="absolute bottom-2 left-2 p-2 bg-black/80 rounded text-xs font-mono text-white z-20"
          data-testid="coordinates-display"
        >
          {coordinates.map((coord, index) => {
            const normalized = normalizeCoordinatesToVideoBounds([coord], videoBounds)[0];
            return (
              <div key={coord.id} className="mb-1">
                <span className="text-gray-400">{getLabel(index)}:</span>{' '}
                <span className="text-blue-400">
                  ({(normalized.x * 100).toFixed(0)}%, {(normalized.y * 100).toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CropOverlay;
