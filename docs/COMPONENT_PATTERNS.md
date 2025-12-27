# React Component Patterns Analysis

**Project**: AI Clips - Video Editing Tool
**Date**: December 27, 2025
**Component Focus**: Frontend styling, structure, and UI patterns

---

## 1. STYLING PATTERNS (Tailwind CSS)

### Color Palette
- **Primary Color**: Blue-600 (`bg-blue-600`, `text-blue-500`, `border-blue-500`)
- **Secondary Colors**: Gray scale (gray-900, gray-800, gray-700, gray-600, gray-400, gray-300)
- **Accent Colors**: Blue-400, Blue-500 for hover states and selection
- **Dark Theme**: Dark mode is the primary design system (`bg-gray-900` backgrounds)

### Consistent Tailwind Classes

#### Cards & Container Elements
```tsx
// Base card styling
'bg-gray-800 rounded-xl border border-gray-700'

// Hover states
'hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200'

// Focus states (keyboard navigation)
'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900'
```

#### Interactive Elements (Buttons, Selectors)
```tsx
// Selected state
'border-blue-500 bg-blue-500/20 text-blue-400'

// Unselected/Hover state
'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:bg-gray-700'

// Disabled state
'opacity-50 cursor-not-allowed'

// Transition effect
'transition-all duration-200'
```

#### Form Controls (Inputs, Selects, Sliders)
```tsx
// Input styling
'w-full px-3 py-2 text-sm bg-gray-800 border-2 border-gray-600 rounded-lg text-gray-200'

// Focus styling
'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

// Error state
'border-red-500'
```

#### Text & Labels
- Label: `'text-sm font-medium text-gray-300'`
- Body: `'text-gray-400'`
- Secondary: `'text-gray-500'` or `'text-xs text-gray-500'`
- Highlights: `'text-blue-400'` for important info
- Value display: `'text-sm font-mono text-blue-400 bg-gray-800 px-2 py-0.5 rounded'`

#### Layout Spacing
- Gap between elements: `gap-2`, `gap-3`, `gap-4`
- Padding: `p-3`, `p-4`, `p-6`
- Margins: `mb-1.5`, `mb-2`, `mt-2`, `mt-4`
- Space between sections: `space-y-2`, `space-y-4`

---

## 2. COMPONENT STRUCTURE PATTERNS

### Props Interface Pattern
All components follow this standard structure:

```tsx
interface ComponentProps {
  /** JSDoc comment for prop */
  propName: Type;
  /** Optional CSS class name */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}
```

### Common Props Across Components
1. **className** (optional): For additional Tailwind classes
2. **disabled** (optional): Controls disabled state
3. **data-testid**: For testing and debugging
4. **aria-label / aria-pressed / aria-selected**: For accessibility

### Component File Template
```tsx
// 1. Type definitions and interfaces
interface ComponentProps { ... }
interface DataModel { ... }

// 2. Constants (configuration arrays, color mappings)
const CONFIG = [...]
const ICON_MAP = { ... }

// 3. Utility functions (formatters, validators)
const helperFunction = (value) => { ... }

// 4. Icon/SVG sub-components
const CustomIcon = ({ className = '' }) => (...)

// 5. Main component
const ComponentName = (props) => { ... }

// 6. Export
export default ComponentName
```

---

## 3. CARD COMPONENT PATTERNS (VideoCard Reference)

### VideoCard.tsx Structure

#### Props Interface
```tsx
interface VideoCardProps {
  video: VideoFileMetadata;
  onClick: (video: VideoFileMetadata) => void;
}
```

#### Key Features
1. **Clickable interaction**: `onClick`, `onKeyDown` for accessibility
2. **Keyboard support**: Enter and Space key handling
3. **Accessibility**: `role="button"`, `tabIndex={0}`, `aria-label`
4. **Hover states**: Group hover patterns with `group` and `group-hover:` classes

#### Visual Hierarchy
```tsx
<div className="group bg-gray-800 rounded-xl border border-gray-700 overflow-hidden ...">
  {/* Thumbnail Section (aspect-video) */}
  <div className="relative aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent z-10" />

    {/* Main content */}
    {/* Badges (absolute positioned) */}

    {/* Hover overlay */}
  </div>

  {/* Info Section (p-4) */}
  <div className="p-4">
    <h3 className="text-white font-medium truncate mb-2">Title</h3>
    <div className="flex items-center justify-between text-sm text-gray-400">
      {/* Metadata badges */}
    </div>
  </div>
</div>
```

