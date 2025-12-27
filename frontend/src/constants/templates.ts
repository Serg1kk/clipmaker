/**
 * Template configuration constants for video frame layouts
 *
 * All templates output in 9:16 portrait aspect ratio (1080x1920)
 * Frame proportions are designed for mobile-first vertical video content
 */

import { TemplateType } from '../components/TemplateSelector';

/**
 * Output dimensions for 9:16 portrait video
 */
export const OUTPUT_DIMENSIONS = {
  width: 1080,
  height: 1920,
  aspectRatio: 9 / 16, // 0.5625
} as const;

/**
 * Frame configuration for each template type
 * All values are in pixels for the final 1080x1920 output
 */
export interface FrameConfig {
  /** Unique identifier for the frame */
  id: string;
  /** X position in output (pixels) */
  x: number;
  /** Y position in output (pixels) */
  y: number;
  /** Width in output (pixels) */
  width: number;
  /** Height in output (pixels) */
  height: number;
  /** Aspect ratio of the frame (width/height) */
  aspectRatio: number;
}

/**
 * Template configuration with frame layout details
 */
export interface TemplateFrameConfig {
  /** Template identifier */
  id: TemplateType;
  /** Human-readable label */
  label: string;
  /** Description of the layout */
  description: string;
  /** Number of frames in this template */
  frameCount: number;
  /** Individual frame configurations */
  frames: FrameConfig[];
}

/**
 * 1-Frame Template: Full screen single frame
 * - 1080x1920 (full 9:16 output)
 */
export const TEMPLATE_1_FRAME: TemplateFrameConfig = {
  id: '1-frame',
  label: 'Single Frame',
  description: 'One video frame layout - full screen',
  frameCount: 1,
  frames: [
    {
      id: 'frame-1',
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
      aspectRatio: 1080 / 1920, // 9:16 = 0.5625
    },
  ],
};

/**
 * 2-Frame Template: Two frames stacked vertically
 * - Each frame: 1080x960 (9:8 aspect ratio)
 * - Frames are 50% of output height each
 */
export const TEMPLATE_2_FRAME: TemplateFrameConfig = {
  id: '2-frame',
  label: 'Two Frames',
  description: 'Two frames stacked vertically (9:8 each)',
  frameCount: 2,
  frames: [
    {
      id: 'frame-1',
      x: 0,
      y: 0,
      width: 1080,
      height: 960,
      aspectRatio: 1080 / 960, // 9:8 = 1.125
    },
    {
      id: 'frame-2',
      x: 0,
      y: 960,
      width: 1080,
      height: 960,
      aspectRatio: 1080 / 960, // 9:8 = 1.125
    },
  ],
};

/**
 * 3-Frame Template: Two small frames on top, one large below
 * - Top row: Two 540x768 frames (40% of height, 9:12.8 = ~0.703 aspect ratio)
 * - Bottom: One 1080x1152 frame (60% of height, 9:9.6 = 0.9375 aspect ratio)
 */
export const TEMPLATE_3_FRAME: TemplateFrameConfig = {
  id: '3-frame',
  label: 'Three Frames',
  description: 'Two small frames on top, one large below',
  frameCount: 3,
  frames: [
    {
      id: 'frame-1',
      x: 0,
      y: 0,
      width: 540,
      height: 768,
      aspectRatio: 540 / 768, // ~0.703
    },
    {
      id: 'frame-2',
      x: 540,
      y: 0,
      width: 540,
      height: 768,
      aspectRatio: 540 / 768, // ~0.703
    },
    {
      id: 'frame-3',
      x: 0,
      y: 768,
      width: 1080,
      height: 1152,
      aspectRatio: 1080 / 1152, // 0.9375
    },
  ],
};

/**
 * All template configurations indexed by template type
 */
export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateFrameConfig> = {
  '1-frame': TEMPLATE_1_FRAME,
  '2-frame': TEMPLATE_2_FRAME,
  '3-frame': TEMPLATE_3_FRAME,
};

/**
 * Get template configuration by type
 */
export function getTemplateFrameConfig(templateType: TemplateType): TemplateFrameConfig {
  return TEMPLATE_CONFIGS[templateType];
}

/**
 * Calculate normalized crop areas for a given template
 * Returns positions as percentages (0-1) for use with source video
 *
 * @param templateType - The template to generate crop areas for
 * @param sourceWidth - Width of source video in pixels
 * @param sourceHeight - Height of source video in pixels
 * @returns Array of normalized crop coordinates for each frame
 */
