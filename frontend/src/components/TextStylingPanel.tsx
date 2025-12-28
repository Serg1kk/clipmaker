import { useState, useCallback } from 'react';
import ColorPicker from './ColorPicker';
import PositionSelector, { TopPositionIcon, CenterPositionIcon, BottomPositionIcon } from './PositionSelector';

/**
 * Text position type representing vertical text placement
 */
export type TextPosition = 'top' | 'center' | 'bottom';

/**
 * Font family type representing available font options (21 fonts total)
 */
export type FontFamily =
  // System/Web Safe Sans-Serif (6)
  | 'Arial'
  | 'Helvetica'
  | 'Verdana'
  | 'Trebuchet MS'
  | 'Roboto'
  | 'Open Sans'
  // Google Fonts Sans-Serif (5)
  | 'Montserrat'
  | 'Lato'
  | 'Poppins'
  | 'Inter'
  | 'Oswald'
  // Serif (3)
  | 'Georgia'
  | 'Times New Roman'
  | 'Playfair Display'
  // Monospace (1)
  | 'Courier New'
  // Display/TikTok Style (5)
  | 'Impact'
  | 'Bebas Neue'
  | 'Anton'
  | 'Bangers'
  | 'Archivo Black'
  // Handwriting (1)
  | 'Permanent Marker';

/**
 * Font category type
 */
export type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'display' | 'handwriting';

/**
 * Font option configuration
 */
export interface FontOption {
  id: FontFamily;
  label: string;
  value: string;
  category: FontCategory;
}

/**
 * Complete text styling configuration
 */
export interface TextStyle {
  /** Whether subtitles are enabled */
  subtitlesEnabled: boolean;
  /** Font family for the text */
  fontFamily: FontFamily;
  /** Font size in pixels (12-72) */
  fontSize: number;
  /** Text color in hex format */
  textColor: string;
  /** Vertical position of text */
  position: TextPosition;
}

/**
 * Props for the TextStylingPanel component
 */
export interface TextStylingPanelProps {
  /** Initial text style values */
  initialStyle?: Partial<TextStyle>;
  /** Callback fired when any style property changes */
  onStyleChange?: (style: TextStyle) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disables all controls when true */
  disabled?: boolean;
  /** Compact mode for inline layouts */
  compact?: boolean;
}

/**
 * Available font families configuration (21 fonts total)
 */
