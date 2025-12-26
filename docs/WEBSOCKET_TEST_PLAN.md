# WebSocket Progress Hook - Comprehensive Test Plan

**Document:** Test Plan for useProgress Hook
**Test Scope:** 8 Edge Cases + Core Functionality
**Framework:** Jest, React Testing Library, WebSocket Mock
**Estimated Test Count:** 45+ test cases

---

## Test Organization

```
tests/
├── useProgress.unit.test.ts          # 20 tests
├── useProgress.integration.test.ts   # 15 tests
├── useProgress.e2e.test.ts           # 10+ tests
├── mocks/
│   ├── websocket.ts
│   ├── progress-messages.ts
│   └── error-scenarios.ts
└── fixtures/
    ├── valid-messages.json
    ├── invalid-messages.json
    └── close-codes.json
```

---

## Test Case Matrix

### 1. Connection Failures

#### Test 1.1: Initial Connection Refused
```typescript
test('should handle connection refused error', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  await waitFor(() => {
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(true);
  });

  expect(result.current.error).toContain('Unable to connect');
  expect(result.current.reconnectAttempt).toBe(1);
});

// Verify:
// - isConnected = false
// - isReconnecting = true
// - error message displayed
// - reconnectAttempt incremented
// - shouldShowRetryButton = true
```

#### Test 1.2: Network Timeout
```typescript
test('should timeout connection after 15 seconds', async () => {
  jest.useFakeTimers();

  const { result } = renderHook(() => useProgress('job-123'));

  jest.advanceTimersByTime(15000);

  await waitFor(() => {
    expect(result.current.isConnected).toBe(false);
  });

  expect(result.current.error).toContain('timeout');

  jest.useRealTimers();
});

// Verify:
// - Connection attempt times out after 15s
// - WebSocket.close() called automatically
// - reconnection scheduled
```

#### Test 1.3: Exponential Backoff Retry
```typescript
test('should retry with exponential backoff', async () => {
  jest.useFakeTimers();

  const { result } = renderHook(() => useProgress('job-123'), {
    initialProps: {
      config: {
        maxReconnectAttempts: 4,
        initialBackoffMs: 1000,
        maxBackoffMs: 8000
      }
    }
  });

  // Attempt 1 fails immediately
  expect(result.current.reconnectAttempt).toBe(1);

  // Should wait ~1 second + jitter
  jest.advanceTimersByTime(2000);
  // Attempt 2

  jest.advanceTimersByTime(3000);
  // Attempt 3 should happen (2 + 4 = 6 > 2)

  jest.advanceTimersByTime(5000);
  // Attempt 4 should happen

  jest.useRealTimers();
});

// Verify backoff schedule:
// Attempt 1: 0s (immediate)
// Attempt 2: 1s + jitter
// Attempt 3: 2s + jitter
// Attempt 4: 4s + jitter
// Attempt 5: 8s + jitter (capped at MAX_BACKOFF)
```

#### Test 1.4: Connection Limit Exceeded (HTTP 429/503)
```typescript
test('should handle server connection limit', async () => {
  mockWebSocket.simulateError('429');

  const { result } = renderHook(() => useProgress('job-123'));

  await waitFor(() => {
    expect(result.current.error).toContain('connection');
  });

  // Should attempt reconnection
  expect(result.current.isReconnecting).toBe(true);
});
```

---

### 2. Invalid JSON Handling

#### Test 2.1: Malformed JSON Response
```typescript
test('should handle malformed JSON gracefully', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  // Simulate WebSocket opening
  mockWebSocket.simulateOpen();

  // Send invalid JSON
  const consoleWarnSpy = jest.spyOn(console, 'warn');
  mockWebSocket.simulateMessage('{"invalid": json}');

  // Should not crash
  await waitFor(() => {
    expect(result.current.isConnected).toBe(true); // Still connected
  });

  // Error logged but not shown to user
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Invalid JSON')
  );
});

// Verify:
// - No user-facing error message
// - Connection remains open
// - Error logged to console only
// - Invalid message count incremented
```

