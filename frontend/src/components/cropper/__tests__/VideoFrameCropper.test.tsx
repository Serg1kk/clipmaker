import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import VideoFrameCropper from '../VideoFrameCropper';
import { CropCoordinates } from '../types';

// Mock HTMLMediaElement methods for JSDOM
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: jest.fn()
});
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: jest.fn().mockResolvedValue(undefined)
});

// Mock react-draggable to avoid issues with JSDOM
jest.mock('react-draggable', () => {
  return {
    __esModule: true,
    default: ({ children, position, onDrag, onStart, disabled }: {
      children: React.ReactNode;
      position: { x: number; y: number };
      onDrag?: (e: unknown, data: { x: number; y: number }) => void;
      onStart?: () => void;
      disabled?: boolean;
    }) => {
      return (
        <div
          data-testid="mock-draggable"
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          onMouseDown={() => {
            if (!disabled) {
              onStart?.();
            }
          }}
          onMouseMove={(e) => {
            if (!disabled && onDrag) {
              onDrag(e, { x: position.x + 10, y: position.y + 10 });
            }
          }}
        >
          {children}
        </div>
      );
    }
  };
});

// Mock image loading
const mockImageLoad = () => {
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    Object.defineProperty(img, 'complete', { value: true });
    fireEvent.load(img);
  });
};

