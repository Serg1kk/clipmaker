import {
  getTemplateConfig,
  getRectangleColor,
  RECTANGLE_COLORS
} from '../types';

describe('getTemplateConfig', () => {
  describe('1-frame template', () => {
    it('returns count of 1', () => {
      const config = getTemplateConfig('1-frame');
      expect(config.count).toBe(1);
    });

    it('returns 1 default position', () => {
      const config = getTemplateConfig('1-frame');
      expect(config.defaultPositions).toHaveLength(1);
    });

    it('returns position with normalized values', () => {
      const config = getTemplateConfig('1-frame');
      const pos = config.defaultPositions[0];

      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(1);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(1);
      expect(pos.width).toBeGreaterThan(0);
      expect(pos.width).toBeLessThanOrEqual(1);
      expect(pos.height).toBeGreaterThan(0);
      expect(pos.height).toBeLessThanOrEqual(1);
    });

    it('returns small centered 9:16 vertical rectangle', () => {
      const config = getTemplateConfig('1-frame');
      const pos = config.defaultPositions[0];

      // Should be a small crop area (~25% width) that user can drag
      expect(pos.width).toBeGreaterThanOrEqual(0.2);
      expect(pos.width).toBeLessThanOrEqual(0.35);
      // Should have 9:16 vertical aspect ratio (0.5625)
      expect(pos.aspectRatio).toBeCloseTo(9 / 16, 2);
      // Should be horizontally centered
      expect(pos.x).toBeCloseTo((1 - pos.width) / 2, 1);
    });
  });

  describe('2-frame template', () => {
    it('returns count of 2', () => {
      const config = getTemplateConfig('2-frame');
      expect(config.count).toBe(2);
    });

    it('returns 2 default positions', () => {
      const config = getTemplateConfig('2-frame');
      expect(config.defaultPositions).toHaveLength(2);
    });

    it('positions rectangles side by side', () => {
      const config = getTemplateConfig('2-frame');
      const [left, right] = config.defaultPositions;

      // Left rectangle should be on the left
      expect(left.x).toBeLessThan(0.5);
      // Right rectangle should be on the right
      expect(right.x).toBeGreaterThanOrEqual(0.5);
    });

    it('positions do not overlap', () => {
      const config = getTemplateConfig('2-frame');
      const [left, right] = config.defaultPositions;

      // Left rectangle right edge should be before right rectangle left edge
      expect(left.x + left.width).toBeLessThanOrEqual(right.x);
    });

    it('frames have 9:8 aspect ratio and small size', () => {
      const config = getTemplateConfig('2-frame');
      const [left, right] = config.defaultPositions;

      // Should be small crop areas (~20% width) that user can drag
      expect(left.width).toBeGreaterThanOrEqual(0.15);
      expect(left.width).toBeLessThanOrEqual(0.25);
      expect(right.width).toBeGreaterThanOrEqual(0.15);
      expect(right.width).toBeLessThanOrEqual(0.25);
      // Should have 9:8 aspect ratio (1.125)
      expect(left.aspectRatio).toBeCloseTo(9 / 8, 2);
      expect(right.aspectRatio).toBeCloseTo(9 / 8, 2);
      // Frame 1 at ~15% from left, Frame 2 at ~65% from left
      expect(left.x).toBeCloseTo(0.15, 1);
      expect(right.x).toBeCloseTo(0.65, 1);
    });
  });

  describe('3-frame template', () => {
    it('returns count of 3', () => {
      const config = getTemplateConfig('3-frame');
      expect(config.count).toBe(3);
    });

    it('returns 3 default positions', () => {
      const config = getTemplateConfig('3-frame');
      expect(config.defaultPositions).toHaveLength(3);
    });

    it('positions top speakers left and right, screen below', () => {
      const config = getTemplateConfig('3-frame');
      const [topLeft, topRight, bottom] = config.defaultPositions;

      // Top-left speaker is on the left
      expect(topLeft.x).toBeLessThan(topRight.x);
      // Bottom screen is horizontally centered
      expect(bottom.x).toBeGreaterThan(0);
      expect(bottom.x + bottom.width).toBeLessThan(1);
    });

    it('positions do not overlap', () => {
      const config = getTemplateConfig('3-frame');
      const [topLeft, topRight, bottom] = config.defaultPositions;

      // Top frames don't overlap horizontally
      expect(topLeft.x + topLeft.width).toBeLessThanOrEqual(topRight.x);
      // Bottom frame is below top frames (no vertical overlap)
      expect(topLeft.y + topLeft.height).toBeLessThanOrEqual(bottom.y);
      expect(topRight.y + topRight.height).toBeLessThanOrEqual(bottom.y);
    });

    it('top speaker frames have same height, bottom frame is larger', () => {
      const config = getTemplateConfig('3-frame');
      const [topLeft, topRight, bottom] = config.defaultPositions;

      // Top frames have same height (speakers)
      expect(topLeft.height).toBe(topRight.height);
      // Bottom frame is larger (screen/presentation)
      expect(bottom.width).toBeGreaterThan(topLeft.width);
    });

    it('frames have correct aspect ratios and small sizes', () => {
      const config = getTemplateConfig('3-frame');
      const [topLeft, topRight, bottom] = config.defaultPositions;

      // Speaker frames should be small (~15% width) and square (1:1)
      expect(topLeft.width).toBeGreaterThanOrEqual(0.12);
      expect(topLeft.width).toBeLessThanOrEqual(0.20);
      expect(topLeft.aspectRatio).toBeCloseTo(1, 1);
      expect(topRight.aspectRatio).toBeCloseTo(1, 1);
      // Screen frame should be wider (~30% width) and 16:9
      expect(bottom.width).toBeGreaterThanOrEqual(0.25);
      expect(bottom.width).toBeLessThanOrEqual(0.35);
      expect(bottom.aspectRatio).toBeCloseTo(16 / 9, 2);
    });
  });

  describe('invalid template', () => {
    it('defaults to 1-frame config for unknown template', () => {
      // @ts-expect-error - Testing invalid input
      const config = getTemplateConfig('invalid');
      expect(config.count).toBe(1);
      expect(config.defaultPositions).toHaveLength(1);
    });
  });
});