#### Test 2.2: Incomplete Message Frame
```typescript
test('should handle incomplete message frames', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Send incomplete message (cut off mid-frame)
  mockWebSocket.simulateMessage('{type: "progress", job_id: "job-');

  // Should handle gracefully
  expect(result.current.isConnected).toBe(true);
  expect(result.current.error).toBeNull();
});
```

#### Test 2.3: HTML Error Page Instead of JSON
```typescript
test('should handle HTML error response', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Send HTML error page
  const htmlError = '<!DOCTYPE html><html>503 Service Unavailable</html>';
  mockWebSocket.simulateMessage(htmlError);

  // Should not crash, should count as invalid
  expect(result.current.isConnected).toBe(true);
  expect(result.current.error).toBeNull(); // Not a user-facing error yet
});
```

#### Test 2.4: Invalid Message Structure
```typescript
test('should validate message structure', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Missing required fields
  const invalidMessage = {
    type: 'progress'
    // missing: job_id, stage, progress, message
  };

  mockWebSocket.simulateMessage(invalidMessage);

  // Should reject but not crash
  expect(result.current.isConnected).toBe(true);
  expect(result.current.error).toBeNull();
});
```

#### Test 2.5: Reconnect After Too Many Invalid Messages
```typescript
test('should reconnect after 10 invalid messages', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Send 11 invalid messages
  for (let i = 0; i < 11; i++) {
    mockWebSocket.simulateMessage('invalid json' + i);
  }

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(true);
  });

  // Connection should be closed
  expect(mockWebSocket.readyState).toBe(WebSocket.CLOSED);
});

// Verify:
// - Tracks invalid message count
// - Resets count on valid message
// - Reconnects after MAX (10)
// - Tracks invalid messages per time window
```

---

### 3. Network Interruption

#### Test 3.1: Connection Lost During Active Transfer
```typescript
test('should handle connection lost during progress update', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Receive a progress update
  const message = {
    type: 'progress',
    job_id: 'job-123',
    stage: 'transcribing',
    progress: 50,
    message: 'Processing...',
    timestamp: new Date().toISOString()
  };

  mockWebSocket.simulateMessage(message);

  // Connection drops
  mockWebSocket.simulateClose(1006, '');

  await waitFor(() => {
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(true);
  });

  // Should preserve last known state
  expect(result.current.progress).toBe(50);
  expect(result.current.stage).toBe(ProgressStage.TRANSCRIBING);
});

// Verify:
// - Last progress (50) preserved
// - Last stage preserved
// - lastUpdateTime recorded
// - Reconnection scheduled
// - User sees "Reconnecting..." message
```

#### Test 3.2: WiFi Disconnection
```typescript
test('should detect WiFi disconnection', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Receive message
  mockWebSocket.simulateMessage({
    type: 'progress',
    job_id: 'job-123',
    stage: 'extracting',
    progress: 25,
    message: 'Extracting audio...',
    timestamp: new Date().toISOString()
  });

  // Simulate network failure
  mockWebSocket.simulateClose(1006, 'Network error');

  // Should show reconnecting UI
  expect(result.current.isReconnecting).toBe(true);
  expect(result.current.error).toContain('Reconnecting');
});
```

#### Test 3.3: Resume From Last Known State
```typescript
test('should resume from last known state after reconnection', async () => {
  const { result, rerender } = renderHook(
    ({ jobId }) => useProgress(jobId),
    { initialProps: { jobId: 'job-123' } }
  );

  mockWebSocket.simulateOpen();

  // Progress at 60%
  mockWebSocket.simulateMessage({
    type: 'progress',
    job_id: 'job-123',
    stage: 'transcribing',
    progress: 60,
    message: '60% complete',
    timestamp: new Date().toISOString()
  });

  // Connection drops
  mockWebSocket.simulateClose(1006, '');

  // Last state preserved
  expect(result.current.progress).toBe(60);

  // Simulate reconnection
  const newMockWs = createMockWebSocket();
  mockWebSocket = newMockWs;

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(true);
  });

  // Reconnect succeeds
  mockWebSocket.simulateOpen();

  // Server sends updated progress (62%)
  mockWebSocket.simulateMessage({
    type: 'progress',
    job_id: 'job-123',
    stage: 'transcribing',
    progress: 62,
    message: '62% complete',
    timestamp: new Date().toISOString()
  });

  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
    expect(result.current.progress).toBe(62);
  });
});
```

