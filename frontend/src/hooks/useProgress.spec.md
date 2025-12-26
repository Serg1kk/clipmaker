# useProgress Hook Architectural Specification

## Overview
The `useProgress` hook is a TypeScript React hook designed to manage real-time progress tracking for long-running backend jobs via WebSocket connections. It encapsulates connection management, message parsing, auto-reconnection with exponential backoff, and state management into a reusable interface.

---

## 1. Core Design Principles

### 1.1 State Management Architecture
- **Single Responsibility**: Each piece of state has one purpose
- **Automatic Lifecycle**: Handles connection/disconnection automatically based on jobId
- **Error Recovery**: Built-in exponential backoff reconnection strategy
- **Memory Cleanup**: Proper cleanup on unmount and jobId changes

### 1.2 WebSocket Message Protocol
The hook expects WebSocket messages in JSON format with the following structure:

```typescript
interface ProgressMessage {
  type: 'progress' | 'status' | 'error' | 'ping';
  progress?: number;        // 0-100
  status?: string;          // e.g., "transcribing", "processing", "completed"
  message?: string;         // Human-readable status message
  error?: string;           // Error message if type is 'error'
  eta_seconds?: number;     // Estimated seconds remaining
}
```

---

## 2. TypeScript Interface Definitions

### 2.1 Hook Input
```typescript
interface UseProgressInput {
  jobId: string | null;     // Job identifier; null disables connection
  onProgressChange?: (progress: number) => void;  // Optional callback
  onStatusChange?: (status: string) => void;      // Optional callback
  onError?: (error: string) => void;              // Optional error callback
}
```

### 2.2 Hook Return Type
```typescript
interface UseProgressReturn {
  // State
  progress: number;                    // Current progress 0-100
  status: string;                      // Current status message
  isConnected: boolean;                // WebSocket connection state
  error: string | null;                // Last error message or null

  // Controls
  reconnect: () => void;               // Manual reconnection function
  reset: () => void;                   // Reset all state to initial
}
```

### 2.3 Internal State Type
```typescript
interface ProgressState {
  progress: number;
  status: string;
  error: string | null;
  isConnected: boolean;
  reconnectAttempts: number;
  lastUpdate: Date;
}
```

### 2.4 WebSocket State Constants
```typescript
enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSED = 'closed',
}
```

### 2.5 Reconnection Strategy Configuration
```typescript
interface ReconnectConfig {
  maxAttempts: number;        // Default: 5
  baseDelay: number;          // Default: 1000ms
  maxDelay: number;           // Default: 30000ms (cap exponential growth)
  backoffMultiplier: number;  // Default: 2
}
```

---

## 3. State Management Details

### 3.1 State Variables (useState calls)
```typescript
const [progress, setProgress] = useState<number>(0);
const [status, setStatus] = useState<string>('');
const [error, setError] = useState<string | null>(null);
const [wsState, setWsState] = useState<WebSocketState>(WebSocketState.DISCONNECTED);

// Internal tracking
const wsRef = useRef<WebSocket | null>(null);
const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const reconnectAttemptsRef = useRef<number>(0);
const messageQueueRef = useRef<ProgressMessage[]>([]);
```

### 3.2 Derived State
```typescript
// Computed from wsState
const isConnected = wsState === WebSocketState.CONNECTED;

// Exposed to consumer
const progressState = {
  progress,
  status,
  error,
  isConnected,
};
```

---

## 4. Core Functions

