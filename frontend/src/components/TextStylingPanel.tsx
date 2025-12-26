import { useState, useCallback } from 'react';
import ColorPicker from './ColorPicker';
import PositionSelector from './PositionSelector';

/**
 * Text position type representing vertical text placement
 */
export type TextPosition = 'top' | 'center' | 'bottom';

/**
 * Font family type representing available font options
 */
export type FontFamily =
  | 'Arial'
  | 'Helvetica'
  | 'Georgia'
  | 'Times New Roman'
  | 'Verdana'
  | 'Trebuchet MS'
  | 'Courier New'
  | 'Impact'
  | 'Roboto'
  | 'Open Sans';

/**
 * Font option configuration
 */
export interface FontOption {
  id: FontFamily;
  label: string;
  value: string;
  category: 'sans-serif' | 'serif' | 'monospace' | 'display';
}

/**
 * Complete text styling configuration
 */
export interface TextStyle {
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
}

/**
 * Available font families configuration
 */
export const FONT_OPTIONS: FontOption[] = [
  { id: 'Arial', label: 'Arial', value: 'Arial, sans-serif', category: 'sans-serif' },
  { id: 'Helvetica', label: 'Helvetica', value: 'Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { id: 'Roboto', label: 'Roboto', value: "'Roboto', sans-serif", category: 'sans-serif' },
  { id: 'Open Sans', label: 'Open Sans', value: "'Open Sans', sans-serif", category: 'sans-serif' },
  { id: 'Verdana', label: 'Verdana', value: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { id: 'Trebuchet MS', label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif", category: 'sans-serif' },
  { id: 'Georgia', label: 'Georgia', value: 'Georgia, serif', category: 'serif' },
  { id: 'Times New Roman', label: 'Times New Roman', value: "'Times New Roman', Times, serif", category: 'serif' },
  { id: 'Courier New', label: 'Courier New', value: "'Courier New', Courier, monospace", category: 'monospace' },
  { id: 'Impact', label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif', category: 'display' },
];

/**
 * Default text style values
 */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Arial',
  fontSize: 24,
  textColor: '#FFFFFF',
  position: 'bottom',
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

  return (
    <div
      className={`text-styling-panel p-4 bg-gray-900 rounded-lg space-y-4 ${className}`}
      role="group"
      aria-label="Text styling controls"
      data-testid="text-styling-panel"
    >
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

      {/* Preview */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg border-2 border-gray-700">
        <div className="text-xs text-gray-500 mb-2">Preview</div>
        <div
          className={`
            h-24 rounded bg-gray-700 relative overflow-hidden
            flex items-${style.position === 'top' ? 'start' : style.position === 'bottom' ? 'end' : 'center'}
            justify-center p-2
          `}
          data-testid="text-preview"
        >
          <span
            style={{
              fontFamily: FONT_OPTIONS.find((f) => f.id === style.fontFamily)?.value || 'Arial, sans-serif',
              fontSize: `${Math.min(style.fontSize, 32)}px`,
              color: style.textColor,
            }}
            className="text-center max-w-full truncate"
          >
            Sample Text
          </span>
        </div>
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" data-testid="style-announcement">
        {`Style: ${style.fontFamily}, ${style.fontSize}px, ${style.textColor}, ${style.position}`}
      </div>
    </div>
  );
};

export default TextStylingPanel;
