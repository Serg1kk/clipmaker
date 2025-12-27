import { useMemo } from 'react';
import { TemplateType } from '../TemplateSelector';
import { NormalizedCropCoordinates } from './types';
import SubtitlePreviewOverlay from './SubtitlePreviewOverlay';
import { TextStyle } from '../TextStylingPanel';

/**
 * Layout configuration for each template in 9:16 preview
 */
interface PreviewFramePosition {
  /** Normalized x position (0-1) in preview canvas */
  x: number;
  /** Normalized y position (0-1) in preview canvas */
  y: number;
  /** Normalized width (0-1) in preview canvas */
  width: number;
  /** Normalized height (0-1) in preview canvas */
  height: number;
}

/**
 * Template layout configurations for 9:16 vertical preview
 *
 * Layout specifications:
 * - 1-frame: Single full-height frame (100% height)
 * - 2-frame: Two frames stacked vertically (50% height each)
 * - 3-frame: Two small square frames on top for speakers (25% height, 50% width each)
 *            plus one large wide frame below for screen/presentation (75% height, full width)
 */
const PREVIEW_LAYOUTS: Record<TemplateType, PreviewFramePosition[]> = {
  '1-frame': [
    { x: 0, y: 0, width: 1, height: 1 }
  ],
  '2-frame': [
    { x: 0, y: 0, width: 1, height: 0.5 },
    { x: 0, y: 0.5, width: 1, height: 0.5 }
  ],
  '3-frame': [
    // Top-left speaker: 50% width, 25% height (nearly square)
    { x: 0, y: 0, width: 0.5, height: 0.25 },
    // Top-right speaker: 50% width, 25% height (nearly square)
    { x: 0.5, y: 0, width: 0.5, height: 0.25 },
    // Bottom screen/presentation: full width, 75% height
    { x: 0, y: 0.25, width: 1, height: 0.75 }
  ]
};

/**
 * Props for the PreviewLayout component
 */
export interface PreviewLayoutProps {
  /** Video or image source URL */
  src: string;
  /** Source type: video frame or static image */
  srcType?: 'video' | 'image';
  /** Current template selection */
  template: TemplateType;
  /** Normalized crop coordinates from the cropper (0-1 range) */
  normalizedCoordinates: NormalizedCropCoordinates[];
  /** Container width for the preview */
  width?: number;
  /** Optional CSS class name */
  className?: string;
  /** Show frame borders for debugging */
  showFrameBorders?: boolean;
  /** Background color for empty areas */
  backgroundColor?: string;
  /** Text styling configuration for subtitle overlay */
  textStyle?: TextStyle;
  /** Sample subtitle text to display */
  subtitleText?: string;
}

/**
 * Calculate the crop region to display from source image
 * Converts normalized coordinates to CSS background-position and background-size
 */
function calculateCropStyle(
  normalizedCoord: NormalizedCropCoordinates,
  framePosition: PreviewFramePosition
): React.CSSProperties {
  // The crop area in the source image
  const cropX = normalizedCoord.x;
  const cropY = normalizedCoord.y;
  const cropWidth = normalizedCoord.width;
  const cropHeight = normalizedCoord.height;

  // Calculate background-size to scale the image so the crop fills the frame
  // If crop is 0.5 of original, we need background-size of 200% to fill the frame
  const scaleX = cropWidth > 0 ? (1 / cropWidth) * 100 : 100;
  const scaleY = cropHeight > 0 ? (1 / cropHeight) * 100 : 100;

  // Calculate background-position to offset to the crop area
  // Position is percentage of (total - visible) area
  const posX = cropWidth < 1 && cropWidth > 0
    ? (cropX / (1 - cropWidth)) * 100
    : 0;
  const posY = cropHeight < 1 && cropHeight > 0
    ? (cropY / (1 - cropHeight)) * 100
    : 0;

  return {
    backgroundSize: `${scaleX}% ${scaleY}%`,
    backgroundPosition: `${Math.min(100, Math.max(0, posX))}% ${Math.min(100, Math.max(0, posY))}%`,
    backgroundRepeat: 'no-repeat'
  };
}

