import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Preset color configuration
 */
export interface PresetColor {
  name: string;
  hex: string;
}

/**
 * Props for the ColorPicker component
 */
export interface ColorPickerProps {
  /** Current color value (hex format) */
  value: string;
  /** Callback when color changes */
  onChange: (color: string) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Label for accessibility */
  label?: string;
}

/**
 * Preset color palette
 */
const PRESET_COLORS: PresetColor[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Purple', hex: '#A855F7' },
];

/**
 * Validates a hex color string
 */
const isValidHex = (hex: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

/**
 * Normalizes a hex color to uppercase 6-digit format
 */
const normalizeHex = (hex: string): string => {
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }
  hex = hex.toUpperCase();
  if (hex.length === 4) {
    // Convert #RGB to #RRGGBB
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
};

/**
 * Determines if a color is light or dark for contrast
 */
const isLightColor = (hex: string): boolean => {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

/**
 * ColorPicker component for text color selection
 *
 * Features:
 * - Color preview square showing current color
 * - Hex color input field with validation
 * - Preset color palette (8 common colors)
 * - Keyboard navigation support
 * - Accessible with ARIA labels
 *
 * @example
 * ```tsx
 * <ColorPicker
 *   value="#FF0000"
 *   onChange={(color) => console.log('Selected:', color)}
 * />
 * ```
 */
const ColorPicker = ({
  value,
  onChange,
  className = '',
  disabled = false,
  label = 'Color picker',
}: ColorPickerProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input value with prop value when not focused
  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(value);
    }
  }, [value, isInputFocused]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value.toUpperCase();

      // Add # prefix if missing
      if (newValue && !newValue.startsWith('#')) {
        newValue = '#' + newValue;
      }

      setInputValue(newValue);

      // Only trigger onChange for valid hex colors
      if (isValidHex(newValue)) {
        onChange(normalizeHex(newValue));
      }
    },
    [onChange]
  );

  // Handle input blur - validate and reset if invalid
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    if (!isValidHex(inputValue)) {
      setInputValue(value);
    }
  }, [inputValue, value]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);

  // Handle preset color click
  const handlePresetClick = useCallback(
    (hex: string) => {
      if (disabled) return;
      setInputValue(hex);
      onChange(hex);
    },
    [disabled, onChange]
  );

  // Handle keyboard navigation for preset colors
  const handlePresetKeyDown = useCallback(
    (e: React.KeyboardEvent, hex: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePresetClick(hex);
      }
    },
    [handlePresetClick]
  );

  // Calculate if current color is selected in preset palette
  const normalizedValue = normalizeHex(value);
  const isPresetSelected = (hex: string) => normalizeHex(hex) === normalizedValue;

  return (
    <div
      className={`color-picker ${className}`}
      role="group"
      aria-label={label}
      data-testid="color-picker"
    >
      {/* Color preview and input row */}
      <div className="flex items-center gap-2 mb-3">
        {/* Color preview square */}
        <div
          className={`
            w-10 h-10 rounded-lg border-2 border-gray-600
            flex items-center justify-center
            ${disabled ? 'opacity-50' : ''}
          `}
          style={{ backgroundColor: isValidHex(value) ? value : '#000000' }}
          aria-label={`Current color: ${value}`}
          data-testid="color-preview"
        >
          {/* Checkered background for transparency indication */}
          {!isValidHex(value) && (
            <span className="text-xs text-gray-400">?</span>
          )}
        </div>

        {/* Hex input field */}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            disabled={disabled}
            placeholder="#000000"
            maxLength={7}
            className={`
              w-full px-3 py-2 text-sm font-mono uppercase
              bg-gray-800 border-2 border-gray-600 rounded-lg
              text-gray-200 placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${!isValidHex(inputValue) && inputValue.length > 0 ? 'border-red-500' : ''}
            `}
            aria-label="Hex color code"
            aria-invalid={!isValidHex(inputValue) && inputValue.length > 0}
            data-testid="color-input"
          />
        </div>
      </div>

      {/* Preset color palette */}
      <div
        className="grid grid-cols-8 gap-1"
        role="listbox"
        aria-label="Preset colors"
        data-testid="color-palette"
      >
        {PRESET_COLORS.map((color) => {
          const isSelected = isPresetSelected(color.hex);
          const needsDarkBorder = isLightColor(color.hex);

          return (
            <button
              key={color.hex}
              type="button"
              onClick={() => handlePresetClick(color.hex)}
              onKeyDown={(e) => handlePresetKeyDown(e, color.hex)}
              disabled={disabled}
              className={`
                w-8 h-8 rounded-md border-2 transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                ${isSelected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110'
                  : 'hover:scale-105'
                }
                ${needsDarkBorder ? 'border-gray-400' : 'border-transparent'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{ backgroundColor: color.hex }}
              role="option"
              aria-selected={isSelected}
              aria-label={`${color.name} (${color.hex})`}
              data-testid={`color-preset-${color.name.toLowerCase()}`}
            />
          );
        })}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" data-testid="color-announcement">
        {`Selected color: ${value}`}
      </div>
    </div>
  );
};

export default ColorPicker;
