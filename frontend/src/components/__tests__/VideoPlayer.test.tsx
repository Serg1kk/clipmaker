/**
 * Test suite for VideoPlayer component
 *
 * Tests cover:
 * - Basic rendering with props
 * - Play/pause functionality
 * - Time display
 * - Progress bar
 * - Volume control
 * - Mute toggle
 * - Keyboard accessibility
 * - Callbacks
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoPlayer, { type VideoPlayerProps } from '../VideoPlayer';

// ============================================================================
// Mock HTMLMediaElement
// ============================================================================

const originalPlay = HTMLMediaElement.prototype.play;
const originalPause = HTMLMediaElement.prototype.pause;

let mockPlay: jest.Mock;
let mockPause: jest.Mock;

interface MockVideoState {
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  paused: boolean;
}

let mockVideoState: MockVideoState;

beforeEach(() => {
  mockVideoState = {
    currentTime: 0,
    duration: 120,
    volume: 1,
    muted: false,
    paused: true,
  };

  mockPlay = jest.fn(() => {
    mockVideoState.paused = false;
    return Promise.resolve();
  });

  mockPause = jest.fn(() => {
    mockVideoState.paused = true;
  });

  HTMLMediaElement.prototype.play = mockPlay as unknown as () => Promise<void>;
  HTMLMediaElement.prototype.pause = mockPause as unknown as () => void;

  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: () => mockVideoState.currentTime,
    set: (value: number) => { mockVideoState.currentTime = value; },
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => mockVideoState.duration,
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    configurable: true,
    get: () => mockVideoState.volume,
    set: (value: number) => { mockVideoState.volume = value; },
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    configurable: true,
    get: () => mockVideoState.muted,
    set: (value: boolean) => { mockVideoState.muted = value; },
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get: () => mockVideoState.paused,
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'buffered', {
    configurable: true,
    get: () => ({
      length: 1,
      start: () => 0,
      end: () => mockVideoState.duration * 0.5,
    }),
  });
});

afterEach(() => {
  HTMLMediaElement.prototype.play = originalPlay;
  HTMLMediaElement.prototype.pause = originalPause;
  jest.clearAllMocks();
});

// ============================================================================
// Test Utilities
// ============================================================================

function renderVideoPlayer(props: Partial<VideoPlayerProps> = {}) {
  const defaultProps: VideoPlayerProps = {
    url: 'https://example.com/test-video.mp4',
    ...props,
  };
  return render(<VideoPlayer {...defaultProps} />);
}

function getVideoElement(): HTMLVideoElement {
  return screen.getByTestId('video-element') as HTMLVideoElement;
}

function triggerVideoEvent(eventName: string) {
  const video = getVideoElement();
  fireEvent(video, new Event(eventName));
}

// ============================================================================
// Test Suite: Basic Rendering
// ============================================================================

describe('VideoPlayer - Basic Rendering', () => {
  it('renders without crashing with valid url prop', () => {
    renderVideoPlayer();

    expect(screen.getByTestId('video-player')).toBeInTheDocument();
    expect(screen.getByTestId('video-element')).toBeInTheDocument();
  });

  it('renders video element with correct src attribute', () => {
    const testUrl = 'https://example.com/my-video.mp4';
    renderVideoPlayer({ url: testUrl });

    const video = getVideoElement();
    expect(video).toHaveAttribute('src', testUrl);
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-video-class';
    renderVideoPlayer({ className: customClass });

    const player = screen.getByTestId('video-player');
    expect(player).toHaveClass(customClass);
  });

  it('sets poster attribute when provided', () => {
    const posterUrl = 'https://example.com/poster.jpg';
    renderVideoPlayer({ poster: posterUrl });

    const video = getVideoElement();
    expect(video).toHaveAttribute('poster', posterUrl);
  });

  it('renders all control elements', () => {
    renderVideoPlayer();

    expect(screen.getByTestId('play-pause-button')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('time-display')).toBeInTheDocument();
    expect(screen.getByTestId('mute-button')).toBeInTheDocument();
    expect(screen.getByTestId('volume-slider')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    renderVideoPlayer();

    const player = screen.getByTestId('video-player');
    expect(player).toHaveAttribute('role', 'application');
    expect(player).toHaveAttribute('aria-label', 'Video player');
    expect(player).toHaveAttribute('tabIndex', '0');
  });
});

// ============================================================================
// Test Suite: Play/Pause Functionality
// ============================================================================

describe('VideoPlayer - Play/Pause Functionality', () => {
  it('play button toggles play state when clicked', async () => {
    renderVideoPlayer();

    const playButton = screen.getByTestId('play-pause-button');
    expect(playButton).toHaveAttribute('aria-label', 'Play');

    fireEvent.click(playButton);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    triggerVideoEvent('play');

    await waitFor(() => {
      expect(playButton).toHaveAttribute('aria-label', 'Pause');
    });
  });

  it('pause button toggles to pause state when playing', async () => {
    renderVideoPlayer();

    const playButton = screen.getByTestId('play-pause-button');

    fireEvent.click(playButton);
    triggerVideoEvent('play');

    await waitFor(() => {
      expect(playButton).toHaveAttribute('aria-label', 'Pause');
    });

    fireEvent.click(playButton);
    expect(mockPause).toHaveBeenCalledTimes(1);

    triggerVideoEvent('pause');

    await waitFor(() => {
      expect(playButton).toHaveAttribute('aria-label', 'Play');
    });
  });

  it('handles autoPlay prop correctly', () => {
    renderVideoPlayer({ autoPlay: true });

    const video = getVideoElement();
    expect(video).toHaveAttribute('autoplay');
  });
});

// ============================================================================
// Test Suite: Time Display
// ============================================================================

describe('VideoPlayer - Time Display', () => {
  it('shows initial time as 0:00 / 0:00', () => {
    mockVideoState.duration = 0;
    renderVideoPlayer();

    expect(screen.getByTestId('current-time')).toHaveTextContent('0:00');
    expect(screen.getByTestId('duration')).toHaveTextContent('0:00');
  });

  it('shows current time and duration after metadata loaded', async () => {
    renderVideoPlayer();

    mockVideoState.duration = 120;
    triggerVideoEvent('loadedmetadata');

    await waitFor(() => {
      expect(screen.getByTestId('duration')).toHaveTextContent('2:00');
    });
  });

  it('updates current time during playback', async () => {
    renderVideoPlayer();

    mockVideoState.duration = 120;
    triggerVideoEvent('loadedmetadata');

    mockVideoState.currentTime = 30;
    triggerVideoEvent('timeupdate');

    await waitFor(() => {
      expect(screen.getByTestId('current-time')).toHaveTextContent('0:30');
    });
  });

  it('formats time correctly for videos over 1 hour', async () => {
    renderVideoPlayer();

    mockVideoState.duration = 5445; // 1:30:45
    triggerVideoEvent('loadedmetadata');

    await waitFor(() => {
      expect(screen.getByTestId('duration')).toHaveTextContent('1:30:45');
    });
  });
});

// ============================================================================
// Test Suite: Progress Bar
// ============================================================================

describe('VideoPlayer - Progress Bar', () => {
  it('renders progress bar with correct ARIA attributes', () => {
    renderVideoPlayer();

    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveAttribute('role', 'slider');
    expect(progressBar).toHaveAttribute('aria-label', 'Seek');
  });

  it('clicking progress bar triggers seek', async () => {
    renderVideoPlayer();

    mockVideoState.duration = 100;
    triggerVideoEvent('loadedmetadata');

    const progressBar = screen.getByTestId('progress-bar');

    progressBar.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      width: 200,
      top: 0,
      right: 200,
      bottom: 10,
      height: 10,
      x: 0,
      y: 0,
      toJSON: () => {},
    })) as unknown as () => DOMRect;

    fireEvent.click(progressBar, { clientX: 100 });

    await waitFor(() => {
      expect(mockVideoState.currentTime).toBe(50);
    });
  });

  it('progress fill reflects current playback position', async () => {
    renderVideoPlayer();

    mockVideoState.duration = 100;
    triggerVideoEvent('loadedmetadata');

    mockVideoState.currentTime = 25;
    triggerVideoEvent('timeupdate');

    await waitFor(() => {
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '25%' });
    });
  });
});

// ============================================================================
// Test Suite: Volume Control
// ============================================================================

describe('VideoPlayer - Volume Control', () => {
  it('volume slider changes volume', async () => {
    renderVideoPlayer();

    const volumeSlider = screen.getByTestId('volume-slider') as HTMLInputElement;

    fireEvent.change(volumeSlider, { target: { value: '0.5' } });

    await waitFor(() => {
      expect(mockVideoState.volume).toBe(0.5);
    });
  });

  it('volume slider has correct range attributes', () => {
    renderVideoPlayer();

    const volumeSlider = screen.getByTestId('volume-slider');
    expect(volumeSlider).toHaveAttribute('min', '0');
    expect(volumeSlider).toHaveAttribute('max', '1');
    expect(volumeSlider).toHaveAttribute('step', '0.05');
  });
});

// ============================================================================
// Test Suite: Mute Toggle
// ============================================================================

describe('VideoPlayer - Mute Toggle', () => {
  it('mute button toggles mute state', async () => {
    renderVideoPlayer();

    const muteButton = screen.getByTestId('mute-button');

    expect(muteButton).toHaveAttribute('aria-label', 'Mute');

    fireEvent.click(muteButton);
    triggerVideoEvent('volumechange');

    await waitFor(() => {
      expect(mockVideoState.muted).toBe(true);
      expect(muteButton).toHaveAttribute('aria-label', 'Unmute');
    });
  });
});

// ============================================================================
// Test Suite: Keyboard Accessibility
// ============================================================================

describe('VideoPlayer - Keyboard Accessibility', () => {
  it('space key toggles play/pause', async () => {
    renderVideoPlayer();

    const player = screen.getByTestId('video-player');
    player.focus();

    fireEvent.keyDown(player, { key: ' ' });
    expect(mockPlay).toHaveBeenCalledTimes(1);

    triggerVideoEvent('play');

    await waitFor(() => {
      expect(screen.getByTestId('play-pause-button')).toHaveAttribute('aria-label', 'Pause');
    });

    fireEvent.keyDown(player, { key: ' ' });
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('player is focusable via tab', () => {
    renderVideoPlayer();

    const player = screen.getByTestId('video-player');
    expect(player).toHaveAttribute('tabIndex', '0');
  });
});

// ============================================================================
// Test Suite: Callbacks
// ============================================================================

describe('VideoPlayer - Callbacks', () => {
  it('calls onEnded callback when video ends', async () => {
    const onEnded = jest.fn();
    renderVideoPlayer({ onEnded: onEnded as VideoPlayerProps['onEnded'] });

    triggerVideoEvent('ended');

    await waitFor(() => {
      expect(onEnded).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onError callback when error occurs', async () => {
    const onError = jest.fn();
    renderVideoPlayer({ onError: onError as VideoPlayerProps['onError'] });

    triggerVideoEvent('error');

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('VideoPlayer - Edge Cases', () => {
  it('handles empty URL gracefully', () => {
    renderVideoPlayer({ url: '' });

    const video = getVideoElement();
    expect(video).toHaveAttribute('src', '');
  });

  it('handles rapid play/pause clicks', () => {
    renderVideoPlayer();

    const playButton = screen.getByTestId('play-pause-button');

    for (let i = 0; i < 10; i++) {
      fireEvent.click(playButton);
    }

    expect(mockPlay.mock.calls.length + mockPause.mock.calls.length).toBeGreaterThan(0);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderVideoPlayer();

    const video = getVideoElement();
    const removeEventListenerSpy = jest.spyOn(video, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalled();
    removeEventListenerSpy.mockRestore();
  });
});
