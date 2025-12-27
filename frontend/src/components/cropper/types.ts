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
  /**
   * Container bounds for constraining movement.
   * offsetX/offsetY specify the origin point within the parent container
   * (used when video uses object-contain and has letterboxing)
   */
  containerBounds: { width: number; height: number; offsetX?: number; offsetY?: number };
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
  /**
   * Aspect ratio to lock (width/height). When set, resize operations
   * will maintain this exact ratio. Pass the source video aspect ratio
   * in sourceAspectRatio to correctly calculate constrained dimensions.
   */
  aspectRatio?: number;
  /**
   * Source video aspect ratio (width/height). Required when aspectRatio
   * is set to correctly calculate pixel dimensions.
   */
  sourceAspectRatio?: number;
  /** Display aspect ratio badge (e.g., '9:16', '16:9') */
  aspectRatioBadge?: string;
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
 *
 * SMALL, non-overlapping crop areas for each template:
 * - 1-frame: 9:16 vertical, 25% width, centered
 * - 2-frame: 9:8 aspect ratio, 20% width each, positioned at 15% and 65%
 * - 3-frame: Two 1:1 squares (15% width) top corners, one 16:9 wide (30% width) bottom center
 */
export function getTemplateConfig(template: TemplateType): TemplateRectangleConfig {
  const templateConfig = TEMPLATE_CONFIGS[template];

  switch (template) {
    case '1-frame':
      // Single frame: 9:16 vertical, 25% of video width, centered
      return {
        count: 1,
        defaultPositions: [
          {
            x: 0.375, // Centered: (1 - 0.25) / 2
            y: 0.05,
            width: 0.25,
            height: 0.9, // Will be clamped based on source aspect ratio
            aspectRatio: 9 / 16, // 0.5625 - vertical
          },
        ],
      };
    case '2-frame':
      // Two frames: 9:8 aspect ratio, 20% width each, non-overlapping
      // Frame 1 at x=15% (left), Frame 2 at x=65% (right)
      return {
        count: 2,
        defaultPositions: [
          {
            x: 0.15, // Left side
            y: 0.25, // Vertically centered-ish
            width: 0.20,
            height: 0.32, // Approximate for 9:8 ratio on 16:9 source
            aspectRatio: 9 / 8, // 1.125
          },
          {
            x: 0.65, // Right side
            y: 0.25, // Vertically centered-ish
            width: 0.20,
            height: 0.32, // Approximate for 9:8 ratio on 16:9 source
            aspectRatio: 9 / 8, // 1.125
          },
        ],
      };
    case '3-frame':
      // Three frames: Two 1:1 squares on top, one 16:9 wide on bottom
      // All small and non-overlapping
      return {
        count: 3,
        defaultPositions: [
          {
            // Top-left speaker - square
            x: 0.05,
            y: 0.05,
            width: 0.15,
            height: 0.27, // Square adjusted for 16:9 source
            aspectRatio: 1, // 1:1 square
          },
          {
            // Top-right speaker - square
            x: 0.80,
            y: 0.05,
            width: 0.15,
            height: 0.27, // Square adjusted for 16:9 source
            aspectRatio: 1, // 1:1 square
          },
          {
            // Bottom screen - 16:9 wide horizontal
            x: 0.35, // Centered: (1 - 0.30) / 2
            y: 0.55,
            width: 0.30,
            height: 0.30, // 16:9 ratio on 16:9 source
            aspectRatio: 16 / 9, // 1.778
          },
        ],
      };
    default:
      return {
        count: 1,
        defaultPositions: [
          { x: 0.375, y: 0.05, width: 0.25, height: 0.9 },
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
