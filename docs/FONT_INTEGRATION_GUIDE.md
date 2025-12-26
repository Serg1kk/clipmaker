# Font Integration Guide

## Overview

This guide covers how to integrate the font system into your video caption application.

## Project Structure

```
frontend/src/
├── constants/
│   ├── fonts.ts              # Font definitions and configuration
│   └── fontLoading.ts        # Font loading utilities
├── hooks/
│   └── useFontLoader.ts      # React hooks for font management
└── components/
    └── [your components using fonts]

docs/
├── FONT_RESEARCH.md          # Detailed research findings
├── FONT_QUICK_REFERENCE.md   # Quick lookup guide
└── FONT_INTEGRATION_GUIDE.md # This file
```

## Quick Start

### 1. Basic Font Dropdown

```tsx
import { FONT_OPTIONS, DEFAULT_FONT } from '@/constants/fonts';
import { useState } from 'react';

export function FontDropdown() {
  const [selectedFont, setSelectedFont] = useState(DEFAULT_FONT.id);

  return (
    <select
      value={selectedFont}
      onChange={(e) => setSelectedFont(e.target.value)}
      aria-label="Select caption font"
    >
      <optgroup label="Recommended">
        {FONT_OPTIONS.filter(f => ['roboto', 'poppins', 'inter'].includes(f.id)).map(font => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </optgroup>

      <optgroup label="All Fonts">
        {FONT_OPTIONS.map(font => (
          <option key={font.id} value={font.id}>
            {font.label} ({font.category})
          </option>
        ))}
      </optgroup>
    </select>
  );
}
```

### 2. Font Preview Component

```tsx
import { FONT_OPTIONS, getFontCSS } from '@/constants/fonts';
import { useFontLoader } from '@/hooks/useFontLoader';

interface FontPreviewProps {
  fontId: string;
  text?: string;
}

export function FontPreview({ fontId, text = 'Preview Text' }: FontPreviewProps) {
  const { isLoading, error } = useFontLoader([fontId]);
  const font = FONT_OPTIONS.find(f => f.id === fontId);

  if (!font) return <div>Font not found</div>;

  return (
    <div className="font-preview">
      {isLoading && <span className="text-gray-500">Loading font...</span>}
      {error && <span className="text-red-500">Error: {error}</span>}

      <div
        style={{
          fontFamily: font.value,
          fontSize: '24px',
          fontWeight: 400,
        }}
      >
        {text}
      </div>

      <div className="text-sm text-gray-600 mt-2">
        <p>Font: {font.label}</p>
        <p>Category: {font.category}</p>
        <p>CSS: {font.value}</p>
      </div>
    </div>
  );
}
```

### 3. Caption Text Component

```tsx
import { FONT_OPTIONS } from '@/constants/fonts';
import { useFontLoader } from '@/hooks/useFontLoader';

interface CaptionTextProps {
  text: string;
  fontId: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  color?: string;
}

export function CaptionText({
  text,
  fontId,
  fontSize = 16,
  fontWeight = 400,
  color = 'white',
}: CaptionTextProps) {
  const { isLoading } = useFontLoader([fontId]);
  const font = FONT_OPTIONS.find(f => f.id === fontId);

  if (!font) return null;

  return (
    <div
      style={{
        fontFamily: font.value,
        fontSize: `${fontSize}px`,
        fontWeight,
        color,
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.7)',
        opacity: isLoading ? 0.5 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {text}
    </div>
  );
}
```

## Advanced Integration

### Font Manager Context

```tsx
// contexts/FontContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { DEFAULT_FONT, FontOption } from '@/constants/fonts';
import { useFontLoader } from '@/hooks/useFontLoader';

interface FontContextValue {
  primaryFont: FontOption;
  secondaryFont: FontOption;
  setPrimaryFont: (fontId: string) => void;
  setSecondaryFont: (fontId: string) => void;
  isLoading: boolean;
  error: string | null;
}

const FontContext = createContext<FontContextValue | undefined>(undefined);

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [primaryFontId, setPrimaryFontId] = useState(DEFAULT_FONT.id);
  const [secondaryFontId, setSecondaryFontId] = useState('poppins');

  const { isLoading, error } = useFontLoader([primaryFontId, secondaryFontId]);

  const primaryFont = FONT_OPTIONS.find(f => f.id === primaryFontId) || DEFAULT_FONT;
  const secondaryFont = FONT_OPTIONS.find(f => f.id === secondaryFontId) || DEFAULT_FONT;

  return (
    <FontContext.Provider
      value={{
        primaryFont,
        secondaryFont,
        setPrimaryFont: setPrimaryFontId,
        setSecondaryFont: setSecondaryFontId,
        isLoading,
        error,
      }}
    >
      {children}
    </FontContext.Provider>
  );
}

export function useFont() {
  const context = useContext(FontContext);
  if (!context) {
    throw new Error('useFont must be used within FontProvider');
  }
  return context;
}
```

### Font Selector with Groups

```tsx
import { FONTS_BY_CATEGORY } from '@/constants/fonts';
import { useFontSelection } from '@/hooks/useFontLoader';

export function CategorizedFontSelector() {
  const { selectedFont, setSelectedFont, isLoading } = useFontSelection('roboto');

  return (
    <div className="font-selector">
      <label htmlFor="font-select">Choose Font:</label>

      <select
        id="font-select"
        value={selectedFont}
        onChange={(e) => setSelectedFont(e.target.value)}
        disabled={isLoading}
      >
        {Object.entries(FONTS_BY_CATEGORY).map(([category, fonts]) => (
          <optgroup key={category} label={`${category.charAt(0).toUpperCase() + category.slice(1)}`}>
            {fonts.map(font => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {isLoading && <span className="loading">Loading font...</span>}
    </div>
  );
}
```

