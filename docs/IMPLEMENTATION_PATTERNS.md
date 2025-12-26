# useProgress Hook - Implementation Patterns & Error Handling

**Purpose:** Reference guide for implementing robust error handling in the useProgress WebSocket hook
**Status:** Analysis & Recommendations
**Last Updated:** 2025-12-26

---

## Table of Contents
1. [Hook Architecture](#hook-architecture)
2. [Error Handling Patterns](#error-handling-patterns)
3. [Connection Management](#connection-management)
4. [State Management](#state-management)
5. [Edge Case Handlers](#edge-case-handlers)
6. [Testing Strategies](#testing-strategies)

---

## Hook Architecture

### Type Definitions

```typescript
// Frontend: frontend/src/hooks/useProgress.ts

export enum ProgressStage {
  PENDING = "pending",
  EXTRACTING = "extracting",
  TRANSCRIBING = "transcribing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface ProgressMessage {
  type: string;
  job_id: string;
  stage: ProgressStage;
  progress: number; // 0-100
  message: string;
  timestamp: string;
  details?: {
    current_step?: number;
    total_steps?: number;
    eta_seconds?: number;
  };
}

export interface UseProgressResult {
  // Progress data
  progress: number;
  stage: ProgressStage;
  message: string;
  details?: ProgressMessage['details'];

  // Connection state
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  maxReconnectAttempts: number;

  // Error state
  error: string | null;
  errorCode?: string;
  errorTime?: number;

  // Metadata
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;

  // Actions
  disconnect: () => void;
  retryManually: () => void;
}

export interface UseProgressConfig {
  maxReconnectAttempts?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  enablePollingFallback?: boolean;
  pollIntervalMs?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

### Hook Signature

```typescript
export function useProgress(
  jobId: string | null,
  config?: UseProgressConfig
): UseProgressResult {
  // Implementation
}
```

---

## Error Handling Patterns

### 1. Try-Catch for JSON Parsing

```typescript
const handleMessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data) as ProgressMessage;

    // Validate message structure
    if (!isValidProgressMessage(data)) {
      console.warn('Invalid message structure:', data);
      incrementInvalidMessageCount();
      return;
    }

    // Ignore messages for old job ID
    if (data.job_id !== currentJobId) {
      console.debug('Ignoring message for old job:', data.job_id);
      return;
    }

    // Process valid message
    updateProgress(data);
    resetInvalidMessageCount();

  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn('Invalid JSON from server:', error.message);
      console.debug('Raw message (first 100 chars):',
        event.data.slice(0, 100));
      incrementInvalidMessageCount();

      // Reconnect if too many errors
      if (invalidMessageCount > MAX_INVALID_MESSAGES) {
        console.warn('Too many invalid messages, reconnecting...');
        reconnect();
      }
    } else {
      console.error('Unexpected error processing message:', error);
    }
  }
};
```

### 2. WebSocket Error Handler

```typescript
const handleWebSocketError = (event: Event) => {
  console.error('WebSocket error:', event);

  // WebSocket error event doesn't provide much detail
  // The onclose handler will fire next with more info
  setError('Connection error. Reconnecting...');
  setIsReconnecting(true);

  // Schedule reconnection
  scheduleReconnection();
};
```

### 3. Connection Close Handler

```typescript
const handleWebSocketClose = (event: CloseEvent) => {
  const code = event.code;
  const reason = event.reason;

  console.log(`WebSocket closed: code=${code}, reason="${reason}"`);

  // Check if we should reconnect
  const shouldReconnect = determineReconnectionStrategy(code, reason);

  if (!shouldReconnect) {
    // Graceful closure - final state already set
    return;
  }

  // Unexpected closure - attempt reconnection
  setIsReconnecting(true);
  scheduleReconnection();
};

const determineReconnectionStrategy = (
  code: number,
  reason: string
): boolean => {
  // Don't reconnect for these terminal codes
  if (code === 1000) {
    // 1000 = Normal closure
    console.info('Server closed connection normally');
    return false;
  }

  if (code === 1008) {
    // 1008 = Policy violation
    console.error('Server rejected connection (policy violation)');
    setError('Your connection was rejected by the server');
    return false;
  }

  if (code === 1009) {
    // 1009 = Message too big
    console.error('Message size exceeded limit');
    setError('Server message size exceeded');
    return false;
  }

  // Check close reason for special cases
  if (reason.toLowerCase().includes('completed')) {
    setStage(ProgressStage.COMPLETED);
    setProgress(100);
    return false;
  }

  if (reason.toLowerCase().includes('failed')) {
    setStage(ProgressStage.FAILED);
    const errorMsg = reason.replace(/^failed[:\s]*/i, '');
    setError(errorMsg || 'Job failed on server');
    return false;
  }

  // Reconnect for all other cases
  return true;
};
```

---

## Connection Management

### 1. Exponential Backoff Reconnection

```typescript
const calculateBackoffDelay = (attempt: number): number => {
  const baseDelay = Math.min(
    config.initialBackoffMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxBackoffMs
  );

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 1000;
  return baseDelay + jitter;
};

const scheduleReconnection = () => {
  if (!isMountedRef.current) return;

  if (reconnectAttempt >= maxReconnectAttempts) {
    setError(
      `Failed to connect after ${maxReconnectAttempts} attempts. ` +
      'Please refresh the page or contact support.'
    );
    setIsReconnecting(false);
    return;
  }

  const backoff = calculateBackoffDelay(reconnectAttempt);
  const nextAttempt = reconnectAttempt + 1;

  console.info(
    `Scheduling reconnection attempt ${nextAttempt} ` +
    `in ${Math.round(backoff / 1000)} seconds`
  );

  setReconnectAttempt(nextAttempt);

  reconnectTimeoutRef.current = setTimeout(() => {
    if (isMountedRef.current) {
      connectWebSocket();
    }
  }, backoff);
};
```

### 2. Safe Connection Creation

```typescript
const connectWebSocket = async () => {
  if (!jobId) {
    console.warn('No jobId provided');
    return;
  }

  if (!isMountedRef.current) return;

  // Check browser support
  if (!isWebSocketSupported()) {
    setIsSupported(false);
    setError(
      'WebSocket is not supported in your browser. ' +
      'Please use a modern browser (Chrome, Firefox, Safari, Edge).'
    );

    // Fallback to polling if enabled
    if (config.enablePollingFallback) {
      startPollingFallback();
    }
    return;
  }

  try {
    // Get WebSocket URL (construct from window.location)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/job/${jobId}`;

    console.info(`Connecting to: ${wsUrl}`);

    // Create WebSocket with timeout
    const ws = new WebSocket(wsUrl);
    const connectTimeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn('WebSocket connection timeout');
        ws.close(1000, 'Connection timeout');
      }
    }, config.connectionTimeoutMs || 15000);

    ws.onopen = () => {
      clearTimeout(connectTimeoutId);

      if (!isMountedRef.current) {
        ws.close(1000, 'Component unmounting');
        return;
      }

      console.info('WebSocket connected');
      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempt(0);
      setError(null);

      websocketRef.current = ws;

      // Send initial ping to verify connection
      sendPing();
    };

    ws.onmessage = handleMessage;
    ws.onerror = handleWebSocketError;
    ws.onclose = handleWebSocketClose;

  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    setError('Failed to create connection');
    scheduleReconnection();
  }
};