describe('VideoFrameCropper', () => {
  const defaultProps = {
    src: '/test-image.jpg',
    srcType: 'image' as const,
    template: '1-frame' as const
  };

  beforeEach(() => {
    // Mock getBoundingClientRect for container sizing
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 450,
      top: 0,
      left: 0,
      right: 800,
      bottom: 450,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }));
  });

  describe('Rendering', () => {
    it('renders the cropper container', () => {
      render(<VideoFrameCropper {...defaultProps} />);
      expect(screen.getByTestId('video-frame-cropper')).toBeInTheDocument();
    });

    it('renders an image when srcType is image', () => {
      render(<VideoFrameCropper {...defaultProps} />);
      expect(screen.getByTestId('cropper-image')).toBeInTheDocument();
    });

    it('renders a video when srcType is video', () => {
      render(<VideoFrameCropper {...defaultProps} srcType="video" />);
      expect(screen.getByTestId('cropper-video')).toBeInTheDocument();
    });

    it('shows loading overlay initially', () => {
      render(<VideoFrameCropper {...defaultProps} />);
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    });

    it('hides loading overlay after image loads', async () => {
      render(<VideoFrameCropper {...defaultProps} />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
      });
    });

    it('applies custom className', () => {
      render(<VideoFrameCropper {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('video-frame-cropper')).toHaveClass('custom-class');
    });
  });

  describe('Template-based rectangles', () => {
    it('renders 1 rectangle for 1-frame template', async () => {
      render(<VideoFrameCropper {...defaultProps} template="1-frame" />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
        expect(screen.queryByTestId('crop-rectangle-frame-2')).not.toBeInTheDocument();
      });
    });

    it('renders 2 rectangles for 2-frame template', async () => {
      render(<VideoFrameCropper {...defaultProps} template="2-frame" />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
        expect(screen.getByTestId('crop-rectangle-frame-2')).toBeInTheDocument();
        expect(screen.queryByTestId('crop-rectangle-frame-3')).not.toBeInTheDocument();
      });
    });

    it('renders 3 rectangles for 3-frame template', async () => {
      render(<VideoFrameCropper {...defaultProps} template="3-frame" />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
        expect(screen.getByTestId('crop-rectangle-frame-2')).toBeInTheDocument();
        expect(screen.getByTestId('crop-rectangle-frame-3')).toBeInTheDocument();
      });
    });

    it('displays correct labels for single frame', async () => {
      render(<VideoFrameCropper {...defaultProps} template="1-frame" />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('crop-label-frame-1')).toHaveTextContent('Crop Area');
      });
    });

    it('displays correct labels for multiple frames', async () => {
      render(<VideoFrameCropper {...defaultProps} template="3-frame" />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('crop-label-frame-1')).toHaveTextContent('Frame 1');
        expect(screen.getByTestId('crop-label-frame-2')).toHaveTextContent('Frame 2');
        expect(screen.getByTestId('crop-label-frame-3')).toHaveTextContent('Frame 3');
      });
    });
  });

  describe('Coordinate callbacks', () => {
    it('provides callback props for coordinate changes', async () => {
      const onCropChange = jest.fn();
      const onNormalizedCropChange = jest.fn();
      render(
        <VideoFrameCropper
          {...defaultProps}
          template="1-frame"
          onCropChange={onCropChange}
          onNormalizedCropChange={onNormalizedCropChange}
        />
      );
      mockImageLoad();

      await waitFor(() => {
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
      });

      // Verify the component renders with callbacks available
      const rectangle = screen.getByTestId('crop-rectangle-frame-1');
      expect(rectangle).toBeInTheDocument();
    });

    it('renders rectangles that can trigger coordinate callbacks', async () => {
      const onCropChange = jest.fn();
      render(
        <VideoFrameCropper
          {...defaultProps}
          template="2-frame"
          onCropChange={onCropChange}
        />
      );
      mockImageLoad();

      await waitFor(() => {
        // Both rectangles should render
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
        expect(screen.getByTestId('crop-rectangle-frame-2')).toBeInTheDocument();
      });
    });
  });

  describe('Coordinates display', () => {
    it('does not show coordinates by default', async () => {
      render(<VideoFrameCropper {...defaultProps} />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.queryByTestId('coordinates-display')).not.toBeInTheDocument();
      });
    });

    it('shows coordinates when showCoordinates is true', async () => {
      render(<VideoFrameCropper {...defaultProps} showCoordinates />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('coordinates-display')).toBeInTheDocument();
      });
    });

    it('displays coordinate values for each rectangle', async () => {
      render(<VideoFrameCropper {...defaultProps} template="2-frame" showCoordinates />);
      mockImageLoad();
      await waitFor(() => {
        expect(screen.getByTestId('coord-display-frame-1')).toBeInTheDocument();
        expect(screen.getByTestId('coord-display-frame-2')).toBeInTheDocument();
      });
    });
  });

  describe('Initial coordinates', () => {
    it('uses provided initial coordinates', async () => {
      const initialCoordinates: CropCoordinates[] = [
        { id: 'frame-1', x: 100, y: 100, width: 200, height: 200 }
      ];

      const onCropChange = jest.fn();
      render(
        <VideoFrameCropper
          {...defaultProps}
          template="1-frame"
          initialCoordinates={initialCoordinates}
          onCropChange={onCropChange}
          showCoordinates
        />
      );
      mockImageLoad();

      await waitFor(() => {
        const coordDisplay = screen.getByTestId('coord-display-frame-1');
        expect(coordDisplay).toHaveTextContent('x: 100');
        expect(coordDisplay).toHaveTextContent('y: 100');
        expect(coordDisplay).toHaveTextContent('w: 200');
        expect(coordDisplay).toHaveTextContent('h: 200');
      });
    });
  });

  describe('Disabled state', () => {
    it('disables all rectangles when disabled prop is true', async () => {
      render(<VideoFrameCropper {...defaultProps} template="2-frame" disabled />);
      mockImageLoad();

      await waitFor(() => {
        const rect1 = screen.getByTestId('crop-rectangle-frame-1');
        const rect2 = screen.getByTestId('crop-rectangle-frame-2');
        expect(rect1).toHaveClass('opacity-50');
        expect(rect2).toHaveClass('opacity-50');
      });
    });
  });

  describe('Rectangle selection', () => {
    it('selects a rectangle when clicked', async () => {
      render(<VideoFrameCropper {...defaultProps} template="2-frame" />);
      mockImageLoad();

      await waitFor(() => {
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
      });

      const rectangle = screen.getByTestId('crop-rectangle-frame-1');
      fireEvent.click(rectangle);

      await waitFor(() => {
        expect(rectangle).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('deselects when clicking outside rectangles', async () => {
      render(<VideoFrameCropper {...defaultProps} template="1-frame" />);
      mockImageLoad();

      await waitFor(() => {
        expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
      });

      const rectangle = screen.getByTestId('crop-rectangle-frame-1');
      fireEvent.click(rectangle);

      const container = screen.getByTestId('cropper-container');
      fireEvent.click(container);

      await waitFor(() => {
        expect(rectangle).toHaveAttribute('aria-selected', 'false');
      });
    });
  });

  describe('Accessibility', () => {
    it('rectangles have proper ARIA labels', async () => {
      render(<VideoFrameCropper {...defaultProps} template="1-frame" />);
      mockImageLoad();

      await waitFor(() => {
        const rectangle = screen.getByTestId('crop-rectangle-frame-1');
        expect(rectangle).toHaveAttribute('role', 'button');
        expect(rectangle).toHaveAttribute('tabIndex', '0');
        expect(rectangle).toHaveAttribute('aria-label');
      });
    });
  });
});

describe('CropRectangle integration', () => {
  it('shows resize handles when selected', async () => {
    render(
      <VideoFrameCropper
        src="/test.jpg"
        srcType="image"
        template="1-frame"
      />
    );

    // Mock image load
    const img = screen.getByTestId('cropper-image');
    fireEvent.load(img);

    await waitFor(() => {
      expect(screen.getByTestId('crop-rectangle-frame-1')).toBeInTheDocument();
    });

    // Click to select
    const rectangle = screen.getByTestId('crop-rectangle-frame-1');
    fireEvent.click(rectangle);

    // Check for resize handles
    await waitFor(() => {
      expect(screen.getByTestId('resize-handle-top-left')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-top-right')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-bottom-left')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle-bottom-right')).toBeInTheDocument();
    });
  });
});
