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
 * 3-Frame Template: Two small square-ish frames on top (speakers), one large wide below (screen)
 * - Top row: Two ~540x480 frames (25% of height, nearly 1:1 aspect ratio for speaker heads)
 * - Bottom: One 1080x1440 frame (75% of height, wide for screen/presentation content)
 */
export const TEMPLATE_3_FRAME: TemplateFrameConfig = {
  id: '3-frame',
  label: 'Three Frames',
  description: 'Two speaker frames on top, presentation below',
  frameCount: 3,
  frames: [
    {
      id: 'frame-1',
      x: 0,
      y: 0,
      width: 540,
      height: 480,
      aspectRatio: 540 / 480, // 1.125 - nearly square for speaker
    },
    {
      id: 'frame-2',
      x: 540,
      y: 0,
      width: 540,
      height: 480,
      aspectRatio: 540 / 480, // 1.125 - nearly square for speaker
    },
    {
      id: 'frame-3',
      x: 0,
      y: 480,
      width: 1080,
      height: 1440,
      aspectRatio: 1080 / 1440, // 0.75 - wide horizontal for screen content
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
 * Strategy: Create SMALL, non-overlapping crop areas that maintain proper aspect ratios.
 * Users should only need to drag to position, not resize extensively.
 *
 * Template 1 (Single Frame): 9:16 vertical, ~25% of video width, centered
 * Template 2 (Two Frames): 9:8 aspect ratio, ~20% width each, positioned left/right
 * Template 3 (Three Frames): Two 1:1 squares (15% width) top, one 16:9 wide (30% width) bottom
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

  if (templateType === '1-frame') {
    // Single frame: 9:16 vertical aspect ratio, 25% of source width, centered
    const targetAspectRatio = 9 / 16; // 0.5625 - vertical
    const normalizedWidth = 0.25;
    // Height calculated from width and aspect ratio, adjusted for source aspect ratio
    const normalizedHeight = (normalizedWidth * sourceAspectRatio) / targetAspectRatio;
    const clampedHeight = Math.min(normalizedHeight, 0.9); // Don't exceed 90% of height

    return [{
      id: template.frames[0].id,
      x: (1 - normalizedWidth) / 2, // Centered horizontally
      y: (1 - clampedHeight) / 2,   // Centered vertically
      width: normalizedWidth,
      height: clampedHeight,
      targetAspectRatio,
    }];
  }

  if (templateType === '2-frame') {
    // Two frames: 9:8 aspect ratio (1.125), 20% width each
    // Frame 1 at x=15%, Frame 2 at x=65%, both vertically centered
    const targetAspectRatio = 9 / 8; // 1.125 - slightly wider than tall
    const normalizedWidth = 0.20;
    // Height = width / aspectRatio * sourceAspectRatio (convert to normalized height)
    const normalizedHeight = (normalizedWidth / targetAspectRatio) * sourceAspectRatio;
    const clampedHeight = Math.min(normalizedHeight, 0.5); // Max 50% of height

    return [
      {
        id: template.frames[0].id,
        x: 0.15, // Left side
        y: (1 - clampedHeight) / 2, // Vertically centered
        width: normalizedWidth,
        height: clampedHeight,
        targetAspectRatio,
      },
      {
        id: template.frames[1].id,
        x: 0.65, // Right side
        y: (1 - clampedHeight) / 2, // Vertically centered
        width: normalizedWidth,
        height: clampedHeight,
        targetAspectRatio,
      },
    ];
  }

  // Template 3: Three frames
  // Frame 1 & 2: 1:1 square (15% width), top-left and top-right
  // Frame 3: 16:9 wide (30% width), bottom-center
  const speakerAspectRatio = 1; // Square
  const screenAspectRatio = 16 / 9; // Wide horizontal

  const speakerWidth = 0.15;
  // For square: height = width * sourceAspectRatio
  const speakerHeight = speakerWidth * sourceAspectRatio;
  const clampedSpeakerHeight = Math.min(speakerHeight, 0.35); // Max 35% height

  const screenWidth = 0.30;
  // For 16:9: height = width / aspectRatio * sourceAspectRatio
  const screenHeight = (screenWidth / screenAspectRatio) * sourceAspectRatio;
  const clampedScreenHeight = Math.min(screenHeight, 0.4); // Max 40% height

  return [
    {
      // Top-left speaker (square)
      id: template.frames[0].id,
      x: 0.05,
      y: 0.05,
      width: speakerWidth,
      height: clampedSpeakerHeight,
      targetAspectRatio: speakerAspectRatio,
    },
    {
      // Top-right speaker (square)
      id: template.frames[1].id,
      x: 0.80, // Right side with some margin
      y: 0.05,
      width: speakerWidth,
      height: clampedSpeakerHeight,
      targetAspectRatio: speakerAspectRatio,
    },
    {
      // Bottom screen (16:9 wide)
      id: template.frames[2].id,
      x: (1 - screenWidth) / 2, // Centered horizontally
      y: 0.55, // Lower half
      width: screenWidth,
      height: clampedScreenHeight,
      targetAspectRatio: screenAspectRatio,
    },
  ];
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