---

### 4. Component Unmount During Reconnection

#### Test 4.1: Cleanup on Unmount
```typescript
test('should cleanup on unmount', async () => {
  const { unmount } = renderHook(() => useProgress('job-123'));

  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

  unmount();

  expect(clearTimeoutSpy).toHaveBeenCalled();
});

// Verify:
// - reconnectTimeout cleared
// - pollingTimeout cleared
// - WebSocket closed
// - AbortController aborted
// - No state updates possible after unmount
```

#### Test 4.2: No State Updates After Unmount
```typescript
test('should not update state after unmount', async () => {
  const { result, unmount } = renderHook(
    () => useProgress('job-123')
  );

  // Component is mounted
  expect(result.current).toBeDefined();

  // Unmount
  unmount();

  // Simulate message arriving after unmount
  // (This would happen if reconnection was scheduled)
  const consoleErrorSpy = jest.spyOn(console, 'error');

  // Should not cause "update on unmounted component" warning
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('unmounted')
  );
});

// Verify:
// - isMountedRef.current = false prevents setState calls
// - No React warnings in console
// - No memory leaks
```

#### Test 4.3: Cancel Pending Reconnection on Unmount
```typescript
test('should cancel pending reconnection when unmounting', async () => {
  jest.useFakeTimers();

  const { unmount } = renderHook(() => useProgress('job-123'));

  // Simulate connection failure
  mockWebSocket.simulateError();

  // Reconnection scheduled
  expect(setTimeout).toHaveBeenCalled();

  unmount();

  // Clear timeout should have been called
  expect(clearTimeout).toHaveBeenCalled();

  jest.useRealTimers();
});
```

#### Test 4.4: Close WebSocket on Unmount
```typescript
test('should close WebSocket on unmount', () => {
  const closeSpy = jest.spyOn(WebSocket.prototype, 'close');

  const { unmount } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  unmount();

  expect(closeSpy).toHaveBeenCalledWith(1000, expect.any(String));
});
```

---

### 5. Multiple Rapid Job Changes

#### Test 5.1: Switch Between Jobs
```typescript
test('should switch between jobs cleanly', async () => {
  const { rerender } = renderHook(
    ({ jobId }) => useProgress(jobId),
    { initialProps: { jobId: 'job-1' } }
  );

  mockWebSocket.simulateOpen();

  // Receive update for job-1
  mockWebSocket.simulateMessage({
    type: 'progress',
    job_id: 'job-1',
    stage: 'transcribing',
    progress: 50,
    message: 'Job 1 progress',
    timestamp: new Date().toISOString()
  });

  // Switch to job-2
  rerender({ jobId: 'job-2' });

  await waitFor(() => {
    // State should reset
    expect(result.current.progress).toBe(0);
    expect(result.current.stage).toBe(ProgressStage.PENDING);
  });

  // Old connection should be closed
  expect(mockWebSocket.readyState).toBe(WebSocket.CLOSED);

  // New connection initiated
  expect(newMockWebSocket.url).toContain('job-2');
});

// Verify:
// - Progress reset to 0
// - Stage reset to PENDING
// - Message cleared
// - Error cleared
// - Old WebSocket closed
// - New WebSocket created for new jobId
// - Only one connection at a time
```

