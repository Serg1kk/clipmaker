/**
 * React hook for managing font loading and font selection
 *
 * Handles:
 * - Async loading of Google Fonts
 * - Error handling and retry logic
 * - Font caching to avoid duplicate loads
 * - CSS variable injection for runtime font switching
 */

import { useEffect, useState, useCallback } from 'react';
import { loadGoogleFonts, applyFontVariables } from '../constants/fontLoading';
import { isGoogleFont, FONT_OPTIONS } from '../constants/fonts';

/**
 * Font loader hook state
 */
export interface UseFontLoaderState {
  /** Currently loading fonts */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Font IDs that are currently loaded */
  loadedFonts: Set<string>;
  /** Retry function to reload fonts */
  retry: () => Promise<void>;
}

/**
 * useFontLoader - Load and manage fonts in React components
 *
 * Features:
 * - Async font loading without blocking render
 * - Error handling with retry capability
 * - Prevents duplicate font loads
 * - Works with both web-safe and Google Fonts
 *
 * @param fontIds - Font IDs to load
 * @param options - Configuration options
 * @returns Font loader state and utilities
 *
 * @example
 * ```tsx
 * function CaptionEditor() {
 *   const { isLoading, error, retry } = useFontLoader(['roboto', 'poppins']);
 *
 *   if (isLoading) return <div>Loading fonts...</div>;
 *   if (error) return <div>Error: {error} <button onClick={retry}>Retry</button></div>;
 *
 *   return <div>Fonts ready!</div>;
 * }
 * ```
 */
