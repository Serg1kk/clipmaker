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
    id: `crop-${index + 1}`,
    x: Math.round(area.x * containerWidth),
    y: Math.round(area.y * containerHeight),
    width: Math.round(area.width * containerWidth),
    height: Math.round(area.height * containerHeight),
  }));
}

/**
 * Normalize coordinates to 0-1 range, clamping to valid bounds
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
  videoDimensions
}: CropOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
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

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Initialize coordinates when template or container size changes
  useEffect(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;

    if (initialCoordinates && initialCoordinates.length === templateConfig.count) {
      // Convert normalized coordinates to pixel coordinates with bounds clamping
      const pixelCoords = initialCoordinates.map((coord, index) => {
        const rawX = coord.x * containerSize.width;
        const rawY = coord.y * containerSize.height;
        const rawWidth = coord.width * containerSize.width;
        const rawHeight = coord.height * containerSize.height;

        // Clamp to ensure crop stays within container bounds
        const clampedWidth = Math.min(rawWidth, containerSize.width);
        const clampedHeight = Math.min(rawHeight, containerSize.height);
        const clampedX = Math.max(0, Math.min(rawX, containerSize.width - clampedWidth));
        const clampedY = Math.max(0, Math.min(rawY, containerSize.height - clampedHeight));

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
      const newCoords = generateInitialCoordinates(
        template,
        containerSize.width,
        containerSize.height
      );
      setCoordinates(newCoords);

      // Notify parent of initial coordinates
      onNormalizedCropChange?.(
        normalizeCoordinates(newCoords, containerSize.width, containerSize.height)
      );
    }
  }, [template, containerSize, templateConfig.count, initialCoordinates, onNormalizedCropChange]);

  // Handle coordinate changes with bounds enforcement
  const handleCoordinateChange = useCallback(
    (updatedCoord: CropCoordinates) => {
      setCoordinates((prev) => {
        const newCoords = prev.map((coord) => {
          if (coord.id !== updatedCoord.id) return coord;

          // Enforce bounds: crop must stay fully inside container
          const clampedWidth = Math.min(updatedCoord.width, containerSize.width);
          const clampedHeight = Math.min(updatedCoord.height, containerSize.height);
          const clampedX = Math.max(0, Math.min(updatedCoord.x, containerSize.width - clampedWidth));
          const clampedY = Math.max(0, Math.min(updatedCoord.y, containerSize.height - clampedHeight));

          return {
            ...updatedCoord,
            x: clampedX,
            y: clampedY,
            width: clampedWidth,
            height: clampedHeight,
          };
        });

        // Notify parent components
        onNormalizedCropChange?.(
          normalizeCoordinates(newCoords, containerSize.width, containerSize.height)
        );

        return newCoords;
      });
    },
    [containerSize, onNormalizedCropChange]
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
      {/* Crop rectangles */}
      {containerSize.width > 0 && coordinates.map((coord, index) => (
        <CropRectangle
          key={coord.id}
          id={coord.id}
          coordinates={coord}
          containerBounds={containerSize}
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
            const normalized = normalizeCoordinates(
              [coord],
              containerSize.width,
              containerSize.height
            )[0];
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
