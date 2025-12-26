# Font Quick Reference Guide

## Complete Font List at a Glance

### Web-Safe Fonts (No external loading required)

```
Sans-Serif:
- Arial
- Helvetica
- Verdana
- Trebuchet MS

Serif:
- Georgia
- Times New Roman

Monospace:
- Courier New
- Courier
```

### Google Fonts (Popular choices)

```
Sans-Serif (Recommended for captions):
- Roboto (DEFAULT)
- Inter
- Poppins
- Open Sans
- Montserrat

Serif (For titles/emphasis):
- Lora
- Playfair Display

Display/Special:
- Fredoka One (rounded display)
- Space Mono (monospace display)
```

---

## Font Code Examples

### TypeScript/React Usage

```typescript
import { FONT_OPTIONS, DEFAULT_FONT, getFontCSS, isGoogleFont } from '@/constants/fonts';

// Get font by ID
const font = FONT_OPTIONS.find(f => f.id === 'roboto');
console.log(font?.value); // "Roboto, system-ui, sans-serif"

// Use default font
console.log(DEFAULT_FONT.label); // "Roboto"
console.log(DEFAULT_FONT.value); // "Roboto, system-ui, sans-serif"

// Check if font requires Google Fonts
if (isGoogleFont('roboto')) {
  // Load from Google Fonts
}

// Get CSS font-family string
const cssFont = getFontCSS('poppins');
console.log(cssFont); // "Poppins, sans-serif"
```

### React Component Example

```typescript
import { FONT_OPTIONS, DEFAULT_FONT } from '@/constants/fonts';
import { loadGoogleFonts } from '@/constants/fontLoading';

export function FontSelector() {
  const [selectedFont, setSelectedFont] = useState(DEFAULT_FONT.id);

  const handleFontChange = async (fontId: string) => {
    // Load font if needed
    await loadGoogleFonts([fontId]);
    setSelectedFont(fontId);
  };

  return (
    <select value={selectedFont} onChange={(e) => handleFontChange(e.target.value)}>
      {FONT_OPTIONS.map(font => (
        <option key={font.id} value={font.id}>
          {font.label}
        </option>
      ))}
    </select>
  );
}
```

### CSS Usage

```css
/* Using specific font */
.caption-text {
  font-family: Roboto, system-ui, sans-serif;
}

/* Using CSS variable */
:root {
  --font-primary: Roboto, system-ui, sans-serif;
  --font-heading: Poppins, sans-serif;
}

.caption-text {
  font-family: var(--font-primary);
}

.caption-title {
  font-family: var(--font-heading);
}
```

### HTML with Google Fonts

```html
<!-- Load fonts from Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">

<style>
  .caption-text {
    font-family: 'Roboto', sans-serif;
  }
</style>
```

---

## Font Selection by Purpose

### For Main Caption Text
```
First Choice:  Roboto (400 weight)
Alternative:   Inter, Open Sans
CSS Example:   font-family: Roboto, system-ui, sans-serif;
```

### For Caption Titles
```
First Choice:  Poppins (600-700 weight)
Alternative:   Montserrat, Lora
CSS Example:   font-family: Poppins, sans-serif;
```

### For Timestamps/Badges
```
First Choice:  Space Mono (400 weight)
Alternative:   Courier New
CSS Example:   font-family: 'Space Mono', monospace;
```

### For Elegant Styling
```
First Choice:  Lora (400-600 weight)
Alternative:   Playfair Display
CSS Example:   font-family: Lora, serif;
```

### Emergency Fallback
```
Use:           Arial, Helvetica
CSS Example:   font-family: Arial, sans-serif;
```

---

## Font Loading Strategies

### Strategy 1: Web-Safe Only (Fastest)
```typescript
// No Google Fonts loading needed
// Font is instantly available on all devices
// File size impact: 0 KB

const font = 'Arial'; // or Georgia, Courier New, etc
```

### Strategy 2: Google Fonts (Recommended)
```typescript
import { loadGoogleFonts } from '@/constants/fontLoading';

// Load fonts on component mount
useEffect(() => {
  loadGoogleFonts(['roboto', 'poppins']);
}, []);

// Font size impact: ~40 KB gzipped
```

### Strategy 3: Optimized Loading (Best Performance)
```typescript
import { preloadFonts, loadGoogleFonts } from '@/constants/fontLoading';

// On app init: preconnect to Google Fonts
preloadFonts(['roboto', 'poppins']);

// When needed: load the fonts
useEffect(() => {
  loadGoogleFonts(['roboto', 'poppins']);
}, []);
```

---

## Font Properties Reference