export function useFontLoader(
  fontIds: string[],
  options: {
    /** Whether to skip loading (useful for conditional loading) */
    skip?: boolean;
    /** Callback when fonts finish loading */
    onLoad?: () => void;
    /** Callback on load error */
    onError?: (error: string) => void;
  } = {}
): UseFontLoaderState {
  const { skip = false, onLoad, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  // Validate font IDs
  const validFontIds = fontIds.filter(id => {
    const isValid = FONT_OPTIONS.some(f => f.id === id);
    if (!isValid) {
      console.warn(`Font ID not found: ${id}`);
    }
    return isValid;
  });

  // Load fonts
  const loadFonts = useCallback(async () => {
    if (skip || validFontIds.length === 0) {
      return;
    }

    // Check which fonts still need loading
    const fontsToLoad = validFontIds.filter(id => !loadedFonts.has(id));

    if (fontsToLoad.length === 0) {
      // All fonts already loaded
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load Google Fonts (web-safe fonts don't need loading)
      const googleFonts = fontsToLoad.filter(id => isGoogleFont(id));

      if (googleFonts.length > 0) {
        await loadGoogleFonts(googleFonts);
      }

      // Update loaded fonts
      setLoadedFonts(prev => {
        const next = new Set(prev);
        fontsToLoad.forEach(id => next.add(id));
        return next;
      });

      setIsLoading(false);
      onLoad?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load fonts';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    }
  }, [validFontIds, loadedFonts, skip, onLoad, onError]);

  // Load fonts on mount and when fontIds change
  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  const retry = useCallback(() => {
    setError(null);
    return loadFonts();
  }, [loadFonts]);

  return {
    isLoading,
    error,
    loadedFonts,
    retry,
  };
}

/**
 * Hook for managing a single selected font with auto-loading
 *
 * Loads font when selection changes
 *
 * @param initialFontId - Initial font ID
 * @param onFontChange - Callback when font changes
 * @returns Selected font ID, setter, and loader state
 *
 * @example
 * ```tsx
 * function FontPicker() {
 *   const {
 *     selectedFont,
 *     setSelectedFont,
 *     isLoading,
 *     error
 *   } = useFontSelection('roboto');
 *
 *   return (
 *     <div>
 *       {isLoading && <span>Loading...</span>}
 *       {error && <span>Error: {error}</span>}
 *       <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)}>
 *         {/* options */}
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFontSelection(
  initialFontId: string,
  onFontChange?: (fontId: string) => void
) {
  const [selectedFont, setSelectedFontState] = useState(initialFontId);
  const { isLoading, error, retry } = useFontLoader([selectedFont]);

  const setSelectedFont = useCallback((fontId: string) => {
    setSelectedFontState(fontId);
    onFontChange?.(fontId);
  }, [onFontChange]);

  return {
    selectedFont,
    setSelectedFont,
    isLoading,
    error,
    retry,
  };
}

/**
 * Hook to apply font CSS variables to an element
 *
 * Useful for dynamically setting font styles on elements
 *
 * @param elementId - ID of element to apply fonts to
 * @param fontMapping - Map of CSS variable names to font IDs
 *
 * @example
 * ```tsx
 * function CaptionText() {
 *   useFontCSSVariables('caption-container', {
 *     '--caption-font': 'roboto',
 *     '--title-font': 'poppins',
 *   });
 *
 *   return (
 *     <div id="caption-container">
 *       <h1 style={{ fontFamily: 'var(--title-font)' }}>Title</h1>
 *       <p style={{ fontFamily: 'var(--caption-font)' }}>Caption text</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFontCSSVariables(
  elementId: string,
  fontMapping: Record<string, string>
) {
  // Load all required fonts
  const fontIds = Object.values(fontMapping);
  const { isLoading } = useFontLoader(fontIds);

  useEffect(() => {
    if (isLoading) return;

    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with ID "${elementId}" not found`);
      return;
    }

    // Apply font variables
    applyFontVariables(element, fontMapping);
  }, [elementId, fontMapping, isLoading]);
}

/**
 * Hook to preload fonts for better performance
 *
 * Preloads fonts in the background without blocking
 *
 * @param fontIds - Font IDs to preload
 * @param delay - Delay before loading (in ms, default 0)
 *
 * @example
 * ```tsx
 * // In your app root or main layout
 * useEffect(() => {
 *   useFontPreloader(['roboto', 'poppins']);
 * }, []);
 * ```
 */
export function useFontPreloader(fontIds: string[], delay: number = 0) {
  const [isPreloaded, setIsPreloaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGoogleFonts(fontIds);
      setIsPreloaded(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [fontIds, delay]);

  return isPreloaded;
}

/**
 * Hook to monitor font loading progress
 *
 * Useful for showing loading bars or progress indicators
 *
 * @param fontIds - Font IDs being loaded
 * @returns Progress information
 *
 * @example
 * ```tsx
 * function FontLoadingBar() {
 *   const { progress, remaining } = useFontProgress(['roboto', 'poppins', 'lora']);
 *
 *   return (
 *     <div>
 *       <ProgressBar value={progress} max={100} />
 *       <p>{remaining} fonts remaining</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFontProgress(fontIds: string[]) {
  const { loadedFonts } = useFontLoader(fontIds);

  const loaded = loadedFonts.size;
  const total = fontIds.length;
  const progress = total > 0 ? (loaded / total) * 100 : 0;
  const remaining = total - loaded;

  return {
    progress,
    loaded,
    total,
    remaining,
    isComplete: remaining === 0,
  };
}

/**
 * Hook for font fallback chain management
 *
 * Automatically uses fallback font if primary font fails to load
 *
 * @param primaryFontId - Primary font to try
 * @param fallbackFontId - Fallback if primary fails
 * @returns Currently active font ID
 *
 * @example
 * ```tsx
 * function SafeText() {
 *   const activeFont = useFontFallback('custom-font', 'roboto');
 *
 *   return (
 *     <p style={{ fontFamily: FONT_OPTIONS.find(f => f.id === activeFont)?.value }}>
 *       This text is safe
 *     </p>
 *   );
 * }
 * ```
 */
export function useFontFallback(primaryFontId: string, fallbackFontId: string) {
  const [activeFontId, setActiveFontId] = useState(primaryFontId);
  const { error } = useFontLoader([primaryFontId], {
    onError: () => setActiveFontId(fallbackFontId),
  });

  return activeFontId;
}
