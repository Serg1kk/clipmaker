# MomentsSidebar Integration Plan

## Overview
Integrates a sidebar component to display and manage AI-detected moments alongside the VideoPlayerWithTimeline component.

## Current Architecture Analysis

### VideoPlayerWithTimeline.tsx
- **Role**: Container component combining video playback with timeline visualization
- **Key State Management**: Uses `useTimeline` hook for marker state
- **Video Control**: Direct access to video element via ref (`videoRef.current`)
- **Seeking**: `handleSeek(time)` method seeks video to specific time
- **Marker Management**:
  - `markers` from useTimeline hook
  - `handleMarkerClickWithSeek()` seeks video and updates selection
  - Missing: No `removeMarker` exposure

### useTimeline Hook
- **Marker Operations**:
  - `removeMarker(id: string)` - Removes marker by ID
  - `handleMarkerClick(marker)` - Handles marker selection
  - `markers` - Current list of TimelineMarker objects
- **Full API Available**: All needed methods are exposed

### TimelineMarker Interface
```typescript
{
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  label: string;
  description?: string;
  confidence?: number;
  type: 'ai_detected' | 'manual' | 'highlight';
  text?: string;
}
```

## Proposed Layout Structure

### Flex Layout (Recommended)
```
┌─────────────────────────────────────────────────────────┐
│                    VideoPlayerWithTimeline              │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  VideoPlayer                      │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 VideoTimeline                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Parent Container (flex layout with sidebar):
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────┐  ┌──────────────────────┐  │
│  │  VideoPlayerWithTimeline     │  │  MomentsSidebar      │  │
│  │                              │  │  - Moment list       │  │
│  │  - VideoPlayer               │  │  - Click to seek     │  │
│  │  - VideoTimeline             │  │  - Delete moment     │  │
│  │  (flex: 1)                   │  │  - Moment details    │  │
│  └──────────────────────────────┘  │  (width: 320px)      │  │
│                                     │  (scrollable)        │  │
│                                     └──────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Layout Changes

#### Option A: Parent Component Integration
Create a wrapper component (e.g., `VideoEditorLayout.tsx`):

```typescript
// Flex container with gap
<div className="flex gap-4 bg-gray-900 rounded-lg overflow-hidden">
  {/* Main content: flex-1 to take available space */}
  <VideoPlayerWithTimeline
    url={videoUrl}
    engagingMoments={moments}
    onMomentSelect={(marker) => setSelectedMoment(marker)}
    onRangeSelect={(range) => setSelectedRange(range)}
    className="flex-1"
  />

  {/* Sidebar: fixed width */}
  <MomentsSidebar
    moments={moments}
    selectedMoment={selectedMoment}
    onMomentClick={handleMomentClick}
    onMomentDelete={handleMomentDelete}
    className="w-80 border-l border-gray-700"
  />
</div>
```

#### Option B: Internal Integration (Update VideoPlayerWithTimeline)
Add sidebar directly within VideoPlayerWithTimeline component.

**Recommendation**: Option A - keeps concerns separated and is more flexible for layout changes.

### 2. Props to Pass from VideoPlayerWithTimeline to MomentsSidebar

```typescript
interface MomentsSidebarProps {
  // Data
  moments: TimelineMarker[];
  selectedMoment?: TimelineMarker | null;
  selectedRange?: TimeRange | null;

  // Callbacks
  onMomentClick: (moment: TimelineMarker) => void;
  onMomentDelete: (momentId: string) => void;
  onMomentSelect?: (moment: TimelineMarker | null) => void;

  // Display options
  className?: string;
  showConfidence?: boolean;
  showType?: boolean;
  maxHeight?: string;
}
```

### 3. Wire Up onMomentClick to Seek

In VideoPlayerWithTimeline:

```typescript
// Handler to pass to MomentsSidebar
const handleMomentClickFromSidebar = useCallback((moment: TimelineMarker) => {
  // Seek video to moment start
  handleSeek(moment.startTime);

  // Update timeline selection
  handleMarkerClickWithSeek(moment);

  // Notify parent if needed
  onMomentSelect?.(moment);
}, [handleSeek, handleMarkerClickWithSeek, onMomentSelect]);

// Pass to sidebar
<MomentsSidebar
  moments={markers}
  selectedMoment={selectedMarker}
  onMomentClick={handleMomentClickFromSidebar}
  onMomentDelete={handleMomentDelete}
/>
```

### 4. Wire Up onMomentDelete to removeMarker

In VideoPlayerWithTimeline:

```typescript
// Access removeMarker from useTimeline hook
const { markers, removeMarker, handleMarkerClick, ... } = useTimeline({...});

// Handler to pass to MomentsSidebar
const handleMomentDelete = useCallback((momentId: string) => {
  removeMarker(momentId);
  // Optional: add confirmation or toast notification
}, [removeMarker]);

// Pass to sidebar
<MomentsSidebar
  moments={markers}
  onMomentDelete={handleMomentDelete}
/>
```

## Code Changes Required

### 1. Update VideoPlayerWithTimeline.tsx

```typescript
// Add new prop to interface
export interface VideoPlayerWithTimelineProps extends VideoPlayerProps {
  // ... existing props ...
  /** Whether to show the moments sidebar */
  showMomentsSidebar?: boolean;
  /** Callback when moment is deleted */
  onMomentDelete?: (momentId: string) => void;
}

