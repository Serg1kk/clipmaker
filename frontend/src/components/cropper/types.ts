import { TemplateType } from '../TemplateSelector';
import {
  TEMPLATE_CONFIGS,
  generateDefaultCropAreas,
  type NormalizedCropArea,
} from '../../constants/templates';

/**
 * Coordinates for a single crop rectangle
 */
export interface CropCoordinates {
  /** Unique identifier for the rectangle */
  id: string;
  /** X position (left) in pixels relative to video frame */
  x: number;
  /** Y position (top) in pixels relative to video frame */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Re-export for convenience
 */
export { generateDefaultCropAreas, type NormalizedCropArea };

/**
 * Normalized coordinates (0-1 range) for consistent output
 */
export interface NormalizedCropCoordinates {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Props for individual CropRectangle component
 */
export interface CropRectangleProps {
  /** Unique identifier */
  id: string;
  /** Current coordinates */
  coordinates: CropCoordinates;
  /** Container bounds for constraining movement */
  containerBounds: { width: number; height: number };
  /** Whether this rectangle is currently selected */
  isSelected: boolean;
  /** Callback when rectangle is selected */
  onSelect: (id: string) => void;
  /** Callback when coordinates change */
  onChange: (coords: CropCoordinates) => void;
  /** Optional label to display */
  label?: string;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Color theme for the rectangle */
  color?: 'blue' | 'green' | 'purple';
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Props for the VideoFrameCropper component
 */
export interface VideoFrameCropperProps {
  /** Video source URL or image URL for the frame */
  src: string;
  /** Type of source: video frame or static image */
  srcType?: 'video' | 'image';
  /** Template determining number of crop rectangles */
  template: TemplateType;
  /** Initial crop coordinates (optional) */
  initialCoordinates?: CropCoordinates[];
  /** Callback when any crop rectangle changes */
  onCropChange?: (coordinates: CropCoordinates[]) => void;
  /** Callback with normalized coordinates (0-1 range) */
  onNormalizedCropChange?: (coordinates: NormalizedCropCoordinates[]) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether cropping is disabled */
  disabled?: boolean;
  /** Aspect ratio to enforce on rectangles (width/height) */
  aspectRatio?: number;
  /** Show coordinate overlay */
  showCoordinates?: boolean;
}

/**
 * Resize handle positions
 */
export type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left';

/**
 * Internal state for tracking resize operations
 */
export interface ResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  startX: number;
  startY: number;
  startCoords: CropCoordinates;
}

/**
 * Template configuration for default rectangle positions
 * Enhanced with aspect ratio information for proper crop sizing
 */
export interface TemplateRectangleConfig {
  count: number;
  defaultPositions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    /** Target aspect ratio for this frame in the output */
    aspectRatio?: number;
  }>;
}

/**
 * Get template configuration based on template type
 * Updated to use correct proportions for 9:16 output:
 * - 1-frame: 1080x1920 full (9:16 = 0.5625 aspect ratio)
 * - 2-frame: Two 1080x960 frames stacked vertically (9:8 = 1.125 each)
 * - 3-frame: Top row two 540x768 (40%), bottom 1080x1152 (60%)
 */
export function getTemplateConfig(template: TemplateType): TemplateRectangleConfig {
  const templateConfig = TEMPLATE_CONFIGS[template];

  switch (template) {
    case '1-frame':
      // Full screen 9:16 crop - centered with proper aspect ratio
      return {
        count: 1,
        defaultPositions: [
          {
            x: 0.1,
            y: 0.05,
            width: 0.8,
            height: 0.9,
            aspectRatio: templateConfig.frames[0].aspectRatio, // 9:16 = 0.5625
          },
        ],
      };
    case '2-frame':
      // Two vertically stacked crops, each with 9:8 aspect ratio
      // Position them to capture different parts of source video
      return {
        count: 2,
        defaultPositions: [
          {
            x: 0.1,
            y: 0.05,
            width: 0.8,
            height: 0.42,
            aspectRatio: templateConfig.frames[0].aspectRatio, // 9:8 = 1.125
          },
          {
            x: 0.1,
            y: 0.53,
            width: 0.8,
            height: 0.42,
            aspectRatio: templateConfig.frames[1].aspectRatio, // 9:8 = 1.125
          },
        ],
      };
    case '3-frame':
      // Two small frames on top (40% height), one large below (60%)
      // Top frames: 540x768 each (aspect ~0.703)
      // Bottom frame: 1080x1152 (aspect 0.9375)
      return {
        count: 3,
        defaultPositions: [
          {
            x: 0.05,
            y: 0.05,
            width: 0.4,
            height: 0.35,
            aspectRatio: templateConfig.frames[0].aspectRatio, // ~0.703
          },
          {
            x: 0.55,
            y: 0.05,
            width: 0.4,
            height: 0.35,
            aspectRatio: templateConfig.frames[1].aspectRatio, // ~0.703
          },
          {
            x: 0.1,
            y: 0.45,
            width: 0.8,
            height: 0.5,
            aspectRatio: templateConfig.frames[2].aspectRatio, // 0.9375
          },
        ],
      };
    default:
      return {
        count: 1,
        defaultPositions: [
          { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        ],
      };
  }
}

/**
 * Color map for rectangle themes
 */
export const RECTANGLE_COLORS: Record<string, { border: string; bg: string; handle: string }> = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-500/20',
    handle: 'bg-blue-500'
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-500/20',
    handle: 'bg-green-500'
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-500/20',
    handle: 'bg-purple-500'
  }
};

/**
 * Get color for rectangle by index
 */
export function getRectangleColor(index: number): 'blue' | 'green' | 'purple' {
  const colors: Array<'blue' | 'green' | 'purple'> = ['blue', 'green', 'purple'];
  return colors[index % colors.length];
}
