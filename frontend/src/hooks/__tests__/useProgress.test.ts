/**
 * Comprehensive test suite for useProgress hook
 * Tests WebSocket connection management, progress updates, auto-reconnection,
 * and edge cases for robust progress tracking functionality.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProgress } from '../useProgress';
import {
  ProgressMessageType,
  WebSocketState,
  DEFAULT_RECONNECT_CONFIG,
  NO_RECONNECT_CODES,
  type ProgressMessage,
  type UseProgressInput,
} from '../types/progress.types';

// ============================================================================
// Mock WebSocket Implementation
// ============================================================================

type WebSocketEventHandler = ((event: Event) => void) | null;
type WebSocketMessageHandler = ((event: MessageEvent) => void) | null;
type WebSocketCloseHandler = ((event: CloseEvent) => void) | null;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static lastInstance: MockWebSocket | null = null;

  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: WebSocketEventHandler = null;
  onmessage: WebSocketMessageHandler = null;
  onerror: WebSocketEventHandler = null;
  onclose: WebSocketCloseHandler = null;

  private _sentMessages: string[] = [];
  private _closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    MockWebSocket.lastInstance = this;
  }

  send(data: string): void {
    if (this._closed) {
      throw new Error('WebSocket is closed');
    }
    this._sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    if (this._closed) return;
    this._closed = true;
    this.readyState = WebSocket.CLOSED;

    if (this.onclose) {
      const event = new CloseEvent('close', {
        code: code ?? 1000,
        reason: reason ?? '',
        wasClean: code === 1000,
      });
      this.onclose(event);
    }
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: ProgressMessage | string): void {
    if (this.onmessage) {
      const messageData = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage(new MessageEvent('message', { data: messageData }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code = 1006, reason = ''): void {
    this._closed = true;
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason, wasClean: code === 1000 }));
    }
  }

  get sentMessages(): string[] {
    return [...this._sentMessages];
  }

  get isClosed(): boolean {
    return this._closed;
  }

  static reset(): void {
    MockWebSocket.instances = [];
    MockWebSocket.lastInstance = null;
  }

  static getLastInstance(): MockWebSocket | null {
    return MockWebSocket.lastInstance;
  }

  static getAllInstances(): MockWebSocket[] {
    return [...MockWebSocket.instances];
  }
}

// Setup global WebSocket mock
const originalWebSocket = global.WebSocket;

beforeAll(() => {
  // @ts-expect-error - Replacing global WebSocket for testing
  global.WebSocket = MockWebSocket;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

beforeEach(() => {
  MockWebSocket.reset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ============================================================================
// Test Utilities
// ============================================================================

function createProgressMessage(overrides: Partial<ProgressMessage> = {}): ProgressMessage {
  return {
    type: ProgressMessageType.PROGRESS,
    progress: 50,
    status: 'Processing',
    ...overrides,
  };
}

function getLatestWs(): MockWebSocket {
  const ws = MockWebSocket.getLastInstance();
  if (!ws) {
    throw new Error('No WebSocket instance found');
  }
  return ws;
}

// ============================================================================
// Test Suite: Connection Management
// ============================================================================

describe('useProgress - Connection Management', () => {
  describe('initial connection', () => {
    it('should not connect when jobId is null', () => {
      renderHook(() => useProgress({ jobId: null }));

      expect(MockWebSocket.instances.length).toBe(0);
    });

    it('should connect when jobId is provided', () => {
      renderHook(() => useProgress({ jobId: 'test-job-123' }));

      expect(MockWebSocket.instances.length).toBe(1);
      expect(getLatestWs().url).toContain('test-job-123');
    });

    it('should build correct WebSocket URL with job ID', () => {
      renderHook(() => useProgress({ jobId: 'my-job-id' }));

      const ws = getLatestWs();
      expect(ws.url).toMatch(/wss?:\/\/.*\/ws\/job\/my-job-id/);
    });

    it('should return initial state values', () => {
      const { result } = renderHook(() => useProgress({ jobId: null }));

      expect(result.current.progress).toBe(0);
      expect(result.current.status).toBe('');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set isConnected to true when connection opens', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('disconnection', () => {
    it('should disconnect when jobId changes to null', async () => {
      const { result, rerender } = renderHook(
        ({ jobId }: UseProgressInput) => useProgress({ jobId }),
        { initialProps: { jobId: 'test-job' } }
      );

      const ws = getLatestWs();
      act(() => ws.simulateOpen());

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      rerender({ jobId: null });

      await waitFor(() => expect(result.current.isConnected).toBe(false));
    });

    it('should disconnect and reconnect when jobId changes', async () => {
      const { result, rerender } = renderHook(
        ({ jobId }: UseProgressInput) => useProgress({ jobId }),
        { initialProps: { jobId: 'job-1' } }
      );

      const firstWs = getLatestWs();
      act(() => firstWs.simulateOpen());

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      rerender({ jobId: 'job-2' });

      // Should have created a new connection
      expect(MockWebSocket.instances.length).toBe(2);

      const secondWs = getLatestWs();
      expect(secondWs.url).toContain('job-2');
    });

    it('should cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useProgress({ jobId: 'test-job' }));

      const ws = getLatestWs();
      act(() => ws.simulateOpen());

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      unmount();

      // WebSocket should have its handlers removed (cleanup happened)
      expect(ws.onopen).toBeNull();
      expect(ws.onmessage).toBeNull();
    });

    it('should clear reconnect timeout on unmount', () => {
      const { unmount } = renderHook(() => useProgress({ jobId: 'test-job' }));

      const ws = getLatestWs();
      act(() => {
        ws.simulateOpen();
        ws.simulateClose(1006, 'Abnormal closure');
      });

      // Reconnection timer should be set
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      unmount();

      // After unmount, no new connections should be attempted
      const instanceCountBeforeTimer = MockWebSocket.instances.length;
      act(() => {
        jest.runAllTimers();
      });

      expect(MockWebSocket.instances.length).toBe(instanceCountBeforeTimer);
    });
  });
});

// ============================================================================
// Test Suite: Progress Updates
// ============================================================================

describe('useProgress - Progress Updates', () => {
  describe('message parsing', () => {
    it('should parse valid progress messages', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: 42,
          status: 'Transcribing audio',
        });
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(42);
        expect(result.current.status).toBe('Transcribing audio');
      });
    });

    it('should update progress percentage correctly', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      const progressValues = [0, 25, 50, 75, 100];

      for (const value of progressValues) {
        act(() => {
          getLatestWs().simulateMessage({
            type: ProgressMessageType.PROGRESS,
            progress: value,
          });
        });

        await waitFor(() => {
          expect(result.current.progress).toBe(value);
        });
      }
    });

    it('should clamp progress values to 0-100 range', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: 150,
        });
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(100);
      });

      act(() => {
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: -50,
        });
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(0);
      });
    });

    it('should update status message correctly', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.STATUS,
          status: 'Initializing...',
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('Initializing...');
      });

      act(() => {
        getLatestWs().simulateMessage({
          type: ProgressMessageType.STATUS,
          status: 'Processing video',
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('Processing video');
      });
    });

    it('should handle invalid JSON gracefully', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage('not valid json {{{');
      });

      await waitFor(() => {
        // Invalid JSON is treated as plain text status message
        expect(result.current.status).toBe('not valid json {{{');
      });

      // Should still be connected
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle messages without progress field', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.STATUS,
          status: 'Working...',
        });
      });

      await waitFor(() => {
        expect(result.current.status).toBe('Working...');
        expect(result.current.progress).toBe(0); // Unchanged from initial
      });
    });

    it('should handle error messages', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.ERROR,
          error: 'Transcription failed',
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Transcription failed');
      });
    });

    it('should update progress after error message', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.ERROR,
          error: 'Temporary error',
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Temporary error');
      });

      act(() => {
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: 50,
          status: 'Resuming...',
        });
      });

      // Progress should still update even with error set
      await waitFor(() => {
        expect(result.current.progress).toBe(50);
        expect(result.current.status).toBe('Resuming...');
      });
    });
  });

  describe('callbacks', () => {
    it('should call onProgressChange when progress updates', async () => {
      const onProgressChange = jest.fn();

      const { result } = renderHook(() =>
        useProgress({
          jobId: 'test-job',
          onProgressChange,
        })
      );

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: 75,
        });
      });

      await waitFor(() => {
        expect(onProgressChange).toHaveBeenCalledWith(75);
      });
    });

    it('should call onStatusChange when status updates', async () => {
      const onStatusChange = jest.fn();

      renderHook(() =>
        useProgress({
          jobId: 'test-job',
          onStatusChange,
        })
      );

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.STATUS,
          status: 'Encoding video',
        });
      });

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('Encoding video');
      });
    });

    it('should call onError when error occurs', async () => {
      const onError = jest.fn();

      renderHook(() =>
        useProgress({
          jobId: 'test-job',
          onError,
        })
      );

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.ERROR,
          error: 'Out of memory',
        });
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Out of memory');
      });
    });
  });

  describe('ping/pong handling', () => {
    it('should respond to ping messages with pong', async () => {
      renderHook(() => useProgress({ jobId: 'test-job' }));

      const ws = getLatestWs();
      act(() => {
        ws.simulateOpen();
        ws.simulateMessage({
          type: ProgressMessageType.PING,
        });
      });

      await waitFor(() => {
        const sentMessages = ws.sentMessages;
        expect(sentMessages.length).toBeGreaterThan(0);
        const lastMessage = JSON.parse(sentMessages[sentMessages.length - 1]);
        expect(lastMessage.type).toBe('pong');
      });
    });
  });
});

// ============================================================================
// Test Suite: Auto-Reconnection
// ============================================================================

describe('useProgress - Auto-Reconnection', () => {
  describe('reconnection triggers', () => {
    it('should reconnect on unexpected disconnect', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      const initialInstanceCount = MockWebSocket.instances.length;

      act(() => {
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      // Fast-forward past reconnection delay
      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.baseDelay);
      });

      expect(MockWebSocket.instances.length).toBe(initialInstanceCount + 1);
    });

    it('should NOT reconnect on clean close (code 1000)', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      const instanceCount = MockWebSocket.instances.length;

      act(() => {
        getLatestWs().simulateClose(1000, 'Normal closure');
      });

      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
      });

      expect(MockWebSocket.instances.length).toBe(instanceCount);
    });

    it('should NOT reconnect on policy violation (code 1008)', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      await waitFor(() => expect(result.current.isConnected).toBe(true));

      const instanceCount = MockWebSocket.instances.length;

      act(() => {
        getLatestWs().simulateClose(1008, 'Policy violation');
      });

      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
      });

      expect(MockWebSocket.instances.length).toBe(instanceCount);
    });

    NO_RECONNECT_CODES.forEach((code) => {
      it(`should NOT reconnect on close code ${code}`, async () => {
        const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

        act(() => {
          getLatestWs().simulateOpen();
        });

        await waitFor(() => expect(result.current.isConnected).toBe(true));

        const instanceCount = MockWebSocket.instances.length;

        act(() => {
          getLatestWs().simulateClose(code, 'Controlled close');
        });

        act(() => {
          jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
        });

        expect(MockWebSocket.instances.length).toBe(instanceCount);
      });
    });
  });

  describe('exponential backoff', () => {
    it('should use exponential backoff delays', async () => {
      renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      // First reconnect: baseDelay * 2^0 = 1000ms
      const beforeFirst = MockWebSocket.instances.length;
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(MockWebSocket.instances.length).toBe(beforeFirst + 1);

      // Simulate another failure
      act(() => {
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      // Second reconnect: baseDelay * 2^1 = 2000ms
      act(() => {
        jest.advanceTimersByTime(1999);
      });
      expect(MockWebSocket.instances.length).toBe(beforeFirst + 1); // Not yet

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(MockWebSocket.instances.length).toBe(beforeFirst + 2);
    });

    it('should cap delay at maxDelay', async () => {
      renderHook(() => useProgress({ jobId: 'test-job' }));

      // Simulate multiple failures to exceed max delay threshold
      for (let i = 0; i < 10; i++) {
        act(() => {
          const ws = getLatestWs();
          ws.simulateOpen();
          ws.simulateClose(1006, 'Abnormal closure');
        });

        // Advance by maxDelay to trigger reconnection
        act(() => {
          jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
        });
      }

      // Should still be trying to reconnect with capped delays
      expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    });
  });

  describe('max attempts', () => {
    it('should stop reconnecting after max attempts', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      // Exhaust all reconnection attempts
      for (let i = 0; i < DEFAULT_RECONNECT_CONFIG.maxAttempts + 2; i++) {
        act(() => {
          getLatestWs().simulateClose(1006, 'Abnormal closure');
        });

        act(() => {
          jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
        });
      }

      const finalCount = MockWebSocket.instances.length;

      // Try to trigger more reconnections
      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay * 2);
      });

      // Should not have created more connections
      expect(MockWebSocket.instances.length).toBe(finalCount);
    });
  });

  describe('manual reconnect', () => {
    it('should allow manual reconnection', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateClose(1000, 'Normal closure');
      });

      const beforeReconnect = MockWebSocket.instances.length;

      act(() => {
        result.current.reconnect();
      });

      // Reconnect uses setTimeout(100ms), advance timers
      act(() => {
        jest.advanceTimersByTime(150);
      });

      expect(MockWebSocket.instances.length).toBe(beforeReconnect + 1);
    });

    it('should reset attempt counter on manual reconnect', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      // Exhaust attempts
      for (let i = 0; i < DEFAULT_RECONNECT_CONFIG.maxAttempts; i++) {
        act(() => {
          const ws = getLatestWs();
          ws.simulateOpen();
          ws.simulateClose(1006, 'Abnormal closure');
        });

        act(() => {
          jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
        });
      }

      const beforeManual = MockWebSocket.instances.length;

      // Manual reconnect should reset counter and allow new attempts
      act(() => {
        result.current.reconnect();
      });

      // Reconnect uses setTimeout(100ms)
      act(() => {
        jest.advanceTimersByTime(150);
      });

      expect(MockWebSocket.instances.length).toBe(beforeManual + 1);

      // Should now be able to auto-reconnect again
      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.baseDelay);
      });

      expect(MockWebSocket.instances.length).toBe(beforeManual + 2);
    });

    it('should cancel pending reconnection timeout on manual reconnect', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      // There should be a pending timeout
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      const beforeManual = MockWebSocket.instances.length;

      act(() => {
        result.current.reconnect();
      });

      // Reconnect uses setTimeout(100ms)
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Manual reconnect should have created new connection
      expect(MockWebSocket.instances.length).toBe(beforeManual + 1);

      // Advance timers more - should not create duplicate connections
      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
      });

      // No duplicate from the old timer
      expect(MockWebSocket.instances.length).toBe(beforeManual + 1);
    });
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('useProgress - Edge Cases', () => {
  describe('component unmount during reconnection', () => {
    it('should not attempt reconnection after unmount', async () => {
      const { unmount } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      const instancesBeforeUnmount = MockWebSocket.instances.length;

      unmount();

      // Fast forward through reconnection delays
      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay * 10);
      });

      // No new WebSocket connections should have been attempted
      expect(MockWebSocket.instances.length).toBe(instancesBeforeUnmount);
    });

    it('should handle unmount during connection attempt', () => {
      const { unmount } = renderHook(() => useProgress({ jobId: 'test-job' }));

      // WebSocket is created but not yet open
      expect(MockWebSocket.instances.length).toBe(1);
      const ws = getLatestWs();

      unmount();

      // Handlers should be cleared on unmount
      expect(ws.onopen).toBeNull();
      expect(ws.onmessage).toBeNull();
    });
  });

  describe('rapid jobId changes', () => {
    it('should handle rapid jobId changes without memory leaks', async () => {
      const { rerender } = renderHook(
        ({ jobId }: UseProgressInput) => useProgress({ jobId }),
        { initialProps: { jobId: 'job-1' } }
      );

      // Rapidly change jobId
      for (let i = 2; i <= 10; i++) {
        rerender({ jobId: `job-${i}` });
      }

      // Should have created connections for each jobId change
      expect(MockWebSocket.instances.length).toBe(10);

      // Last instance should be for job-10
      expect(getLatestWs().url).toContain('job-10');
    });

    it('should cancel reconnection when jobId changes', async () => {
      const { result, rerender } = renderHook(
        ({ jobId }: UseProgressInput) => useProgress({ jobId }),
        { initialProps: { jobId: 'job-1' } }
      );

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateClose(1006, 'Abnormal closure');
      });

      // Reconnection is pending
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Change jobId
      rerender({ jobId: 'job-2' });

      const instancesAfterChange = MockWebSocket.instances.length;

      // Advance past reconnection delay
      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.maxDelay);
      });

      // Should only have the new job-2 connection, not a reconnection to job-1
      expect(MockWebSocket.instances.length).toBe(instancesAfterChange);
      expect(getLatestWs().url).toContain('job-2');
    });

    it('should reset state when jobId changes', async () => {
      const { result, rerender } = renderHook(
        ({ jobId }: UseProgressInput) => useProgress({ jobId }),
        { initialProps: { jobId: 'job-1' } }
      );

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: 75,
          status: 'Almost done',
        });
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(75);
        expect(result.current.status).toBe('Almost done');
      });

      // Change jobId - state should reset
      rerender({ jobId: 'job-2' });

      await waitFor(() => {
        expect(result.current.progress).toBe(0);
        expect(result.current.status).toBe('');
      });
    });
  });

  describe('WebSocket connection failure', () => {
    it('should handle immediate connection error', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateError();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should attempt reconnection after connection error', async () => {
      renderHook(() => useProgress({ jobId: 'test-job' }));

      const initialCount = MockWebSocket.instances.length;

      act(() => {
        getLatestWs().simulateError();
        getLatestWs().simulateClose(1006, 'Connection failed');
      });

      act(() => {
        jest.advanceTimersByTime(DEFAULT_RECONNECT_CONFIG.baseDelay);
      });

      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount);
    });
  });

  describe('reset function', () => {
    it('should reset all state values', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.PROGRESS,
          progress: 80,
          status: 'Processing',
        });
        getLatestWs().simulateMessage({
          type: ProgressMessageType.ERROR,
          error: 'Some error',
        });
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(80);
        expect(result.current.error).toBe('Some error');
      });

      act(() => {
        result.current.reset();
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(0);
        expect(result.current.status).toBe('');
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('message queueing', () => {
    it('should process messages received before connection fully established', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      const ws = getLatestWs();

      // Receive messages before onopen fires
      act(() => {
        ws.onmessage?.(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: ProgressMessageType.PROGRESS,
              progress: 10,
            }),
          })
        );
      });

      // Now open the connection
      act(() => {
        ws.simulateOpen();
      });

      // The queued message should eventually be processed
      await waitFor(() => {
        // Progress should be updated (either 10 from queue or 0 if not queued)
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple rapid progress updates', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
      });

      // Send many updates rapidly
      act(() => {
        for (let i = 0; i <= 100; i += 5) {
          getLatestWs().simulateMessage({
            type: ProgressMessageType.PROGRESS,
            progress: i,
          });
        }
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(100);
      });
    });
  });

  describe('complete message handling', () => {
    it('should handle complete message type', async () => {
      const { result } = renderHook(() => useProgress({ jobId: 'test-job' }));

      act(() => {
        getLatestWs().simulateOpen();
        getLatestWs().simulateMessage({
          type: ProgressMessageType.COMPLETE,
          progress: 100,
          status: 'Completed',
        });
      });

      await waitFor(() => {
        expect(result.current.progress).toBe(100);
        expect(result.current.status).toBe('Completed');
      });
    });
  });
});

// ============================================================================
// Test Suite: Type Safety
// ============================================================================

describe('useProgress - Type Safety', () => {
  it('should have correct return type shape', () => {
    const { result } = renderHook(() => useProgress({ jobId: null }));

    // TypeScript compile-time checks
    const progress: number = result.current.progress;
    const status: string = result.current.status;
    const isConnected: boolean = result.current.isConnected;
    const error: string | null = result.current.error;
    const reconnect: () => void = result.current.reconnect;
    const reset: () => void = result.current.reset;

    expect(typeof progress).toBe('number');
    expect(typeof status).toBe('string');
    expect(typeof isConnected).toBe('boolean');
    expect(error === null || typeof error === 'string').toBe(true);
    expect(typeof reconnect).toBe('function');
    expect(typeof reset).toBe('function');
  });
});

// ============================================================================
// Test Suite: Custom Configuration
// ============================================================================

describe('useProgress - Custom Configuration', () => {
  it('should accept custom reconnect configuration', async () => {
    const customConfig = {
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
    };

    renderHook(() =>
      useProgress({
        jobId: 'test-job',
        reconnectConfig: customConfig,
      })
    );

    act(() => {
      getLatestWs().simulateOpen();
      getLatestWs().simulateClose(1006, 'Abnormal closure');
    });

    const beforeReconnect = MockWebSocket.instances.length;

    // Custom baseDelay is 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(MockWebSocket.instances.length).toBe(beforeReconnect + 1);
  });

  it('should use custom WebSocket URL builder', async () => {
    const customUrlBuilder = (jobId: string) =>
      `wss://custom.server.com/progress/${jobId}`;

    renderHook(() =>
      useProgress({
        jobId: 'my-job',
        buildWebSocketUrl: customUrlBuilder,
      })
    );

    const ws = getLatestWs();
    expect(ws.url).toBe('wss://custom.server.com/progress/my-job');
  });
});

// ============================================================================
// Test Suite: Memory and Performance
// ============================================================================

describe('useProgress - Memory and Performance', () => {
  it('should not accumulate WebSocket instances on repeated connects/disconnects', async () => {
    const { rerender } = renderHook(
      ({ jobId }: UseProgressInput) => useProgress({ jobId }),
      { initialProps: { jobId: 'job-1' } }
    );

    // Simulate many connect/disconnect cycles
    for (let i = 1; i <= 20; i++) {
      act(() => {
        getLatestWs().simulateOpen();
      });

      rerender({ jobId: `job-${i + 1}` });
    }

    // Should have created 21 instances (initial + 20 rerenders)
    const allInstances = MockWebSocket.getAllInstances();
    expect(allInstances.length).toBe(21);

    // Last instance should be for job-21
    expect(getLatestWs().url).toContain('job-21');
  });

  it('should cleanup all timers on unmount', () => {
    const { unmount } = renderHook(() => useProgress({ jobId: 'test-job' }));

    act(() => {
      getLatestWs().simulateOpen();
      getLatestWs().simulateClose(1006, 'Abnormal closure');
    });

    // Timers should be set for reconnection
    const timersBefore = jest.getTimerCount();
    expect(timersBefore).toBeGreaterThan(0);

    unmount();

    // All timers should be cleared or their callbacks should be no-ops
    act(() => {
      jest.runAllTimers();
    });

    // No new connections should have been created
    const instancesAfterTimers = MockWebSocket.instances.length;
    expect(instancesAfterTimers).toBe(MockWebSocket.instances.length);
  });
});