/**
 * PreviewLayout - Shows final 9:16 preview with cropped areas positioned by template
 *
 * This component renders a vertical (9:16 aspect ratio) preview that shows
 * how the cropped video frames will appear in the final output. It updates
 * live as the user drags crop rectangles in the VideoFrameCropper.
 *
 * Features:
 * - 9:16 aspect ratio container (vertical mobile format)
 * - Template-based frame positioning (1, 2, or 3 frames)
 * - Live updates as crop coordinates change
 * - CSS-based cropping for smooth performance
 * - Supports both video and image sources
 *
 * @example
 * ```tsx
 * <PreviewLayout
 *   src="/video-frame.jpg"
 *   template="2-frame"
 *   normalizedCoordinates={[
 *     { id: 'crop-1', x: 0.1, y: 0.1, width: 0.4, height: 0.8 },
 *     { id: 'crop-2', x: 0.5, y: 0.1, width: 0.4, height: 0.8 }
 *   ]}
 *   width={270}
 * />
 * ```
 */
const PreviewLayout = ({
  src,
  srcType = 'image',
  template,
  normalizedCoordinates,
  width = 270,
  className = '',
  showFrameBorders = false,
  backgroundColor = '#000',
  textStyle,
  subtitleText = 'Sample Subtitle'
}: PreviewLayoutProps) => {
  // Calculate height for 9:16 aspect ratio
  const height = Math.round(width * (16 / 9));

  // Get layout configuration for current template
  const framePositions = useMemo(() => PREVIEW_LAYOUTS[template], [template]);

  // Match coordinates to frame positions
  const frames = useMemo(() => {
    return framePositions.map((position, index) => {
      const coord = normalizedCoordinates[index];
      return {
        position,
        coord,
        id: coord?.id || `frame-${index}`
      };
    });
  }, [framePositions, normalizedCoordinates]);

  return (
    <div
      className={`preview-layout relative overflow-hidden rounded-lg ${className}`}
      style={{
        width,
        height,
        backgroundColor
      }}
      data-testid="preview-layout"
      aria-label="9:16 video preview"
    >
      {/* Render each frame based on template layout */}
      {frames.map(({ position, coord, id }, index) => {
        // Calculate pixel dimensions for this frame
        const frameStyle: React.CSSProperties = {
          position: 'absolute',
          left: position.x * width,
          top: position.y * height,
          width: position.width * width,
          height: position.height * height,
          overflow: 'hidden'
        };

        // If we have coordinates, show the cropped region
        if (coord && coord.width > 0 && coord.height > 0) {
          const cropStyle = calculateCropStyle(coord, position);

          return (
            <div
              key={id}
              className={`preview-frame ${showFrameBorders ? 'border border-white/30' : ''}`}
              style={frameStyle}
              data-testid={`preview-frame-${index}`}
            >
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `url(${src})`,
                  ...cropStyle
                }}
                data-testid={`preview-frame-content-${index}`}
              />
              {/* Frame label for debugging */}
              {showFrameBorders && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
                  Frame {index + 1}
                </div>
              )}
            </div>
          );
        }

        // Empty frame placeholder
        return (
          <div
            key={id}
            className={`preview-frame flex items-center justify-center ${showFrameBorders ? 'border border-white/30' : ''}`}
            style={{
              ...frameStyle,
              backgroundColor: 'rgba(50, 50, 50, 0.5)'
            }}
            data-testid={`preview-frame-${index}`}
          >
            <span className="text-gray-500 text-xs">
              No crop area
            </span>
          </div>
        );
      })}

      {/* Subtitle Preview Overlay */}
      {textStyle && (
        <SubtitlePreviewOverlay
          enabled={textStyle.subtitlesEnabled}
          fontFamily={textStyle.fontFamily}
          fontSize={textStyle.fontSize}
          textColor={textStyle.textColor}
          position={textStyle.position}
          sampleText={subtitleText}
        />
      )}

      {/* Aspect ratio indicator */}
      <div
        className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-gray-400"
        data-testid="aspect-ratio-label"
      >
        9:16
      </div>
    </div>
  );
};

export default PreviewLayout;
