# MomentsSidebar Integration - Architecture Diagram

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     VideoEditorLayout (NEW)                     │
│                    (flex container, gap-4)                       │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│  VideoPlayerWithTimeline        │  MomentsSidebar (NEW)         │
│  (flex-1)                       │  (w-80, scrollable)           │
│                                 │                               │
│  ┌──────────────────────────┐   │  ┌─────────────────────────┐  │
│  │   VideoPlayer            │   │  │  Moments Header         │  │
│  │   (wraps <video>)        │   │  │  Shows: Moments (N)     │  │
│  └──────────────────────────┘   │  └─────────────────────────┘  │
│                                 │                               │
│  ┌──────────────────────────┐   │  ┌─────────────────────────┐  │
│  │   VideoTimeline          │   │  │  Scrollable List        │  │
│  │   - Shows markers        │   │  │  of Moments             │  │
│  │   - Drag to select range │   │  │                         │  │
│  │   - Hover preview        │   │  │  [Moment Item]          │  │
│  └──────────────────────────┘   │  │  [Moment Item]          │  │
│                                 │  │  [Moment Item] ←active  │  │
│  useTimeline Hook               │  │  [Moment Item]          │  │
│  - markers[]                    │  │                         │  │
│  - selectedMarker               │  │  Each Item:             │  │
│  - selectedRange                │  │  - Click: seek video    │  │
│  - removeMarker()               │  │  - Delete: remove       │  │
│  - handleMarkerClick()          │  │  - Shows: time,         │  │
│  - handleMarkerHover()          │  │    description, conf    │  │
│  - selectRange()                │  └─────────────────────────┘  │
│                                 │                               │
│ videoRef → <video> element      │                               │
│ handleSeek() → seek video       │                               │
│ handleMarkerClickWithSeek()     │                               │
│                                 │                               │
└─────────────────────────────────┴───────────────────────────────┘
```

## Data Flow Diagram

### Moment Click Flow

```
User clicks moment in sidebar
    ↓
MomentsSidebar.onMomentClick(moment)
    ↓
VideoPlayerWithTimeline.handleMarkerClickWithSeek(moment)
    ├── handleMarkerClick(marker)
    │   └── useTimeline.handleMarkerClick(marker)
    │       ├── setSelectedMarker(marker)
    │       ├── selectRange({ start, end })
    │       └── onMarkerSelect callback
    │
    └── videoRef.current.currentTime = marker.startTime
        └── setCurrentTime(marker.startTime)

Result:
  ✓ Video seeks to marker start time
  ✓ Timeline marker highlighted
  ✓ Timeline range selected (marker.start → marker.end)
  ✓ Sidebar item highlighted (via selectedMoment prop)
```

### Moment Delete Flow

```
User clicks delete button on sidebar moment
    ↓
MomentsSidebar.onMomentDelete(momentId)
    ↓
VideoPlayerWithTimeline.handleMomentDelete(momentId)
    ↓
useTimeline.removeMarker(momentId)
    ├── setMarkersState(prev => prev.filter(m => m.id !== id))
    └── if (selectedMarker?.id === id) {
          setSelectedMarker(null)
          onMarkerSelect(null)
        }

Result:
  ✓ Moment removed from markers array
  ✓ Moment removed from sidebar list
  ✓ Moment removed from timeline
  ✓ Selection cleared if deleted moment was selected
```

### Timeline Marker Click Flow

```
User clicks marker on timeline
    ↓
VideoTimeline.handleMarkerClick(marker)
    ↓
VideoPlayerWithTimeline.handleMarkerClickWithSeek(marker)
    ├── handleMarkerClick(marker)
    │   └── useTimeline.handleMarkerClick(marker)
    │       └── Updates: selectedMarker, selectedRange
    │
    └── videoRef.current.currentTime = marker.startTime

Result:
  ✓ Video seeks to marker start
  ✓ VideoPlayerWithTimeline.selectedMarker updated
  ✓ Sidebar auto-highlights (via selectedMoment prop)
```

## Props Flow Tree

```
VideoEditorLayout
├── moments: TimelineMarker[]
├── selectedMoment: TimelineMarker | null
├── selectedRange: TimeRange | null
│
├─→ VideoPlayerWithTimeline
│   ├─ engagingMoments (→ useTimeline.loadEngagingMoments)
│   ├─ showMomentsSidebar: boolean
│   ├─ onMomentSelect (callback)
│   ├─ onRangeSelect (callback)
│   │
│   └─ Internal useTimeline hook provides:
│       ├─ markers → passed to VideoTimeline + MomentsSidebar
│       ├─ selectedMarker → passed to MomentsSidebar
│       ├─ selectedRange → passed to VideoTimeline + MomentsSidebar
│       ├─ removeMarker → used by handleMomentDelete
│       └─ handleMarkerClick → used by handleMarkerClickWithSeek
│
│
└─→ MomentsSidebar
    ├─ moments (from VideoPlayerWithTimeline.markers)
    ├─ selectedMoment (from VideoPlayerWithTimeline.selectedMarker)
    ├─ selectedRange (optional, from VideoPlayerWithTimeline.selectedRange)
    ├─ onMomentClick ← handleMarkerClickWithSeek
    └─ onMomentDelete ← handleMomentDelete
```

## State Management Architecture

```
Single Source of Truth: useTimeline Hook
├─ State:
│  ├─ markers: TimelineMarker[]
│  ├─ selectedMarker: TimelineMarker | null
│  ├─ selectedRange: TimeRange | null
│  └─ hoveredMarker: TimelineMarker | null
│
├─ Updaters:
│  ├─ removeMarker(id)
│  ├─ handleMarkerClick(marker)
│  ├─ selectRange(range)
│  ├─ handleMarkerHover(marker)
│  └─ loadEngagingMoments(moments)
│
└─ Consumers:
   ├─ VideoTimeline (reads: markers, selectedRange)
   ├─ MomentsSidebar (reads: moments, selectedMarker)
   └─ Parent callbacks (reads: selectedMarker, selectedRange)

