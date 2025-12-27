import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import CropRectangle from './CropRectangle';
import {
  VideoFrameCropperProps,
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
function getAspectRatioBadge(aspectRatio: number): string {
  // Common aspect ratios with recognizable names
  const ratioMap: Array<{ ratio: number; label: string }> = [
    { ratio: 9 / 16, label: '9:16' },     // Vertical video
    { ratio: 16 / 9, label: '16:9' },     // Standard widescreen
    { ratio: 9 / 8, label: '9:8' },       // Two-frame split
    { ratio: 1, label: '1:1' },           // Square
    { ratio: 4 / 3, label: '4:3' },       // Classic TV
    { ratio: 3 / 4, label: '3:4' },       // Portrait
    { ratio: 3 / 2, label: '3:2' },       // DSLR
    { ratio: 2 / 3, label: '2:3' },       // Portrait DSLR
    { ratio: 21 / 9, label: '21:9' },     // Ultra-wide
    { ratio: 1080 / 1440, label: '3:4' }, // 3-frame bottom
  ];

  // Find closest matching ratio (within 5% tolerance)
  for (const { ratio, label } of ratioMap) {
    if (Math.abs(aspectRatio - ratio) / ratio < 0.05) {
      return label;
    }
  }

  // Fallback: generate from decimal
  // Try to find simple integer ratios
  for (let denominator = 1; denominator <= 20; denominator++) {
    const numerator = Math.round(aspectRatio * denominator);
    if (Math.abs(numerator / denominator - aspectRatio) < 0.02) {
      // Simplify if possible
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const d = gcd(numerator, denominator);
      return `${numerator / d}:${denominator / d}`;
    }
  }

  return aspectRatio.toFixed(2);
}

/**
 * Generate initial coordinates based on template and container size
 * Uses the new generateDefaultCropAreas for aspect-ratio-aware positioning
 */
function generateInitialCoordinates(
  template: string,
  containerWidth: number,
  containerHeight: number
): CropCoordinates[] {
  // Use the new aspect-ratio-aware crop area generator
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
 * Normalize coordinates to 0-1 range
 */
function normalizeCoordinates(
  coords: CropCoordinates[],
  containerWidth: number,
  containerHeight: number
): NormalizedCropCoordinates[] {
  return coords.map((coord) => ({
    id: coord.id,
    x: containerWidth > 0 ? coord.x / containerWidth : 0,
    y: containerHeight > 0 ? coord.y / containerHeight : 0,
    width: containerWidth > 0 ? coord.width / containerWidth : 0,
    height: containerHeight > 0 ? coord.height / containerHeight : 0
  }));
}

/**
 * VideoFrameCropper component - Display video frame with draggable crop rectangles
 *
 * Features:
 * - Shows video frame (paused video or static image)
 * - Overlays 1-3 draggable/resizable crop rectangles based on template
 * - Reports pixel and normalized coordinates on change
 * - Template-based default positions
 * - Visual coordinate display option
 *
 * @example
 * ```tsx
 * <VideoFrameCropper
 *   src="/video.mp4"
 *   srcType="video"
 *   template="2-frame"
 *   onCropChange={(coords) => console.log('Crop coords:', coords)}
 *   onNormalizedCropChange={(normalized) => console.log('Normalized:', normalized)}
 * />
 * ```
 */
const VideoFrameCropper = ({
  src,
  srcType = 'image',
  template,
  initialCoordinates,
  onCropChange,
  onNormalizedCropChange,
  className = '',
  disabled = false,
  showCoordinates = false
}: VideoFrameCropperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [coordinates, setCoordinates] = useState<CropCoordinates[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Get template configuration
  const templateConfig = useMemo(() => getTemplateConfig(template), [template]);

  // Get aspect ratios for each frame from template config
  const frameAspectRatios = useMemo(() => {
    const config = TEMPLATE_CONFIGS[template];
    return config.frames.map(frame => frame.aspectRatio);
  }, [template]);

  // Calculate source aspect ratio
  const sourceAspectRatio = useMemo(() => {
    return containerSize.width > 0 && containerSize.height > 0
      ? containerSize.width / containerSize.height
      : 16 / 9; // Default to 16:9
  }, [containerSize.width, containerSize.height]);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize coordinates when template or container size changes
  useEffect(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;

    if (initialCoordinates && initialCoordinates.length === templateConfig.count) {
      setCoordinates(initialCoordinates);
    } else {
      const newCoords = generateInitialCoordinates(
        template,
        containerSize.width,
        containerSize.height
      );
      setCoordinates(newCoords);
    }
  }, [template, containerSize, templateConfig.count, initialCoordinates]);

  // Handle coordinate changes
  const handleCoordinateChange = useCallback(
    (updatedCoord: CropCoordinates) => {
      setCoordinates((prev) => {
        const newCoords = prev.map((coord) =>
          coord.id === updatedCoord.id ? updatedCoord : coord
        );

        // Notify parent components
        onCropChange?.(newCoords);
        onNormalizedCropChange?.(
          normalizeCoordinates(newCoords, containerSize.width, containerSize.height)
        );

        return newCoords;
      });
    },
    [containerSize, onCropChange, onNormalizedCropChange]
  );

  // Handle rectangle selection
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Handle click outside rectangles to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === videoRef.current) {
      setSelectedId(null);
    }
  }, []);

  // Handle media load
  const handleMediaLoad = useCallback(() => {
    setIsLoaded(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, []);

  // Pause video on mount for frame capture
  useEffect(() => {
    if (srcType === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [srcType, src]);

  // Get labels for rectangles
  const getLabel = (index: number): string => {
    if (templateConfig.count === 1) return 'Crop Area';
    return `Frame ${index + 1}`;
  };

  return (
    <div
      className={`video-frame-cropper relative bg-black rounded-lg overflow-hidden ${className}`}
      data-testid="video-frame-cropper"
    >
      {/* Media container */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video"
        onClick={handleContainerClick}
        data-testid="cropper-container"
      >
        {/* Video or Image */}
        {srcType === 'video' ? (
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onLoadedData={handleMediaLoad}
            muted
            playsInline
            data-testid="cropper-video"
          />
        ) : (
          <img
            src={src}
            alt="Video frame"
            className="w-full h-full object-contain"
            onLoad={handleMediaLoad}
            data-testid="cropper-image"
          />
        )}

        {/* Crop rectangles overlay */}
        {isLoaded && containerSize.width > 0 && (
          <div
            className="absolute inset-0"
            data-testid="rectangles-overlay"
          >
            {coordinates.map((coord, index) => (
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
          </div>
        )}

        {/* Loading overlay */}
        {!isLoaded && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gray-900"
            data-testid="loading-overlay"
          >
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        )}
      </div>

      {/* Coordinates display */}
      {showCoordinates && coordinates.length > 0 && (
        <div
          className="mt-2 p-3 bg-gray-800 rounded-lg text-xs font-mono"
          data-testid="coordinates-display"
        >
          <div className="text-gray-400 mb-2">Crop Coordinates:</div>
          <div className="space-y-1">
            {coordinates.map((coord, index) => {
              const normalized = normalizeCoordinates(
                [coord],
                containerSize.width,
                containerSize.height
              )[0];
              return (
                <div
                  key={coord.id}
                  className={`flex justify-between ${
                    selectedId === coord.id ? 'text-blue-400' : 'text-gray-300'
                  }`}
                  data-testid={`coord-display-${coord.id}`}
                >
                  <span>{getLabel(index)}:</span>
                  <span>
                    x: {coord.x.toFixed(0)}, y: {coord.y.toFixed(0)},
                    w: {coord.width.toFixed(0)}, h: {coord.height.toFixed(0)}
                    <span className="text-gray-500 ml-2">
                      ({(normalized.x * 100).toFixed(1)}%, {(normalized.y * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoFrameCropper;
