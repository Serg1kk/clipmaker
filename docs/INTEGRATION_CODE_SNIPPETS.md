# MomentsSidebar Integration - Code Snippets

## Quick Reference

### 1. MomentsSidebar Props Interface

```typescript
// File: frontend/src/components/sidebar/MomentsSidebar.tsx

export interface MomentsSidebarProps {
  // Data from VideoPlayerWithTimeline
  moments: TimelineMarker[];
  selectedMoment?: TimelineMarker | null;
  selectedRange?: TimeRange | null;

  // Callbacks wired to VideoPlayerWithTimeline handlers
  onMomentClick: (moment: TimelineMarker) => void;
  onMomentDelete: (momentId: string) => void;

  // Optional
  showConfidence?: boolean;
  maxHeight?: string;
  className?: string;
}
```

### 2. VideoPlayerWithTimeline Integration

```typescript
// File: frontend/src/components/VideoPlayerWithTimeline.tsx

import MomentsSidebar from './sidebar/MomentsSidebar';

export interface VideoPlayerWithTimelineProps extends VideoPlayerProps {
  engagingMoments?: Array<{...}>;
  onRangeSelect?: (range: TimeRange | null) => void;
  onMomentSelect?: (marker: TimelineMarker | null) => void;
  showTimeline?: boolean;
  showMomentsSidebar?: boolean; // NEW
  className?: string;
}

const VideoPlayerWithTimeline = ({
  engagingMoments = [],
  onRangeSelect,
  onMomentSelect,
  showTimeline = true,
  showMomentsSidebar = false, // NEW
  className = '',
  ...playerProps
}: VideoPlayerWithTimelineProps) => {

  // Extract removeMarker from useTimeline hook
  const {
    markers,
    selectedRange,
    selectedMarker, // Also get selected marker!
    selectRange,
    handleMarkerClick,
    handleMarkerHover,
    loadEngagingMoments,
    removeMarker, // NEW - extract this
  } = useTimeline({
    onRangeChange: onRangeSelect,
    onMarkerSelect: onMomentSelect,
  });

  // Handler for sidebar moment deletion
  const handleMomentDelete = useCallback((momentId: string) => {
    removeMarker(momentId);
  }, [removeMarker]);

  return (
    <div ref={containerRef} className={`video-player-with-timeline ${className}`}>
      {/* Video Player */}
      <VideoPlayer {...playerProps} />

      {/* Timeline */}
      {showTimeline && isReady && (
        <div className="mt-4">
          <VideoTimeline {...timelineProps} />
        </div>
      )}

      {/* NEW: MomentsSidebar - rendered on demand */}
      {showMomentsSidebar && (
        <MomentsSidebar
          moments={markers}
          selectedMoment={selectedMarker}
          selectedRange={selectedRange}
          onMomentClick={handleMarkerClickWithSeek}  // Wire click to seek
          onMomentDelete={handleMomentDelete}         // Wire delete to removeMarker
          className="border-l border-gray-700 w-80"
        />
      )}
    </div>
  );
};
```

### 3. Parent Layout Component (Using Both)

```typescript
// File: frontend/src/components/VideoEditorLayout.tsx

import { useState } from 'react';
import VideoPlayerWithTimeline from './VideoPlayerWithTimeline';
import MomentsSidebar from './sidebar/MomentsSidebar';
import { TimelineMarker, TimeRange } from './timeline/types';

interface VideoEditorLayoutProps {
  videoUrl: string;
  engagingMoments: Array<{...}>;
  onMomentsChange?: (moments: TimelineMarker[]) => void;
}

export const VideoEditorLayout = ({
  videoUrl,
  engagingMoments,
  onMomentsChange,
}: VideoEditorLayoutProps) => {
  const [selectedMoment, setSelectedMoment] = useState<TimelineMarker | null>(null);
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null);

  return (
    <div className="flex gap-4 w-full h-screen bg-gray-900 p-4 rounded-lg">
      {/* Main video player area - takes available space */}
      <div className="flex-1 flex flex-col min-w-0">
        <VideoPlayerWithTimeline
          url={videoUrl}
          engagingMoments={engagingMoments}
          showTimeline={true}
          showMomentsSidebar={false} // Sidebar is external
          onMomentSelect={setSelectedMoment}
          onRangeSelect={setSelectedRange}
          className="flex-1"
        />
      </div>

      {/* Sidebar with moments list - fixed width */}
      <div className="w-80 border-l border-gray-700">
        <MomentsSidebar
          moments={engagingMoments}
          selectedMoment={selectedMoment}
          selectedRange={selectedRange}
          onMomentClick={(moment) => {
            setSelectedMoment(moment);
            // Click handler in VideoPlayerWithTimeline will handle seeking
          }}
          onMomentDelete={(momentId) => {
            // Call parent handler or state management
            onMomentsChange?.(
              engagingMoments.filter(m => m.id !== momentId)
            );
          }}
        />
      </div>
    </div>
  );
};
```