export interface NormalizedCropArea {
  id: string;
  /** Normalized x position (0-1) relative to source video */
  x: number;
  /** Normalized y position (0-1) relative to source video */
  y: number;
  /** Normalized width (0-1) relative to source video */
  width: number;
  /** Normalized height (0-1) relative to source video */
  height: number;
  /** Target aspect ratio for this frame in the output */
  targetAspectRatio: number;
}

/**
 * Generate default crop areas based on template and source video dimensions
 *
 * Strategy:
 * 1. Calculate the aspect ratio each frame needs from the source
 * 2. Position crop areas to cover different regions of the source video
 * 3. Ensure crops maintain the target aspect ratio
 *
 * @param templateType - Template type
 * @param sourceWidth - Source video width
 * @param sourceHeight - Source video height
 * @returns Array of normalized crop areas for the source video
 */
export function generateDefaultCropAreas(
  templateType: TemplateType,
  sourceWidth: number,
  sourceHeight: number
): NormalizedCropArea[] {
  const template = TEMPLATE_CONFIGS[templateType];
  const sourceAspectRatio = sourceWidth / sourceHeight;

  return template.frames.map((frame, index) => {
    const targetAspectRatio = frame.aspectRatio;

    // Calculate crop dimensions to match target aspect ratio
    let cropWidth: number;
    let cropHeight: number;

    if (sourceAspectRatio > targetAspectRatio) {
      // Source is wider than target - limit by height
      cropHeight = sourceHeight;
      cropWidth = cropHeight * targetAspectRatio;
    } else {
      // Source is taller than target - limit by width
      cropWidth = sourceWidth;
      cropHeight = cropWidth / targetAspectRatio;
    }

    // Normalize dimensions
    const normalizedWidth = cropWidth / sourceWidth;
    const normalizedHeight = cropHeight / sourceHeight;

    // Calculate positions based on template layout
    let normalizedX: number;
    let normalizedY: number;

    if (templateType === '1-frame') {
      // Center the single crop
      normalizedX = (1 - normalizedWidth) / 2;
      normalizedY = (1 - normalizedHeight) / 2;
    } else if (templateType === '2-frame') {
      // Stack vertically - offset each crop slightly to show different regions
      normalizedX = (1 - normalizedWidth) / 2;
      if (index === 0) {
        normalizedY = Math.max(0, (1 - normalizedHeight) / 4);
      } else {
        normalizedY = Math.min(1 - normalizedHeight, 1 - (1 - normalizedHeight) / 4 - normalizedHeight);
      }
    } else {
      // 3-frame layout
      if (index === 0) {
        // Top-left
        normalizedX = Math.max(0, (1 - normalizedWidth) / 4);
        normalizedY = Math.max(0, (1 - normalizedHeight) / 4);
      } else if (index === 1) {
        // Top-right
        normalizedX = Math.min(1 - normalizedWidth, 1 - (1 - normalizedWidth) / 4 - normalizedWidth);
        normalizedY = Math.max(0, (1 - normalizedHeight) / 4);
      } else {
        // Bottom full width
        normalizedX = (1 - normalizedWidth) / 2;
        normalizedY = Math.min(1 - normalizedHeight, 1 - (1 - normalizedHeight) / 4 - normalizedHeight);
      }
    }

    // Ensure values are clamped to valid range
    normalizedX = Math.max(0, Math.min(1 - normalizedWidth, normalizedX));
    normalizedY = Math.max(0, Math.min(1 - normalizedHeight, normalizedY));

    return {
      id: frame.id,
      x: normalizedX,
      y: normalizedY,
      width: normalizedWidth,
      height: normalizedHeight,
      targetAspectRatio,
    };
  });
}

/**
 * Convert pixel coordinates to normalized coordinates
 */
export function pixelsToNormalized(
  pixels: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: pixels.x / containerWidth,
    y: pixels.y / containerHeight,
    width: pixels.width / containerWidth,
    height: pixels.height / containerHeight,
  };
}

/**
 * Convert normalized coordinates to pixel coordinates
 */
export function normalizedToPixels(
  normalized: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(normalized.x * containerWidth),
    y: Math.round(normalized.y * containerHeight),
    width: Math.round(normalized.width * containerWidth),
    height: Math.round(normalized.height * containerHeight),
  };
}
