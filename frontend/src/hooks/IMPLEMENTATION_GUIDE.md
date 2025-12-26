# useProgress Hook - Implementation Guide

## Quick Start

This guide provides step-by-step instructions for implementing the `useProgress` hook based on the architectural specification in `useProgress.spec.md`.

---

## Phase 1: Setup & Type Definitions

### Step 1.1: Verify Type Definitions
Location: `/frontend/src/hooks/types/progress.types.ts`

Ensure all types are properly defined:
- `ProgressMessageType` enum
- `WebSocketState` enum
- `ProgressMessage` interface
- `ReconnectConfig` interface
- `UseProgressInput` interface
- `UseProgressReturn` interface
- Helper functions and type guards

**File Status**: ✓ Complete - Ready to use

---

## Phase 2: Core Hook Implementation

### Step 2.1: Create Main Hook File

**File**: `/frontend/src/hooks/useProgress.ts`

**Implementation Steps**:

1. **Import dependencies**
   ```typescript
   import { useState, useRef, useCallback, useEffect } from 'react';
   import {
     ProgressMessage,
     ProgressMessageType,
     WebSocketState,
     UseProgressInput,
     UseProgressReturn,
     ReconnectConfig,
     DEFAULT_RECONNECT_CONFIG,
     NO_RECONNECT_CODES,
   } from './types/progress.types';
   ```

2. **Define helper functions** (Section 7 in spec)
   - `calculateBackoffDelay()`: Compute exponential backoff delay
   - `buildDefaultWebSocketUrl()`: Construct WebSocket URL
   - `isValidProgress()`: Validate progress value (0-100)

3. **Initialize state and refs**
   - useState for: progress, status, error, wsState
   - useRef for: wsRef, reconnectTimeoutRef, reconnectAttemptsRef, messageQueueRef

4. **Implement core connection function** (Section 4.1)
   - `connect()`: Establish WebSocket connection
   - Handle onopen, onmessage, onerror, onclose handlers
   - Use useCallback with dependencies

5. **Implement message handling** (Section 4.2)
   - `handleMessage()`: Parse and process incoming messages
   - Handle ping/pong keep-alive
   - Update state based on message type
   - Invoke callbacks

6. **Implement reconnection logic** (Section 4.3)
   - `handleWebSocketClose()`: Handle disconnect events
   - Implement exponential backoff
   - Respect NO_RECONNECT_CODES

7. **Implement error handling** (Section 4.4)
   - `handleWebSocketError()`: Process connection errors
   - Trigger reconnection
   - Update error state

8. **Implement control functions** (Sections 4.5-4.7)
   - `reconnect()`: Manual reconnection
   - `reset()`: Clear all state
   - `disconnect()`: Cleanup resources

9. **Add useEffect for lifecycle** (Section 5)
   - Trigger connection on jobId change
   - Cleanup on unmount
   - Handle dependencies correctly

10. **Return hook interface**
    ```typescript
    return {
      progress,
      status,
      isConnected: wsState === WebSocketState.CONNECTED,
      error,
      reconnect,
      reset,
    };
    ```

### Step 2.2: Implementation Checklist

- [ ] All imports correct
- [ ] Types properly imported from progress.types.ts
- [ ] Helper functions implemented
- [ ] State variables initialized
- [ ] Refs properly typed with useRef
- [ ] connect() function complete with all handlers
- [ ] handleMessage() parses messages correctly
- [ ] handleWebSocketClose() implements backoff correctly
- [ ] handleWebSocketError() triggers reconnection
- [ ] reconnect() resets attempt counter
- [ ] reset() clears all state
- [ ] disconnect() cleans up resources
- [ ] useEffect manages lifecycle correctly
- [ ] Return type matches UseProgressReturn
- [ ] All callbacks use useCallback
- [ ] All dependencies listed in useCallback/useEffect

---

## Phase 3: Configuration & Constants

### Step 3.1: Verify Default Configuration

The following constants should be defined:

```typescript
// From progress.types.ts
const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelay: 1000,      // 1 second
  maxDelay: 30000,      // 30 seconds
  backoffMultiplier: 2,
};

// WebSocket close codes to skip reconnection
const NO_RECONNECT_CODES = new Set([
  1000, // Normal closure
  1003, // Unsupported data
  1008, // Policy violation
  1009, // Message too big
  1011, // Server error
  1012, // Service restart
]);
```

### Step 3.2: WebSocket URL Building

Default implementation:
```typescript
const buildDefaultWebSocketUrl = (jobId: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/job/${jobId}`;
};
```

Allow override via `buildWebSocketUrl` in input parameters.

---

## Phase 4: Advanced Features

### Step 4.1: Optional Message Buffering

When connection not yet established, buffer incoming messages:

```typescript
const processMessageQueue = useCallback((): void => {
  while (messageQueueRef.current.length > 0) {
    const message = messageQueueRef.current.shift();
    if (message) {
      // Re-process buffered message
      updateStateFromMessage(message);
    }
  }
}, []);
```

### Step 4.2: Custom Message Parser

Allow consumers to provide custom parsing logic:

```typescript
const messageParser = input.parseMessage ||
  (event: MessageEvent): ProgressMessage => JSON.parse(event.data);