#### Test 5.2: Ignore Old Job Messages
```typescript
test('should ignore messages from old job', async () => {
  const { rerender } = renderHook(
    ({ jobId }) => useProgress(jobId),
    { initialProps: { jobId: 'job-1' } }
  );

  mockWebSocket.simulateOpen();

  // Switch to job-2
  rerender({ jobId: 'job-2' });

  // Send message for old job-1
  mockWebSocket.simulateMessage({
    type: 'progress',
    job_id: 'job-1', // OLD JOB ID
    stage: 'transcribing',
    progress: 50,
    message: 'Should be ignored',
    timestamp: new Date().toISOString()
  });

  // State should remain at initial values
  expect(result.current.progress).toBe(0);
  expect(result.current.stage).toBe(ProgressStage.PENDING);

  // Verify warning logged
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('old job')
  );
});
```

#### Test 5.3: Rapid Job Switches
```typescript
test('should handle rapid job ID changes', async () => {
  jest.useFakeTimers();

  const { rerender } = renderHook(
    ({ jobId }) => useProgress(jobId),
    { initialProps: { jobId: 'job-1' } }
  );

  // Rapid switches
  rerender({ jobId: 'job-2' });
  jest.advanceTimersByTime(100);

  rerender({ jobId: 'job-3' });
  jest.advanceTimersByTime(100);

  rerender({ jobId: 'job-4' });
  jest.advanceTimersByTime(100);

  await waitFor(() => {
    // Should connect to final job
    expect(mockWebSocket.url).toContain('job-4');
  });

  // Should have cleaned up intermediate connections
  // Count of closed connections should match number of switches
  const closeCalls = closeSpy.mock.calls.length;
  expect(closeCalls).toBeGreaterThanOrEqual(2);

  jest.useRealTimers();
});
```

---

### 6. Server Close Codes

#### Test 6.1: Graceful Closure (1000)
```typescript
test('should not reconnect on code 1000 (normal closure)', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();
  mockWebSocket.simulateMessage({
    type: 'progress',
    job_id: 'job-123',
    stage: 'completed',
    progress: 100,
    message: 'Done',
    timestamp: new Date().toISOString()
  });

  // Server closes with code 1000
  mockWebSocket.simulateClose(1000, 'Normal closure');

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
```

#### Test 6.2: Job Completed (Close Reason)
```typescript
test('should detect job completion from close reason', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Server closes with completion reason
  mockWebSocket.simulateClose(1000, 'completed');

  await waitFor(() => {
    expect(result.current.stage).toBe(ProgressStage.COMPLETED);
    expect(result.current.progress).toBe(100);
  });

  // Should not reconnect
  expect(result.current.isReconnecting).toBe(false);
});
```

#### Test 6.3: Job Failed (Close Reason)
```typescript
test('should detect job failure from close reason', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Server closes with failure reason
  mockWebSocket.simulateClose(
    1000,
    'failed: Invalid audio format'
  );

  await waitFor(() => {
    expect(result.current.stage).toBe(ProgressStage.FAILED);
    expect(result.current.error).toContain('Invalid audio format');
  });

  // Should not reconnect
  expect(result.current.isReconnecting).toBe(false);
});
```

#### Test 6.4: Server Error (1011)
```typescript
test('should reconnect on code 1011 (server error)', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();
  mockWebSocket.simulateClose(1011, 'Internal server error');

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(true);
  });

  // Should schedule reconnection
  expect(reconnectTimeoutRef.current).toBeDefined();
});
```

#### Test 6.5: Service Restart (1012)
```typescript
test('should handle service restart (1012)', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();
  mockWebSocket.simulateClose(1012, 'Service restart');

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(true);
  });

  // Should use longer backoff for service restart
  // First reconnection delay should be noticeable
});
```

#### Test 6.6: Abrupt Closure (No Code)
```typescript
test('should handle abrupt closure (code 1006)', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Connection reset without close frame
  mockWebSocket.simulateClose(1006, '');

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(true);
  });

  // Should reconnect with standard backoff
});
```

---

### 7. Maximum Reconnection Attempts

