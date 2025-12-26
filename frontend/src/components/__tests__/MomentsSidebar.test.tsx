/**
 * Test suite for MomentsSidebar component
 *
 * Tests cover:
 * - Empty state rendering
 * - Moments list rendering with correct time formatting
 * - AI reason (description) display
 * - Moment click callback
 * - Moment delete callback
 * - Selected moment highlighting
 * - Correct moment count display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MomentsSidebar, { type MomentsSidebarProps } from '../MomentsSidebar';
import { type TimelineMarker } from '../timeline/types';

// ============================================================================
// Mock Data
// ============================================================================

const mockMarkers: TimelineMarker[] = [
  {
    id: 'test-1',
    startTime: 10,
    endTime: 25,
    duration: 15,
    label: 'Moment 1',
    description: 'Great hook',
    confidence: 0.9,
    type: 'ai_detected',
  },
  {
    id: 'test-2',
    startTime: 60,
    endTime: 90,
    duration: 30,
    label: 'Moment 2',
    description: 'Key insight',
    confidence: 0.85,
    type: 'ai_detected',
  },
];

const mockMarkersWithLongTimes: TimelineMarker[] = [
  {
    id: 'test-3',
    startTime: 3661, // 1:01:01
    endTime: 3720,   // 1:02:00
    duration: 59,
    label: 'Long Moment',
    description: 'Over an hour',
    confidence: 0.95,
    type: 'ai_detected',
  },
];

// ============================================================================
// Test Utilities
// ============================================================================

function renderMomentsSidebar(props: Partial<MomentsSidebarProps> = {}) {
  const defaultProps: MomentsSidebarProps = {
    moments: [],
    onMomentClick: vi.fn(),
    onMomentDelete: vi.fn(),
    ...props,
  };
  return render(<MomentsSidebar {...defaultProps} />);
}

function getMomentItems(): HTMLElement[] {
  return screen.queryAllByTestId(/^moment-item-/);
}

function getMomentItem(id: string): HTMLElement {
  return screen.getByTestId(`moment-item-${id}`);
}

function getDeleteButton(momentElement: HTMLElement): HTMLElement {
  return within(momentElement).getByTestId('moment-delete-button');
}

// ============================================================================
// Test Suite: Empty State
// ============================================================================

describe('MomentsSidebar - Empty State', () => {
  it('renders empty state message when no moments provided', () => {
    renderMomentsSidebar({ moments: [] });

    expect(screen.getByTestId('moments-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no moments/i)).toBeInTheDocument();
  });

  it('displays helpful empty state text', () => {
    renderMomentsSidebar({ moments: [] });

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toHaveTextContent(/no moments/i);
  });

  it('does not render moment list when empty', () => {
    renderMomentsSidebar({ moments: [] });

    expect(screen.queryByTestId('moments-list')).not.toBeInTheDocument();
    expect(getMomentItems()).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: Moments List Rendering
// ============================================================================

describe('MomentsSidebar - Moments List Rendering', () => {
  it('renders list of moments when provided', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    expect(screen.getByTestId('moments-list')).toBeInTheDocument();
    expect(getMomentItems()).toHaveLength(2);
  });

  it('renders each moment with correct label', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    expect(screen.getByText('Moment 1')).toBeInTheDocument();
    expect(screen.getByText('Moment 2')).toBeInTheDocument();
  });

  it('renders moments with unique test IDs based on moment id', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    expect(screen.getByTestId('moment-item-test-1')).toBeInTheDocument();
    expect(screen.getByTestId('moment-item-test-2')).toBeInTheDocument();
  });

  it('does not show empty state when moments exist', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Test Suite: Time Formatting
// ============================================================================

describe('MomentsSidebar - Time Formatting', () => {
  it('displays start time in MM:SS format for times under 1 hour', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    expect(moment1).toHaveTextContent('0:10');

    const moment2 = getMomentItem('test-2');
    expect(moment2).toHaveTextContent('1:00');
  });

  it('displays end time in correct format', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    expect(moment1).toHaveTextContent('0:25');

    const moment2 = getMomentItem('test-2');
    expect(moment2).toHaveTextContent('1:30');
  });

  it('displays time range as "start - end" format', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    const timeDisplay = within(moment1).getByTestId('moment-time');
    expect(timeDisplay).toHaveTextContent('0:10 - 0:25');
  });

  it('formats times over 1 hour as HH:MM:SS', () => {
    renderMomentsSidebar({ moments: mockMarkersWithLongTimes });

    const moment = getMomentItem('test-3');
    expect(moment).toHaveTextContent('1:01:01');
    expect(moment).toHaveTextContent('1:02:00');
  });

  it('displays duration for each moment', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    const durationDisplay = within(moment1).getByTestId('moment-duration');
    expect(durationDisplay).toHaveTextContent('15s');
  });
});

// ============================================================================
// Test Suite: AI Reason (Description) Display
// ============================================================================

describe('MomentsSidebar - AI Reason Display', () => {
  it('displays description for each moment', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    expect(screen.getByText('Great hook')).toBeInTheDocument();
    expect(screen.getByText('Key insight')).toBeInTheDocument();
  });

  it('description is within the correct moment item', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    const description = within(moment1).getByTestId('moment-description');
    expect(description).toHaveTextContent('Great hook');

    const moment2 = getMomentItem('test-2');
    const description2 = within(moment2).getByTestId('moment-description');
    expect(description2).toHaveTextContent('Key insight');
  });

  it('handles moments without description gracefully', () => {
    const momentsWithoutDescription: TimelineMarker[] = [
      {
        id: 'no-desc',
        startTime: 5,
        endTime: 10,
        duration: 5,
        label: 'No Description',
        type: 'ai_detected',
      },
    ];

    renderMomentsSidebar({ moments: momentsWithoutDescription });

    const moment = getMomentItem('no-desc');
    expect(moment).toBeInTheDocument();
    // Description element should either be absent or empty
    const descElement = within(moment).queryByTestId('moment-description');
    if (descElement) {
      expect(descElement).toBeEmptyDOMElement();
    }
  });

  it('displays confidence score when provided', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    const confidence = within(moment1).getByTestId('moment-confidence');
    expect(confidence).toHaveTextContent('90%');
  });
});

// ============================================================================
// Test Suite: Moment Click Callback
// ============================================================================

describe('MomentsSidebar - Moment Click', () => {
  it('calls onMomentClick when moment is clicked', () => {
    const onMomentClick = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentClick });

    const moment1 = getMomentItem('test-1');
    fireEvent.click(moment1);

    expect(onMomentClick).toHaveBeenCalledTimes(1);
    expect(onMomentClick).toHaveBeenCalledWith(mockMarkers[0]);
  });

  it('calls onMomentClick with correct marker data', () => {
    const onMomentClick = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentClick });

    const moment2 = getMomentItem('test-2');
    fireEvent.click(moment2);

    expect(onMomentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-2',
        startTime: 60,
        endTime: 90,
        description: 'Key insight',
      })
    );
  });

  it('each moment can be clicked independently', () => {
    const onMomentClick = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentClick });

    fireEvent.click(getMomentItem('test-1'));
    fireEvent.click(getMomentItem('test-2'));

    expect(onMomentClick).toHaveBeenCalledTimes(2);
    expect(onMomentClick).toHaveBeenNthCalledWith(1, mockMarkers[0]);
    expect(onMomentClick).toHaveBeenNthCalledWith(2, mockMarkers[1]);
  });

  it('moment item is clickable with proper cursor style', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment = getMomentItem('test-1');
    expect(moment).toHaveStyle({ cursor: 'pointer' });
  });

  it('moment has proper accessibility role', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment = getMomentItem('test-1');
    expect(moment).toHaveAttribute('role', 'button');
  });
});

// ============================================================================
// Test Suite: Moment Delete Callback
// ============================================================================

describe('MomentsSidebar - Moment Delete', () => {
  it('renders delete button for each moment', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    const moment2 = getMomentItem('test-2');

    expect(getDeleteButton(moment1)).toBeInTheDocument();
    expect(getDeleteButton(moment2)).toBeInTheDocument();
  });

  it('calls onMomentDelete when delete button is clicked', () => {
    const onMomentDelete = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentDelete });

    const moment1 = getMomentItem('test-1');
    const deleteBtn = getDeleteButton(moment1);

    fireEvent.click(deleteBtn);

    expect(onMomentDelete).toHaveBeenCalledTimes(1);
    expect(onMomentDelete).toHaveBeenCalledWith('test-1');
  });

  it('delete button click does not trigger moment click', () => {
    const onMomentClick = vi.fn();
    const onMomentDelete = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentClick, onMomentDelete });

    const moment1 = getMomentItem('test-1');
    const deleteBtn = getDeleteButton(moment1);

    fireEvent.click(deleteBtn);

    expect(onMomentDelete).toHaveBeenCalledTimes(1);
    expect(onMomentClick).not.toHaveBeenCalled();
  });

  it('delete button has accessible label', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const moment1 = getMomentItem('test-1');
    const deleteBtn = getDeleteButton(moment1);

    expect(deleteBtn).toHaveAttribute('aria-label', expect.stringContaining('delete'));
  });

  it('can delete different moments independently', () => {
    const onMomentDelete = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentDelete });

    const deleteBtn1 = getDeleteButton(getMomentItem('test-1'));
    const deleteBtn2 = getDeleteButton(getMomentItem('test-2'));

    fireEvent.click(deleteBtn2);
    fireEvent.click(deleteBtn1);

    expect(onMomentDelete).toHaveBeenNthCalledWith(1, 'test-2');
    expect(onMomentDelete).toHaveBeenNthCalledWith(2, 'test-1');
  });
});

// ============================================================================
// Test Suite: Selected Moment Highlighting
// ============================================================================

describe('MomentsSidebar - Selected Moment', () => {
  it('highlights selected moment with visual indicator', () => {
    renderMomentsSidebar({
      moments: mockMarkers,
      selectedMomentId: 'test-1',
    });

    const moment1 = getMomentItem('test-1');
    const moment2 = getMomentItem('test-2');

    expect(moment1).toHaveAttribute('data-selected', 'true');
    expect(moment2).toHaveAttribute('data-selected', 'false');
  });

  it('applies selected CSS class to selected moment', () => {
    renderMomentsSidebar({
      moments: mockMarkers,
      selectedMomentId: 'test-2',
    });

    const moment2 = getMomentItem('test-2');
    expect(moment2).toHaveClass('selected');
  });

  it('no moment is highlighted when selectedMomentId is undefined', () => {
    renderMomentsSidebar({
      moments: mockMarkers,
      selectedMomentId: undefined,
    });

    const moment1 = getMomentItem('test-1');
    const moment2 = getMomentItem('test-2');

    expect(moment1).toHaveAttribute('data-selected', 'false');
    expect(moment2).toHaveAttribute('data-selected', 'false');
  });

  it('no moment is highlighted when selectedMomentId is null', () => {
    renderMomentsSidebar({
      moments: mockMarkers,
      selectedMomentId: null,
    });

    const moment1 = getMomentItem('test-1');
    const moment2 = getMomentItem('test-2');

    expect(moment1).not.toHaveClass('selected');
    expect(moment2).not.toHaveClass('selected');
  });

  it('has aria-current on selected moment', () => {
    renderMomentsSidebar({
      moments: mockMarkers,
      selectedMomentId: 'test-1',
    });

    const moment1 = getMomentItem('test-1');
    expect(moment1).toHaveAttribute('aria-current', 'true');
  });
});

// ============================================================================
// Test Suite: Moment Count Display
// ============================================================================

describe('MomentsSidebar - Moment Count', () => {
  it('displays correct number of moments in header', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const header = screen.getByTestId('moments-header');
    expect(header).toHaveTextContent('2');
  });

  it('shows singular "moment" for single item', () => {
    renderMomentsSidebar({ moments: [mockMarkers[0]] });

    const header = screen.getByTestId('moments-header');
    expect(header).toHaveTextContent('1 moment');
  });

  it('shows plural "moments" for multiple items', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const header = screen.getByTestId('moments-header');
    expect(header).toHaveTextContent('2 moments');
  });

  it('shows 0 moments count when empty', () => {
    renderMomentsSidebar({ moments: [] });

    const header = screen.getByTestId('moments-header');
    expect(header).toHaveTextContent('0 moments');
  });

  it('updates count dynamically with prop changes', () => {
    const { rerender } = render(
      <MomentsSidebar
        moments={mockMarkers}
        onMomentClick={vi.fn()}
        onMomentDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('moments-header')).toHaveTextContent('2 moments');

    rerender(
      <MomentsSidebar
        moments={[mockMarkers[0]]}
        onMomentClick={vi.fn()}
        onMomentDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('moments-header')).toHaveTextContent('1 moment');
  });
});

// ============================================================================
// Test Suite: Accessibility
// ============================================================================

describe('MomentsSidebar - Accessibility', () => {
  it('sidebar has proper role and label', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const sidebar = screen.getByTestId('moments-sidebar');
    expect(sidebar).toHaveAttribute('role', 'region');
    expect(sidebar).toHaveAttribute('aria-label', expect.stringContaining('moment'));
  });

  it('moments list has proper list role', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const list = screen.getByTestId('moments-list');
    expect(list).toHaveAttribute('role', 'list');
  });

  it('each moment item has listitem role', () => {
    renderMomentsSidebar({ moments: mockMarkers });

    const items = getMomentItems();
    items.forEach(item => {
      expect(item).toHaveAttribute('role', 'button');
    });
  });

  it('delete buttons are keyboard accessible', () => {
    const onMomentDelete = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentDelete });

    const deleteBtn = getDeleteButton(getMomentItem('test-1'));

    deleteBtn.focus();
    fireEvent.keyDown(deleteBtn, { key: 'Enter' });

    expect(onMomentDelete).toHaveBeenCalled();
  });

  it('moments are keyboard accessible', () => {
    const onMomentClick = vi.fn();
    renderMomentsSidebar({ moments: mockMarkers, onMomentClick });

    const moment = getMomentItem('test-1');

    moment.focus();
    fireEvent.keyDown(moment, { key: 'Enter' });

    expect(onMomentClick).toHaveBeenCalled();
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('MomentsSidebar - Edge Cases', () => {
  it('handles single moment correctly', () => {
    renderMomentsSidebar({ moments: [mockMarkers[0]] });

    expect(getMomentItems()).toHaveLength(1);
    expect(screen.getByTestId('moment-item-test-1')).toBeInTheDocument();
  });

  it('handles many moments without issues', () => {
    const manyMoments: TimelineMarker[] = Array.from({ length: 50 }, (_, i) => ({
      id: `test-${i}`,
      startTime: i * 10,
      endTime: i * 10 + 5,
      duration: 5,
      label: `Moment ${i + 1}`,
      description: `Description ${i + 1}`,
      confidence: 0.8,
      type: 'ai_detected' as const,
    }));

    renderMomentsSidebar({ moments: manyMoments });

    expect(getMomentItems()).toHaveLength(50);
    expect(screen.getByTestId('moments-header')).toHaveTextContent('50 moments');
  });

  it('handles moment with zero duration', () => {
    const zeroLengthMoment: TimelineMarker[] = [
      {
        id: 'zero',
        startTime: 10,
        endTime: 10,
        duration: 0,
        label: 'Zero Duration',
        type: 'ai_detected',
      },
    ];

    renderMomentsSidebar({ moments: zeroLengthMoment });

    const moment = getMomentItem('zero');
    expect(moment).toBeInTheDocument();
    const durationDisplay = within(moment).getByTestId('moment-duration');
    expect(durationDisplay).toHaveTextContent('0s');
  });

  it('applies custom className when provided', () => {
    renderMomentsSidebar({ moments: mockMarkers, className: 'custom-class' });

    const sidebar = screen.getByTestId('moments-sidebar');
    expect(sidebar).toHaveClass('custom-class');
  });

  it('handles moments with special characters in description', () => {
    const specialMoment: TimelineMarker[] = [
      {
        id: 'special',
        startTime: 0,
        endTime: 5,
        duration: 5,
        label: 'Special',
        description: '<script>alert("XSS")</script> & "quotes" \'apostrophes\'',
        type: 'ai_detected',
      },
    ];

    renderMomentsSidebar({ moments: specialMoment });

    const moment = getMomentItem('special');
    // Description should be escaped and displayed as text
    expect(moment).toHaveTextContent('<script>');
    expect(moment).toHaveTextContent('&');
  });
});
