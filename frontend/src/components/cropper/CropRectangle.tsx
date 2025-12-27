import { useRef, useState, useCallback, useEffect } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import {
  CropRectangleProps,
  CropCoordinates,
  ResizeHandle,
  ResizeState,
  RECTANGLE_COLORS
} from './types';

/**
 * Resize handle component for rectangle corners and edges
 */
const ResizeHandleElement = ({
  position,
  onMouseDown,
  color
}: {
  position: ResizeHandle;
  onMouseDown: (e: React.MouseEvent, handle: ResizeHandle) => void;
  color: string;
}) => {
  const positionClasses: Record<ResizeHandle, string> = {
    'top-left': '-top-1.5 -left-1.5 cursor-nwse-resize',
    'top-right': '-top-1.5 -right-1.5 cursor-nesw-resize',
    'bottom-left': '-bottom-1.5 -left-1.5 cursor-nesw-resize',
    'bottom-right': '-bottom-1.5 -right-1.5 cursor-nwse-resize',
    'top': '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
    'right': 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize',
    'bottom': '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
    'left': 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize'
  };

  return (
    <div
      className={`absolute w-3 h-3 ${color} rounded-sm ${positionClasses[position]} hover:scale-125 transition-transform`}
      onMouseDown={(e) => onMouseDown(e, position)}
      data-testid={`resize-handle-${position}`}
    />
  );
};

/**
 * CropRectangle component - Draggable and resizable crop area
 *
 * Features:
 * - Drag to reposition within container bounds
 * - Resize via corner and edge handles
 * - Visual feedback for selected state
 * - Coordinate constraints (min width/height, container bounds)
 * - Aspect ratio locking for constrained resize
 * - Aspect ratio badge display
 * - Accessible with keyboard navigation
 */