## CSS Integration

### Global Font Styles

```css
/* styles/fonts.css */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Poppins:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

:root {
  /* Font families */
  --font-primary: 'Roboto', system-ui, sans-serif;
  --font-secondary: 'Poppins', sans-serif;
  --font-accent: 'Lora', serif;
  --font-mono: 'Space Mono', monospace;

  /* Font sizes */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;

  /* Font weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line heights */
  --line-height-tight: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}

/* Caption text styles */
.caption-text {
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
}

.caption-title {
  font-family: var(--font-secondary);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: white;
}

.caption-timestamp {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: rgba(255, 255, 255, 0.8);
}
```

### Tailwind Integration

```tsx
// tailwind.config.ts
export default {
  theme: {
    fontFamily: {
      primary: ['Roboto', 'system-ui', 'sans-serif'],
      secondary: ['Poppins', 'sans-serif'],
      accent: ['Lora', 'serif'],
      mono: ['Space Mono', 'monospace'],
    },
  },
};

// Usage in components
export function Caption() {
  return (
    <div className="font-primary text-base">
      <h1 className="font-secondary text-2xl font-bold">Title</h1>
      <p>Caption text</p>
      <code className="font-mono text-xs">timestamp</code>
    </div>
  );
}
```

## Performance Optimization

### Lazy Load Non-Critical Fonts

```tsx
// Load only critical fonts on init
export function useAppFonts() {
  const { isLoading: criticalLoading } = useFontLoader(['roboto']);

  // Load secondary fonts after critical fonts are ready
  const { isLoading: secondaryLoading } = useFontLoader(
    ['poppins', 'lora'],
    { skip: criticalLoading }
  );

  return {
    isReady: !criticalLoading && !secondaryLoading,
  };
}
```

### Font Caching Strategy

```tsx
// Use this in App root
useEffect(() => {
  // Preload all fonts for app
  preloadFonts(['roboto', 'poppins', 'open-sans']);
}, []);
```

### CSS-in-JS Integration

```tsx
// With styled-components
import styled from 'styled-components';
import { FONT_OPTIONS } from '@/constants/fonts';

const CaptionText = styled.p<{ fontId: string }>`
  font-family: ${props => {
    const font = FONT_OPTIONS.find(f => f.id === props.fontId);
    return font?.value || 'Arial, sans-serif';
  }};
  font-size: 16px;
  font-weight: 400;
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
`;
```

## Testing

### Font Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { CaptionText } from '@/components/CaptionText';

describe('CaptionText', () => {
  it('should render with correct font family', () => {
    const { container } = render(
      <CaptionText text="Test caption" fontId="roboto" />
    );

    const element = container.firstChild;
    const styles = window.getComputedStyle(element);

    expect(styles.fontFamily).toContain('Roboto');
  });

  it('should load Google Fonts when needed', async () => {
    render(<CaptionText text="Test" fontId="poppins" />);

    // Font should load asynchronously
    await screen.findByText('Test');
  });
});
```

### Font Loading Tests

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useFontLoader } from '@/hooks/useFontLoader';

describe('useFontLoader', () => {
  it('should load Google Fonts', async () => {
    const { result } = renderHook(() => useFontLoader(['roboto']));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadedFonts.has('roboto')).toBe(true);
    });
  });

  it('should handle load errors', async () => {
    const { result } = renderHook(() => useFontLoader(['invalid-font']));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

## Migration Guide

### If You Have Existing Font Code

1. Replace hardcoded font names with `FONT_OPTIONS`
2. Use `useFontLoader` hook instead of manual font loading
3. Move Google Fonts import to `fontLoading.ts`
4. Update CSS to use font values from `FONT_OPTIONS`

### Example Migration

```tsx
// Before
const CaptionText = () => {
  return <div style={{ fontFamily: 'Roboto, sans-serif' }}>Text</div>;
};

// After
import { FONT_OPTIONS, DEFAULT_FONT } from '@/constants/fonts';
import { useFontLoader } from '@/hooks/useFontLoader';

const CaptionText = ({ fontId = DEFAULT_FONT.id }) => {
  const { isLoading } = useFontLoader([fontId]);
  const font = FONT_OPTIONS.find(f => f.id === fontId);

  return (
    <div style={{ fontFamily: font?.value, opacity: isLoading ? 0.5 : 1 }}>
      Text
    </div>
  );
};
```

## Troubleshooting

### Font Not Loading
```typescript
// Debug with console logs
const { isLoading, error, loadedFonts } = useFontLoader(['roboto']);

useEffect(() => {
  console.log('Loading:', isLoading);
  console.log('Error:', error);
  console.log('Loaded:', Array.from(loadedFonts));
}, [isLoading, error, loadedFonts]);
```

### CORS Issues
- Ensure using HTTPS URLs for Google Fonts
- Check browser console for CORS errors
- Verify `display=swap` parameter is present

### Font Not Rendering
- Check if Google Fonts CSS is loaded
- Verify font name matches exactly (case-sensitive)
- Check CSS specificity (inline styles override classes)

## Summary

- Use `FONT_OPTIONS` for all font references
- Use `useFontLoader` hook for loading fonts
- Load critical fonts on app init
- Use CSS variables for runtime font switching
- Always provide web-safe fallbacks
- Test font loading on real devices

For more details, see:
- `FONT_RESEARCH.md` - Detailed research
- `FONT_QUICK_REFERENCE.md` - Quick lookup
- `constants/fonts.ts` - Font definitions
- `constants/fontLoading.ts` - Loading utilities
- `hooks/useFontLoader.ts` - React hooks

