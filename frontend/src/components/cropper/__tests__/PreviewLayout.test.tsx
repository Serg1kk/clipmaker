import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreviewLayout from '../PreviewLayout';
import { NormalizedCropCoordinates } from '../types';

describe('PreviewLayout', () => {
  const mockSrc = '/test-image.jpg';

  const mockCoordinates: NormalizedCropCoordinates[] = [
    { id: 'frame-1', x: 0.1, y: 0.1, width: 0.4, height: 0.8 },
    { id: 'frame-2', x: 0.5, y: 0.1, width: 0.4, height: 0.8 }
  ];

  describe('rendering', () => {
    it('renders with correct 9:16 aspect ratio', () => {
      const width = 270;
      const expectedHeight = Math.round(width * (16 / 9));

      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
          width={width}
        />
      );

      const container = screen.getByTestId('preview-layout');
      expect(container).toBeInTheDocument();
      expect(container).toHaveStyle({ width: `${width}px`, height: `${expectedHeight}px` });
    });

    it('shows aspect ratio label', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      expect(screen.getByTestId('aspect-ratio-label')).toHaveTextContent('9:16');
    });

    it('applies custom className', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
          className="custom-class"
        />
      );

      expect(screen.getByTestId('preview-layout')).toHaveClass('custom-class');
    });

    it('applies custom background color', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
          backgroundColor="#333"
        />
      );

      expect(screen.getByTestId('preview-layout')).toHaveStyle({ backgroundColor: '#333' });
    });
  });

  describe('template layouts', () => {
    it('renders single frame for 1-frame template', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      expect(screen.getByTestId('preview-frame-0')).toBeInTheDocument();
      expect(screen.queryByTestId('preview-frame-1')).not.toBeInTheDocument();
    });

    it('renders two frames for 2-frame template', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="2-frame"
          normalizedCoordinates={mockCoordinates}
        />
      );

      expect(screen.getByTestId('preview-frame-0')).toBeInTheDocument();
      expect(screen.getByTestId('preview-frame-1')).toBeInTheDocument();
      expect(screen.queryByTestId('preview-frame-2')).not.toBeInTheDocument();
    });

    it('renders three frames for 3-frame template', () => {
      const threeCoords: NormalizedCropCoordinates[] = [
        ...mockCoordinates,
        { id: 'frame-3', x: 0.3, y: 0.3, width: 0.3, height: 0.6 }
      ];

      render(
        <PreviewLayout
          src={mockSrc}
          template="3-frame"
          normalizedCoordinates={threeCoords}
        />
      );

      expect(screen.getByTestId('preview-frame-0')).toBeInTheDocument();
      expect(screen.getByTestId('preview-frame-1')).toBeInTheDocument();
      expect(screen.getByTestId('preview-frame-2')).toBeInTheDocument();
    });
  });

  describe('frame positioning', () => {
    it('positions 1-frame to fill entire preview', () => {
      const width = 270;
      const height = Math.round(width * (16 / 9));

      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
          width={width}
        />
      );

      const frame = screen.getByTestId('preview-frame-0');
      expect(frame).toHaveStyle({
        left: '0px',
        top: '0px',
        width: `${width}px`,
        height: `${height}px`
      });
    });

    it('positions 2-frame as stacked vertically', () => {
      const width = 270;
      const height = Math.round(width * (16 / 9));
      const halfHeight = height * 0.5;

      render(
        <PreviewLayout
          src={mockSrc}
          template="2-frame"
          normalizedCoordinates={mockCoordinates}
          width={width}
        />
      );

      const frame1 = screen.getByTestId('preview-frame-0');
      const frame2 = screen.getByTestId('preview-frame-1');

      expect(frame1).toHaveStyle({ top: '0px' });
      expect(frame2).toHaveStyle({ top: `${halfHeight}px` });
    });

    it('positions 3-frame with 2 top side-by-side (25%) + 1 bottom (75%)', () => {
      const width = 270;
      const height = Math.round(width * (16 / 9));
      const halfWidth = width * 0.5;
      const topHeight = height * 0.25; // 25% for top frames (480/1920)
      const bottomHeight = height * 0.75; // 75% for bottom frame (1440/1920)

      const threeCoords: NormalizedCropCoordinates[] = [
        { id: 'frame-1', x: 0.1, y: 0.1, width: 0.4, height: 0.8 },
        { id: 'frame-2', x: 0.5, y: 0.1, width: 0.4, height: 0.8 },
        { id: 'frame-3', x: 0.3, y: 0.3, width: 0.3, height: 0.6 }
      ];

      render(
        <PreviewLayout
          src={mockSrc}
          template="3-frame"
          normalizedCoordinates={threeCoords}
          width={width}
        />
      );

      const frame1 = screen.getByTestId('preview-frame-0');
      const frame2 = screen.getByTestId('preview-frame-1');
      const frame3 = screen.getByTestId('preview-frame-2');

      // Top-left frame: 0,0 with 50% width, 25% height
      expect(frame1).toHaveStyle({
        left: '0px',
        top: '0px',
        width: `${halfWidth}px`,
        height: `${topHeight}px`
      });

      // Top-right frame: 50% left, 0 top with 50% width, 25% height
      expect(frame2).toHaveStyle({
        left: `${halfWidth}px`,
        top: '0px',
        width: `${halfWidth}px`,
        height: `${topHeight}px`
      });

      // Bottom main frame: 0 left, 25% top with 100% width, 75% height
      expect(frame3).toHaveStyle({
        left: '0px',
        top: `${topHeight}px`,
        width: `${width}px`,
        height: `${bottomHeight}px`
      });
    });
  });

  describe('crop visualization', () => {
    it('shows frame content with background image', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      const content = screen.getByTestId('preview-frame-content-0');
      expect(content).toHaveStyle({
        backgroundImage: `url(${mockSrc})`
      });
    });

    it('shows empty placeholder when no coordinates provided', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="2-frame"
          normalizedCoordinates={[mockCoordinates[0]]} // Only 1 coord for 2-frame
        />
      );

      // First frame has content
      expect(screen.getByTestId('preview-frame-content-0')).toBeInTheDocument();
      // Second frame shows placeholder
      expect(screen.getByTestId('preview-frame-1')).toHaveTextContent('No crop area');
    });

    it('handles zero-dimension coordinates gracefully', () => {
      const zeroCoord: NormalizedCropCoordinates = {
        id: 'crop-zero',
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };

      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[zeroCoord]}
        />
      );

      // Should show placeholder for zero dimensions
      expect(screen.getByTestId('preview-frame-0')).toHaveTextContent('No crop area');
    });
  });

  describe('frame borders', () => {
    it('does not show frame borders by default', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      const frame = screen.getByTestId('preview-frame-0');
      expect(frame).not.toHaveClass('border');
    });

    it('shows frame borders when showFrameBorders is true', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
          showFrameBorders
        />
      );

      const frame = screen.getByTestId('preview-frame-0');
      expect(frame).toHaveClass('border');
    });

    it('shows frame labels when showFrameBorders is true', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="2-frame"
          normalizedCoordinates={mockCoordinates}
          showFrameBorders
        />
      );

      expect(screen.getByText('Frame 1')).toBeInTheDocument();
      expect(screen.getByText('Frame 2')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible label', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      expect(screen.getByLabelText('9:16 video preview')).toBeInTheDocument();
    });
  });

  describe('custom width', () => {
    it('uses default width of 270px', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      expect(screen.getByTestId('preview-layout')).toHaveStyle({ width: '270px' });
    });

    it('accepts custom width', () => {
      render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
          width={400}
        />
      );

      const expectedHeight = Math.round(400 * (16 / 9));
      expect(screen.getByTestId('preview-layout')).toHaveStyle({
        width: '400px',
        height: `${expectedHeight}px`
      });
    });
  });

  describe('live updates', () => {
    it('updates frame content when coordinates change', () => {
      const { rerender } = render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[{ id: 'frame-1', x: 0.1, y: 0.1, width: 0.5, height: 0.5 }]}
        />
      );

      const content = screen.getByTestId('preview-frame-content-0');
      const initialStyle = content.style.backgroundPosition;

      // Update with new coordinates
      rerender(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[{ id: 'frame-1', x: 0.3, y: 0.3, width: 0.4, height: 0.4 }]}
        />
      );

      // Background position should have changed
      expect(content.style.backgroundPosition).not.toBe(initialStyle);
    });

    it('updates layout when template changes', () => {
      const { rerender } = render(
        <PreviewLayout
          src={mockSrc}
          template="1-frame"
          normalizedCoordinates={[mockCoordinates[0]]}
        />
      );

      expect(screen.queryByTestId('preview-frame-1')).not.toBeInTheDocument();

      rerender(
        <PreviewLayout
          src={mockSrc}
          template="2-frame"
          normalizedCoordinates={mockCoordinates}
        />
      );

      expect(screen.getByTestId('preview-frame-1')).toBeInTheDocument();
    });
  });
});
