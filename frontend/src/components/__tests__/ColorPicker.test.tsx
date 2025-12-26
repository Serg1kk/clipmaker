/**
 * Test suite for ColorPicker component
 *
 * Tests cover:
 * - Basic rendering
 * - Color preview
 * - Hex input functionality
 * - Preset colors
 * - Disabled state
 * - Accessibility
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ColorPicker from '../ColorPicker';

describe('ColorPicker', () => {
  const defaultProps = {
    value: '#000000',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the color picker', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    });

    it('renders color preview square', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByTestId('color-preview')).toBeInTheDocument();
    });

    it('renders hex input field', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByTestId('color-input')).toBeInTheDocument();
    });

    it('renders preset color palette', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByTestId('color-palette')).toBeInTheDocument();
    });

    it('renders all 8 preset colors', () => {
      render(<ColorPicker {...defaultProps} />);

      expect(screen.getByTestId('color-preset-black')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-white')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-red')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-blue')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-green')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-yellow')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-orange')).toBeInTheDocument();
      expect(screen.getByTestId('color-preset-purple')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ColorPicker {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('color-picker')).toHaveClass('custom-class');
    });
  });

  describe('color preview', () => {
    it('displays current color in preview square', () => {
      render(<ColorPicker {...defaultProps} value="#FF0000" />);
      const preview = screen.getByTestId('color-preview');
      expect(preview).toHaveStyle({ backgroundColor: '#FF0000' });
    });

    it('updates preview when value prop changes', () => {
      const { rerender } = render(<ColorPicker {...defaultProps} value="#FF0000" />);

      rerender(<ColorPicker {...defaultProps} value="#00FF00" />);

      const preview = screen.getByTestId('color-preview');
      expect(preview).toHaveStyle({ backgroundColor: '#00FF00' });
    });
  });

  describe('hex input', () => {
    it('displays current value in input', () => {
      render(<ColorPicker {...defaultProps} value="#FF5500" />);
      expect(screen.getByTestId('color-input')).toHaveValue('#FF5500');
    });

    it('calls onChange with valid hex on input change', () => {
      const onChange = jest.fn();

      render(<ColorPicker value="#000000" onChange={onChange} />);

      const input = screen.getByTestId('color-input');
      fireEvent.change(input, { target: { value: '#FF0000' } });

      expect(onChange).toHaveBeenCalledWith('#FF0000');
    });

    it('converts input to uppercase', () => {
      render(<ColorPicker {...defaultProps} />);

      const input = screen.getByTestId('color-input');
      fireEvent.change(input, { target: { value: '#ff0000' } });

      expect(input).toHaveValue('#FF0000');
    });

    it('auto-prefixes # if missing', () => {
      render(<ColorPicker {...defaultProps} />);

      const input = screen.getByTestId('color-input');
      fireEvent.change(input, { target: { value: 'FF0000' } });

      expect(input).toHaveValue('#FF0000');
    });

    it('shows invalid state for invalid hex', () => {
      render(<ColorPicker {...defaultProps} />);

      const input = screen.getByTestId('color-input');
      fireEvent.change(input, { target: { value: '#XYZ' } });

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('resets to last valid value on blur if invalid', () => {
      render(<ColorPicker {...defaultProps} value="#FF0000" />);

      const input = screen.getByTestId('color-input');
      fireEvent.change(input, { target: { value: '#XYZ' } });
      fireEvent.blur(input);

      expect(input).toHaveValue('#FF0000');
    });
  });

  describe('preset colors', () => {
    it('calls onChange when preset is clicked', () => {
      const onChange = jest.fn();

      render(<ColorPicker value="#000000" onChange={onChange} />);

      fireEvent.click(screen.getByTestId('color-preset-red'));

      expect(onChange).toHaveBeenCalledWith('#EF4444');
    });

    it('highlights selected preset', () => {
      render(<ColorPicker {...defaultProps} value="#EF4444" />);

      const redPreset = screen.getByTestId('color-preset-red');
      expect(redPreset).toHaveAttribute('aria-selected', 'true');
    });

    it('supports keyboard activation with Enter', () => {
      const onChange = jest.fn();

      render(<ColorPicker value="#000000" onChange={onChange} />);

      const bluePreset = screen.getByTestId('color-preset-blue');
      fireEvent.keyDown(bluePreset, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith('#3B82F6');
    });

    it('supports keyboard activation with Space', () => {
      const onChange = jest.fn();

      render(<ColorPicker value="#000000" onChange={onChange} />);

      const greenPreset = screen.getByTestId('color-preset-green');
      fireEvent.keyDown(greenPreset, { key: ' ' });

      expect(onChange).toHaveBeenCalledWith('#22C55E');
    });
  });

  describe('disabled state', () => {
    it('disables input when disabled', () => {
      render(<ColorPicker {...defaultProps} disabled />);
      expect(screen.getByTestId('color-input')).toBeDisabled();
    });

    it('disables preset buttons when disabled', () => {
      render(<ColorPicker {...defaultProps} disabled />);
      expect(screen.getByTestId('color-preset-black')).toBeDisabled();
    });

    it('does not call onChange when disabled', () => {
      const onChange = jest.fn();

      render(<ColorPicker value="#000000" onChange={onChange} disabled />);

      fireEvent.click(screen.getByTestId('color-preset-red'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('applies opacity styling when disabled', () => {
      render(<ColorPicker {...defaultProps} disabled />);
      expect(screen.getByTestId('color-preview')).toHaveClass('opacity-50');
    });
  });

  describe('accessibility', () => {
    it('has accessible role group', () => {
      render(<ColorPicker {...defaultProps} label="Text color" />);
      expect(screen.getByRole('group', { name: /text color/i })).toBeInTheDocument();
    });

    it('has labeled input', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByLabelText(/hex color code/i)).toBeInTheDocument();
    });

    it('has accessible preset palette', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByRole('listbox', { name: /preset colors/i })).toBeInTheDocument();
    });

    it('has screen reader announcement', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByTestId('color-announcement')).toBeInTheDocument();
    });

    it('preset buttons have accessible labels', () => {
      render(<ColorPicker {...defaultProps} />);
      expect(screen.getByLabelText(/black \(#000000\)/i)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles 3-digit hex colors', () => {
      const onChange = jest.fn();

      render(<ColorPicker value="#000000" onChange={onChange} />);

      const input = screen.getByTestId('color-input');
      fireEvent.change(input, { target: { value: '#F00' } });

      // Should normalize to 6-digit
      expect(onChange).toHaveBeenCalledWith('#FF0000');
    });

    it('handles empty value', () => {
      render(<ColorPicker {...defaultProps} value="" />);
      expect(screen.getByTestId('color-input')).toHaveValue('');
    });
  });
});
