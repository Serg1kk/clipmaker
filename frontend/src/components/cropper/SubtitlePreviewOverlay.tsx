import { useMemo } from 'react';
import { TextPosition, FONT_OPTIONS, FontFamily } from '../TextStylingPanel';

/**
 * Props for the SubtitlePreviewOverlay component
 */
export interface SubtitlePreviewOverlayProps {
  /** Whether subtitles are visible */
  enabled: boolean;
  /** Font family for the subtitle text */
  fontFamily: FontFamily;
  /** Font size in pixels */
  fontSize: number;
  /** Text color in hex format */
  textColor: string;
  /** Vertical position of the subtitle */
  position: TextPosition;
  /** Sample text to display (optional) */
  sampleText?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Generates CSS text-shadow for outline effect (improves readability)
 */
function generateTextShadow(color: string, width: number): string {
  const shadows: string[] = [];

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
 * SubtitlePreviewOverlay - Displays styled subtitle text on the preview panel
 *
 * This component renders a sample subtitle overlay on the PreviewLayout
 * to show users how their text styling choices will appear in the final video.
 *
 * Features:
 * - Configurable position (top/center/bottom)
 * - Applies font family, size, and color from TextStylingPanel
 * - Text outline for visibility on any background
 * - Smooth transitions when position changes
 *
 * @example
 * ```tsx
 * <SubtitlePreviewOverlay
 *   enabled={true}
 *   fontFamily="Arial"
 *   fontSize={24}
 *   textColor="#FFFFFF"
 *   position="center"
 * />
 * ```
 */
const SubtitlePreviewOverlay = ({
  enabled,
  fontFamily,
  fontSize,
  textColor,
  position,
  sampleText = 'Sample Subtitle',
  className = '',
}: SubtitlePreviewOverlayProps) => {
  // Get the CSS font-family value
  const fontFamilyValue = useMemo(() => {
    const font = FONT_OPTIONS.find((f) => f.id === fontFamily);
    return font?.value || 'Arial, sans-serif';
  }, [fontFamily]);

  // Generate text shadow for outline effect
  const textShadow = useMemo(() => generateTextShadow('#000000', 2), []);

  // Position classes based on position prop
  const positionClasses: Record<TextPosition, string> = {
    top: 'top-4',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-4',
  };

  // Don't render if disabled
  if (!enabled) {
    return null;
  }

  // Scale font size for preview (preview is smaller than actual output)
  // Preview is typically 270px wide vs 1080px output, so ~25% scale
  const scaledFontSize = Math.max(12, Math.round(fontSize * 0.5));

  return (
    <div
      className={`
        absolute left-0 right-0 flex justify-center
        pointer-events-none z-20
        transition-all duration-300 ease-in-out
        ${positionClasses[position]}
        ${className}
      `}
      role="region"
      aria-label="Subtitle preview"
      data-testid="subtitle-preview-overlay"
    >
      <div
        className="inline-block px-3 py-1.5 rounded max-w-[90%] text-center"
        style={{
          fontFamily: fontFamilyValue,
          fontSize: `${scaledFontSize}px`,
          color: textColor,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          textShadow,
        }}
        data-testid="subtitle-preview-text"
      >
        {sampleText}
      </div>
    </div>
  );
};

export default SubtitlePreviewOverlay;