```

### Step 4.3: Keep-Alive Mechanism

Handle ping/pong to detect stale connections:

```typescript
if (message.type === ProgressMessageType.PING) {
  ws.send(JSON.stringify({ type: ProgressMessageType.PONG }));
  return;
}
```

---

## Phase 5: Testing Strategy

### Step 5.1: Unit Tests File

**File**: `/frontend/src/hooks/__tests__/useProgress.test.ts`

**Test Categories**:

1. **Initialization Tests**
   ```typescript
   describe('useProgress', () => {
     describe('initialization', () => {
       it('should initialize with default values', () => {
         // progress: 0, status: '', error: null, isConnected: false
       });

       it('should handle null jobId gracefully', () => {
         // Should not attempt connection
       });
     });
   });
   ```

2. **Connection Tests**
   ```typescript
   describe('connection', () => {
     it('should connect when jobId is provided', async () => {
       // Mock WebSocket, verify connect called
     });

     it('should use wss protocol for https', () => {
       // Mock window.location.protocol as 'https:'
       // Verify URL starts with 'wss:'
     });
   });
   ```

3. **Message Handling Tests**
   ```typescript
   describe('message handling', () => {
     it('should update progress on progress message', () => {
       // Send { type: 'progress', progress: 50 }
       // Verify progress state = 50
     });

     it('should clamp progress to 0-100', () => {
       // Send progress: 150
       // Verify progress = 100
     });

     it('should handle ping/pong keep-alive', () => {
       // Send ping, verify pong sent
     });
   });
   ```

4. **Reconnection Tests**
   ```typescript
   describe('reconnection', () => {
     it('should attempt reconnection on close', () => {
       // Simulate WebSocket close
       // Verify reconnection triggered after delay
     });

     it('should use exponential backoff', () => {
       // Simulate multiple closes
       // Verify delays: 1000ms, 2000ms, 4000ms, 8000ms, 16000ms
     });

     it('should stop reconnecting after max attempts', () => {
       // Simulate 5+ close events
       // Verify no more reconnection attempts
     });
   });
   ```

5. **Error Handling Tests**
   ```typescript
   describe('error handling', () => {
     it('should set error on message parse failure', () => {
       // Send invalid JSON
       // Verify error state contains error message
     });

     it('should not throw on WebSocket error', () => {
       // Simulate WebSocket error
       // Verify component doesn't throw
     });
   });
   ```

6. **Cleanup Tests**
   ```typescript
   describe('cleanup', () => {
     it('should cleanup on unmount', () => {
       // Render hook, unmount
       // Verify WebSocket closed
       // Verify timeout cleared
     });

     it('should cleanup on jobId change', () => {
       // Render with jobId=1, change to jobId=2
       // Verify old connection closed
       // Verify new connection established
     });
   });
   ```

### Step 5.2: Mock WebSocket Implementation

```typescript
// __tests__/mocks/websocket.ts
export class MockWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  readyState = WebSocket.CONNECTING;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    // Mock implementation
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: object): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Setup in test file
beforeEach(() => {
  global.WebSocket = MockWebSocket as any;
});
```

### Step 5.3: Integration Test Example

```typescript
it('should handle full lifecycle', async () => {
  const { result } = renderHook(() => useProgress({ jobId: 'job-123' }));

  // Initially disconnected
  expect(result.current.isConnected).toBe(false);
  expect(result.current.progress).toBe(0);

  // Simulate connection
  act(() => {
    mockWs.simulateOpen();
  });
  await waitFor(() => expect(result.current.isConnected).toBe(true));

  // Simulate progress update
  act(() => {
    mockWs.simulateMessage({ type: 'progress', progress: 50 });
  });
  expect(result.current.progress).toBe(50);

  // Simulate status update
  act(() => {
    mockWs.simulateMessage({ type: 'status', status: 'transcribing' });
  });
  expect(result.current.status).toBe('transcribing');

  // Simulate completion
  act(() => {
    mockWs.simulateMessage({ type: 'progress', progress: 100 });
  });
  expect(result.current.progress).toBe(100);

  // Cleanup
  act(() => {
    mockWs.close();
  });
  await waitFor(() => expect(result.current.isConnected).toBe(false));
});
```

---

## Phase 6: Documentation & Examples

### Step 6.1: Create Usage Examples

**File**: `/frontend/src/hooks/useProgress.examples.tsx`

Include:
- Basic usage example
- Advanced usage with callbacks
- Error handling example
- Multiple concurrent jobs
- Cleanup and unmount patterns

### Step 6.2: Add JSDoc Comments

All functions should include JSDoc:
```typescript
/**
 * Custom React hook for tracking job progress via WebSocket
 *
 * @param input Configuration for the hook
 * @returns Object with progress state and control functions
 *
 * @example
 * const { progress, status, isConnected, error, reconnect } = useProgress({
 *   jobId: 'job-123',
 *   onProgressChange: (p) => console.log(`Progress: ${p}%`)
 * });
 */
