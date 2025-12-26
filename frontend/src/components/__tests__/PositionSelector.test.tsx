/**
 * Test suite for PositionSelector component
 *
 * Tests cover:
 * - Basic rendering
 * - Initial position
 * - Position selection
 * - Keyboard navigation
 * - Disabled state
 * - Accessibility
 * - Styling
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PositionSelector, { TextPosition } from '../PositionSelector';

describe('PositionSelector', () => {
  describe('rendering', () => {
    it('renders the position selector', () => {
      render(<PositionSelector />);
      expect(screen.getByTestId('position-selector')).toBeInTheDocument();
    });

    it('renders all three position buttons', () => {
      render(<PositionSelector />);

      expect(screen.getByTestId('position-button-top')).toBeInTheDocument();
      expect(screen.getByTestId('position-button-center')).toBeInTheDocument();
      expect(screen.getByTestId('position-button-bottom')).toBeInTheDocument();
    });

    it('renders button labels', () => {
      render(<PositionSelector />);

      expect(screen.getByText('Top')).toBeInTheDocument();
      expect(screen.getByText('Center')).toBeInTheDocument();
      expect(screen.getByText('Bottom')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<PositionSelector className="custom-class" />);
      expect(screen.getByTestId('position-selector')).toHaveClass('custom-class');
    });
  });

  describe('initial position', () => {
    it('defaults to center position', () => {
      render(<PositionSelector />);

      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('position-button-top')).toHaveAttribute('data-selected', 'false');
      expect(screen.getByTestId('position-button-bottom')).toHaveAttribute('data-selected', 'false');
    });

    it('respects initialPosition prop', () => {
      render(<PositionSelector initialPosition="top" />);

      expect(screen.getByTestId('position-button-top')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'false');
      expect(screen.getByTestId('position-button-bottom')).toHaveAttribute('data-selected', 'false');
    });

    it('shows selected indicator on initial position', () => {
      render(<PositionSelector initialPosition="bottom" />);

      const bottomButton = screen.getByTestId('position-button-bottom');
      expect(bottomButton.querySelector('[data-testid="selected-indicator"]')).toBeInTheDocument();
    });
  });

  describe('position selection', () => {
    it('calls onPositionChange when position is clicked', () => {
      const onPositionChange = jest.fn();

      render(<PositionSelector onPositionChange={onPositionChange} />);

      fireEvent.click(screen.getByTestId('position-button-top'));

      expect(onPositionChange).toHaveBeenCalledWith('top');
    });

    it('updates selected position on click', () => {
      render(<PositionSelector />);

      fireEvent.click(screen.getByTestId('position-button-top'));

      expect(screen.getByTestId('position-button-top')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'false');
    });

    it('moves selected indicator when position changes', () => {
      render(<PositionSelector initialPosition="center" />);

      // Initially center has indicator
      expect(
        screen.getByTestId('position-button-center').querySelector('[data-testid="selected-indicator"]')
      ).toBeInTheDocument();

      // Click top
      fireEvent.click(screen.getByTestId('position-button-top'));

      // Now top has indicator
      expect(
        screen.getByTestId('position-button-top').querySelector('[data-testid="selected-indicator"]')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('position-button-center').querySelector('[data-testid="selected-indicator"]')
      ).not.toBeInTheDocument();
    });

    it('calls onPositionChange for each position type', () => {
      const onPositionChange = jest.fn();

      render(<PositionSelector onPositionChange={onPositionChange} />);

      fireEvent.click(screen.getByTestId('position-button-top'));
      expect(onPositionChange).toHaveBeenCalledWith('top');

      fireEvent.click(screen.getByTestId('position-button-center'));
      expect(onPositionChange).toHaveBeenCalledWith('center');

      fireEvent.click(screen.getByTestId('position-button-bottom'));
      expect(onPositionChange).toHaveBeenCalledWith('bottom');
    });
  });

  describe('keyboard navigation', () => {
    it('supports Enter key to select position', () => {
      const onPositionChange = jest.fn();

      render(<PositionSelector onPositionChange={onPositionChange} />);

      const topButton = screen.getByTestId('position-button-top');
      fireEvent.keyDown(topButton, { key: 'Enter' });

      expect(onPositionChange).toHaveBeenCalledWith('top');
    });

    it('supports Space key to select position', () => {
      const onPositionChange = jest.fn();

      render(<PositionSelector onPositionChange={onPositionChange} />);

      const bottomButton = screen.getByTestId('position-button-bottom');
      fireEvent.keyDown(bottomButton, { key: ' ' });

      expect(onPositionChange).toHaveBeenCalledWith('bottom');
    });

    it('does not select on other keys', () => {
      const onPositionChange = jest.fn();

      render(<PositionSelector onPositionChange={onPositionChange} />);

      const topButton = screen.getByTestId('position-button-top');
      fireEvent.keyDown(topButton, { key: 'a' });

      expect(onPositionChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('disables all buttons when disabled', () => {
      render(<PositionSelector disabled />);

      expect(screen.getByTestId('position-button-top')).toBeDisabled();
      expect(screen.getByTestId('position-button-center')).toBeDisabled();
      expect(screen.getByTestId('position-button-bottom')).toBeDisabled();
    });

    it('does not call onPositionChange when disabled', () => {
      const onPositionChange = jest.fn();

      render(<PositionSelector disabled onPositionChange={onPositionChange} />);

      fireEvent.click(screen.getByTestId('position-button-top'));

      expect(onPositionChange).not.toHaveBeenCalled();
    });

    it('applies disabled styling', () => {
      render(<PositionSelector disabled />);

      expect(screen.getByTestId('position-button-top')).toHaveClass('opacity-50');
    });
  });

  describe('accessibility', () => {
    it('has accessible role group', () => {
      render(<PositionSelector />);
      expect(screen.getByRole('group', { name: /select text position/i })).toBeInTheDocument();
    });

    it('buttons have aria-pressed attribute', () => {
      render(<PositionSelector initialPosition="center" />);

      expect(screen.getByTestId('position-button-center')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('position-button-top')).toHaveAttribute('aria-pressed', 'false');
    });

    it('buttons have accessible labels', () => {
      render(<PositionSelector />);

      expect(screen.getByLabelText(/top: text positioned at top of frame/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/center: text positioned in center of frame/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bottom: text positioned at bottom of frame/i)).toBeInTheDocument();
    });

    it('has screen reader announcement', () => {
      render(<PositionSelector />);
      expect(screen.getByTestId('selection-announcement')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('selected button has blue styling', () => {
      render(<PositionSelector initialPosition="top" />);

      const topButton = screen.getByTestId('position-button-top');
      expect(topButton).toHaveClass('border-blue-500');
      expect(topButton).toHaveClass('text-blue-400');
    });

    it('unselected buttons have gray styling', () => {
      render(<PositionSelector initialPosition="top" />);

      const centerButton = screen.getByTestId('position-button-center');
      expect(centerButton).toHaveClass('border-gray-600');
      expect(centerButton).toHaveClass('text-gray-400');
    });

    it('shows checkmark indicator on selected template', () => {
      render(<PositionSelector initialPosition="center" />);

      const selectedBtn = screen.getByTestId('position-button-center');
      const indicator = selectedBtn.querySelector('[data-testid="selected-indicator"]');
      expect(indicator).toBeInTheDocument();

      // Checkmark SVG should be inside
      const checkmark = indicator?.querySelector('svg');
      expect(checkmark).toBeInTheDocument();
    });

    it('only one position shows checkmark at a time', () => {
      render(<PositionSelector />);

      // Initially center is selected
      let indicators = screen.getAllByTestId('selected-indicator');
      expect(indicators).toHaveLength(1);

      // Select top
      fireEvent.click(screen.getByTestId('position-button-top'));

      indicators = screen.getAllByTestId('selected-indicator');
      expect(indicators).toHaveLength(1);

      const topBtn = screen.getByTestId('position-button-top');
      expect(topBtn.querySelector('[data-testid="selected-indicator"]')).toBeInTheDocument();
    });
  });

  describe('type safety', () => {
    it('only accepts valid position types', () => {
      // TypeScript would catch invalid position types at compile time
      // This test verifies runtime behavior with valid types
      const positions: TextPosition[] = ['top', 'center', 'bottom'];

      positions.forEach(position => {
        const { unmount } = render(<PositionSelector initialPosition={position} />);
        expect(screen.getByTestId(`position-button-${position}`)).toHaveAttribute('data-selected', 'true');
        unmount();
      });
    });
  });
});
