# MomentsSidebar Integration - Quick Reference Card

## Layout (Copy-Paste Ready)

```tsx
// Parent component
<div className="flex gap-4 w-full h-full bg-gray-900 p-4">
  <VideoPlayerWithTimeline
    url={videoUrl}
    engagingMoments={moments}
    showMomentsSidebar={false}
    onMomentSelect={setSelectedMoment}
    onRangeSelect={setSelectedRange}
    className="flex-1"
  />
  <MomentsSidebar
    moments={moments}
    selectedMoment={selectedMoment}
    onMomentClick={(m) => seekToMoment(m)}
    onMomentDelete={(id) => deleteMoment(id)}
    className="w-80 border-l border-gray-700"
  />
</div>
```

## Props Checklist

```tsx
// ✓ Required for MomentsSidebar
moments: TimelineMarker[]
onMomentClick: (moment: TimelineMarker) => void
onMomentDelete: (momentId: string) => void

// ✓ Optional but recommended
selectedMoment?: TimelineMarker | null
selectedRange?: TimeRange | null
className?: string
```

## Handler Implementation Pattern

```tsx
// In VideoPlayerWithTimeline

// 1. Extract from hook
const { markers, selectedMarker, removeMarker, handleMarkerClick } = useTimeline({...});

// 2. Wrap existing click handler
const onMomentClick = useCallback((marker: TimelineMarker) => {
  handleMarkerClickWithSeek(marker);  // Seek + select
}, [handleMarkerClickWithSeek]);

// 3. Create delete handler
const onMomentDelete = useCallback((momentId: string) => {
  removeMarker(momentId);
}, [removeMarker]);

// 4. Pass to component
<MomentsSidebar
  moments={markers}
  selectedMoment={selectedMarker}
  onMomentClick={onMomentClick}
  onMomentDelete={onMomentDelete}
/>
```

## MomentsSidebar Minimal Implementation

```tsx
export const MomentsSidebar = ({
  moments,
  selectedMoment,
  onMomentClick,
  onMomentDelete,
  className = '',
}: MomentsSidebarProps) => {
  return (
    <div className={`bg-gray-800 flex flex-col overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold">Moments ({moments.length})</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {moments.map(moment => (
          <div
            key={moment.id}
            onClick={() => onMomentClick(moment)}
            className={`p-3 rounded cursor-pointer ${
              selectedMoment?.id === moment.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            <p className="font-medium">{moment.label}</p>
            <p className="text-xs text-gray-400">
              {formatTime(moment.startTime)} - {formatTime(moment.endTime)}
            </p>
            {moment.description && (
              <p className="text-xs mt-1 line-clamp-2">{moment.description}</p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMomentDelete(moment.id);
              }}
              className="text-xs mt-2 px-2 py-1 hover:bg-red-500 rounded"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## State Flow One-Liner

```
Sidebar Click → handleMarkerClickWithSeek → videoRef.seek + useTimeline.select
                                                              ↓
                                                      markers prop updates
                                                              ↓
                                                  Both components re-render
```

## Data Source Mapping

| UI Component | Prop | Source |
|---|---|---|
| MomentsSidebar | moments | useTimeline.markers |
| MomentsSidebar | selectedMoment | useTimeline.selectedMarker |
| VideoTimeline | markers | useTimeline.markers |
| VideoTimeline | selectedRange | useTimeline.selectedRange |

## Handler Mapping

| Event | Handler | Source |
|---|---|---|
| Click moment | onMomentClick | handleMarkerClickWithSeek |
| Delete moment | onMomentDelete | handleMomentDelete |
| Seek video | handleSeek | videoRef.current.currentTime = time |

## Files

```
Frontend Structure:
components/
├── VideoPlayerWithTimeline.tsx ← Update
├── sidebar/
│   └── MomentsSidebar.tsx ← New
└── VideoEditorLayout.tsx ← New (optional)
```

## Checklist

- [ ] Create `sidebar/MomentsSidebar.tsx`
- [ ] Import MomentsSidebar in VideoPlayerWithTimeline
- [ ] Extract `selectedMarker` from useTimeline
- [ ] Extract `removeMarker` from useTimeline
- [ ] Create `handleMomentDelete` handler
- [ ] Render `<MomentsSidebar>` with props
- [ ] Test moment click seeks video
- [ ] Test moment delete removes from timeline
- [ ] Test selection stays in sync
- [ ] Style sidebar (dark theme)
- [ ] Add keyboard shortcuts (optional)
- [ ] Add scroll-into-view (optional)

## Common Issues & Fixes

### Sidebar not updating after delete
**Issue**: removeMarker called but sidebar unchanged
**Fix**: Ensure `moments` prop comes from `useTimeline.markers` (not local state)

### Click doesn't seek video
**Issue**: Moment click handler doesn't seek
**Fix**: Pass `handleMarkerClickWithSeek` not just `handleMarkerClick`
- `handleMarkerClickWithSeek` includes: `videoRef.current.currentTime = ...`

### Sidebar always shows all moments
**Issue**: Moments not removing after delete
**Fix**: Check `removeMarker` is being called from correct hook instance

### Selection not syncing
**Issue**: Timeline and sidebar show different selections
**Fix**: Both must read from `useTimeline.selectedMarker` (single source)

## Performance Tips

1. **Memoize handlers**: Use `useCallback` for `onMomentClick`, `onMomentDelete`
2. **Virtualize list**: Use react-window for 100+ moments
3. **Debounce hover**: Add hover effects with debounce
4. **Lazy description**: Load descriptions on demand
5. **Preload confidence**: Cache confidence scores

## Accessibility

```tsx
// Add to moment item
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onMomentClick(moment);
    }
  }}
  aria-selected={selectedMoment?.id === moment.id}
  aria-label={`${moment.label}, ${formatTime(moment.startTime)}`}