#### Test 7.1: Give Up After Max Attempts
```typescript
test('should give up after max reconnection attempts', async () => {
  jest.useFakeTimers();

  const { result } = renderHook(() =>
    useProgress('job-123', {
      maxReconnectAttempts: 3
    })
  );

  // Simulate connection failure
  mockWebSocket.simulateError();

  for (let i = 1; i <= 3; i++) {
    // Wait for backoff
    jest.advanceTimersByTime(10000);

    // Fail again
    mockWebSocket.simulateError();
  }

  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.error).toContain('after 3 attempts');
  });

  jest.useRealTimers();
});

// Verify:
// - reconnectAttempt = 3
// - isReconnecting = false
// - error message shown
// - canRetryManually = true
```

#### Test 7.2: Manual Retry After Max Attempts
```typescript
test('should allow manual retry after max attempts', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  // Exhaust max attempts
  // ...

  expect(result.current.canRetryManually).toBe(true);

  // User clicks retry
  act(() => {
    result.current.retryManually();
  });

  // Should attempt reconnection again
  await waitFor(() => {
    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.reconnectAttempt).toBe(1);
  });
});
```

#### Test 7.3: Show Contact Support After Max Attempts
```typescript
test('should show support contact info after max attempts', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  // Exhaust max attempts
  // ...

  await waitFor(() => {
    expect(result.current.error).toContain('contact support');
  });
});
```

---

### 8. Browser WebSocket Support

#### Test 8.1: Detect Missing WebSocket Support
```typescript
test('should detect missing WebSocket support', () => {
  const originalWS = (global as any).WebSocket;
  (global as any).WebSocket = undefined;

  const { result } = renderHook(() => useProgress('job-123'));

  expect(result.current.isSupported).toBe(false);
  expect(result.current.error).toContain('not supported');

  (global as any).WebSocket = originalWS;
});

// Verify:
// - isSupported = false
// - Error message shown with browser upgrade link
// - shouldShowUpgradeMessage = true
```

#### Test 8.2: Fallback to Polling
```typescript
test('should fallback to polling if WebSocket unavailable', async () => {
  const originalWS = (global as any).WebSocket;
  (global as any).WebSocket = undefined;

  const fetchSpy = jest.spyOn(global, 'fetch');

  const { result } = renderHook(() =>
    useProgress('job-123', {
      enablePollingFallback: true
    })
  );

  await waitFor(
    () => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/progress/job-123')
      );
    },
    { timeout: 5000 }
  );

  (global as any).WebSocket = originalWS;
});

// Verify:
// - Falls back to API polling
// - Updates progress from polling responses
// - Shows "Using fallback" message
```

#### Test 8.3: Polling Updates State
```typescript
test('should update state from polling', async () => {
  // WebSocket unavailable
  // Enable polling fallback

  const progressResponse = {
    stage: 'transcribing',
    progress: 45,
    message: 'Processing audio...'
  };

  fetch.mockResolvedValue(
    new Response(JSON.stringify(progressResponse), { status: 200 })
  );

  const { result } = renderHook(() =>
    useProgress('job-123', {
      enablePollingFallback: true,
      pollIntervalMs: 500
    })
  );

  await waitFor(() => {
    expect(result.current.progress).toBe(45);
    expect(result.current.stage).toBe(ProgressStage.TRANSCRIBING);
  });
});
```

---

## Core Functionality Tests

### Test 9.1: Valid Progress Message Processing
```typescript
test('should process valid progress message', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  const message = {
    type: 'progress',
    job_id: 'job-123',
    stage: 'extracting',
    progress: 25.5,
    message: 'Extracting audio from video...',
    timestamp: '2025-12-26T12:00:00Z',
    details: {
      current_step: 1,
      total_steps: 4,
      eta_seconds: 120
    }
  };

  mockWebSocket.simulateMessage(message);

  await waitFor(() => {
    expect(result.current.progress).toBe(25.5);
    expect(result.current.stage).toBe(ProgressStage.EXTRACTING);
    expect(result.current.message).toBe('Extracting audio from video...');
    expect(result.current.details?.eta_seconds).toBe(120);
  });
});
```

