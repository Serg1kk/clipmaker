/**
 * Tests for font loading hooks
 *
 * Tests cover:
 * - Font loading functionality
 * - Error handling
 * - Caching behavior
 * - Hook state management
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useFontLoader,
  useFontSelection,
  useFontProgress,
  useFontFallback,
} from '../useFontLoader';
import * as fontLoading from '../../constants/fontLoading';

// Mock font loading module
jest.mock('../../constants/fontLoading', () => ({
  loadGoogleFonts: jest.fn(),
  applyFontVariables: jest.fn(),
}));

describe('useFontLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should initialize with isLoading false and no error', () => {
      const { result } = renderHook(() => useFontLoader(['roboto']));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load web-safe fonts without external requests', async () => {
      const { result } = renderHook(() => useFontLoader(['arial']));

      await waitFor(() => {
        expect(result.current.loadedFonts.has('arial')).toBe(true);
      });

      // Web-safe fonts don't require Google Fonts loading
      expect(fontLoading.loadGoogleFonts).not.toHaveBeenCalled();
    });

    it('should load Google Fonts with external request', async () => {
      (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFontLoader(['roboto']));

      await waitFor(() => {
        expect(result.current.loadedFonts.has('roboto')).toBe(true);
      });

      expect(fontLoading.loadGoogleFonts).toHaveBeenCalledWith(['roboto']);
    });
  });

  describe('error handling', () => {
    it('should handle loading errors', async () => {
      const errorMessage = 'Failed to load fonts';
      (fontLoading.loadGoogleFonts as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const { result } = renderHook(() => useFontLoader(['roboto']));

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should call onError callback on failure', async () => {
      const onError = jest.fn();
      const errorMessage = 'Load failed';

      (fontLoading.loadGoogleFonts as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      renderHook(() => useFontLoader(['roboto'], { onError }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should allow retry after error', async () => {
      (fontLoading.loadGoogleFonts as jest.Mock)
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useFontLoader(['roboto']));

      // First attempt should fail
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Clear error and retry
      act(() => {
        result.current.retry();
      });

      // Second attempt should succeed
      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.loadedFonts.has('roboto')).toBe(true);
      });
    });
  });

  describe('caching', () => {
    it('should not reload fonts that are already loaded', async () => {
      (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

      const { result: result1 } = renderHook(() => useFontLoader(['roboto']));

      await waitFor(() => {
        expect(result1.current.loadedFonts.has('roboto')).toBe(true);
      });

      // Load same font again
      const { result: result2 } = renderHook(() => useFontLoader(['roboto']));

      // Should not call loadGoogleFonts again
      expect(fontLoading.loadGoogleFonts).toHaveBeenCalledTimes(1);
    });

    it('should only load new fonts when font list changes', async () => {
      (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

      const { result, rerender } = renderHook(
        ({ fontIds }) => useFontLoader(fontIds),
        { initialProps: { fontIds: ['roboto'] } }
      );

      await waitFor(() => {
        expect(result.current.loadedFonts.has('roboto')).toBe(true);
      });

      // Add another font
      rerender({ fontIds: ['roboto', 'poppins'] });

      await waitFor(() => {
        expect(result.current.loadedFonts.has('poppins')).toBe(true);
      });

      // Should only load poppins on second call
      expect(fontLoading.loadGoogleFonts).toHaveBeenLastCalledWith(['poppins']);
    });
  });

  describe('callbacks', () => {
    it('should call onLoad callback when fonts load successfully', async () => {
      const onLoad = jest.fn();
      (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

      renderHook(() => useFontLoader(['roboto'], { onLoad }));

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalled();
      });
    });

    it('should skip loading when skip option is true', () => {
      const { result } = renderHook(() =>
        useFontLoader(['roboto'], { skip: true })
      );

      expect(result.current.isLoading).toBe(false);
      expect(fontLoading.loadGoogleFonts).not.toHaveBeenCalled();
    });
  });

  describe('invalid fonts', () => {
    it('should warn about invalid font IDs', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderHook(() => useFontLoader(['invalid-font-id']));

      expect(consoleSpy).toHaveBeenCalledWith('Font ID not found: invalid-font-id');

      consoleSpy.mockRestore();
    });

    it('should filter out invalid font IDs before loading', async () => {
      (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

      renderHook(() => useFontLoader(['roboto', 'invalid-id', 'poppins']));

      await waitFor(() => {
        expect(fontLoading.loadGoogleFonts).toHaveBeenCalledWith(['roboto', 'poppins']);
      });
    });
  });
});

describe('useFontSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);
  });

  it('should initialize with provided font ID', () => {
    const { result } = renderHook(() => useFontSelection('roboto'));

    expect(result.current.selectedFont).toBe('roboto');
  });

  it('should update selected font', async () => {
    const { result } = renderHook(() => useFontSelection('roboto'));

    act(() => {
      result.current.setSelectedFont('poppins');
    });

    expect(result.current.selectedFont).toBe('poppins');
  });

  it('should call onFontChange callback when font changes', () => {
    const onFontChange = jest.fn();

    const { result } = renderHook(() =>
      useFontSelection('roboto', onFontChange)
    );

    act(() => {
      result.current.setSelectedFont('poppins');
    });

    expect(onFontChange).toHaveBeenCalledWith('poppins');
  });

  it('should load font when selection changes', async () => {
    const { result } = renderHook(() => useFontSelection('roboto'));

    act(() => {
      result.current.setSelectedFont('poppins');
    });

    await waitFor(() => {
      expect(fontLoading.loadGoogleFonts).toHaveBeenCalledWith(['poppins']);
    });
  });
});

describe('useFontProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);
  });

  it('should calculate progress correctly', async () => {
    const { result } = renderHook(() =>
      useFontProgress(['roboto', 'poppins', 'lora'])
    );

    await waitFor(() => {
      expect(result.current.progress).toBe(100);
      expect(result.current.isComplete).toBe(true);
    });
  });

  it('should track loaded and remaining fonts', async () => {
    const { result } = renderHook(() =>
      useFontProgress(['roboto', 'poppins', 'lora'])
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(3);
      expect(result.current.total).toBe(3);
      expect(result.current.remaining).toBe(0);
    });
  });

  it('should calculate partial progress', async () => {
    // Mock loading only first font
    (fontLoading.loadGoogleFonts as jest.Mock).mockImplementation(
      async (fontIds) => {
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    );

    const { result } = renderHook(() =>
      useFontProgress(['roboto', 'poppins'])
    );

    // Initially loading
    expect(result.current.progress).toBeLessThan(100);

    await waitFor(() => {
      expect(result.current.progress).toBe(100);
    });
  });
});

describe('useFontFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use primary font when loading succeeds', async () => {
    (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFontFallback('roboto', 'arial'));

    await waitFor(() => {
      expect(result.current).toBe('roboto');
    });
  });

  it('should use fallback font when primary fails to load', async () => {
    (fontLoading.loadGoogleFonts as jest.Mock).mockRejectedValue(
      new Error('Load failed')
    );

    const { result } = renderHook(() => useFontFallback('invalid-font', 'arial'));

    await waitFor(() => {
      expect(result.current).toBe('arial');
    });
  });

  it('should fall back to web-safe font', async () => {
    (fontLoading.loadGoogleFonts as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() =>
      useFontFallback('custom-google-font', 'verdana')
    );

    await waitFor(() => {
      expect(result.current).toBe('verdana');
    });
  });
});

describe('font loading performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not block render while loading', () => {
    (fontLoading.loadGoogleFonts as jest.Mock).mockImplementation(
      () =>
        new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
    );

    const { result } = renderHook(() => useFontLoader(['roboto']));

    // Should immediately return without blocking
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle multiple fonts efficiently', async () => {
    const fontIds = ['roboto', 'poppins', 'open-sans', 'lora'];
    (fontLoading.loadGoogleFonts as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFontLoader(fontIds));

    await waitFor(() => {
      expect(result.current.loadedFonts.size).toBe(4);
    });

    // Should batch load all fonts in single call
    expect(fontLoading.loadGoogleFonts).toHaveBeenCalledTimes(1);
  });
});