const isWebSocketSupported = (): boolean => {
  return typeof WebSocket !== 'undefined' &&
         typeof window !== 'undefined' &&
         window.WebSocket !== null;
};
```

### 3. Clean Disconnection

```typescript
const disconnect = useCallback(() => {
  console.info('Disconnecting WebSocket');

  // Clear reconnection timeout
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }

  // Clear polling timeout if active
  if (pollingTimeoutRef.current) {
    clearTimeout(pollingTimeoutRef.current);
  }

  // Close WebSocket
  if (websocketRef.current &&
      websocketRef.current.readyState === WebSocket.OPEN) {
    websocketRef.current.close(1000, 'User disconnect');
  }

  // Clear abort controller
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  // Reset state
  setIsConnected(false);
  setIsReconnecting(false);
  setProgress(0);
  setStage(ProgressStage.PENDING);
  setMessage('');
  setError(null);
  setReconnectAttempt(0);

}, []);
```

---

## State Management

### 1. Initialize State with useReducer

```typescript
interface ProgressState {
  // Progress data
  progress: number;
  stage: ProgressStage;
  message: string;
  details?: ProgressMessage['details'];

  // Connection state
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;

  // Error state
  error: string | null;
  errorCode?: string;
  errorTime?: number;
  invalidMessageCount: number;

  // Metadata
  startTime: number | null;
  lastUpdateTime: number | null;
}

type ProgressAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS' }
  | { type: 'CONNECT_FAILURE'; error: string; errorCode: string }
  | { type: 'UPDATE_PROGRESS'; payload: ProgressMessage }
  | { type: 'SCHEDULE_RECONNECT'; attempt: number }
  | { type: 'INVALID_MESSAGE' }
  | { type: 'RESET_INVALID_MESSAGES' }
  | { type: 'SET_ERROR'; error: string; errorCode?: string }
  | { type: 'RESET' };

const initialState: ProgressState = {
  progress: 0,
  stage: ProgressStage.PENDING,
  message: '',
  isConnected: false,
  isReconnecting: false,
  reconnectAttempt: 0,
  error: null,
  invalidMessageCount: 0,
  startTime: null,
  lastUpdateTime: null,
};

const progressReducer = (
  state: ProgressState,
  action: ProgressAction
): ProgressState => {
  switch (action.type) {
    case 'CONNECT_START':
      return {
        ...state,
        isConnected: false,
        isReconnecting: true,
        error: null,
      };

    case 'CONNECT_SUCCESS':
      return {
        ...state,
        isConnected: true,
        isReconnecting: false,
        reconnectAttempt: 0,
        error: null,
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.payload.progress,
        stage: action.payload.stage as ProgressStage,
        message: action.payload.message,
        details: action.payload.details,
        lastUpdateTime: Date.now(),
        invalidMessageCount: 0, // Reset invalid count on success
      };

    case 'INVALID_MESSAGE':
      return {
        ...state,
        invalidMessageCount: state.invalidMessageCount + 1,
      };

    case 'SCHEDULE_RECONNECT':
      return {
        ...state,
        isConnected: false,
        isReconnecting: true,
        reconnectAttempt: action.attempt,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        errorCode: action.errorCode,
        errorTime: Date.now(),
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
};
```

### 2. Track Elapsed Time

```typescript
// Calculate elapsed time since start
const [elapsedSeconds, setElapsedSeconds] = useState(0);

useEffect(() => {
  if (!isConnected || !startTimeRef.current) return;

  const interval = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.floor((now - startTimeRef.current) / 1000);
    setElapsedSeconds(elapsed);
  }, 1000);

  return () => clearInterval(interval);
}, [isConnected]);

// Update start time when connection succeeds
useEffect(() => {
  if (isConnected && !startTimeRef.current) {
    startTimeRef.current = Date.now();
  }
}, [isConnected]);
```

### 3. Prevent State Updates After Unmount

```typescript
const isMountedRef = useRef(true);

// Safety wrapper for setState
const safeSetState = useCallback(<T,>(
  setter: React.Dispatch<React.SetStateAction<T>>,
  value: T
) => {
  if (isMountedRef.current) {
    setter(value);
  }
}, []);

// Use for all setState calls
safeSetState(setProgress, newProgress);
safeSetState(setError, newError);
```

---

## Edge Case Handlers

### 1. Handle Component Unmount

```typescript
useEffect(() => {
  return () => {
    // Cleanup on unmount
    isMountedRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    if (websocketRef.current &&
        websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.close(1000, 'Component unmounting');
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    console.info('useProgress hook cleanup complete');
  };
}, []);
```

### 2. Handle Job ID Changes

```typescript
useEffect(() => {
  // Close old connection
  if (websocketRef.current &&
      websocketRef.current.readyState === WebSocket.OPEN) {
    websocketRef.current.close(1000, 'Job ID changed');
  }

  // Cancel pending timers
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }

  if (pollingTimeoutRef.current) {
    clearTimeout(pollingTimeoutRef.current);
  }

  // Reset state
  dispatch({ type: 'RESET' });

  // Connect to new job if ID provided
  if (jobId) {
    startTimeRef.current = null;
    connectWebSocket();
  }
}, [jobId]);
```

### 3. Handle Invalid Message Recovery

```typescript
const MAX_INVALID_MESSAGES = 10;
const INVALID_MESSAGE_WINDOW = 60000; // 1 minute

useEffect(() => {
  if (invalidMessageCount <= 0) return;

  const timer = setTimeout(() => {
    // Reset counter after window
    dispatch({ type: 'RESET_INVALID_MESSAGES' });
  }, INVALID_MESSAGE_WINDOW);

  return () => clearTimeout(timer);
}, [invalidMessageCount]);