### 4. Basic MomentsSidebar Implementation

```typescript
// File: frontend/src/components/sidebar/MomentsSidebar.tsx

import { TimelineMarker } from '../timeline/types';
import { formatTime } from '../timeline/types';

export interface MomentsSidebarProps {
  moments: TimelineMarker[];
  selectedMoment?: TimelineMarker | null;
  onMomentClick: (moment: TimelineMarker) => void;
  onMomentDelete: (momentId: string) => void;
  className?: string;
}

const MomentsSidebar = ({
  moments,
  selectedMoment,
  onMomentClick,
  onMomentDelete,
  className = '',
}: MomentsSidebarProps) => {
  const handleDelete = (e: React.MouseEvent, momentId: string) => {
    e.stopPropagation();
    if (confirm('Delete this moment?')) {
      onMomentDelete(momentId);
    }
  };

  return (
    <div className={`bg-gray-800 overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">
          Moments ({moments.length})
        </h3>
      </div>

      {/* Scrollable moments list */}
      <div className="flex-1 overflow-y-auto">
        {moments.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            No moments detected
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {moments.map((moment) => (
              <div
                key={moment.id}
                onClick={() => onMomentClick(moment)}
                className={`
                  p-3 rounded cursor-pointer transition-colors
                  ${selectedMoment?.id === moment.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }
                `}
              >
                {/* Moment info */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{moment.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTime(moment.startTime)} - {formatTime(moment.endTime)}
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, moment.id)}
                    className="text-xs px-2 py-1 hover:bg-red-500 rounded"
                    title="Delete moment"
                  >
                    ×
                  </button>
                </div>

                {/* Description and confidence */}
                {moment.description && (
                  <p className="text-xs opacity-90 line-clamp-2">
                    {moment.description}
                  </p>
                )}
                {moment.confidence !== undefined && (
                  <div className="mt-1 text-xs opacity-75">
                    Confidence: {Math.round(moment.confidence * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MomentsSidebar;
```

## Integration Checklist

- [ ] Create `/frontend/src/components/sidebar/` directory
- [ ] Create `MomentsSidebar.tsx` component
- [ ] Update `VideoPlayerWithTimeline.tsx` props interface
- [ ] Export `removeMarker` from useTimeline hook (already done)
- [ ] Add `showMomentsSidebar` prop to VideoPlayerWithTimeline
- [ ] Create handler `handleMomentDelete`
- [ ] Pass props to MomentsSidebar component
- [ ] Test moment click seeks video
- [ ] Test moment delete removes from list
- [ ] Test selection sync between timeline and sidebar
- [ ] Add styling/CSS classes
- [ ] Update component exports

## Key Implementation Points

### 1. Click Handler Wiring
```typescript
// In VideoPlayerWithTimeline
onMomentClick={handleMarkerClickWithSeek}
//  ↓ calls
handleMarkerClickWithSeek = useCallback((marker: TimelineMarker) => {
  handleMarkerClick(marker);           // Updates timeline selection
  videoRef.current.currentTime = ...;  // Seeks video
}, [handleMarkerClick]);
```

### 2. Delete Handler Wiring
```typescript
// In VideoPlayerWithTimeline
onMomentDelete={handleMomentDelete}
// ↓ calls
handleMomentDelete = useCallback((momentId: string) => {
  removeMarker(momentId);  // From useTimeline hook
}, [removeMarker]);
```

### 3. Selection State Sync
```typescript
// Both components share same state through props:
- moments={markers}              // From useTimeline
- selectedMoment={selectedMarker} // From useTimeline
- selectedRange={selectedRange}   // From useTimeline

// When either component updates, parent handles sync
onMomentSelect={(marker) => {
  // Updates parent state passed back to both components
}}
```

## No Additional State Management Needed!

All functionality already exists in `useTimeline` hook:
- ✓ `markers` - list of moments
- ✓ `selectedMarker` - selected moment
- ✓ `selectedRange` - selected time range
- ✓ `removeMarker(id)` - delete moment
- ✓ `handleMarkerClick(marker)` - select moment
- ✓ `handleMarkerHover(marker)` - hover moment

Just pass these to MomentsSidebar and wire the callbacks!
