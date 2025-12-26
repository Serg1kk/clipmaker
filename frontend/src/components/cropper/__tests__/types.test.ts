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

    it('returns centered large rectangle', () => {
      const config = getTemplateConfig('1-frame');
      const pos = config.defaultPositions[0];

      // Should take up most of the frame
      expect(pos.width).toBeGreaterThanOrEqual(0.7);
      expect(pos.height).toBeGreaterThanOrEqual(0.7);
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

    it('positions rectangles in order left to right', () => {
      const config = getTemplateConfig('3-frame');
      const [first, second, third] = config.defaultPositions;

      expect(first.x).toBeLessThan(second.x);
      expect(second.x).toBeLessThan(third.x);
    });

    it('positions do not overlap', () => {
      const config = getTemplateConfig('3-frame');
      const [first, second, third] = config.defaultPositions;

      expect(first.x + first.width).toBeLessThanOrEqual(second.x);
      expect(second.x + second.width).toBeLessThanOrEqual(third.x);
    });

    it('all positions have same height', () => {
      const config = getTemplateConfig('3-frame');
      const heights = config.defaultPositions.map(p => p.height);

      expect(heights[0]).toBe(heights[1]);
      expect(heights[1]).toBe(heights[2]);
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