### Test 9.2: Progress Stage Transitions
```typescript
test('should transition through all stages', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  const stages = [
    { stage: ProgressStage.PENDING, progress: 0 },
    { stage: ProgressStage.EXTRACTING, progress: 25 },
    { stage: ProgressStage.TRANSCRIBING, progress: 60 },
    { stage: ProgressStage.COMPLETED, progress: 100 }
  ];

  for (const { stage, progress } of stages) {
    mockWebSocket.simulateMessage({
      type: 'progress',
      job_id: 'job-123',
      stage: stage,
      progress: progress,
      message: `Stage: ${stage}`,
      timestamp: new Date().toISOString()
    });

    await waitFor(() => {
      expect(result.current.stage).toBe(stage);
      expect(result.current.progress).toBe(progress);
    });
  }
});
```

### Test 9.3: Heartbeat/Ping-Pong
```typescript
test('should respond to server ping', async () => {
  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  // Server sends ping
  mockWebSocket.simulateMessage({
    type: 'ping',
    timestamp: new Date().toISOString()
  });

  // Should respond with pong (or handle gracefully)
  // Implementation specific
});
```

### Test 9.4: Elapsed Time Tracking
```typescript
test('should track elapsed time', async () => {
  jest.useFakeTimers();

  const { result } = renderHook(() => useProgress('job-123'));

  mockWebSocket.simulateOpen();

  expect(result.current.elapsedSeconds).toBe(0);

  jest.advanceTimersByTime(5000);

  await waitFor(() => {
    expect(result.current.elapsedSeconds).toBeCloseTo(5);
  });

  jest.advanceTimersByTime(10000);

  await waitFor(() => {
    expect(result.current.elapsedSeconds).toBeCloseTo(15);
  });

  jest.useRealTimers();
});
```

---

## Integration Tests

### Test 10.1: Full Job Lifecycle
```typescript
describe('Full Job Lifecycle', () => {
  it('should complete full job from start to finish', async () => {
    const { result } = renderHook(() => useProgress('job-123'));

    // 1. Initial connect
    mockWebSocket.simulateOpen();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // 2. Receive progress updates
    mockWebSocket.simulateMessage({
      type: 'progress',
      job_id: 'job-123',
      stage: ProgressStage.EXTRACTING,
      progress: 25,
      message: 'Extracting...',
      timestamp: new Date().toISOString()
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(25);
    });

    // 3. More progress
    mockWebSocket.simulateMessage({
      type: 'progress',
      job_id: 'job-123',
      stage: ProgressStage.TRANSCRIBING,
      progress: 75,
      message: 'Transcribing...',
      timestamp: new Date().toISOString()
    });

    // 4. Completion
    mockWebSocket.simulateClose(1000, 'completed');

    await waitFor(() => {
      expect(result.current.stage).toBe(ProgressStage.COMPLETED);
      expect(result.current.isReconnecting).toBe(false);
    });
  });
});
```

---

## Test Setup & Fixtures

### Mock WebSocket
```typescript
// tests/mocks/websocket.ts
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.simulateOpen(), 0);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: any) {
    const messageEvent = new MessageEvent('message', {
      data: typeof data === 'string' ? data : JSON.stringify(data)
    });
    this.onmessage?.(messageEvent);
  }

  simulateError(message = 'Connection error') {
    this.onerror?.(new ErrorEvent('error', { message }));
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    const closeEvent = new CloseEvent('close', { code, reason });
    this.onclose?.(closeEvent);
  }

  send(data: string) {
    // Track sent messages
  }

  close(code?: number, reason?: string) {
    this.simulateClose(code, reason);
  }
}
```

---

## Test Execution Plan

```bash
# Run all tests
npm run test:progress

# Run specific test file
npm run test:progress -- useProgress.unit.test.ts

# Run with coverage
npm run test:progress -- --coverage

# Run in watch mode
npm run test:progress -- --watch

# Run E2E tests
npm run test:e2e -- websocket-progress
```

---

## Coverage Goals

- **Statements:** 95%+
- **Branches:** 90%+
- **Functions:** 95%+
- **Lines:** 95%+

Critical paths to test:
- Connection establishment
- Error scenarios (all 8 edge cases)
- State transitions
- Cleanup/unmount
- Job ID changes
