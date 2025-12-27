import { useState, useCallback } from 'react';
import TemplateSelector, { TemplateType } from '../TemplateSelector';
import VideoFrameCropper from './VideoFrameCropper';
import PreviewLayout from './PreviewLayout';
import { CropCoordinates, NormalizedCropCoordinates } from './types';
import { TextStyle } from '../TextStylingPanel';

/**
 * Props for the PreviewLayoutWithCropper component
 */
export interface PreviewLayoutWithCropperProps {
  /** Video or image source URL */
  src: string;
  /** Source type: video frame or static image */
  srcType?: 'video' | 'image';
  /** Initial template selection */
  initialTemplate?: TemplateType;
  /** Width for the preview panel (9:16 aspect ratio) */
  previewWidth?: number;
  /** Callback when crop coordinates change */
  onCropChange?: (coordinates: CropCoordinates[]) => void;
  /** Callback with normalized coordinates (0-1 range) */
  onNormalizedCropChange?: (coordinates: NormalizedCropCoordinates[]) => void;
  /** Callback when template changes */
  onTemplateChange?: (template: TemplateType) => void;
  /** Show coordinate debug display */
  showCoordinates?: boolean;
  /** Show frame borders in preview */
  showFrameBorders?: boolean;
  /** Optional CSS class */
  className?: string;
  /** Text styling configuration for subtitle overlay */
  textStyle?: TextStyle;
  /** Sample subtitle text to display */
  subtitleText?: string;
  /** Compact mode - shows only preview without cropper and template selector */
  compactMode?: boolean;
}

/**
 * Complete cropping interface with live 9:16 preview
 *
 * This component combines:
 * - TemplateSelector for choosing frame layouts (1, 2, or 3 frames)
 * - VideoFrameCropper for adjusting crop areas on the source video
 * - PreviewLayout showing live 9:16 preview of the final output
 *
 * As the user drags crop rectangles, the preview updates in real-time
 * to show exactly how the final vertical video will look.
 *
 * @example
 * ```tsx
 * <PreviewLayoutWithCropper
 *   src="/video-frame.jpg"
 *   srcType="image"
 *   initialTemplate="2-frame"
 *   previewWidth={270}
 *   onCropChange={(coords) => console.log('Crops:', coords)}
 * />
 * ```
 */
const PreviewLayoutWithCropper = ({
  src,
  srcType = 'image',
  initialTemplate = '1-frame',
  previewWidth = 270,
  onCropChange,
  onNormalizedCropChange,
  onTemplateChange,
  showCoordinates = false,
  showFrameBorders = false,
  className = '',
  textStyle,
  subtitleText,
  compactMode = false
}: PreviewLayoutWithCropperProps) => {
  const [template, setTemplate] = useState<TemplateType>(initialTemplate);
  const [normalizedCoordinates, setNormalizedCoordinates] = useState<NormalizedCropCoordinates[]>([]);

  // Handle template selection change
  const handleTemplateChange = useCallback((newTemplate: TemplateType) => {
    setTemplate(newTemplate);
    onTemplateChange?.(newTemplate);
  }, [onTemplateChange]);

  // Handle normalized crop coordinate changes - updates preview live
  const handleNormalizedCropChange = useCallback((coords: NormalizedCropCoordinates[]) => {
    setNormalizedCoordinates(coords);
    onNormalizedCropChange?.(coords);
  }, [onNormalizedCropChange]);

  // Handle raw crop coordinate changes
  const handleCropChange = useCallback((coords: CropCoordinates[]) => {
    onCropChange?.(coords);
  }, [onCropChange]);

  // Compact mode: shows only the preview without cropper controls
  if (compactMode) {
    return (
      <div
        className={`preview-layout-compact ${className}`}
        data-testid="preview-layout-compact"
      >
        <PreviewLayout
          src={src}
          srcType={srcType}
          template={template}
          normalizedCoordinates={normalizedCoordinates}
          width={previewWidth}
          showFrameBorders={showFrameBorders}
          textStyle={textStyle}
          subtitleText={subtitleText}
        />
      </div>
    );
  }

  return (
    <div
      className={`preview-layout-with-cropper ${className}`}
      data-testid="preview-layout-with-cropper"
    >
      {/* Template Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Layout
        </label>
        <TemplateSelector
          initialTemplate={template}
          onTemplateChange={handleTemplateChange}
        />
      </div>

      {/* Main content: Cropper + Preview side by side */}
      <div className="flex gap-6 items-start">
        {/* Source video with crop rectangles */}
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Adjust Crop Areas
          </label>
          <VideoFrameCropper
            src={src}
            srcType={srcType}
            template={template}
            onCropChange={handleCropChange}
            onNormalizedCropChange={handleNormalizedCropChange}
            showCoordinates={showCoordinates}
          />
        </div>

        {/* Live 9:16 preview */}
        <div className="flex-shrink-0">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Preview (9:16)
          </label>
          <PreviewLayout
            src={src}
            srcType={srcType}
            template={template}
            normalizedCoordinates={normalizedCoordinates}
            width={previewWidth}
            showFrameBorders={showFrameBorders}
            textStyle={textStyle}
            subtitleText={subtitleText}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Live preview - drag crop areas to update</span>
      </div>
    </div>
  );
};

export default PreviewLayoutWithCropper;