export const FONT_OPTIONS: FontOption[] = [
  // System/Web Safe Sans-Serif
  { id: 'Arial', label: 'Arial', value: 'Arial, sans-serif', category: 'sans-serif' },
  { id: 'Helvetica', label: 'Helvetica', value: 'Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { id: 'Verdana', label: 'Verdana', value: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { id: 'Trebuchet MS', label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif", category: 'sans-serif' },
  { id: 'Roboto', label: 'Roboto', value: "'Roboto', sans-serif", category: 'sans-serif' },
  { id: 'Open Sans', label: 'Open Sans', value: "'Open Sans', sans-serif", category: 'sans-serif' },
  // Google Fonts Sans-Serif (Popular)
  { id: 'Montserrat', label: 'Montserrat', value: "'Montserrat', sans-serif", category: 'sans-serif' },
  { id: 'Lato', label: 'Lato', value: "'Lato', sans-serif", category: 'sans-serif' },
  { id: 'Poppins', label: 'Poppins', value: "'Poppins', sans-serif", category: 'sans-serif' },
  { id: 'Inter', label: 'Inter', value: "'Inter', sans-serif", category: 'sans-serif' },
  { id: 'Oswald', label: 'Oswald', value: "'Oswald', sans-serif", category: 'sans-serif' },
  // Serif
  { id: 'Georgia', label: 'Georgia', value: 'Georgia, serif', category: 'serif' },
  { id: 'Times New Roman', label: 'Times New Roman', value: "'Times New Roman', Times, serif", category: 'serif' },
  { id: 'Playfair Display', label: 'Playfair Display', value: "'Playfair Display', serif", category: 'serif' },
  // Monospace
  { id: 'Courier New', label: 'Courier New', value: "'Courier New', Courier, monospace", category: 'monospace' },
  // Display/TikTok Style
  { id: 'Impact', label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif', category: 'display' },
  { id: 'Bebas Neue', label: 'Bebas Neue', value: "'Bebas Neue', sans-serif", category: 'display' },
  { id: 'Anton', label: 'Anton', value: "'Anton', sans-serif", category: 'display' },
  { id: 'Bangers', label: 'Bangers', value: "'Bangers', cursive", category: 'display' },
  { id: 'Archivo Black', label: 'Archivo Black', value: "'Archivo Black', sans-serif", category: 'display' },
  // Handwriting
  { id: 'Permanent Marker', label: 'Permanent Marker', value: "'Permanent Marker', cursive", category: 'handwriting' },
];

/**
 * Default text style values
 */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  subtitlesEnabled: true,
  fontFamily: 'Arial',
  fontSize: 24,
  textColor: '#FFFFFF',
  position: 'center',
};

/**
 * Font size constraints
 */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 72;

/**
 * TextStylingPanel - Comprehensive text styling controls
 *
 * Features:
 * - Font family dropdown with 10 common fonts
 * - Font size slider (12-72px range)
 * - Color picker with preset palette
 * - Position selector (top/center/bottom)
 * - Saves all changes to project state via callback
 * - Accessible with keyboard navigation
 *
 * @example
 * ```tsx
 * <TextStylingPanel
 *   initialStyle={{ fontFamily: 'Arial', fontSize: 24, textColor: '#FFFFFF', position: 'bottom' }}
 *   onStyleChange={(style) => updateProjectState(style)}
 * />
 * ```
 */
const TextStylingPanel = ({
  initialStyle,
  onStyleChange,
  className = '',
  disabled = false,
  compact = false,
}: TextStylingPanelProps) => {
  // Merge initial style with defaults
  const [style, setStyle] = useState<TextStyle>(() => ({
    ...DEFAULT_TEXT_STYLE,
    ...initialStyle,
  }));

  // Generic update handler that updates state and calls onStyleChange
  const updateStyle = useCallback(
    <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => {
      setStyle((prev) => {
        const updated = { ...prev, [key]: value };
        onStyleChange?.(updated);
        return updated;
      });
    },
    [onStyleChange]
  );

  // Font family change handler
  const handleFontFamilyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateStyle('fontFamily', e.target.value as FontFamily);
    },
    [updateStyle]
  );

  // Font size change handler
  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateStyle('fontSize', Number(e.target.value));
    },
    [updateStyle]
  );

  // Color change handler
  const handleColorChange = useCallback(
    (color: string) => {
      updateStyle('textColor', color);
    },
    [updateStyle]
  );

  // Position change handler
  const handlePositionChange = useCallback(
    (position: TextPosition) => {
      updateStyle('position', position);
    },
    [updateStyle]
  );

  // Compact mode: streamlined inline layout
  if (compact) {
    return (
      <div
        className={`text-styling-panel-compact ${className}`}
        role="group"
        aria-label="Text styling controls"
        data-testid="text-styling-panel-compact"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Subtitles Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Subtitles</span>
            <button
              type="button"
              role="switch"
              aria-checked={style.subtitlesEnabled}
              onClick={() => updateStyle('subtitlesEnabled', !style.subtitlesEnabled)}
              disabled={disabled}
              className={`
                relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer
                rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out
                ${style.subtitlesEnabled ? 'bg-blue-600' : 'bg-gray-600'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                aria-hidden="true"
                className={`
                  pointer-events-none inline-block h-4 w-4 transform rounded-full
                  bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${style.subtitlesEnabled ? 'translate-x-4' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          {/* Font Family */}
          <select
            value={style.fontFamily}
            onChange={handleFontFamilyChange}
            disabled={disabled}
            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200"
            title="Font family"
          >
            {FONT_OPTIONS.slice(0, 6).map((font) => (
              <option key={font.id} value={font.id}>{font.label}</option>
            ))}
          </select>

          {/* Font Size */}
          <div className="flex items-center gap-1">
            <input
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              value={style.fontSize}
              onChange={handleFontSizeChange}
              disabled={disabled}
              className="w-16 h-1 rounded-lg appearance-none cursor-pointer bg-gray-600"
              title="Font size"
            />
            <span className="text-xs text-gray-400 w-8">{style.fontSize}px</span>
          </div>

          {/* Color */}
          <input
            type="color"
            value={style.textColor}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border border-gray-600"
            title="Text color"
          />

          {/* Position */}
          <div className="flex gap-1">
            {([
              { pos: 'top' as TextPosition, Icon: TopPositionIcon },
              { pos: 'center' as TextPosition, Icon: CenterPositionIcon },
              { pos: 'bottom' as TextPosition, Icon: BottomPositionIcon },
            ]).map(({ pos, Icon }) => (
              <button
                key={pos}
                type="button"
                onClick={() => handlePositionChange(pos)}
                disabled={disabled}
                className={`p-1 rounded transition-colors ${
                  style.position === pos
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={`Position: ${pos}`}
              >
                <Icon className="w-5 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`text-styling-panel p-4 bg-gray-900 rounded-lg space-y-4 ${className}`}
      role="group"
      aria-label="Text styling controls"
      data-testid="text-styling-panel"
    >
      {/* Enable Subtitles Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <label
          htmlFor="subtitles-enabled-toggle"
          className="text-sm font-medium text-gray-300"
        >
          Enable Subtitles
        </label>
        <button
          type="button"
          role="switch"
          id="subtitles-enabled-toggle"
          aria-checked={style.subtitlesEnabled}
          onClick={() => updateStyle('subtitlesEnabled', !style.subtitlesEnabled)}
          disabled={disabled}
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
            rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
            ${style.subtitlesEnabled ? 'bg-blue-600' : 'bg-gray-600'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          data-testid="subtitles-enabled-toggle"
        >
          <span className="sr-only">Enable subtitles</span>
          <span
            aria-hidden="true"
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full
              bg-white shadow ring-0 transition duration-200 ease-in-out
              ${style.subtitlesEnabled ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
      </div>

      {/* Font Family Dropdown */}
      <div className="space-y-1.5">
        <label
          htmlFor="font-family-select"
          className="block text-sm font-medium text-gray-300"
        >
          Font Family
        </label>
        <select
          id="font-family-select"
          value={style.fontFamily}
          onChange={handleFontFamilyChange}
          disabled={disabled}
          className={`
            w-full px-3 py-2 text-sm
            bg-gray-800 border-2 border-gray-600 rounded-lg
            text-gray-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-label="Select font family"
          data-testid="font-family-select"
        >
          {FONT_OPTIONS.map((font) => (
            <option
              key={font.id}
              value={font.id}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label
            htmlFor="font-size-slider"
            className="block text-sm font-medium text-gray-300"
          >
            Font Size
          </label>
          <span
            className="text-sm font-mono text-blue-400 bg-gray-800 px-2 py-0.5 rounded"
            data-testid="font-size-value"
          >
            {style.fontSize}px
          </span>
        </div>
        <input
          id="font-size-slider"
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          value={style.fontSize}
          onChange={handleFontSizeChange}
          disabled={disabled}
          className={`
            w-full h-2 rounded-lg appearance-none cursor-pointer
            bg-gray-700
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-blue-500
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          aria-label="Font size slider"
          aria-valuenow={style.fontSize}
          aria-valuemin={FONT_SIZE_MIN}
          aria-valuemax={FONT_SIZE_MAX}
          data-testid="font-size-slider"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{FONT_SIZE_MIN}px</span>
          <span>{FONT_SIZE_MAX}px</span>
        </div>
      </div>

      {/* Text Color Picker */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">
          Text Color
        </label>
        <ColorPicker
          value={style.textColor}
          onChange={handleColorChange}
          disabled={disabled}
          label="Text color picker"
        />
      </div>

      {/* Position Selector */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">
          Text Position
        </label>
        <PositionSelector
          initialPosition={style.position}
          onPositionChange={handlePositionChange}
          disabled={disabled}
        />
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" data-testid="style-announcement">
        {`Subtitles ${style.subtitlesEnabled ? 'enabled' : 'disabled'}, Style: ${style.fontFamily}, ${style.fontSize}px, ${style.textColor}, ${style.position}`}
      </div>
    </div>
  );
};

export default TextStylingPanel;