describe('getRectangleColor', () => {
  it('returns blue for index 0', () => {
    expect(getRectangleColor(0)).toBe('blue');
  });

  it('returns green for index 1', () => {
    expect(getRectangleColor(1)).toBe('green');
  });

  it('returns purple for index 2', () => {
    expect(getRectangleColor(2)).toBe('purple');
  });

  it('cycles colors for indices > 2', () => {
    expect(getRectangleColor(3)).toBe('blue');
    expect(getRectangleColor(4)).toBe('green');
    expect(getRectangleColor(5)).toBe('purple');
  });
});

describe('RECTANGLE_COLORS', () => {
  it('has blue color theme', () => {
    expect(RECTANGLE_COLORS.blue).toBeDefined();
    expect(RECTANGLE_COLORS.blue.border).toContain('blue');
    expect(RECTANGLE_COLORS.blue.bg).toContain('blue');
    expect(RECTANGLE_COLORS.blue.handle).toContain('blue');
  });

  it('has green color theme', () => {
    expect(RECTANGLE_COLORS.green).toBeDefined();
    expect(RECTANGLE_COLORS.green.border).toContain('green');
    expect(RECTANGLE_COLORS.green.bg).toContain('green');
    expect(RECTANGLE_COLORS.green.handle).toContain('green');
  });

  it('has purple color theme', () => {
    expect(RECTANGLE_COLORS.purple).toBeDefined();
    expect(RECTANGLE_COLORS.purple.border).toContain('purple');
    expect(RECTANGLE_COLORS.purple.bg).toContain('purple');
    expect(RECTANGLE_COLORS.purple.handle).toContain('purple');
  });

  it('all themes have required properties', () => {
    Object.values(RECTANGLE_COLORS).forEach(theme => {
      expect(theme).toHaveProperty('border');
      expect(theme).toHaveProperty('bg');
      expect(theme).toHaveProperty('handle');
    });
  });
});