// In component body, add handler
const handleMomentDelete = useCallback((momentId: string) => {
  removeMarker(momentId);
}, [removeMarker]);

// Export removeMarker so parent can access it
export const {
  markers,
  selectedRange,
  selectedMarker,
  handleMarkerClick,
  removeMarker,
  ...
} = useTimeline({
  onRangeChange: onRangeSelect,
  onMarkerSelect: onMomentSelect,
});

// If showing sidebar, pass handlers
{showMomentsSidebar && (
  <MomentsSidebar
    moments={markers}
    selectedMoment={selectedMarker}
    onMomentClick={handleMarkerClickWithSeek}
    onMomentDelete={handleMomentDelete}
  />
)}
```

### 2. Create MomentsSidebar Component (New File)

Location: `/frontend/src/components/sidebar/MomentsSidebar.tsx`

Key features:
- Displays scrollable list of moments
- Shows marker metadata (time, confidence, description)
- Click to seek
- Delete button with confirmation
- Highlight selected moment
- Group by type (AI Detected, Manual, Highlights)

### 3. Parent Layout Component (New File)

Location: `/frontend/src/components/VideoEditorLayout.tsx`

```typescript
<div className="flex gap-4 w-full h-full bg-gray-900 p-4 rounded-lg">
  <VideoPlayerWithTimeline
    {...props}
    className="flex-1"
  />
  <MomentsSidebar
    moments={moments}
    onMomentDelete={handleDelete}
    className="w-80 border-l border-gray-700"
  />
</div>
```

## State Flow Diagram

```
MomentsSidebar
  ├─ moments (from parent)
  ├─ selectedMoment (from parent)
  └─ Callbacks:
      ├─ onMomentClick(moment)
      │  └─ VideoPlayerWithTimeline.handleMarkerClickWithSeek()
      │     ├─ videoRef.current.currentTime = moment.startTime
      │     └─ useTimeline.handleMarkerClick()
      │
      └─ onMomentDelete(momentId)
         └─ VideoPlayerWithTimeline.handleMomentDelete()
            └─ useTimeline.removeMarker(momentId)
               └─ setMarkersState(prev => prev.filter(m => m.id !== id))
```

## Timeline Interaction Coordination

### Click Behavior Consistency

When user clicks a moment in sidebar:
1. Video seeks to moment.startTime
2. Timeline shows selected range (start -> end)
3. Marker highlighted on timeline
4. Sidebar highlights the moment

When user clicks marker on timeline:
1. Video seeks to marker.startTime
2. Sidebar scrolls to highlight the moment
3. Both components show same selection

**Implementation**: Pass same callback to both components:
```typescript
const handleMomentSelect = useCallback((moment: TimelineMarker) => {
  handleMarkerClickWithSeek(moment); // Updates video + timeline
  // Sidebar auto-highlights via selectedMoment prop
}, [handleMarkerClickWithSeek]);
```

## CSS/Styling Considerations

### Sidebar Container
- Fixed width: 320px (adjustable)
- Scrollable content area
- Dark theme to match video player
- Border separator between components

### Moment Item
- Hover: highlight background
- Active/Selected: blue border or background
- Compact layout with timestamp, title, confidence
- Delete button on hover

### Layout Spacing
- Gap between VideoPlayer and Sidebar: 16px (gap-4)
- Sidebar padding: 16px
- Moment item padding: 8-12px

## Testing Strategy

### Unit Tests
- MomentsSidebar renders moments correctly
- Click handlers fire with correct moment data
- Delete with confirmation works
- Scrolling and selection states

### Integration Tests
- Clicking sidebar moment seeks video
- Deleting moment updates both sidebar and timeline
- Selected state synced across components
- Timeline and sidebar selections stay in sync

### E2E Tests
- Full workflow: detect moments → view in sidebar → select → delete
- Undo/redo if implemented
- Keyboard shortcuts for moment navigation

## Future Enhancements

1. **Grouping**: Group moments by type or time range
2. **Filtering**: Filter by confidence, type, or duration
3. **Sorting**: Sort by time, confidence, or custom order
4. **Keyboard Navigation**: Arrow keys to select moments, Delete to remove
5. **Bulk Operations**: Select multiple moments for bulk delete
6. **Export**: Export selected moments as timestamps or clips
7. **Search**: Search moment descriptions/reasons
8. **Moment Editing**: Edit moment name/description in sidebar

## Summary

**Layout**: Flex container with VideoPlayerWithTimeline (flex-1) + MomentsSidebar (fixed width)

**Props to MomentsSidebar**:
- `moments: TimelineMarker[]`
- `selectedMoment?: TimelineMarker | null`
- `onMomentClick: (moment) => handleMarkerClickWithSeek(moment)`
- `onMomentDelete: (id) => removeMarker(id)`

**Wire-up Locations**:
- Click handler → calls existing `handleMarkerClickWithSeek()` from VideoPlayerWithTimeline
- Delete handler → calls `removeMarker()` from useTimeline hook
- Both are already exposed, no new state management needed

**Key Insight**: Leverage existing `useTimeline` hook API - all needed functionality already exists!
