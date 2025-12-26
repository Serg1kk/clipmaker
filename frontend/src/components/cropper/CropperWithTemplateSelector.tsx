import { useState, useCallback } from 'react';
import TemplateSelector, { TemplateType } from '../TemplateSelector';
import VideoFrameCropper from './VideoFrameCropper';
import { CropCoordinates, NormalizedCropCoordinates } from './types';

/**
 * Props for the CropperWithTemplateSelector component
 */
export interface CropperWithTemplateSelectorProps {
  /** Video or image source URL */
  src: string;
  /** Source type */
  srcType?: 'video' | 'image';
  /** Initial template selection */
  initialTemplate?: TemplateType;
  /** Callback when crop coordinates change */
  onCropChange?: (coordinates: CropCoordinates[]) => void;
  /** Callback with normalized coordinates (0-1 range) */
  onNormalizedCropChange?: (coordinates: NormalizedCropCoordinates[]) => void;
  /** Callback when template changes */
  onTemplateChange?: (template: TemplateType) => void;
  /** Show coordinate debug display */
  showCoordinates?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Combined component: TemplateSelector + VideoFrameCropper
 *
 * Allows users to:
 * 1. Select a template (1, 2, or 3 frames)
 * 2. Adjust crop rectangles by dragging/resizing
 * 3. Get output coordinates for each crop area
 *
 * @example
 * ```tsx
 * <CropperWithTemplateSelector
 *   src="/my-video.mp4"
 *   srcType="video"
 *   initialTemplate="2-frame"
 *   onCropChange={(coords) => console.log('Crops:', coords)}
 *   showCoordinates
 * />
 * ```
 */
const CropperWithTemplateSelector = ({
  src,
  srcType = 'image',
  initialTemplate = '1-frame',
  onCropChange,
  onNormalizedCropChange,
  onTemplateChange,
  showCoordinates = false,
  className = ''
}: CropperWithTemplateSelectorProps) => {
  const [template, setTemplate] = useState<TemplateType>(initialTemplate);
  const [coordinates, setCoordinates] = useState<CropCoordinates[]>([]);

  // Handle template selection change
  const handleTemplateChange = useCallback((newTemplate: TemplateType) => {
    setTemplate(newTemplate);
    onTemplateChange?.(newTemplate);
  }, [onTemplateChange]);

  // Handle crop coordinate changes
  const handleCropChange = useCallback((coords: CropCoordinates[]) => {
    setCoordinates(coords);
    onCropChange?.(coords);
  }, [onCropChange]);

  return (
    <div className={`cropper-with-template ${className}`}>
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

      {/* Video Frame Cropper */}
      <div className="rounded-lg overflow-hidden">
        <VideoFrameCropper
          src={src}
          srcType={srcType}
          template={template}
          onCropChange={handleCropChange}
          onNormalizedCropChange={onNormalizedCropChange}
          showCoordinates={showCoordinates}
        />
      </div>

      {/* Output summary */}
      {coordinates.length > 0 && (
        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <div className="text-sm font-medium text-gray-300 mb-2">
            {coordinates.length} crop area{coordinates.length > 1 ? 's' : ''} defined
          </div>
          <div className="flex gap-2">
            {coordinates.map((coord, index) => (
              <div
                key={coord.id}
                className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-400"
              >
                Frame {index + 1}: {coord.width}×{coord.height}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CropperWithTemplateSelector;
