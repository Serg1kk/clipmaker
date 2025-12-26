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
  disabled = false
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

  // Handle drag events
  const handleDrag = useCallback(
    (_e: DraggableEvent, data: DraggableData) => {
      if (disabled || resizeState.isResizing) return;

      const newCoords: CropCoordinates = {
        ...coordinates,
        x: data.x,
        y: data.y
      };
      onChange(newCoords);
    },
    [coordinates, onChange, disabled, resizeState.isResizing]
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

      // Apply resize based on handle position
      switch (handle) {
        case 'top-left':
          newX = Math.max(0, Math.min(startCoords.x + deltaX, startCoords.x + startCoords.width - minWidth));
          newY = Math.max(0, Math.min(startCoords.y + deltaY, startCoords.y + startCoords.height - minHeight));
          newWidth = startCoords.width - (newX - startCoords.x);
          newHeight = startCoords.height - (newY - startCoords.y);
          break;
        case 'top-right':
          newY = Math.max(0, Math.min(startCoords.y + deltaY, startCoords.y + startCoords.height - minHeight));
          newWidth = Math.max(minWidth, Math.min(startCoords.width + deltaX, containerBounds.width - startCoords.x));
          newHeight = startCoords.height - (newY - startCoords.y);
          break;
        case 'bottom-left':
          newX = Math.max(0, Math.min(startCoords.x + deltaX, startCoords.x + startCoords.width - minWidth));
          newWidth = startCoords.width - (newX - startCoords.x);
          newHeight = Math.max(minHeight, Math.min(startCoords.height + deltaY, containerBounds.height - startCoords.y));
          break;
        case 'bottom-right':
          newWidth = Math.max(minWidth, Math.min(startCoords.width + deltaX, containerBounds.width - startCoords.x));
          newHeight = Math.max(minHeight, Math.min(startCoords.height + deltaY, containerBounds.height - startCoords.y));
          break;
        case 'top':
          newY = Math.max(0, Math.min(startCoords.y + deltaY, startCoords.y + startCoords.height - minHeight));
          newHeight = startCoords.height - (newY - startCoords.y);
          break;
        case 'right':
          newWidth = Math.max(minWidth, Math.min(startCoords.width + deltaX, containerBounds.width - startCoords.x));
          break;
        case 'bottom':
          newHeight = Math.max(minHeight, Math.min(startCoords.height + deltaY, containerBounds.height - startCoords.y));
          break;
        case 'left':
          newX = Math.max(0, Math.min(startCoords.x + deltaX, startCoords.x + startCoords.width - minWidth));
          newWidth = startCoords.width - (newX - startCoords.x);
          break;
      }

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
  }, [resizeState, minWidth, minHeight, containerBounds, onChange, id]);

  // Calculate bounds for draggable
  const bounds = {
    left: 0,
    top: 0,
    right: containerBounds.width - coordinates.width,
    bottom: containerBounds.height - coordinates.height
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
        {/* Label */}
        {label && (
          <div
            className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white ${colorTheme.handle} rounded`}
            data-testid={`crop-label-${id}`}
          >
            {label}
          </div>
        )}

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