### Roboto (RECOMMENDED DEFAULT)
```
ID:          'roboto'
Label:       'Roboto'
Value:       'Roboto, system-ui, sans-serif'
Category:    sans-serif
Google Font: Yes
Weights:     400, 500, 700
Use Cases:   Primary captions, body text
Readability: Excellent at all sizes
Best For:    Video overlays
```

### Poppins
```
ID:          'poppins'
Label:       'Poppins'
Value:       'Poppins, sans-serif'
Category:    sans-serif
Google Font: Yes
Weights:     400, 500, 600, 700
Use Cases:   Titles, emphasis
Readability: Very good
Best For:    Headers and titles
```

### Inter
```
ID:          'inter'
Label:       'Inter'
Value:       'Inter, system-ui, sans-serif'
Category:    sans-serif
Google Font: Yes
Weights:     400, 500, 600, 700
Use Cases:   Body text, captions
Readability: Excellent (geometric)
Best For:    Screen display
```

### Arial (Web-Safe)
```
ID:          'arial'
Label:       'Arial'
Value:       'Arial, Helvetica, sans-serif'
Category:    sans-serif
Google Font: No
Weights:     400, 700
Use Cases:   Universal fallback
Readability: Good
Best For:    Guaranteed compatibility
```

### Georgia (Web-Safe)
```
ID:          'georgia'
Label:       'Georgia'
Value:       'Georgia, serif'
Category:    serif
Google Font: No
Weights:     400, 700
Use Cases:   Elegant styling
Readability: Good (serif)
Best For:    Professional appearance
```

### Space Mono
```
ID:          'space-mono'
Label:       'Space Mono'
Value:       '"Space Mono", monospace'
Category:    monospace
Google Font: Yes
Weights:     400, 700
Use Cases:   Timestamps, code
Readability: Good (monospace)
Best For:    Technical content
```

---

## Font Weight Reference

```
Thin:   100 (rarely available)
Light:  300 (rarely available)
Regular: 400 (most common)
Medium: 500 (good for emphasis)
SemiBold: 600 (strong emphasis)
Bold:   700 (headings)
Heavy:  900 (rarely available)
```

### Weight Recommendations for Captions
```
Body Text:     400 (regular)
Emphasis:      500-600 (medium-semibold)
Titles:        700 (bold)
Fine Print:    400 (regular, smaller size)
```

---

## Performance Metrics

### Font Loading Times
```
Web-Safe (Arial, Georgia):    Instant
Google Fonts (first load):     ~200-500ms
Google Fonts (cached):         Instant
```

### File Sizes (gzipped)
```
Single Google Font:            ~15-30 KB
Two Google Fonts:              ~25-40 KB
Three Google Fonts:            ~35-50 KB
Web-Safe Only:                 0 KB
```

### CSS Variable Impact
```
CSS Variables:                 +0.5 KB
Font Imports:                  +5-10 KB
JavaScript Font Loader:        +2 KB
Total Overhead:                ~7-20 KB
```

---

## Browser Support

### All Fonts
- Chrome: ✓ Full support
- Firefox: ✓ Full support
- Safari: ✓ Full support (iOS 4.1+)
- Edge: ✓ Full support
- IE 11: ✓ Full support

### Google Fonts Specific
- Requires HTTPS: Yes
- CORS: Handled by Google
- Display Swap: Supported everywhere

---

## Troubleshooting

### Font Not Loading
```typescript
// Check if font ID is valid
const font = FONT_OPTIONS.find(f => f.id === 'typo');
// If undefined, check FONT_OPTIONS list

// For Google Fonts, check network requests
// Ensure HTTPS is used
// Check display=swap parameter
```

### Font Rendering Issues
```css
/* Add these for better rendering */
font-smoothing: antialiased;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Fallback Not Working
```css
/* Always include fallback */
font-family: 'Custom Font', Arial, sans-serif;
                              ↑ fallback required
```

---

## Environment Setup

### Add to Next.js
```jsx
// app.tsx or _document.tsx
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

### Add to Create React App
```css
/* index.css */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
```

### Add to Plain HTML
```html
<head>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
</head>
```

---

## Summary

| Use Case | Font | Weight | Category | Loading |
|----------|------|--------|----------|---------|
| Primary captions | Roboto | 400 | Sans-serif | Google |
| Titles | Poppins | 600-700 | Sans-serif | Google |
| Body text | Inter | 400 | Sans-serif | Google |
| Elegant text | Lora | 400-600 | Serif | Google |
| Timestamps | Space Mono | 400 | Monospace | Google |
| Fallback | Arial | 400 | Sans-serif | Web-Safe |

**Recommended Setup:**
1. Load Roboto as primary (default)
2. Load Poppins for titles (optional)
3. Use Arial as fallback (automatic)
4. Total impact: ~30-40 KB

---

**Last Updated:** 2025-12-27
**Status:** Ready for Implementation
