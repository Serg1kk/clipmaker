/**
 * Font options for video captions and text overlays
 *
 * Includes:
 * - Web-safe fonts (guaranteed to work across all browsers/systems)
 * - Google Fonts (popular, reliable choices for modern web)
 * - Categories: serif, sans-serif, monospace
 * - Optimized for video caption readability
 */

export type FontCategory = 'serif' | 'sans-serif' | 'monospace' | 'display';

export interface FontOption {
  /** Unique identifier */
  id: string;
  /** Display label in dropdown */
  label: string;
  /** CSS font-family value */
  value: string;
  /** Font category for grouping */
  category: FontCategory;
  /** Whether to load from Google Fonts */
  googleFont?: boolean;
  /** Font weight variants available (for Google Fonts) */
  weights?: number[];
}

/**
 * Comprehensive font options for video captions
 *
 * Web-safe fonts are listed first (no external dependency)
 * Google Fonts provide modern alternatives with better styling
 */
export const FONT_OPTIONS: FontOption[] = [
  // Web-Safe Sans-Serif (Universal, highly legible)
  {
    id: 'arial',
    label: 'Arial',
    value: 'Arial, Helvetica, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'helvetica',
    label: 'Helvetica',
    value: 'Helvetica, Arial, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'verdana',
    label: 'Verdana',
    value: 'Verdana, Geneva, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'trebuchet-ms',
    label: 'Trebuchet MS',
    value: '"Trebuchet MS", sans-serif',
    category: 'sans-serif',
  },

  // Web-Safe Serif (Classic, formal)
  {
    id: 'georgia',
    label: 'Georgia',
    value: 'Georgia, serif',
    category: 'serif',
  },
  {
    id: 'times-new-roman',
    label: 'Times New Roman',
    value: '"Times New Roman", Times, serif',
    category: 'serif',
  },

  // Web-Safe Monospace (Code, technical)
  {
    id: 'courier-new',
    label: 'Courier New',
    value: '"Courier New", monospace',
    category: 'monospace',
  },
  {
    id: 'courier',
    label: 'Courier',
    value: 'Courier, monospace',
    category: 'monospace',
  },

  // Google Fonts - Sans-Serif (Modern, popular for video)
  {
    id: 'inter',
    label: 'Inter',
    value: 'Inter, system-ui, sans-serif',
    category: 'sans-serif',
    googleFont: true,
    weights: [400, 500, 600, 700],
  },
  {
    id: 'roboto',
    label: 'Roboto',
    value: 'Roboto, system-ui, sans-serif',
    category: 'sans-serif',
    googleFont: true,
    weights: [400, 500, 700],
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    value: '"Open Sans", sans-serif',
    category: 'sans-serif',
    googleFont: true,
    weights: [400, 500, 600, 700],
  },
  {
    id: 'poppins',
    label: 'Poppins',
    value: 'Poppins, sans-serif',
    category: 'sans-serif',
    googleFont: true,
    weights: [400, 500, 600, 700],
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    value: 'Montserrat, sans-serif',
    category: 'sans-serif',
    googleFont: true,
    weights: [400, 500, 600, 700],
  },

  // Google Fonts - Serif (Elegant, readable)
  {
    id: 'lora',
    label: 'Lora',
    value: 'Lora, serif',
    category: 'serif',
    googleFont: true,
    weights: [400, 500, 600, 700],
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display',
    value: '"Playfair Display", serif',
    category: 'serif',
    googleFont: true,
    weights: [400, 700],
  },

  // Google Fonts - Display (Eye-catching, dramatic)
  {
    id: 'fredoka-one',
    label: 'Fredoka One',
    value: '"Fredoka One", sans-serif',
    category: 'display',
    googleFont: true,
    weights: [400],
  },
  {
    id: 'space-mono',
    label: 'Space Mono',
    value: '"Space Mono", monospace',
    category: 'monospace',
    googleFont: true,
    weights: [400, 700],
  },
];

/**
 * Recommended default font for video captions
 *
 * Roboto is chosen because:
 * - Excellent readability at small sizes
 * - Modern, professional appearance
 * - Works well on mobile screens
 * - Free via Google Fonts
 * - Optimized for screen display
 */
export const DEFAULT_FONT: FontOption = FONT_OPTIONS.find(f => f.id === 'roboto')!;

/**
 * Group fonts by category for organized dropdown
 */
export const FONTS_BY_CATEGORY = FONT_OPTIONS.reduce(
  (acc, font) => {
    if (!acc[font.category]) {
      acc[font.category] = [];
    }
    acc[font.category].push(font);
    return acc;
  },
  {} as Record<FontCategory, FontOption[]>
);

/**
 * Get Google Fonts import URL for selected fonts
 *
 * Usage: Add to HTML <head> or CSS @import
 *
 * @param fontIds - Array of font IDs to import
 * @returns Google Fonts CSS import URL
 *
 * @example
 * ```tsx
 * const url = getGoogleFontsImportUrl(['roboto', 'poppins', 'lora']);
 * // Returns: https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Poppins:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap
 * ```
 */
export function getGoogleFontsImportUrl(fontIds: string[]): string {
  const selectedFonts = fontIds
    .map(id => FONT_OPTIONS.find(f => f.id === id))
    .filter((f): f is FontOption => f !== undefined && f.googleFont);

  if (selectedFonts.length === 0) {
    return '';
  }

  const familyParams = selectedFonts
    .map(font => {
      const fontName = font.label.replace(/\s+/g, '+');
      const weights = font.weights?.join(';') || '400';
      return `family=${fontName}:wght@${weights}`;
    })
    .join('&');

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

/**
 * Get font CSS string for use in styles
 *
 * @param fontId - Font ID from FONT_OPTIONS
 * @returns CSS font-family string or empty string if not found
 */
export function getFontCSS(fontId: string): string {
  const font = FONT_OPTIONS.find(f => f.id === fontId);
  return font?.value || '';
}

/**
 * Check if a font requires Google Fonts loading
 *
 * @param fontId - Font ID to check
 * @returns true if font is from Google Fonts
 */
export function isGoogleFont(fontId: string): boolean {
  const font = FONT_OPTIONS.find(f => f.id === fontId);
  return font?.googleFont ?? false;
}

/**
 * Get all Google Fonts from the options
 */
export function getGoogleFonts(): FontOption[] {
  return FONT_OPTIONS.filter(f => f.googleFont);
}

/**
 * Get all web-safe fonts (no external loading required)
 */
export function getWebSafeFonts(): FontOption[] {
  return FONT_OPTIONS.filter(f => !f.googleFont);
}
