import { useState, useCallback } from 'react';

/**
 * Text position type representing vertical text placement
 */
export type TextPosition = 'top' | 'center' | 'bottom';

/**
 * Position configuration for each placement option
 */
export interface PositionConfig {
  id: TextPosition;
  label: string;
  description: string;
}

/**
 * Props for the PositionSelector component
 */
export interface PositionSelectorProps {
  /** Initial selected position */
  initialPosition?: TextPosition;
  /** Callback when position selection changes */
  onPositionChange?: (position: TextPosition) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Available positions configuration
 */
const POSITIONS: PositionConfig[] = [
  { id: 'top', label: 'Top', description: 'Text positioned at top of frame' },
  { id: 'center', label: 'Center', description: 'Text positioned in center of frame' },
  { id: 'bottom', label: 'Bottom', description: 'Text positioned at bottom of frame' },
];

/**
 * Icon component for top position
 */
const TopPositionIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Frame outline */}
    <rect x="2" y="2" width="36" height="26" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* Text lines at top */}
    <rect x="8" y="6" width="24" height="3" rx="1" fill="currentColor" opacity="0.8" />
    <rect x="12" y="11" width="16" height="2" rx="1" fill="currentColor" opacity="0.4" />
  </svg>
);

/**
 * Icon component for center position
 */
const CenterPositionIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Frame outline */}
    <rect x="2" y="2" width="36" height="26" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* Text lines in center */}
    <rect x="8" y="12" width="24" height="3" rx="1" fill="currentColor" opacity="0.8" />
    <rect x="12" y="17" width="16" height="2" rx="1" fill="currentColor" opacity="0.4" />
  </svg>
);

/**
 * Icon component for bottom position
 */
const BottomPositionIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Frame outline */}
    <rect x="2" y="2" width="36" height="26" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* Text lines at bottom */}
    <rect x="8" y="19" width="24" height="3" rx="1" fill="currentColor" opacity="0.8" />
    <rect x="12" y="24" width="16" height="2" rx="1" fill="currentColor" opacity="0.4" />
  </svg>
);

/**
 * Map position IDs to their icon components
 */
const POSITION_ICONS: Record<TextPosition, React.FC<{ className?: string }>> = {
  'top': TopPositionIcon,
  'center': CenterPositionIcon,
  'bottom': BottomPositionIcon,
};

/**
 * PositionSelector component for choosing text vertical position
 *
 * Features:
 * - 3 position buttons with visual icons (top, center, bottom)
 * - Selected position stored in state
 * - Active/inactive visual states
 * - Keyboard navigation (Tab + Enter/Space)
 * - Accessible with ARIA labels
 *
 * @example
 * ```tsx
 * <PositionSelector
 *   initialPosition="center"
 *   onPositionChange={(position) => console.log('Selected:', position)}
 * />
 * ```
 */
const PositionSelector = ({
  initialPosition = 'center',
  onPositionChange,
  className = '',
  disabled = false,
}: PositionSelectorProps) => {
  // Store selected position in state
  const [selectedPosition, setSelectedPosition] = useState<TextPosition>(initialPosition);

  // Handle position button click
  const handlePositionClick = useCallback(
    (position: TextPosition) => {
      if (disabled) return;
      setSelectedPosition(position);
      onPositionChange?.(position);
    },
    [disabled, onPositionChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, position: TextPosition) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePositionClick(position);
      }
    },
    [handlePositionClick]
  );

  return (
    <div
      className={`position-selector ${className}`}
      role="group"
      aria-label="Select text position"
      data-testid="position-selector"
    >
      <div className="flex gap-2">
        {POSITIONS.map((position) => {
          const isSelected = selectedPosition === position.id;
          const IconComponent = POSITION_ICONS[position.id];

          return (
            <button
              key={position.id}
              type="button"
              onClick={() => handlePositionClick(position.id)}
              onKeyDown={(e) => handleKeyDown(e, position.id)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center justify-center
                p-3 rounded-lg border-2 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:bg-gray-700'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-pressed={isSelected}
              aria-label={`${position.label}: ${position.description}`}
              data-testid={`position-button-${position.id}`}
              data-selected={isSelected ? 'true' : 'false'}
            >
              {/* Icon */}
              <IconComponent className="w-10 h-8 mb-1" />

              {/* Label */}
              <span className="text-xs font-medium whitespace-nowrap">
                {position.label}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                  data-testid="selected-indicator"
                >
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" data-testid="selection-announcement">
        {selectedPosition && `Selected: ${POSITIONS.find(p => p.id === selectedPosition)?.label}`}
      </div>
    </div>
  );
};

export default PositionSelector;