Key Point: No duplicate state! All derived from useTimeline hook.
```

## Handler Chain Architecture

```
Component Method Chain:

VideoPlayerWithTimeline.handleMarkerClickWithSeek(marker)
  │
  ├─→ useTimeline.handleMarkerClick(marker)
  │    └─ Updates: selectedMarker, selectedRange
  │    └─ Calls: onMarkerSelect callback
  │
  └─→ videoRef.current.currentTime = marker.startTime
      └─ Triggers: video 'timeupdate' event
         └─ Updates: currentTime state
            └─ VideoTimeline gets updated currentTime prop


VideoPlayerWithTimeline.handleMomentDelete(momentId)
  │
  └─→ useTimeline.removeMarker(momentId)
       ├─ Updates: markers array
       ├─ Clears: selectedMarker (if deleted)
       └─ Calls: onMarkerSelect(null) if needed


VideoPlayerWithTimeline.handleSeek(time)
  │
  └─→ videoRef.current.currentTime = time
       └─ Triggers: video 'timeupdate' event
```

## Callback Wiring Diagram

```
MomentsSidebar Props:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  onMomentClick: (moment) => void                             │
│     │                                                        │
│     └─→ Wired to:                                            │
│         VideoPlayerWithTimeline.handleMarkerClickWithSeek    │
│         ├─ Calls: useTimeline.handleMarkerClick()           │
│         └─ Seeks: videoRef.current.currentTime = start      │
│                                                              │
│  onMomentDelete: (momentId) => void                          │
│     │                                                        │
│     └─→ Wired to:                                            │
│         VideoPlayerWithTimeline.handleMomentDelete()         │
│         └─ Calls: useTimeline.removeMarker(momentId)        │
│                                                              │
│  moments: TimelineMarker[]                                   │
│     │                                                        │
│     └─→ Source:                                              │
│         useTimeline.markers                                  │
│                                                              │
│  selectedMoment: TimelineMarker | null                       │
│     │                                                        │
│     └─→ Source:                                              │
│         useTimeline.selectedMarker                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Layout Grid System

```
┌─────────────────────────────────────────────────────────────────┐
│ VideoEditorLayout                                               │
│ className="flex gap-4"                                          │
├─────────────────────────────┬───────────────────────────────────┤
│                             │                                   │
│  flex-1                     │  w-80                             │
│  (responsive width)         │  (fixed 320px)                    │
│                             │                                   │
│  min-w-0                    │  border-l border-gray-700         │
│  (prevent overflow)         │  overflow-y-auto                  │
│                             │  bg-gray-800                      │
│  VideoPlayerWithTimeline    │                                   │
│  └─ VideoPlayer             │  MomentsSidebar                   │
│  └─ VideoTimeline           │  └─ Header (p-4)                 │
│                             │  └─ List (flex-1, overflow)      │
│                             │     └─ Moment Items              │
│                             │                                   │
│                             │  Scrolling:                       │
│                             │  └─ flex flex-col                │
│                             │  └─ max-height: 100vh            │
│                             │  └─ overflow-y-auto              │
│                             │                                   │
└─────────────────────────────┴───────────────────────────────────┘
```

## Timeline Sync Architecture

```
When ANY update happens to markers or selection:

1. useTimeline state changes
   ├─ markers[]
   ├─ selectedMarker
   └─ selectedRange

2. VideoPlayerWithTimeline re-renders
   ├─ Passes markers to: VideoTimeline
   ├─ Passes selectedMarker to: MomentsSidebar
   ├─ Passes selectedRange to: VideoTimeline + MomentsSidebar
   └─ currentTime passed to: VideoTimeline (from video element)

3. Both components update visual feedback:
   ├─ VideoTimeline:
   │  ├─ Highlights active marker
   │  ├─ Shows selected range
   │  └─ Moves playhead
   │
   └─ MomentsSidebar:
      ├─ Highlights selected moment
      ├─ Scrolls into view (optional)
      └─ Updates selection background

Result: Single click → both components update instantly
```

## File Structure

```
frontend/src/
├─ components/
│  ├─ VideoPlayer.tsx
│  ├─ VideoPlayerWithTimeline.tsx ← Updated with sidebar support
│  ├─ VideoEditorLayout.tsx ← NEW: Parent container
│  ├─ timeline/
│  │  ├─ VideoTimeline.tsx
│  │  ├─ types.ts
│  │  └─ __tests__/
│  │
│  └─ sidebar/ ← NEW DIRECTORY
│     ├─ MomentsSidebar.tsx ← NEW: Sidebar component
│     ├─ types.ts (optional)
│     └─ __tests__/ (optional)
│
├─ hooks/
│  ├─ useTimeline.ts
│  └─ __tests__/
│
└─ pages/
   └─ ...
```

## Key Integration Points Summary

| Point | Location | Action |
|-------|----------|--------|
| Extract removeMarker | `VideoPlayerWithTimeline.tsx` | Line 66-76 (useTimeline return) |
| Create delete handler | `VideoPlayerWithTimeline.tsx` | New: `handleMomentDelete()` |
| Wire handlers | `VideoPlayerWithTimeline.tsx` | Pass to `<MomentsSidebar>` props |
| Create MomentsSidebar | `sidebar/MomentsSidebar.tsx` | New file |
| Create layout | `VideoEditorLayout.tsx` | New file |
| Export new component | `App.tsx` or index | Update imports |

All integration is additive - no breaking changes to existing components!
