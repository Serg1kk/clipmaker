/**
 * Google Fonts loading and integration utilities
 *
 * Handles:
 * - Font loading from Google Fonts CDN
 * - Font loading state management
 * - CSS variable integration
 * - Performance optimization (async loading)
 */

import { FONT_OPTIONS, getGoogleFontsImportUrl, isGoogleFont } from './fonts';

/**
 * Load Google Fonts dynamically
 *
 * Usage: Call during component mount or on font selection change
 *
 * @param fontIds - Array of font IDs to load
 * @returns Promise that resolves when fonts are loaded
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   loadGoogleFonts(['roboto', 'poppins']);
 * }, []);
 * ```
 */
export async function loadGoogleFonts(fontIds: string[]): Promise<void> {
  const googleFontIds = fontIds.filter(id => isGoogleFont(id));

  if (googleFontIds.length === 0) {
    return;
  }

  const url = getGoogleFontsImportUrl(googleFontIds);

  if (!url) {
    return;
  }

  // Check if already loaded to avoid duplicate requests
  const existingLink = document.querySelector(`link[href="${url}"]`);
  if (existingLink) {
    return;
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    link.type = 'text/css';

    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load fonts from ${url}`));

    document.head.appendChild(link);
  });
}

/**
 * Add font to document's <head> via CSS @import
 *
 * Alternative method to loadGoogleFonts using CSS @import instead of link tag
 * Useful for SSR or when you need stylesheet control
 *
 * @param fontIds - Array of font IDs to import
 *
 * @example
 * ```tsx
 * importGoogleFontsCSS(['roboto', 'lora']);
 * ```
 */
export function importGoogleFontsCSS(fontIds: string[]): void {
  const url = getGoogleFontsImportUrl(fontIds);

  if (!url) {
    return;
  }

  // Check if already imported
  const existingImport = Array.from(document.styleSheets).some(sheet => {
    try {
      return sheet.href === url;
    } catch {
      return false;
    }
  });

  if (existingImport) {
    return;
  }

  const style = document.createElement('style');
  style.textContent = `@import url('${url}');`;
  document.head.appendChild(style);
}

/**
 * Create CSS variables for selected fonts
 *
 * Generates CSS custom properties for easy font usage throughout app
 *
 * @param fontMapping - Map of CSS variable name to font ID
 * @returns CSS string with variables
 *
 * @example
 * ```tsx
 * const css = createFontCSSVariables({
 *   '--font-primary': 'roboto',
 *   '--font-heading': 'poppins',
 *   '--font-body': 'open-sans',
 * });
 *
 * // Output:
 * // --font-primary: Roboto, system-ui, sans-serif;
 * // --font-heading: Poppins, sans-serif;
 * // --font-body: "Open Sans", sans-serif;
 * ```
 */
export function createFontCSSVariables(
  fontMapping: Record<string, string>
): string {
  const cssVars = Object.entries(fontMapping)
    .map(([varName, fontId]) => {
      const font = FONT_OPTIONS.find(f => f.id === fontId);
      if (!font) {
        console.warn(`Font ID not found: ${fontId}`);
        return '';
      }
      return `${varName}: ${font.value};`;
    })
    .filter(Boolean)
    .join('\n');

  return cssVars;
}

/**
 * Apply font CSS variables to element
 *
 * Sets CSS variables directly on element style for runtime changes
 *
 * @param element - Target DOM element
 * @param fontMapping - Map of CSS variable name to font ID
 *
 * @example
 * ```tsx
 * const element = document.querySelector('.caption-text');
 * applyFontVariables(element, {
 *   '--text-font': 'roboto',
 * });
 * ```
 */
export function applyFontVariables(
  element: HTMLElement,
  fontMapping: Record<string, string>
): void {
  Object.entries(fontMapping).forEach(([varName, fontId]) => {
    const font = FONT_OPTIONS.find(f => f.id === fontId);
    if (font) {
      element.style.setProperty(varName, font.value);
    }
  });
}

/**
 * Get all fonts that need to be loaded from Google Fonts
 *
 * Useful for pre-loading fonts on app initialization
 *
 * @returns Array of Google Font IDs that should be loaded
 */
export function getRequiredGoogleFonts(): string[] {
  // By default, load the most popular fonts for video captions
  // Customize this based on your app's needs
  return ['roboto', 'poppins', 'open-sans', 'lora'];
}

/**
 * Font loading manager for React components
 *
 * Usage in React components:
 *
 * @example
 * ```tsx
 * import { useFontLoader } from '@/hooks/useFontLoader';
 *
 * function CaptionEditor() {
 *   const { isLoading, error } = useFontLoader(['roboto', 'poppins']);
 *
 *   if (isLoading) return <div>Loading fonts...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return <div>Fonts loaded!</div>;
 * }
 * ```
 */
export interface FontLoaderState {
  /** Whether fonts are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Manually retry loading */
  retry: () => void;
}

/**
 * System font stack recommendations for video captions
 *
 * Use these as fallbacks in font-family values for optimal performance
 */
export const SYSTEM_FONT_STACKS = {
  /**
   * macOS system font stack (optimized for Apple devices)
   * Falls back to Inter and system sans-serif
   */
  modern: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',

  /**
   * Windows-optimized font stack
   * Prioritizes Segoe UI for Windows, falls back to system fonts
   */
  windows: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  /**
   * Android-optimized font stack
   * Uses Roboto (native Android font)
   */
  android: 'Roboto, "Helvetica Neue", sans-serif',

  /**
   * Web-safe fallback (works everywhere)
   * No external dependencies, maximum compatibility
   */
  fallback: 'Arial, Helvetica, sans-serif',
};

/**
 * Preload fonts for better performance
 *
 * Adds <link rel="preload"> to document head
 * Call early in app initialization for visible fonts
 *
 * @param fontIds - Font IDs to preload
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   preloadFonts(['roboto', 'poppins']);
 * }, []);
 * ```
 */
export function preloadFonts(fontIds: string[]): void {
  const googleFonts = fontIds.filter(id => isGoogleFont(id));

  googleFonts.forEach(fontId => {
    const font = FONT_OPTIONS.find(f => f.id === fontId);
    if (!font) return;

    // Note: Google Fonts doesn't provide direct font file URLs for preload
    // The CSS import handles this automatically
    // This function documents the pattern for when using custom font services
  });

  // For Google Fonts, preload via dns-prefetch and preconnect
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://fonts.googleapis.com';
  document.head.appendChild(link);

  const link2 = document.createElement('link');
  link2.rel = 'preconnect';
  link2.href = 'https://fonts.gstatic.com';
  link2.crossOrigin = 'anonymous';
  document.head.appendChild(link2);
}
