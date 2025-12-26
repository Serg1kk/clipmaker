import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import PreviewLayoutWithCropper from '../PreviewLayoutWithCropper';

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
    default: ({ children, position }: {
      children: React.ReactNode;
      position: { x: number; y: number };
    }) => {
      return (
        <div
          data-testid="mock-draggable"
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
          {children}
        </div>
      );
    }
  };
});

describe('PreviewLayoutWithCropper', () => {
  const mockSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  describe('rendering', () => {
    it('renders template selector', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByTestId('template-selector')).toBeInTheDocument();
    });

    it('renders video frame cropper', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByTestId('video-frame-cropper')).toBeInTheDocument();
    });

    it('renders preview layout', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByTestId('preview-layout')).toBeInTheDocument();
    });

    it('shows labels for sections', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByText('Select Layout')).toBeInTheDocument();
      expect(screen.getByText('Adjust Crop Areas')).toBeInTheDocument();
      expect(screen.getByText('Preview (9:16)')).toBeInTheDocument();
    });

    it('shows live preview indicator', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByText('Live preview - drag crop areas to update')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} className="custom-class" />);
      expect(screen.getByTestId('preview-layout-with-cropper')).toHaveClass('custom-class');
    });
  });

  describe('template selection', () => {
    it('uses 1-frame template by default', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      // 1-frame button should be selected
      const oneFrameButton = screen.getByTestId('template-button-1-frame');
      expect(oneFrameButton).toHaveAttribute('data-selected', 'true');
    });

    it('uses initialTemplate when provided', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} initialTemplate="2-frame" />);
      const twoFrameButton = screen.getByTestId('template-button-2-frame');
      expect(twoFrameButton).toHaveAttribute('data-selected', 'true');
    });

    it('updates template when button clicked', async () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);

      // Click 2-frame template button
      const twoFrameButton = screen.getByTestId('template-button-2-frame');
      fireEvent.click(twoFrameButton);

      await waitFor(() => {
        expect(twoFrameButton).toHaveAttribute('data-selected', 'true');
      });
    });

    it('calls onTemplateChange when template changes', () => {
      const handleTemplateChange = jest.fn();
      render(
        <PreviewLayoutWithCropper
          src={mockSrc}
          onTemplateChange={handleTemplateChange}
        />
      );

      const twoFrameButton = screen.getByTestId('template-button-2-frame');
      fireEvent.click(twoFrameButton);

      expect(handleTemplateChange).toHaveBeenCalledWith('2-frame');
    });
  });

  describe('preview layout integration', () => {
    it('renders 9:16 aspect ratio preview', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} previewWidth={270} />);
      const preview = screen.getByTestId('preview-layout');

      // 9:16 aspect ratio: height = 270 * (16/9) = 480
      const expectedHeight = Math.round(270 * (16 / 9));
      expect(preview).toHaveStyle({ width: '270px', height: `${expectedHeight}px` });
    });

    it('shows aspect ratio label', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByTestId('aspect-ratio-label')).toHaveTextContent('9:16');
    });

    it('accepts custom preview width', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} previewWidth={400} />);
      const preview = screen.getByTestId('preview-layout');
      expect(preview).toHaveStyle({ width: '400px' });
    });
  });

  describe('source handling', () => {
    it('defaults to image source type', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByTestId('preview-layout-with-cropper')).toBeInTheDocument();
    });

    it('accepts video source type', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} srcType="video" />);
      expect(screen.getByTestId('preview-layout-with-cropper')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible preview label', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByLabelText('9:16 video preview')).toBeInTheDocument();
    });

    it('has template selector with accessible role', () => {
      render(<PreviewLayoutWithCropper src={mockSrc} />);
      expect(screen.getByRole('group', { name: /select video template layout/i })).toBeInTheDocument();
    });
  });
});