>
  {/* ... */}
</div>
```

## Testing Patterns

```tsx
// Test moment click
fireEvent.click(screen.getByText('Moment 1'));
expect(mockOnMomentClick).toHaveBeenCalledWith(moments[0]);

// Test delete
fireEvent.click(screen.getByLabelText('Delete moment'));
expect(mockOnMomentDelete).toHaveBeenCalledWith('moment-id-1');

// Test selection sync
expect(screen.getByText('Moment 1')).toHaveClass('bg-blue-600');
expect(screen.getByText('Moment 2')).toHaveClass('bg-gray-700');
```

## CSS Classes Reference

```
Sidebar Container: bg-gray-800 overflow-hidden flex flex-col
Header: p-4 border-b border-gray-700
List: flex-1 overflow-y-auto space-y-2 p-2
Moment Item: p-3 rounded cursor-pointer transition-colors
Active Item: bg-blue-600 text-white
Inactive Item: bg-gray-700 text-gray-200 hover:bg-gray-600
Delete Button: text-xs px-2 py-1 hover:bg-red-500 rounded
```

## Quick Debug

```tsx
// Log all moments
console.log('Moments:', moments);

// Log selected marker
console.log('Selected:', selectedMarker);

// Check if handlers are bound
console.log('onMomentClick:', onMomentClick);
console.log('onMomentDelete:', onMomentDelete);

// Verify video ref
console.log('Video element:', videoRef.current);
console.log('Video time:', videoRef.current?.currentTime);
```

## Next Steps After Integration

1. Add moment grouping (by type, time)
2. Add filtering (by confidence, type, duration)
3. Add keyboard shortcuts (→/← to navigate moments)
4. Add search (find moments by text)
5. Add export (save selected moments)
6. Add undo/redo for deletions
7. Add bulk operations (select multiple)
8. Add moment editing (rename, reorder)

---

**Everything you need is in the existing `useTimeline` hook!**
