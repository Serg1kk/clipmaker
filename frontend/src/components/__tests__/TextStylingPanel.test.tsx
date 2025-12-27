/**
 * Test suite for TextStylingPanel component
 *
 * Tests cover:
 * - Basic rendering
 * - Default values
 * - Font family dropdown
 * - Font size slider
 * - Color picker integration
 * - Position selector integration
 * - Preview functionality
 * - Disabled state
 * - Accessibility
 * - onStyleChange callback
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TextStylingPanel, {
  TextStyle,
  DEFAULT_TEXT_STYLE,
  FONT_OPTIONS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from '../TextStylingPanel';

describe('TextStylingPanel', () => {
  describe('rendering', () => {
    it('renders the text styling panel', () => {
      render(<TextStylingPanel />);
      expect(screen.getByTestId('text-styling-panel')).toBeInTheDocument();
    });

    it('renders all control sections', () => {
      render(<TextStylingPanel />);

      // Subtitles enabled toggle
      expect(screen.getByTestId('subtitles-enabled-toggle')).toBeInTheDocument();
      expect(screen.getByText('Enable Subtitles')).toBeInTheDocument();

      // Font family dropdown
      expect(screen.getByTestId('font-family-select')).toBeInTheDocument();
      expect(screen.getByLabelText('Font Family')).toBeInTheDocument();

      // Font size slider
      expect(screen.getByTestId('font-size-slider')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-value')).toBeInTheDocument();

      // Color picker
      expect(screen.getByTestId('color-picker')).toBeInTheDocument();

      // Position selector
      expect(screen.getByTestId('position-selector')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<TextStylingPanel className="custom-class" />);
      expect(screen.getByTestId('text-styling-panel')).toHaveClass('custom-class');
    });
  });

  describe('default values', () => {
    it('uses default style values when no initial style provided', () => {
      render(<TextStylingPanel />);

      // Subtitles enabled default
      expect(screen.getByTestId('subtitles-enabled-toggle')).toHaveAttribute('aria-checked', 'true');

      // Font family default
      expect(screen.getByTestId('font-family-select')).toHaveValue(DEFAULT_TEXT_STYLE.fontFamily);

      // Font size default
      expect(screen.getByTestId('font-size-value')).toHaveTextContent(`${DEFAULT_TEXT_STYLE.fontSize}px`);
      expect(screen.getByTestId('font-size-slider')).toHaveValue(String(DEFAULT_TEXT_STYLE.fontSize));

      // Position default (center is default)
      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'true');
    });

    it('uses initial style values when provided', () => {
      const initialStyle: Partial<TextStyle> = {
        fontFamily: 'Georgia',
        fontSize: 36,
        textColor: '#FF0000',
        position: 'top',
      };

      render(<TextStylingPanel initialStyle={initialStyle} />);

      expect(screen.getByTestId('font-family-select')).toHaveValue('Georgia');
      expect(screen.getByTestId('font-size-value')).toHaveTextContent('36px');
      expect(screen.getByTestId('position-button-top')).toHaveAttribute('data-selected', 'true');
    });

    it('merges partial initial style with defaults', () => {
      const initialStyle: Partial<TextStyle> = {
        fontSize: 48,
      };

      render(<TextStylingPanel initialStyle={initialStyle} />);

      // Custom value
      expect(screen.getByTestId('font-size-value')).toHaveTextContent('48px');

      // Default values for other properties
      expect(screen.getByTestId('font-family-select')).toHaveValue(DEFAULT_TEXT_STYLE.fontFamily);
      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('font family dropdown', () => {
    it('renders all font options', () => {
      render(<TextStylingPanel />);
      const select = screen.getByTestId('font-family-select');

      FONT_OPTIONS.forEach((font) => {
        expect(select).toContainHTML(font.label);
      });
    });

    it('calls onStyleChange when font family changes', () => {
      const onStyleChange = jest.fn();

      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      const select = screen.getByTestId('font-family-select');
      fireEvent.change(select, { target: { value: 'Georgia' } });

      expect(onStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({ fontFamily: 'Georgia' })
      );
    });

    it('updates font family display value', () => {
      render(<TextStylingPanel />);

      const select = screen.getByTestId('font-family-select');
      fireEvent.change(select, { target: { value: 'Impact' } });

      expect(select).toHaveValue('Impact');
    });
  });

  describe('font size slider', () => {
    it('displays current font size value', () => {
      render(<TextStylingPanel initialStyle={{ fontSize: 32 }} />);
      expect(screen.getByTestId('font-size-value')).toHaveTextContent('32px');
    });

    it('has correct min and max values', () => {
      render(<TextStylingPanel />);
      const slider = screen.getByTestId('font-size-slider');

      expect(slider).toHaveAttribute('min', String(FONT_SIZE_MIN));
      expect(slider).toHaveAttribute('max', String(FONT_SIZE_MAX));
    });

    it('calls onStyleChange when font size changes', () => {
      const onStyleChange = jest.fn();
      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      const slider = screen.getByTestId('font-size-slider');
      fireEvent.change(slider, { target: { value: '48' } });

      expect(onStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({ fontSize: 48 })
      );
    });

    it('updates font size display value on change', () => {
      render(<TextStylingPanel />);

      const slider = screen.getByTestId('font-size-slider');
      fireEvent.change(slider, { target: { value: '56' } });

      expect(screen.getByTestId('font-size-value')).toHaveTextContent('56px');
    });

    it('has proper ARIA attributes', () => {
      render(<TextStylingPanel initialStyle={{ fontSize: 28 }} />);
      const slider = screen.getByTestId('font-size-slider');

      expect(slider).toHaveAttribute('aria-valuenow', '28');
      expect(slider).toHaveAttribute('aria-valuemin', String(FONT_SIZE_MIN));
      expect(slider).toHaveAttribute('aria-valuemax', String(FONT_SIZE_MAX));
    });
  });

  describe('color picker', () => {
    it('renders color picker component', () => {
      render(<TextStylingPanel />);
      expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    });

    it('displays initial color value', () => {
      render(<TextStylingPanel initialStyle={{ textColor: '#FF5500' }} />);
      const colorInput = screen.getByTestId('color-input');
      expect(colorInput).toHaveValue('#FF5500');
    });

    it('calls onStyleChange when color changes via preset', () => {
      const onStyleChange = jest.fn();

      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      const redPreset = screen.getByTestId('color-preset-red');
      fireEvent.click(redPreset);

      expect(onStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({ textColor: '#EF4444' })
      );
    });
  });

  describe('subtitles enabled toggle', () => {
    it('renders the toggle switch', () => {
      render(<TextStylingPanel />);
      expect(screen.getByTestId('subtitles-enabled-toggle')).toBeInTheDocument();
    });

    it('is enabled by default', () => {
      render(<TextStylingPanel />);
      const toggle = screen.getByTestId('subtitles-enabled-toggle');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('respects initial subtitlesEnabled value', () => {
      render(<TextStylingPanel initialStyle={{ subtitlesEnabled: false }} />);
      const toggle = screen.getByTestId('subtitles-enabled-toggle');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('calls onStyleChange when toggle is clicked', () => {
      const onStyleChange = jest.fn();
      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      const toggle = screen.getByTestId('subtitles-enabled-toggle');
      fireEvent.click(toggle);

      expect(onStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({ subtitlesEnabled: false })
      );
    });

    it('toggles state when clicked', () => {
      render(<TextStylingPanel />);
      const toggle = screen.getByTestId('subtitles-enabled-toggle');

      // Initially enabled
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Click to disable
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      // Click to enable again
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('is disabled when panel is disabled', () => {
      render(<TextStylingPanel disabled />);
      const toggle = screen.getByTestId('subtitles-enabled-toggle');
      expect(toggle).toBeDisabled();
    });

    it('does not call onStyleChange when disabled and clicked', () => {
      const onStyleChange = jest.fn();
      render(<TextStylingPanel disabled onStyleChange={onStyleChange} />);

      const toggle = screen.getByTestId('subtitles-enabled-toggle');
      fireEvent.click(toggle);

      expect(onStyleChange).not.toHaveBeenCalled();
    });
  });

  describe('position selector', () => {
    it('renders all position buttons', () => {
      render(<TextStylingPanel />);

      expect(screen.getByTestId('position-button-top')).toBeInTheDocument();
      expect(screen.getByTestId('position-button-center')).toBeInTheDocument();
      expect(screen.getByTestId('position-button-bottom')).toBeInTheDocument();
    });

    it('shows initial position as selected', () => {
      render(<TextStylingPanel initialStyle={{ position: 'center' }} />);

      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('position-button-top')).toHaveAttribute('data-selected', 'false');
      expect(screen.getByTestId('position-button-bottom')).toHaveAttribute('data-selected', 'false');
    });

    it('calls onStyleChange when position changes', () => {
      const onStyleChange = jest.fn();

      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      fireEvent.click(screen.getByTestId('position-button-top'));

      expect(onStyleChange).toHaveBeenCalledWith(
        expect.objectContaining({ position: 'top' })
      );
    });

    it('updates selected position on click', () => {
      render(<TextStylingPanel />);

      fireEvent.click(screen.getByTestId('position-button-center'));

      expect(screen.getByTestId('position-button-center')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('position-button-bottom')).toHaveAttribute('data-selected', 'false');
    });
  });

  // Note: Preview section was removed - subtitles now preview on main 9:16 PreviewLayout

  describe('disabled state', () => {
    it('disables font family dropdown when disabled', () => {
      render(<TextStylingPanel disabled />);
      expect(screen.getByTestId('font-family-select')).toBeDisabled();
    });

    it('disables font size slider when disabled', () => {
      render(<TextStylingPanel disabled />);
      expect(screen.getByTestId('font-size-slider')).toBeDisabled();
    });

    it('disables color input when disabled', () => {
      render(<TextStylingPanel disabled />);
      expect(screen.getByTestId('color-input')).toBeDisabled();
    });

    it('disables color presets when disabled', () => {
      render(<TextStylingPanel disabled />);
      expect(screen.getByTestId('color-preset-black')).toBeDisabled();
    });

    it('disables position buttons when disabled', () => {
      render(<TextStylingPanel disabled />);
      expect(screen.getByTestId('position-button-top')).toBeDisabled();
      expect(screen.getByTestId('position-button-center')).toBeDisabled();
      expect(screen.getByTestId('position-button-bottom')).toBeDisabled();
    });

    it('does not call onStyleChange when disabled and clicking position', () => {
      const onStyleChange = jest.fn();

      render(<TextStylingPanel disabled onStyleChange={onStyleChange} />);

      fireEvent.click(screen.getByTestId('position-button-top'));

      expect(onStyleChange).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has accessible role group', () => {
      render(<TextStylingPanel />);
      expect(screen.getByRole('group', { name: /text styling controls/i })).toBeInTheDocument();
    });

    it('has labeled font family select', () => {
      render(<TextStylingPanel />);
      expect(screen.getByLabelText(/font family/i)).toBeInTheDocument();
    });

    it('has labeled font size slider', () => {
      render(<TextStylingPanel />);
      expect(screen.getByLabelText(/font size slider/i)).toBeInTheDocument();
    });

    it('has screen reader announcement for style changes', () => {
      render(<TextStylingPanel />);
      expect(screen.getByTestId('style-announcement')).toBeInTheDocument();
    });
  });

  describe('onStyleChange callback', () => {
    it('receives complete style object on any change', () => {
      const onStyleChange = jest.fn();

      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      fireEvent.change(screen.getByTestId('font-family-select'), { target: { value: 'Georgia' } });

      expect(onStyleChange).toHaveBeenCalledWith({
        subtitlesEnabled: DEFAULT_TEXT_STYLE.subtitlesEnabled,
        fontFamily: 'Georgia',
        fontSize: DEFAULT_TEXT_STYLE.fontSize,
        textColor: DEFAULT_TEXT_STYLE.textColor,
        position: DEFAULT_TEXT_STYLE.position,
      });
    });

    it('calls onStyleChange with updated values after multiple changes', () => {
      const onStyleChange = jest.fn();

      render(<TextStylingPanel onStyleChange={onStyleChange} />);

      // Change font family
      fireEvent.change(screen.getByTestId('font-family-select'), { target: { value: 'Impact' } });

      // Change font size
      fireEvent.change(screen.getByTestId('font-size-slider'), { target: { value: '36' } });

      // Change position
      fireEvent.click(screen.getByTestId('position-button-top'));

      // Last call should have all updated values
      const calls = onStyleChange.mock.calls;
      const lastCall = calls[calls.length - 1][0] as TextStyle;
      expect(lastCall.fontFamily).toBe('Impact');
      expect(lastCall.fontSize).toBe(36);
      expect(lastCall.position).toBe('top');
    });
  });
});
