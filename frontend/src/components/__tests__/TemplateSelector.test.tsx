/**
 * Test suite for TemplateSelector component
 *
 * Tests cover:
 * - Basic rendering
 * - Initial state
 * - Template selection
 * - Keyboard navigation
 * - Disabled state
 * - Accessibility
 * - Visual states
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplateSelector, { TemplateType } from '../TemplateSelector';

describe('TemplateSelector', () => {
  describe('Rendering', () => {
    it('renders all three template buttons', () => {
      render(<TemplateSelector />);

      expect(screen.getByTestId('template-button-1-frame')).toBeInTheDocument();
      expect(screen.getByTestId('template-button-2-frame')).toBeInTheDocument();
      expect(screen.getByTestId('template-button-3-frame')).toBeInTheDocument();
    });

    it('renders with correct labels', () => {
      render(<TemplateSelector />);

      expect(screen.getByText('Single Frame')).toBeInTheDocument();
      expect(screen.getByText('Two Frames')).toBeInTheDocument();
      expect(screen.getByText('Three Frames')).toBeInTheDocument();
    });

    it('renders container with correct test id', () => {
      render(<TemplateSelector />);

      expect(screen.getByTestId('template-selector')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<TemplateSelector className="custom-class" />);

      const container = screen.getByTestId('template-selector');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Initial State', () => {
    it('defaults to 1-frame template when no initialTemplate provided', () => {
      render(<TemplateSelector />);

      const oneFrameBtn = screen.getByTestId('template-button-1-frame');
      expect(oneFrameBtn).toHaveAttribute('data-selected', 'true');
      expect(oneFrameBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('respects initialTemplate prop', () => {
      render(<TemplateSelector initialTemplate="2-frame" />);

      const twoFrameBtn = screen.getByTestId('template-button-2-frame');
      expect(twoFrameBtn).toHaveAttribute('data-selected', 'true');

      const oneFrameBtn = screen.getByTestId('template-button-1-frame');
      expect(oneFrameBtn).toHaveAttribute('data-selected', 'false');
    });

    it('shows selected indicator on initial template', () => {
      render(<TemplateSelector initialTemplate="3-frame" />);

      const threeFrameBtn = screen.getByTestId('template-button-3-frame');
      const indicator = threeFrameBtn.querySelector('[data-testid="selected-indicator"]');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('changes selection when clicking a different template', () => {
      render(<TemplateSelector initialTemplate="1-frame" />);

      const twoFrameBtn = screen.getByTestId('template-button-2-frame');
      fireEvent.click(twoFrameBtn);

      expect(twoFrameBtn).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('template-button-1-frame')).toHaveAttribute('data-selected', 'false');
    });

    it('calls onTemplateChange callback when selection changes', () => {
      const handleChange = jest.fn();
      render(<TemplateSelector onTemplateChange={handleChange} />);

      fireEvent.click(screen.getByTestId('template-button-2-frame'));

      expect(handleChange).toHaveBeenCalledWith('2-frame');
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('stores selected template in internal state', () => {
      render(<TemplateSelector />);

      // Click 3-frame
      fireEvent.click(screen.getByTestId('template-button-3-frame'));
      expect(screen.getByTestId('template-button-3-frame')).toHaveAttribute('data-selected', 'true');

      // Click 2-frame
      fireEvent.click(screen.getByTestId('template-button-2-frame'));
      expect(screen.getByTestId('template-button-2-frame')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('template-button-3-frame')).toHaveAttribute('data-selected', 'false');
    });

    it('can re-select the same template', () => {
      const handleChange = jest.fn();
      render(<TemplateSelector initialTemplate="1-frame" onTemplateChange={handleChange} />);

      fireEvent.click(screen.getByTestId('template-button-1-frame'));

      expect(handleChange).toHaveBeenCalledWith('1-frame');
      expect(screen.getByTestId('template-button-1-frame')).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('Keyboard Navigation', () => {
    it('selects template with Enter key', () => {
      const handleChange = jest.fn();
      render(<TemplateSelector onTemplateChange={handleChange} />);

      const twoFrameBtn = screen.getByTestId('template-button-2-frame');
      fireEvent.keyDown(twoFrameBtn, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledWith('2-frame');
      expect(twoFrameBtn).toHaveAttribute('data-selected', 'true');
    });

    it('selects template with Space key', () => {
      const handleChange = jest.fn();
      render(<TemplateSelector onTemplateChange={handleChange} />);

      const threeFrameBtn = screen.getByTestId('template-button-3-frame');
      fireEvent.keyDown(threeFrameBtn, { key: ' ' });

      expect(handleChange).toHaveBeenCalledWith('3-frame');
      expect(threeFrameBtn).toHaveAttribute('data-selected', 'true');
    });

    it('does not select on other keys', () => {
      const handleChange = jest.fn();
      render(<TemplateSelector onTemplateChange={handleChange} />);

      const twoFrameBtn = screen.getByTestId('template-button-2-frame');
      fireEvent.keyDown(twoFrameBtn, { key: 'a' });

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('template-button-1-frame')).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('Disabled State', () => {
    it('disables all buttons when disabled prop is true', () => {
      render(<TemplateSelector disabled />);

      expect(screen.getByTestId('template-button-1-frame')).toBeDisabled();
      expect(screen.getByTestId('template-button-2-frame')).toBeDisabled();
      expect(screen.getByTestId('template-button-3-frame')).toBeDisabled();
    });

    it('does not change selection when disabled', () => {
      const handleChange = jest.fn();
      render(<TemplateSelector disabled onTemplateChange={handleChange} />);

      fireEvent.click(screen.getByTestId('template-button-2-frame'));

      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('template-button-1-frame')).toHaveAttribute('data-selected', 'true');
    });

    it('applies disabled styling', () => {
      render(<TemplateSelector disabled />);

      const buttons = [
        screen.getByTestId('template-button-1-frame'),
        screen.getByTestId('template-button-2-frame'),
        screen.getByTestId('template-button-3-frame'),
      ];

      buttons.forEach(button => {
        expect(button).toHaveClass('opacity-50');
        expect(button).toHaveClass('cursor-not-allowed');
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA role on container', () => {
      render(<TemplateSelector />);

      const container = screen.getByTestId('template-selector');
      expect(container).toHaveAttribute('role', 'group');
      expect(container).toHaveAttribute('aria-label', 'Select video template layout');
    });

    it('buttons have aria-pressed attribute', () => {
      render(<TemplateSelector initialTemplate="2-frame" />);

      expect(screen.getByTestId('template-button-1-frame')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('template-button-2-frame')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('template-button-3-frame')).toHaveAttribute('aria-pressed', 'false');
    });

    it('buttons have descriptive aria-labels', () => {
      render(<TemplateSelector />);

      expect(screen.getByTestId('template-button-1-frame')).toHaveAttribute(
        'aria-label',
        'Single Frame: Full screen 1080x1920 layout'
      );
      expect(screen.getByTestId('template-button-2-frame')).toHaveAttribute(
        'aria-label',
        'Two Frames: Two frames stacked vertically (9:8 each)'
      );
      expect(screen.getByTestId('template-button-3-frame')).toHaveAttribute(
        'aria-label',
        'Three Frames: Two on top, one large below'
      );
    });

    it('has screen reader announcement for selection', () => {
      render(<TemplateSelector initialTemplate="2-frame" />);

      const announcement = screen.getByTestId('selection-announcement');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      expect(announcement).toHaveTextContent('Selected: Two Frames');
    });

    it('icons have aria-hidden attribute', () => {
      render(<TemplateSelector />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const svg = button.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Visual States', () => {
    it('selected button has blue styling', () => {
      render(<TemplateSelector initialTemplate="1-frame" />);

      const selectedBtn = screen.getByTestId('template-button-1-frame');
      expect(selectedBtn).toHaveClass('border-blue-500');
      expect(selectedBtn).toHaveClass('text-blue-400');
    });

    it('unselected buttons have gray styling', () => {
      render(<TemplateSelector initialTemplate="1-frame" />);

      const unselectedBtn = screen.getByTestId('template-button-2-frame');
      expect(unselectedBtn).toHaveClass('border-gray-600');
      expect(unselectedBtn).toHaveClass('text-gray-400');
    });

    it('shows checkmark indicator on selected template', () => {
      render(<TemplateSelector initialTemplate="2-frame" />);

      const selectedBtn = screen.getByTestId('template-button-2-frame');
      const indicator = selectedBtn.querySelector('[data-testid="selected-indicator"]');
      expect(indicator).toBeInTheDocument();

      // Checkmark SVG should be inside
      const checkmark = indicator?.querySelector('svg');
      expect(checkmark).toBeInTheDocument();
    });

    it('only one template shows checkmark at a time', () => {
      render(<TemplateSelector />);

      // Initially 1-frame is selected
      let indicators = screen.getAllByTestId('selected-indicator');
      expect(indicators).toHaveLength(1);

      // Select 3-frame
      fireEvent.click(screen.getByTestId('template-button-3-frame'));

      indicators = screen.getAllByTestId('selected-indicator');
      expect(indicators).toHaveLength(1);

      const threeFrameBtn = screen.getByTestId('template-button-3-frame');
      expect(threeFrameBtn.querySelector('[data-testid="selected-indicator"]')).toBeInTheDocument();
    });
  });

  describe('Type Safety', () => {
    it('only accepts valid template types', () => {
      // TypeScript would catch invalid template types at compile time
      // This test verifies runtime behavior with valid types
      const templates: TemplateType[] = ['1-frame', '2-frame', '3-frame'];

      templates.forEach(template => {
        const { unmount } = render(<TemplateSelector initialTemplate={template} />);
        expect(screen.getByTestId(`template-button-${template}`)).toHaveAttribute('data-selected', 'true');
        unmount();
      });
    });
  });
});