export function useProgress(input: UseProgressInput): UseProgressReturn {
  // ...
}
```

---

## Phase 7: Integration with Existing Code

### Step 7.1: Refactor App.jsx (Optional)

The existing `useWebSocket` hook in `App.jsx` can be refactored to use the new `useProgress` hook:

**Before**: Custom WebSocket hook with inline logic
**After**: Reuse `useProgress` hook

This is optional - the hook works independently of existing code.

### Step 7.2: Create Example Components

**File**: `/frontend/src/components/ProgressTracker.tsx`

A reusable component that uses the hook:

```typescript
interface ProgressTrackerProps {
  jobId: string;
}

export function ProgressTracker({ jobId }: ProgressTrackerProps) {
  const { progress, status, isConnected, error, reconnect } = useProgress({ jobId });

  return (
    <div className="progress-tracker">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="status">
        {status || 'Waiting for updates...'}
      </div>
      {error && (
        <div className="error">
          <p>{error}</p>
          <button onClick={reconnect}>Retry</button>
        </div>
      )}
      <div className="connection-indicator">
        <span className={`indicator ${isConnected ? 'connected' : 'disconnected'}`} />
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}
```

---

## Phase 8: Validation Checklist

### Before Marking Complete

- [ ] All types in progress.types.ts implemented
- [ ] useProgress.ts hook fully implemented
- [ ] All functions have JSDoc comments
- [ ] Hook passes all unit tests (at least 80% coverage)
- [ ] Hook passes all integration tests
- [ ] WebSocket URL building verified
- [ ] Reconnection with exponential backoff verified
- [ ] Message parsing verified
- [ ] Error handling verified
- [ ] Cleanup on unmount verified
- [ ] Cleanup on jobId change verified
- [ ] No memory leaks (verified with React DevTools)
- [ ] TypeScript compilation succeeds with no errors
- [ ] ESLint passes with no warnings
- [ ] Example components work with the hook
- [ ] Existing App.jsx still works (no breaking changes)
- [ ] Documentation complete and accurate

---

## Debugging Tips

### Enable Verbose Logging

Add this during development:

```typescript
const DEBUG = true;

const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[useProgress]', ...args);
};

const logError = (...args: unknown[]) => {
  if (DEBUG) console.error('[useProgress]', ...args);
};
```

Then use `log()` and `logError()` throughout the implementation.

### Monitor WebSocket Events

Add this in your component:

```typescript
useEffect(() => {
  console.log('useProgress state:', { progress, status, isConnected, error });
}, [progress, status, isConnected, error]);
```

### React DevTools Profiler

- Profile the component rendering
- Check if hook state updates cause unnecessary re-renders
- Verify callbacks are memoized correctly

---

## Common Issues & Solutions

### Issue: WebSocket connection never establishes
- **Check**: Is `jobId` being provided?
- **Check**: Is the backend WebSocket server running?
- **Check**: Is the URL protocol correct (ws vs wss)?
- **Solution**: Add console logs in `connect()` function

### Issue: Progress doesn't update
- **Check**: Is message format correct? `{ type: 'progress', progress: 50 }`
- **Check**: Is `handleMessage()` being called?
- **Check**: Are callbacks being invoked?
- **Solution**: Log incoming messages in `handleMessage()`

### Issue: Reconnection loops infinitely
- **Check**: Is the backend sending a close code?
- **Check**: Is the close code in `NO_RECONNECT_CODES`?
- **Check**: Has max attempt limit been reached?
- **Solution**: Check close event code and implement termination logic

### Issue: Memory leaks on unmount
- **Check**: Is cleanup function called?
- **Check**: Are all timeouts cleared?
- **Check**: Is WebSocket closed?
- **Solution**: Verify useEffect cleanup is working

---

## Next Steps

1. **Implement Phase 2** (Core Hook Implementation)
   - Create `/frontend/src/hooks/useProgress.ts`
   - Follow all steps in Section 2.1-2.2

2. **Implement Phase 5** (Testing)
   - Create test file with mock WebSocket
   - Run tests to verify implementation

3. **Implement Phase 6** (Documentation)
   - Add JSDoc comments
   - Create example components

4. **Integrate** with your application
   - Use in production components
   - Monitor for issues
   - Optimize based on usage patterns

---

## Questions?

Refer back to:
- `useProgress.spec.md` for detailed specifications
- `progress.types.ts` for type definitions
- This guide for implementation steps
- Existing `useVideoFiles.ts` for hook pattern reference
- Existing `App.jsx` WebSocket implementation for reference

Good luck with the implementation!
