import { useState, useCallback } from 'react';

/**
 * Template type representing available frame layouts
 */
export type TemplateType = '1-frame' | '2-frame' | '3-frame';

/**
 * Template configuration for each layout type
 */
export interface TemplateConfig {
  id: TemplateType;
  label: string;
  description: string;
}

/**
 * Props for the TemplateSelector component
 */
export interface TemplateSelectorProps {
  /** Initial selected template */
  initialTemplate?: TemplateType;
  /** Callback when template selection changes */
  onTemplateChange?: (template: TemplateType) => void;
  /** Optional CSS class name */
  className?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Available templates configuration
 */
const TEMPLATES: TemplateConfig[] = [
  { id: '1-frame', label: 'Single Frame', description: 'One video frame layout' },
  { id: '2-frame', label: 'Two Frames', description: 'Side-by-side dual frame layout' },
  { id: '3-frame', label: 'Three Frames', description: 'Triple frame layout' },
];

/**
 * Icon component for 1-frame layout
 */
const OneFrameIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="36" height="26" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="6" y="6" width="28" height="18" rx="1" fill="currentColor" opacity="0.3" />
  </svg>
);

/**
 * Icon component for 2-frame layout
 */
const TwoFrameIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="36" height="26" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="4" y="6" width="14" height="18" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="22" y="6" width="14" height="18" rx="1" fill="currentColor" opacity="0.3" />
  </svg>
);

/**
 * Icon component for 3-frame layout
 */
const ThreeFrameIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="36" height="26" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <rect x="4" y="6" width="9" height="18" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="15" y="6" width="10" height="18" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="27" y="6" width="9" height="18" rx="1" fill="currentColor" opacity="0.3" />
  </svg>
);

/**
 * Map template IDs to their icon components
 */
const TEMPLATE_ICONS: Record<TemplateType, React.FC<{ className?: string }>> = {
  '1-frame': OneFrameIcon,
  '2-frame': TwoFrameIcon,
  '3-frame': ThreeFrameIcon,
};

/**
 * TemplateSelector component for choosing video frame layouts
 *
 * Features:
 * - 3 template buttons with visual icons (1-frame, 2-frame, 3-frame)
 * - Selected template stored in state
 * - Active/inactive visual states
 * - Keyboard navigation (Tab + Enter/Space)
 * - Accessible with ARIA labels
 *
 * @example
 * ```tsx
 * <TemplateSelector
 *   initialTemplate="1-frame"
 *   onTemplateChange={(template) => console.log('Selected:', template)}
 * />
 * ```
 */
const TemplateSelector = ({
  initialTemplate = '1-frame',
  onTemplateChange,
  className = '',
  disabled = false,
}: TemplateSelectorProps) => {
  // Store selected template in state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(initialTemplate);

  // Handle template button click
  const handleTemplateClick = useCallback(
    (template: TemplateType) => {
      if (disabled) return;
      setSelectedTemplate(template);
      onTemplateChange?.(template);
    },
    [disabled, onTemplateChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, template: TemplateType) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTemplateClick(template);
      }
    },
    [handleTemplateClick]
  );

  return (
    <div
      className={`template-selector ${className}`}
      role="group"
      aria-label="Select video template layout"
      data-testid="template-selector"
    >
      <div className="flex gap-2">
        {TEMPLATES.map((template) => {
          const isSelected = selectedTemplate === template.id;
          const IconComponent = TEMPLATE_ICONS[template.id];

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateClick(template.id)}
              onKeyDown={(e) => handleKeyDown(e, template.id)}
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
              aria-label={`${template.label}: ${template.description}`}
              data-testid={`template-button-${template.id}`}
              data-selected={isSelected ? 'true' : 'false'}
            >
              {/* Icon */}
              <IconComponent className="w-10 h-8 mb-1" />

              {/* Label */}
              <span className="text-xs font-medium whitespace-nowrap">
                {template.label}
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
        {selectedTemplate && `Selected: ${TEMPLATES.find(t => t.id === selectedTemplate)?.label}`}
      </div>
    </div>
  );
};

export default TemplateSelector;