const CropRectangle = ({
  id,
  coordinates,
  containerBounds,
  isSelected,
  onSelect,
  onChange,
  label,
  minWidth = 50,
  minHeight = 50,
  color = 'blue',
  disabled = false,
  aspectRatio,
  sourceAspectRatio = 16 / 9,
  aspectRatioBadge
}: CropRectangleProps) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    startCoords: coordinates
  });

  const colorTheme = RECTANGLE_COLORS[color];

  // Get offset values (for letterboxed video scenarios)
  const offsetX = containerBounds.offsetX ?? 0;
  const offsetY = containerBounds.offsetY ?? 0;

  // Handle drag events - constrain within container bounds (accounting for offset)
  const handleDrag = useCallback(
    (_e: DraggableEvent, data: DraggableData) => {
      if (disabled || resizeState.isResizing) return;

      // Constrain position to keep rectangle fully inside video bounds
      // Video bounds start at (offsetX, offsetY) and extend for (width, height)
      const minX = offsetX;
      const minY = offsetY;
      const maxX = offsetX + containerBounds.width - coordinates.width;
      const maxY = offsetY + containerBounds.height - coordinates.height;

      const constrainedX = Math.max(minX, Math.min(data.x, maxX));
      const constrainedY = Math.max(minY, Math.min(data.y, maxY));

      const newCoords: CropCoordinates = {
        ...coordinates,
        x: constrainedX,
        y: constrainedY
      };
      onChange(newCoords);
    },
    [coordinates, containerBounds, offsetX, offsetY, onChange, disabled, resizeState.isResizing]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();

      setResizeState({
        isResizing: true,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCoords: { ...coordinates }
      });
      onSelect(id);
    },
    [coordinates, disabled, id, onSelect]
  );

  /**
   * Calculate height from width while maintaining aspect ratio.
   * Accounts for source video aspect ratio when calculating pixel dimensions.
   */
  const calculateHeightFromWidth = (width: number, targetAspectRatio: number): number => {
    // For a crop area: actual aspect = (width / containerWidth) / (height / containerHeight) * sourceAspectRatio
    // We want: targetAspectRatio = (normalizedWidth / normalizedHeight) * sourceAspectRatio
    // So: normalizedHeight = normalizedWidth * sourceAspectRatio / targetAspectRatio
    // In pixels: height = (width / containerBounds.width) * sourceAspectRatio / targetAspectRatio * containerBounds.height
    return (width / containerBounds.width) * sourceAspectRatio / targetAspectRatio * containerBounds.height;
  };

  /**
   * Calculate width from height while maintaining aspect ratio.
   */
  const calculateWidthFromHeight = (height: number, targetAspectRatio: number): number => {
    // Inverse of the above
    return (height / containerBounds.height) * targetAspectRatio / sourceAspectRatio * containerBounds.width;
  };

  // Handle resize move
  useEffect(() => {
    if (!resizeState.isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      const { startCoords, handle } = resizeState;

      let newX = startCoords.x;
      let newY = startCoords.y;
      let newWidth = startCoords.width;
      let newHeight = startCoords.height;

      // Determine if this is a corner or edge handle
      const isCorner = handle?.includes('-');
      const isHorizontalEdge = handle === 'left' || handle === 'right';
      const isVerticalEdge = handle === 'top' || handle === 'bottom';

      if (aspectRatio) {
        // ASPECT-RATIO-LOCKED RESIZE
        if (isCorner) {
          // For corners, use the larger delta to determine resize
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);

          // Prefer horizontal resize for better UX
          const useWidthDelta = absDeltaX >= absDeltaY;

          if (useWidthDelta) {
            // Calculate new dimensions from width change
            switch (handle) {
              case 'top-left':
                newWidth = Math.max(minWidth, startCoords.width - deltaX);
                newHeight = calculateHeightFromWidth(newWidth, aspectRatio);
                newX = startCoords.x + startCoords.width - newWidth;
                newY = startCoords.y + startCoords.height - newHeight;
                break;
              case 'top-right':
                newWidth = Math.max(minWidth, startCoords.width + deltaX);
                newHeight = calculateHeightFromWidth(newWidth, aspectRatio);
                newY = startCoords.y + startCoords.height - newHeight;
                break;
              case 'bottom-left':
                newWidth = Math.max(minWidth, startCoords.width - deltaX);
                newHeight = calculateHeightFromWidth(newWidth, aspectRatio);
                newX = startCoords.x + startCoords.width - newWidth;
                break;
              case 'bottom-right':
                newWidth = Math.max(minWidth, startCoords.width + deltaX);
                newHeight = calculateHeightFromWidth(newWidth, aspectRatio);
                break;
            }
          } else {
            // Calculate new dimensions from height change
            switch (handle) {
              case 'top-left':
                newHeight = Math.max(minHeight, startCoords.height - deltaY);
                newWidth = calculateWidthFromHeight(newHeight, aspectRatio);
                newX = startCoords.x + startCoords.width - newWidth;
                newY = startCoords.y + startCoords.height - newHeight;
                break;
              case 'top-right':
                newHeight = Math.max(minHeight, startCoords.height - deltaY);
                newWidth = calculateWidthFromHeight(newHeight, aspectRatio);
                newY = startCoords.y + startCoords.height - newHeight;
                break;
              case 'bottom-left':
                newHeight = Math.max(minHeight, startCoords.height + deltaY);
                newWidth = calculateWidthFromHeight(newHeight, aspectRatio);
                newX = startCoords.x + startCoords.width - newWidth;
                break;
              case 'bottom-right':
                newHeight = Math.max(minHeight, startCoords.height + deltaY);
                newWidth = calculateWidthFromHeight(newHeight, aspectRatio);
                break;
            }
          }
        } else if (isHorizontalEdge) {
          // For left/right edges, resize width and calculate height proportionally
          if (handle === 'left') {
            newWidth = Math.max(minWidth, startCoords.width - deltaX);
            newHeight = calculateHeightFromWidth(newWidth, aspectRatio);
            newX = startCoords.x + startCoords.width - newWidth;
            // Keep vertically centered relative to original center
            const centerY = startCoords.y + startCoords.height / 2;
            newY = centerY - newHeight / 2;
          } else {
            newWidth = Math.max(minWidth, startCoords.width + deltaX);
            newHeight = calculateHeightFromWidth(newWidth, aspectRatio);
            // Keep vertically centered relative to original center
            const centerY = startCoords.y + startCoords.height / 2;
            newY = centerY - newHeight / 2;
          }
        } else if (isVerticalEdge) {
          // For top/bottom edges, resize height and calculate width proportionally
          if (handle === 'top') {
            newHeight = Math.max(minHeight, startCoords.height - deltaY);
            newWidth = calculateWidthFromHeight(newHeight, aspectRatio);
            newY = startCoords.y + startCoords.height - newHeight;
            // Keep horizontally centered relative to original center
            const centerX = startCoords.x + startCoords.width / 2;
            newX = centerX - newWidth / 2;
          } else {
            newHeight = Math.max(minHeight, startCoords.height + deltaY);
            newWidth = calculateWidthFromHeight(newHeight, aspectRatio);
            // Keep horizontally centered relative to original center
            const centerX = startCoords.x + startCoords.width / 2;
            newX = centerX - newWidth / 2;
          }
        }
      } else {
        // FREE-FORM RESIZE (with offset bounds support)
        const resizeOffsetX = containerBounds.offsetX ?? 0;
        const resizeOffsetY = containerBounds.offsetY ?? 0;
        const maxResizeX = resizeOffsetX + containerBounds.width;
        const maxResizeY = resizeOffsetY + containerBounds.height;

        switch (handle) {
          case 'top-left':
            newX = Math.max(resizeOffsetX, Math.min(startCoords.x + deltaX, startCoords.x + startCoords.width - minWidth));
            newY = Math.max(resizeOffsetY, Math.min(startCoords.y + deltaY, startCoords.y + startCoords.height - minHeight));
            newWidth = startCoords.width - (newX - startCoords.x);
            newHeight = startCoords.height - (newY - startCoords.y);
            break;
          case 'top-right':
            newY = Math.max(resizeOffsetY, Math.min(startCoords.y + deltaY, startCoords.y + startCoords.height - minHeight));
            newWidth = Math.max(minWidth, Math.min(startCoords.width + deltaX, maxResizeX - startCoords.x));
            newHeight = startCoords.height - (newY - startCoords.y);
            break;
          case 'bottom-left':
            newX = Math.max(resizeOffsetX, Math.min(startCoords.x + deltaX, startCoords.x + startCoords.width - minWidth));
            newWidth = startCoords.width - (newX - startCoords.x);
            newHeight = Math.max(minHeight, Math.min(startCoords.height + deltaY, maxResizeY - startCoords.y));
            break;
          case 'bottom-right':
            newWidth = Math.max(minWidth, Math.min(startCoords.width + deltaX, maxResizeX - startCoords.x));
            newHeight = Math.max(minHeight, Math.min(startCoords.height + deltaY, maxResizeY - startCoords.y));
            break;
          case 'top':
            newY = Math.max(resizeOffsetY, Math.min(startCoords.y + deltaY, startCoords.y + startCoords.height - minHeight));
            newHeight = startCoords.height - (newY - startCoords.y);
            break;
          case 'right':
            newWidth = Math.max(minWidth, Math.min(startCoords.width + deltaX, maxResizeX - startCoords.x));
            break;
          case 'bottom':
            newHeight = Math.max(minHeight, Math.min(startCoords.height + deltaY, maxResizeY - startCoords.y));
            break;
          case 'left':
            newX = Math.max(resizeOffsetX, Math.min(startCoords.x + deltaX, startCoords.x + startCoords.width - minWidth));
            newWidth = startCoords.width - (newX - startCoords.x);
            break;
        }
      }

      // Apply container bounds constraints (accounting for offset)
      const boundsOffsetX = containerBounds.offsetX ?? 0;
      const boundsOffsetY = containerBounds.offsetY ?? 0;
      const maxBoundsX = boundsOffsetX + containerBounds.width;
      const maxBoundsY = boundsOffsetY + containerBounds.height;

      newX = Math.max(boundsOffsetX, Math.min(newX, maxBoundsX - newWidth));
      newY = Math.max(boundsOffsetY, Math.min(newY, maxBoundsY - newHeight));
      newWidth = Math.min(newWidth, maxBoundsX - newX);
      newHeight = Math.min(newHeight, maxBoundsY - newY);

      onChange({
        id,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });
    };

    const handleMouseUp = () => {
      setResizeState((prev) => ({ ...prev, isResizing: false, handle: null }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, minWidth, minHeight, containerBounds, onChange, id, aspectRatio, sourceAspectRatio]);

  // Calculate bounds for draggable (accounting for video offset in letterboxed scenarios)
  const bounds = {
    left: offsetX,
    top: offsetY,
    right: offsetX + containerBounds.width - coordinates.width,
    bottom: offsetY + containerBounds.height - coordinates.height
  };

  const resizeHandles: ResizeHandle[] = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'top',
    'right',
    'bottom',
    'left'
  ];

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x: coordinates.x, y: coordinates.y }}
      bounds={bounds}
      onDrag={handleDrag}
      onStart={() => onSelect(id)}
      disabled={disabled || resizeState.isResizing}
    >
      <div
        ref={nodeRef}
        className={`
          absolute border-2 ${colorTheme.border} ${colorTheme.bg}
          ${isSelected ? 'ring-2 ring-white/50' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-move'}
          transition-shadow
        `}
        style={{
          width: coordinates.width,
          height: coordinates.height
        }}
        onClick={() => onSelect(id)}
        role="button"
        tabIndex={0}
        aria-label={`Crop rectangle ${label || id}`}
        aria-selected={isSelected}
        data-testid={`crop-rectangle-${id}`}
      >
        {/* Label and Aspect Ratio Badge */}
        <div className="absolute -top-6 left-0 right-0 flex items-center justify-between pointer-events-none">
          {label && (
            <div
              className={`px-2 py-0.5 text-xs font-medium text-white ${colorTheme.handle} rounded`}
              data-testid={`crop-label-${id}`}
            >
              {label}
            </div>
          )}
          {aspectRatioBadge && (
            <div
              className="px-2 py-0.5 text-xs font-medium text-white bg-gray-800/90 rounded ml-auto"
              data-testid={`aspect-ratio-badge-${id}`}
            >
              {aspectRatioBadge}
            </div>
          )}
        </div>

        {/* Resize handles - only show when selected */}
        {isSelected && !disabled && (
          <>
            {resizeHandles.map((handle) => (
              <ResizeHandleElement
                key={handle}
                position={handle}
                onMouseDown={handleResizeStart}
                color={colorTheme.handle}
              />
            ))}
          </>
        )}

        {/* Center crosshair for alignment */}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-4 h-px bg-white/50" />
            <div className="absolute w-px h-4 bg-white/50" />
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default CropRectangle;