### 4.1 WebSocket Connection Function
```typescript
const connect = useCallback(() => {
  if (!jobId) return;

  // Clean up existing connection
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.close(1000, 'Reconnecting');
  }

  // Update state to connecting/reconnecting
  const isReconnect = reconnectAttemptsRef.current > 0;
  setWsState(isReconnect ? WebSocketState.RECONNECTING : WebSocketState.CONNECTING);

  // Build WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws/job/${jobId}`;

  try {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Handle connection open
    ws.onopen = () => {
      setWsState(WebSocketState.CONNECTED);
      reconnectAttemptsRef.current = 0;
      setError(null);
      processMessageQueue();
    };

    // Handle incoming messages
    ws.onmessage = handleMessage;

    // Handle errors
    ws.onerror = handleWebSocketError;

    // Handle close
    ws.onclose = handleWebSocketClose;

  } catch (err) {
    handleConnectionError(err);
  }
}, [jobId]);
```

### 4.2 Message Handler
```typescript
const handleMessage = useCallback((event: MessageEvent) => {
  try {
    const data: ProgressMessage = JSON.parse(event.data);

    // Handle ping/pong keep-alive
    if (data.type === 'ping') {
      wsRef.current?.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    // Queue message if not yet connected
    if (wsState !== WebSocketState.CONNECTED) {
      messageQueueRef.current.push(data);
      return;
    }

    // Process progress update
    if (data.progress !== undefined) {
      const newProgress = Math.max(0, Math.min(100, data.progress));
      setProgress(newProgress);
    }

    // Process status update
    if (data.status) {
      setStatus(data.status);
      onStatusChange?.(data.status);
    }

    // Process error message
    if (data.type === 'error' || data.error) {
      const errorMsg = data.error || data.message || 'Unknown error';
      setError(errorMsg);
      onError?.(errorMsg);
    } else {
      setError(null);
    }

    // Trigger progress callback
    if (data.progress !== undefined) {
      onProgressChange?.(data.progress);
    }

  } catch (err) {
    console.error('Failed to parse WebSocket message:', err);
    setError(`Failed to parse message: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}, [wsState, onProgressChange, onStatusChange, onError]);
```

### 4.3 Reconnection Handler
```typescript
const handleWebSocketClose = useCallback((event: CloseEvent) => {
  setWsState(WebSocketState.DISCONNECTED);

  // Don't reconnect on clean close (1000) or policy violation (1003)
  const shouldReconnect = ![1000, 1003, 1008].includes(event.code);
  const hasAttemptsLeft = reconnectAttemptsRef.current < config.maxAttempts;

  if (shouldReconnect && hasAttemptsLeft && jobId) {
    const delay = calculateBackoffDelay(
      reconnectAttemptsRef.current,
      config.baseDelay,
      config.maxDelay,
      config.backoffMultiplier
    );

    reconnectAttemptsRef.current += 1;
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${config.maxAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  } else {
    reconnectAttemptsRef.current = 0;
    if (!shouldReconnect) {
      setError(`Connection closed: ${event.reason || event.code}`);
    }
  }
}, [jobId, config, connect]);
```

### 4.4 Error Handler
```typescript
const handleWebSocketError = useCallback((event: Event) => {
  console.error('WebSocket error:', event);
  const errorMessage = 'WebSocket connection error';
  setError(errorMessage);
  onError?.(errorMessage);

  // Trigger reconnection attempt
  if (!reconnectTimeoutRef.current) {
    const delay = calculateBackoffDelay(
      reconnectAttemptsRef.current,
      config.baseDelay,
      config.maxDelay,
      config.backoffMultiplier
    );

    reconnectAttemptsRef.current += 1;
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }
}, [config, onError, connect]);
```

### 4.5 Manual Reconnect Function
```typescript
const reconnect = useCallback(() => {
  reconnectAttemptsRef.current = 0;
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }
  connect();
}, [connect]);
```

### 4.6 Reset Function
```typescript
const reset = useCallback(() => {
  setProgress(0);
  setStatus('');
  setError(null);
  messageQueueRef.current = [];
}, []);
```

### 4.7 Cleanup Function
```typescript
const disconnect = useCallback(() => {
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }

  if (wsRef.current) {
    if (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING) {
      wsRef.current.close(1000, 'Component unmount');
    }
    wsRef.current = null;
  }

  reconnectAttemptsRef.current = 0;
  setWsState(WebSocketState.DISCONNECTED);
}, []);
```

---

## 5. Effect Hooks

### 5.1 Job ID Change Effect
```typescript
useEffect(() => {
  if (jobId) {
    reset();
    connect();
  } else {
    disconnect();
  }

  return () => {
    disconnect();
  };
}, [jobId, connect, disconnect, reset]);
```

### 5.2 Effect Dependencies
- Primary: `jobId` (triggers connection/disconnection)
- Secondary: `connect`, `disconnect`, `reset` (callback dependencies)

---

## 6. Configuration Constants

### 6.1 Defaults
```typescript
const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelay: 1000,      // 1 second
  maxDelay: 30000,      // 30 seconds
  backoffMultiplier: 2,
};
```

### 6.2 WebSocket Close Codes to Skip Reconnect
- `1000`: Normal closure
- `1003`: Unsupported data
- `1008`: Policy violation
- `1009`: Message too big
- `1011`: Server error

---

## 7. Helper Functions

### 7.1 Exponential Backoff Calculator
```typescript
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}
```

### 7.2 Message Queue Processor
```typescript
function processMessageQueue(): void {
  while (messageQueueRef.current.length > 0) {
    const message = messageQueueRef.current.shift();
    if (message) {
      handleMessage({ data: JSON.stringify(message) } as MessageEvent);
    }
  }
}
```

---

## 8. Usage Example

### 8.1 Basic Usage
```typescript
function JobProgressComponent({ jobId }: { jobId: string }) {
  const { progress, status, isConnected, error, reconnect } = useProgress({ jobId });

  return (
    <div>
      <div>Progress: {progress}%</div>
      <div>Status: {status}</div>
      <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

### 8.2 Advanced Usage with Callbacks
```typescript
function AdvancedJobComponent({ jobId }: { jobId: string }) {
  const [notification, setNotification] = useState('');

  const { progress, status, isConnected, error, reconnect, reset } = useProgress({
    jobId,
    onProgressChange: (p) => console.log(`Progress: ${p}%`),
    onStatusChange: (s) => setNotification(`Status: ${s}`),
    onError: (e) => console.error(`Error: ${e}`),
  });

  return (
    <div>
      <ProgressBar value={progress} />
      <StatusDisplay text={status} />
      {notification && <Toast message={notification} />}
      {error && <ErrorAlert message={error} onRetry={reconnect} />}
    </div>
  );
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests
- State initialization and defaults
- Progress boundary clamping (0-100)
- Status message parsing
- Error message handling
- Reset functionality

### 9.2 Integration Tests
- Connection establishment
- Message parsing and state updates
- Callback invocation
- Reconnection with exponential backoff
- Cleanup on unmount
- Cleanup on jobId change

### 9.3 Mock WebSocket Strategy
```typescript
// Create mock WebSocket for testing
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send(data: string): void {
    // Mock implementation
  }

  close(code?: number, reason?: string): void {
    // Mock implementation
  }
}

// Mock factory
global.WebSocket = MockWebSocket as any;
```

---

## 10. Error Handling Strategy

### 10.1 Error Categories
1. **Connection Errors**: Network issues, server unavailable
2. **Message Parse Errors**: Invalid JSON, unexpected format
3. **State Errors**: Invalid progress values, malformed status
4. **Lifecycle Errors**: Unmount during active operation

### 10.2 Error Recovery
- Connection errors: Auto-reconnect with exponential backoff
- Parse errors: Log and continue; don't stop other messages
- State errors: Clamp/validate values; use safe defaults
- Lifecycle errors: Ensure cleanup on unmount regardless

---

## 11. Performance Considerations

### 11.1 Memory Management
- WebSocket cleanup on disconnect
- Timeout cleanup on component unmount
- Message queue size limit (optional, default: unlimited)
- Avoid memory leaks from useCallback closures

### 11.2 Update Optimization
- Batch state updates when multiple messages arrive
- Debounce progress updates if needed (optional)
- Memoize callback functions to prevent unnecessary re-renders

### 11.3 Network Optimization
- WebSocket keep-alive via ping/pong
- Connection pooling (if multiple hooks share connection)
- Message compression (optional backend feature)

---

## 12. Implementation Checklist

- [ ] Define TypeScript interfaces (Section 2)
- [ ] Implement state variables and refs (Section 3)
- [ ] Create connection function (Section 4.1)
- [ ] Create message handler (Section 4.2)
- [ ] Create reconnection handler (Section 4.3)
- [ ] Create error handler (Section 4.4)
- [ ] Create manual reconnect function (Section 4.5)
- [ ] Create reset function (Section 4.6)
- [ ] Create cleanup/disconnect function (Section 4.7)
- [ ] Add useEffect for jobId changes (Section 5)
- [ ] Add helper functions (Section 7)
- [ ] Write unit tests (Section 9.1)
- [ ] Write integration tests (Section 9.2)
- [ ] Add JSDoc comments
- [ ] Create usage documentation
- [ ] Test with real backend WebSocket

---

## 13. File Organization

```
frontend/src/
├── hooks/
│   ├── useProgress.ts          (Implementation)
│   ├── useProgress.spec.md     (This file)
│   ├── __tests__/
│   │   └── useProgress.test.ts (Tests)
│   └── types/
│       └── progress.types.ts   (TypeScript definitions)
└── services/
    └── api.ts                   (Existing API service)
```

---

## 14. Migration Notes

- **From App.jsx WebSocket**: Extract `useWebSocket` logic into `useProgress`
- **Backward Compatibility**: Keep existing App.jsx component as-is initially
- **Gradual Adoption**: Refactor components one at a time to use new hook
- **Shared Constants**: Move `WS_STATE` enum to separate file if needed

---

## Summary

The `useProgress` hook provides a production-ready, fully-typed solution for managing WebSocket-based progress tracking. It handles all connection lifecycle concerns, automatic reconnection, error recovery, and state management in a clean, reusable interface suitable for enterprise React applications.