#### Hover Effects Pattern
- **Group pattern**: Parent has `group` class, children use `group-hover:` classes
- **Icon color change**: `group-hover:text-blue-500`
- **Title color change**: `group-hover:text-blue-400`
- **Overlay appearance**: `opacity-0 group-hover:opacity-100`
- **Border glow**: `hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10`

#### Badge Pattern
```tsx
<div className="absolute bottom-2 right-2 z-20 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white">
  {value}
</div>
```

---

## 4. UI PATTERNS & CONVENTIONS

### Button/Control Selection Pattern
Used in: **TemplateSelector**, **PositionSelector**, **ColorPicker presets**

#### Structure
```tsx
<button
  type="button"
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
  data-testid={`button-${id}`}
>
  {/* Icon */}
  <Icon className="w-10 h-8 mb-1" />

  {/* Label */}
  <span className="text-xs font-medium whitespace-nowrap">Label</span>

  {/* Selected indicator */}
  {isSelected && (
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
      <CheckIcon className="w-3 h-3 text-white" />
    </div>
  )}
</button>
```

#### Key Elements
- **Relative positioning**: Allows absolute positioned selected indicator
- **Selected indicator**: Blue dot with checkmark in top-right corner
- **Keyboard navigation**: `onKeyDown` for Enter/Space support
- **Focus ring**: Blue ring with dark offset for visibility

### Panel/Section Pattern
Used in: **TextStylingPanel**, **ColorPicker**, **PositionSelector**

#### Structure
```tsx
<div
  className="panel-name p-4 bg-gray-900 rounded-lg space-y-4"
  role="group"
  aria-label="Descriptive label"
  data-testid="panel-name"
>
  {/* Individual control section */}
  <div className="space-y-1.5">
    <label htmlFor="control-id" className="block text-sm font-medium text-gray-300">
      Label
    </label>
    {/* Control element */}
  </div>

  {/* Screen reader announcement */}
  <div className="sr-only" aria-live="polite" data-testid="announcement">
    Current state announcement
  </div>
</div>
```

#### Key Elements
- **Panel container**: `p-4 bg-gray-900 rounded-lg space-y-4`
- **Control section**: `space-y-1.5` for tight spacing between label and control
- **Label styling**: `text-sm font-medium text-gray-300`
- **Screen reader support**: `sr-only` (screen reader only) hidden div with `aria-live="polite"`

### Input Field Pattern
```tsx
<input
  type="text"
  className={`
    w-full px-3 py-2 text-sm font-mono uppercase
    bg-gray-800 border-2 border-gray-600 rounded-lg
    text-gray-200 placeholder-gray-500
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${!isValid ? 'border-red-500' : ''}
  `}
  aria-label="Descriptive label"
  aria-invalid={!isValid}
  data-testid="input-field"
/>
```

#### Key Elements
- **Typography**: Font-mono for hex codes, uppercase display
- **Borders**: 2px border-gray-600, changes to border-blue-500 on focus
- **Error state**: border-red-500 for invalid input
- **Focus ring**: Blue ring, offset by dark gray
- **ARIA support**: aria-label and aria-invalid

### Slider/Range Input Pattern
```tsx
<input
  type="range"
  min={MIN}
  max={MAX}
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
  `}
  aria-label="Label"
  aria-valuenow={value}
  aria-valuemin={MIN}
  aria-valuemax={MAX}
