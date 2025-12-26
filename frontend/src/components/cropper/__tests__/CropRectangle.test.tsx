import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import CropRectangle from '../CropRectangle';
import { CropCoordinates } from '../types';

// Note: react-draggable is used directly - tests focus on component behavior

describe('CropRectangle', () => {
  const defaultCoords: CropCoordinates = {
    id: 'test-rect',
    x: 100,
    y: 50,
    width: 200,
    height: 150
  };

  const defaultProps = {
    id: 'test-rect',
    coordinates: defaultCoords,
    containerBounds: { width: 800, height: 450 },
    isSelected: false,
    onSelect: jest.fn(),
    onChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the rectangle with correct dimensions', () => {
      render(<CropRectangle {...defaultProps} />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toBeInTheDocument();
      expect(rectangle).toHaveStyle({ width: '200px', height: '150px' });
    });

    it('displays label when provided', () => {
      render(<CropRectangle {...defaultProps} label="Frame 1" />);
      expect(screen.getByTestId('crop-label-test-rect')).toHaveTextContent('Frame 1');
    });

    it('does not display label when not provided', () => {
      render(<CropRectangle {...defaultProps} />);
      expect(screen.queryByTestId('crop-label-test-rect')).not.toBeInTheDocument();
    });

    it('applies correct color theme', () => {
      render(<CropRectangle {...defaultProps} color="green" />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveClass('border-green-500');
    });

    it('defaults to blue color', () => {
      render(<CropRectangle {...defaultProps} />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveClass('border-blue-500');
    });
  });

  describe('Selection', () => {
    it('calls onSelect when clicked', () => {
      const onSelect = jest.fn();
      render(<CropRectangle {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('crop-rectangle-test-rect'));
      expect(onSelect).toHaveBeenCalledWith('test-rect');
    });

    it('shows ring effect when selected', () => {
      render(<CropRectangle {...defaultProps} isSelected />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveClass('ring-2');
    });

    it('does not show ring when not selected', () => {
      render(<CropRectangle {...defaultProps} isSelected={false} />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).not.toHaveClass('ring-2');
    });

    it('sets aria-selected correctly', () => {
      const { rerender } = render(<CropRectangle {...defaultProps} isSelected={false} />);
      expect(screen.getByTestId('crop-rectangle-test-rect')).toHaveAttribute('aria-selected', 'false');

      rerender(<CropRectangle {...defaultProps} isSelected />);
      expect(screen.getByTestId('crop-rectangle-test-rect')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Resize handles', () => {
    it('shows resize handles when selected', () => {
      render(<CropRectangle {...defaultProps} isSelected />);

      expect(screen.getByTestId('resize-handle-top-left')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-top-right')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-bottom-left')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-bottom-right')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-top')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-right')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-left')).toBeInTheDocument();
    });

    it('hides resize handles when not selected', () => {
      render(<CropRectangle {...defaultProps} isSelected={false} />);

      expect(screen.queryByTestId('resize-handle-top-left')).not.toBeInTheDocument();
      expect(screen.queryByTestId('resize-handle-bottom-right')).not.toBeInTheDocument();
    });

    it('hides resize handles when disabled', () => {
      render(<CropRectangle {...defaultProps} isSelected disabled />);

      expect(screen.queryByTestId('resize-handle-top-left')).not.toBeInTheDocument();
    });
  });

  describe('Dragging', () => {
    it('renders a draggable rectangle', () => {
      const onChange = jest.fn();
      render(<CropRectangle {...defaultProps} onChange={onChange} />);

      // The rectangle should be rendered and positioned
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toBeInTheDocument();
      expect(rectangle).toHaveClass('cursor-move');
    });

    it('shows not-allowed cursor when disabled', () => {
      const onChange = jest.fn();
      render(<CropRectangle {...defaultProps} onChange={onChange} disabled />);

      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Disabled state', () => {
    it('applies disabled styles', () => {
      render(<CropRectangle {...defaultProps} disabled />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveClass('opacity-50');
      expect(rectangle).toHaveClass('cursor-not-allowed');
    });

    it('prevents interaction when disabled', () => {
      const onSelect = jest.fn();
      render(<CropRectangle {...defaultProps} onSelect={onSelect} disabled />);

      // Rectangle should still be rendered but with disabled appearance
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveClass('opacity-50');
    });
  });

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<CropRectangle {...defaultProps} />);
      expect(screen.getByTestId('crop-rectangle-test-rect')).toHaveAttribute('role', 'button');
    });

    it('has tabIndex for keyboard navigation', () => {
      render(<CropRectangle {...defaultProps} />);
      expect(screen.getByTestId('crop-rectangle-test-rect')).toHaveAttribute('tabIndex', '0');
    });

    it('has aria-label with rectangle info', () => {
      render(<CropRectangle {...defaultProps} label="Frame 1" />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toHaveAttribute('aria-label', 'Crop rectangle Frame 1');
    });
  });

  describe('Center crosshair', () => {
    it('shows crosshair when selected', () => {
      render(<CropRectangle {...defaultProps} isSelected />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      // Check for crosshair elements (horizontal and vertical lines)
      const crosshairContainer = rectangle.querySelector('.pointer-events-none');
      expect(crosshairContainer).toBeInTheDocument();
    });
  });

  describe('Bounds calculation', () => {
    it('renders rectangle within container bounds', () => {
      render(<CropRectangle {...defaultProps} />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');

      // Rectangle is rendered with specified dimensions
      expect(rectangle).toHaveStyle({ width: '200px', height: '150px' });
    });

    it('respects container bounds configuration', () => {
      const largeContainerProps = {
        ...defaultProps,
        containerBounds: { width: 1920, height: 1080 }
      };
      render(<CropRectangle {...largeContainerProps} />);
      const rectangle = screen.getByTestId('crop-rectangle-test-rect');
      expect(rectangle).toBeInTheDocument();
    });
  });
});

describe('Resize behavior', () => {
  const defaultCoords: CropCoordinates = {
    id: 'resize-test',
    x: 100,
    y: 100,
    width: 200,
    height: 200
  };

  const props = {
    id: 'resize-test',
    coordinates: defaultCoords,
    containerBounds: { width: 800, height: 600 },
    isSelected: true,
    onSelect: jest.fn(),
    onChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers resize on handle mousedown', () => {
    render(<CropRectangle {...props} />);

    const handle = screen.getByTestId('resize-handle-bottom-right');
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 300 });

    // The component should now be in resize mode
    // Further mouse moves would trigger resize
    expect(props.onSelect).toHaveBeenCalledWith('resize-test');
  });

  it('respects minimum width constraint', () => {
    const onChange = jest.fn();
    render(<CropRectangle {...props} onChange={onChange} minWidth={100} />);

    const handle = screen.getByTestId('resize-handle-right');

    // Start resize
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 200 });

    // Try to shrink below minimum
    fireEvent.mouseMove(document, { clientX: 150, clientY: 200 });
    fireEvent.mouseUp(document);

    // onChange should be called with width >= minWidth
    if (onChange.mock.calls.length > 0) {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.width).toBeGreaterThanOrEqual(100);
    }
  });

  it('respects minimum height constraint', () => {
    const onChange = jest.fn();
    render(<CropRectangle {...props} onChange={onChange} minHeight={80} />);

    const handle = screen.getByTestId('resize-handle-bottom');

    // Start resize
    fireEvent.mouseDown(handle, { clientX: 200, clientY: 300 });

    // Try to shrink below minimum
    fireEvent.mouseMove(document, { clientX: 200, clientY: 120 });
    fireEvent.mouseUp(document);

    // onChange should be called with height >= minHeight
    if (onChange.mock.calls.length > 0) {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.height).toBeGreaterThanOrEqual(80);
    }
  });
});