// After max invalid messages, reconnect
useEffect(() => {
  if (invalidMessageCount >= MAX_INVALID_MESSAGES) {
    console.warn(
      `Received ${MAX_INVALID_MESSAGES} invalid messages, ` +
      'reconnecting...'
    );
    disconnect();
    setTimeout(connectWebSocket, 1000);
  }
}, [invalidMessageCount]);
```

### 4. Handle Max Reconnection Attempts

```typescript
useEffect(() => {
  if (reconnectAttempt >= maxReconnectAttempts && isReconnecting) {
    dispatch({
      type: 'SET_ERROR',
      error: `Unable to connect after ${maxReconnectAttempts} attempts. ` +
             'Please refresh the page.',
      errorCode: 'MAX_ATTEMPTS_EXCEEDED'
    });

    // Log for debugging
    console.error('Max reconnection attempts exceeded', {
      jobId,
      lastProgress: progress,
      lastStage: stage,
      attempts: reconnectAttempt
    });

    // Allow manual retry
    setCanRetryManually(true);
  }
}, [reconnectAttempt, isReconnecting]);
```

---

## Testing Strategies

### 1. Unit Test: Invalid JSON Handling

```typescript
describe('useProgress - Invalid JSON', () => {
  it('should handle malformed JSON gracefully', () => {
    const { result } = renderHook(() => useProgress('job-123'));

    // Simulate invalid JSON message
    const mockWs = result.current as any;
    const invalidMessage = new MessageEvent('message', {
      data: '{"invalid": json}'
    });

    mockWs.handleMessage(invalidMessage);

    // Should not crash
    expect(result.current.error).toBeNull(); // Not a user-facing error
  });

  it('should reconnect after too many invalid messages', () => {
    const { result } = renderHook(() => useProgress('job-123'));

    // Send 11 invalid messages
    for (let i = 0; i < 11; i++) {
      const message = new MessageEvent('message', {
        data: 'invalid json'
      });
      // Simulate message
    }

    // Should attempt reconnection
    expect(result.current.isReconnecting).toBe(true);
  });
});
```

### 2. Unit Test: Component Unmount

```typescript
describe('useProgress - Unmount', () => {
  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useProgress('job-123'));

    const timeoutSpy = jest.spyOn(global, 'clearTimeout');

    unmount();

    // Should clear all timeouts
    expect(timeoutSpy).toHaveBeenCalled();
  });

  it('should not update state after unmount', () => {
    const { result, unmount } = renderHook(
      () => useProgress('job-123')
    );

    unmount();

    // Try to trigger a state update
    // Should not cause "update on unmounted component" warning
    expect(() => {
      // Simulate message after unmount
    }).not.toThrow();
  });
});
```

### 3. Integration Test: Full Reconnection Flow

```typescript
describe('useProgress - Reconnection', () => {
  it('should reconnect with exponential backoff', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() =>
      useProgress('job-123', {
        maxReconnectAttempts: 3,
        initialBackoffMs: 1000,
        maxBackoffMs: 8000
      })
    );

    // Simulate connection failure
    act(() => {
      // Trigger failure
    });

    expect(result.current.isReconnecting).toBe(true);

    // Should wait 1 second + jitter
    jest.advanceTimersByTime(2000);
    // Attempt 2

    jest.advanceTimersByTime(3000);
    // Attempt 3

    jest.useRealTimers();
  });
});
```

### 4. Mock WebSocket for Testing

```typescript
// test-utils/mock-websocket.ts
export class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  sentMessages: any[] = [];

  constructor(url: string) {
    this.url = url;
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: any) {
    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify(data)
    });
    this.onmessage?.(messageEvent);
  }

  simulateError(message: string = 'Connection error') {
    this.onerror?.(new Event('error'));
  }

  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = WebSocket.CLOSED;
    const closeEvent = new CloseEvent('close', { code, reason });
    this.onclose?.(closeEvent);
  }

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  close(code?: number, reason?: string) {
    this.simulateClose(code, reason);
  }
}

// Setup before tests
beforeEach(() => {
  (global as any).WebSocket = MockWebSocket;
});
```

---

## Summary

This implementation guide provides patterns for:
1. **Robust error handling** with try-catch blocks
2. **Connection management** with exponential backoff
3. **State management** with useReducer for complex state
4. **Edge case handling** for unmounts, job changes, and max attempts
5. **Testing strategies** with mock WebSocket and integration tests

The patterns prioritize:
- Preventing memory leaks
- Avoiding state updates after unmount
- Graceful degradation
- User-friendly error messages
- Proper cleanup
- Testability
