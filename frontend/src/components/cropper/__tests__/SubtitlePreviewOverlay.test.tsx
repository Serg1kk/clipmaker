/**
 * Test suite for SubtitlePreviewOverlay component
 *
 * Tests cover:
 * - Basic rendering
 * - Visibility based on enabled prop
 * - Position (top/center/bottom)
 * - Styling (font family, size, color)
 * - Custom sample text
 * - Accessibility
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubtitlePreviewOverlay from '../SubtitlePreviewOverlay';

describe('SubtitlePreviewOverlay', () => {
  const defaultProps = {
    enabled: true,
    fontFamily: 'Arial' as const,
    fontSize: 24,
    textColor: '#FFFFFF',
    position: 'center' as const,
  };

  describe('rendering', () => {
    it('renders when enabled', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} />);
      expect(screen.getByTestId('subtitle-preview-overlay')).toBeInTheDocument();
    });

    it('does not render when disabled', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} enabled={false} />);
      expect(screen.queryByTestId('subtitle-preview-overlay')).not.toBeInTheDocument();
    });

    it('renders default sample text', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} />);
      expect(screen.getByText('Sample Subtitle')).toBeInTheDocument();
    });

    it('renders custom sample text', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} sampleText="Custom Text" />);
      expect(screen.getByText('Custom Text')).toBeInTheDocument();
    });
  });

  describe('position', () => {
    it('applies top position class', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} position="top" />);
      const overlay = screen.getByTestId('subtitle-preview-overlay');
      expect(overlay).toHaveClass('top-4');
    });

    it('applies center position class', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} position="center" />);
      const overlay = screen.getByTestId('subtitle-preview-overlay');
      expect(overlay).toHaveClass('top-1/2');
      expect(overlay).toHaveClass('-translate-y-1/2');
    });

    it('applies bottom position class', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} position="bottom" />);
      const overlay = screen.getByTestId('subtitle-preview-overlay');
      expect(overlay).toHaveClass('bottom-4');
    });
  });

  describe('styling', () => {
    it('applies text color', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} textColor="#FF0000" />);
      const textElement = screen.getByTestId('subtitle-preview-text');
      expect(textElement).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('applies font family', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} fontFamily="Georgia" />);
      const textElement = screen.getByTestId('subtitle-preview-text');
      expect(textElement).toHaveStyle({ fontFamily: 'Georgia, serif' });
    });

    it('scales font size for preview', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} fontSize={48} />);
      const textElement = screen.getByTestId('subtitle-preview-text');
      // Font size is scaled to 50% for preview, so 48 * 0.5 = 24px
      expect(textElement).toHaveStyle({ fontSize: '24px' });
    });

    it('enforces minimum font size of 12px', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} fontSize={12} />);
      const textElement = screen.getByTestId('subtitle-preview-text');
      // 12 * 0.5 = 6, but minimum is 12px
      expect(textElement).toHaveStyle({ fontSize: '12px' });
    });

    it('applies background color', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} />);
      const textElement = screen.getByTestId('subtitle-preview-text');
      expect(textElement).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.5)' });
    });
  });

  describe('accessibility', () => {
    it('has accessible role', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} />);
      expect(screen.getByRole('region', { name: /subtitle preview/i })).toBeInTheDocument();
    });

    it('has aria-label', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} />);
      const overlay = screen.getByTestId('subtitle-preview-overlay');
      expect(overlay).toHaveAttribute('aria-label', 'Subtitle preview');
    });

    it('is pointer-events-none to not interfere with clicks', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} />);
      const overlay = screen.getByTestId('subtitle-preview-overlay');
      expect(overlay).toHaveClass('pointer-events-none');
    });
  });

  describe('custom className', () => {
    it('applies additional className', () => {
      render(<SubtitlePreviewOverlay {...defaultProps} className="custom-class" />);
      const overlay = screen.getByTestId('subtitle-preview-overlay');
      expect(overlay).toHaveClass('custom-class');
    });
  });
});