/>
```

#### Key Elements
- **Webkit thumb**: Custom styling for Chrome/Safari
- **Mozilla thumb**: Custom styling for Firefox
- **Thumb hover**: Scale-110 on hover
- **ARIA attributes**: aria-valuenow, aria-valuemin, aria-valuemax for screen readers
- **Color bar**: bg-gray-700, thumb is bg-blue-500

### Select Dropdown Pattern
```tsx
<select
  value={value}
  onChange={handler}
  className={`
    w-full px-3 py-2 text-sm
    bg-gray-800 border-2 border-gray-600 rounded-lg
    text-gray-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}
  aria-label="Label"
  data-testid="select-field"
>
  {options.map(opt => (
    <option key={opt.id} value={opt.id}>
      {opt.label}
    </option>
  ))}
</select>
```

---

## 5. ACCESSIBILITY PATTERNS

### ARIA Labels & Roles
```tsx
// Button with accessibility
role="button"
tabIndex={0}
aria-label="Start project with {name}"
aria-pressed={isSelected}
aria-invalid={!isValid}

// Grouping controls
role="group"
aria-label="Select video template layout"

// Screen reader only content
<div className="sr-only" aria-live="polite">
  Announcement text for screen readers
</div>

// List/palette roles
role="listbox"
role="option"
```

### Keyboard Navigation Pattern
```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(value);
    }
  },
  [onClick]
);
```

---

## 6. STATE MANAGEMENT PATTERNS

### useState with Callback
```tsx
const [selectedItem, setSelectedItem] = useState<Type>(initialValue);

const handleChange = useCallback(
  (newValue: Type) => {
    setSelectedItem(newValue);
    onChangeCallback?.(newValue);
  },
  [onChangeCallback]
);
```

### Form State with Validation
```tsx
const [inputValue, setInputValue] = useState(initialValue);
const [isFocused, setIsFocused] = useState(false);
const [isValid, setIsValid] = useState(true);

useEffect(() => {
  if (!isFocused) {
    // Validate and reset on blur
    setIsValid(validate(inputValue));
  }
}, [isFocused, inputValue]);
```

### Event Handlers
```tsx
// Change handlers with type safety
const handleChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Process and validate
  },
  [dependencies]
);

// Keyboard handlers
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(id);
    }
  },
  [onClick]
);

// Focus handlers
const handleFocus = useCallback(() => setIsFocused(true), []);
const handleBlur = useCallback(() => setIsFocused(false), []);
```

---

## 7. LAYOUT & SPACING CONVENTIONS

### Padding & Margins
- **Panels**: `p-4` (16px)
- **Controls section**: `p-3` (12px)
- **Label-to-control gap**: `space-y-1.5` (6px)
- **Between sections**: `space-y-4` (16px)
- **Horizontal gaps**: `gap-2`, `gap-3`, `gap-4`

### Typography
- **Panel title/label**: `text-sm font-medium text-gray-300`
- **Control label**: `text-xs font-medium`
- **Helper text**: `text-xs text-gray-500`
- **Values/badges**: `text-xs font-medium text-white`

### Border Radius
- **Cards/panels**: `rounded-xl` (12px)
- **Buttons/inputs**: `rounded-lg` (8px)
- **Badges**: `rounded` (4px)

---

## 8. TESTING & DATA ATTRIBUTES

All interactive components include:
```tsx
data-testid="component-unique-id"
data-selected={isSelected ? 'true' : 'false'}
data-value={currentValue}
```

Example test IDs:
- `template-button-{id}`
- `color-preset-{name}`
- `position-button-{id}`
- `text-styling-panel`
- `color-picker`

---

## 9. ICON PATTERNS

### SVG Icons
- **Inline SVGs**: Used for custom icons (layout templates, position indicators)
- **Icon sizing**:
  - Controls: `w-10 h-8` or `w-5 h-5`
  - Badges: `w-3 h-3` or `w-7 h-7`
  - Decorative: `w-16 h-16`

### Icon Components
```tsx
const CustomIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 40 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* SVG content */}
  </svg>
);

// Icon mapping for type-safe access
const ICON_MAP: Record<ItemType, React.FC<{ className?: string }>> = {
  'type-1': Icon1,
  'type-2': Icon2,
};
```

---

## 10. RECOMMENDED PATTERNS FOR NEW COMPONENTS

### For ProjectCard Component
```tsx
interface ProjectCardProps {
  project: ProjectMetadata;
  onClick: (project: ProjectMetadata) => void;
  className?: string;
  disabled?: boolean;
}

// Base structure: follow VideoCard pattern
// - Clickable container with group hover
// - Thumbnail placeholder with icon
// - Badge with metadata
// - Title and info section
// - Hover overlay with action
```

### For ConfirmDeleteModal Component
```tsx
interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  itemName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

// Structure:
// - Dark overlay (fixed, inset-0, bg-black/50)
// - Modal container (centered, bg-gray-800, rounded-xl)
// - Header with title (p-6, border-b)
// - Body with message (p-6)
// - Footer with buttons (p-6, border-t, flex gap-3, justify-end)
// - Cancel button: gray styling
// - Delete button: red styling for destructive action
// - Loading state with spinner
```

---

## Summary of Key Patterns

1. **Color Scheme**: Dark theme with blue accents
2. **Interactions**: Group hover, focus rings, smooth transitions
3. **States**: Selected (blue), unselected (gray), disabled (opacity-50)
4. **Accessibility**: Full ARIA support, keyboard navigation, screen reader text
5. **Spacing**: Consistent 4px base unit (p-3=12px, p-4=16px, etc.)
6. **Form Controls**: 2px borders, blue focus ring with offset, error states in red
7. **Testing**: All interactive elements have data-testid attributes
8. **Icons**: Custom SVGs with configurable sizing via className
9. **Panels**: bg-gray-900, p-4, rounded-lg, space-y-4 structure
10. **Callbacks**: useCallback with dependency arrays, optional props with ?. syntax

