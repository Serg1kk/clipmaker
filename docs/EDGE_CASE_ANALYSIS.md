# useProgress WebSocket Hook - Comprehensive Edge Case Analysis

**Analysis Date:** 2025-12-26
**Agent Role:** ANALYST - Hive Mind Collective
**Objective:** Define error handling and recovery strategies for WebSocket progress tracking

---

## Executive Summary

This document provides a comprehensive analysis of 8 critical edge cases for the `useProgress` React hook that manages WebSocket connections for real-time transcription progress updates. Each scenario includes:
- What should happen (expected behavior)
- Error messages to display
- Required state changes
- Recovery strategies

---

## Architecture Context

### WebSocket Protocol
- **Endpoint:** `/ws/job/{job_id}`
- **Message Format:** JSON with type, job_id, stage, progress, message, timestamp
- **Heartbeat:** 30-second ping/pong intervals
- **Connection Timeout:** 120 seconds
- **Max Connections:** 100 per server

### Hook Interface
```typescript
interface UseProgressResult {
  progress: number;
  stage: ProgressStage;
  message: string;
  isConnected: boolean;
  error: string | null;
  isReconnecting: boolean;
  reconnectAttempt: number;
  maxReconnectAttempts: number;
}
```

### Expected Progress Stages
- `pending` - Job queued, waiting to start
- `extracting` - Audio extraction in progress (0-25%)
- `transcribing` - Transcription in progress (25-100%)
- `completed` - Job finished successfully
- `failed` - Job failed with error

---

## Edge Case Analysis

### 1. WebSocket Connection Failures

#### Scenario Description
The initial WebSocket connection attempt fails due to:
- Network unreachable
- DNS resolution failure
- Server rejecting connection
- Port blocked by firewall
- Server overloaded (HTTP 429, 503)

#### What Should Happen
1. Connection attempt fails immediately
2. Detect failure and enter retry mode
3. Wait exponential backoff time before retry
4. Display user-friendly error message
5. Allow manual retry trigger
6. Eventually give up after max attempts

#### Error Messages to Display
```typescript
// Immediate failure
"Unable to connect to progress updates. Checking connection..."

// After 1-3 retries
"Connecting... (Attempt 2 of 5)"

// After 5 retries (max reached)
"Failed to connect to progress updates after 5 attempts. Please refresh the page or contact support."

// Specific failure reasons
"Connection refused: Server may be down or unreachable"
"Network timeout: Please check your internet connection"
"Connection limit exceeded: Too many active jobs"
```

#### State Changes Required
```typescript
{
  isConnected: false,
  isReconnecting: true,
  reconnectAttempt: 1,
  error: "Unable to connect to progress updates",
  progress: 0,
  stage: "pending",
  lastErrorCode: "CONNECTION_FAILED",
  lastErrorTime: timestamp,
  shouldShowRetryButton: true
}
```

#### Recovery Strategy
```
Exponential Backoff Retry:
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds
- Attempt 6+: max out at 30 seconds

Max Attempts: 5-6 (configurable, ~2 minutes total)

Retry Reset: Reset attempt counter after 10 minutes of stable connection
```

**Implementation Details:**
```typescript
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF = 1000; // ms
const MAX_BACKOFF = 30000; // ms

const calculateBackoff = (attempt: number) => {
  return Math.min(INITIAL_BACKOFF * Math.pow(2, attempt), MAX_BACKOFF);
};

// Add jitter to prevent thundering herd
const backoffWithJitter = calculateBackoff(attempt) + Math.random() * 1000;
```

---

### 2. Server Sends Invalid JSON

#### Scenario Description
Server sends malformed data that cannot be parsed as JSON:
- Corrupted WebSocket frame
- Partial message concatenation
- Non-UTF8 binary data
- HTML error page instead of JSON
- Incomplete message (connection cut mid-frame)

#### What Should Happen
1. Catch JSON parse error
2. Log error with raw message data (truncated for security)
3. Skip invalid message, continue listening
4. Do NOT crash the hook or component
5. Optionally increment error counter
6. If error rate exceeds threshold, disconnect and reconnect

#### Error Messages to Display
```typescript
// For user (non-intrusive)
"Received invalid data from server. Retrying..."

// For developers (console only, not shown to user)
"Invalid JSON received: SyntaxError: Unexpected token < at position 0"
"Raw message (first 100 chars): '<!DOCTYPE html><html><head><title>503...'"
```

#### State Changes Required
```typescript
{
  isConnected: true, // Still connected at socket level
  error: null, // Don't show user-facing error
  invalidMessageCount: (previous + 1),
  lastInvalidMessageTime: timestamp,
  shouldReconnect: invalidMessageCount > 10 // If too many errors
}
```

#### Recovery Strategy
```
Invalid Message Handling:
1. Try to parse with JSON.parse()
2. Catch SyntaxError
3. Log raw message (first 100 chars only)
4. Track error count
5. If > 10 invalid messages in 60 seconds:
   - Close connection gracefully
   - Mark as reconnecting
   - Initiate reconnection with backoff
6. Otherwise, continue listening

Safety Checks:
- Never expose raw message to user
- Cap logged message length to 500 chars
- Reset invalid message counter every 60 seconds
```

**Implementation:**
```typescript
const MAX_INVALID_MESSAGES = 10;
const INVALID_MESSAGE_WINDOW = 60000; // ms

try {
  const data = JSON.parse(message);
  processProgressMessage(data);
} catch (error) {
  console.error('Invalid JSON:', error.message);
  console.debug('Raw (truncated):', message.slice(0, 100));

  setInvalidMessageCount(prev => prev + 1);

  if (invalidMessageCount > MAX_INVALID_MESSAGES) {
    // Reconnect
    reconnect();
  }
}
```

---

### 3. Network Interruption During Active Connection

#### Scenario Description
Connection is established and receiving messages, then suddenly breaks:
- Network cable disconnected
- WiFi connection dropped
- User goes offline (airplane mode, tunnel, etc.)
- Firewall/proxy closes idle connection
- Server network interface fails
- NAT binding expires without keepalive

#### What Should Happen
1. WebSocket `close` or `error` event fires
2. Update state to disconnected immediately
3. Show non-blocking reconnection UI
4. Preserve last known state (progress, stage)
5. Attempt reconnection with exponential backoff
6. Resume progress updates when reconnected
7. Detect if job completed while offline

#### Error Messages to Display
```typescript
// Connection loss detected
"Reconnecting... (Lost connection at 45% progress)"

// After 2-3 retries
"Trying to reconnect... (2 attempts)"

// Server confirms job is done
"Connection restored. Job completed: 100%"

// Job failed while offline
"Connection restored. Job failed: Audio format not supported"
```

#### State Changes Required
```typescript
{
  isConnected: false,
  isReconnecting: true,
  reconnectAttempt: 1,
  error: "Connection lost. Reconnecting...",
  lastKnownProgress: 45,
  lastKnownStage: "transcribing",
  connectionLostAt: timestamp,
  isOfflineMode: true // Flag to handle resume logic
}
```

#### Recovery Strategy
```
Network Recovery:
1. Detect disconnect via WebSocket.onclose or onerror
2. Save current state to state variable
3. Immediately show "Reconnecting" message
4. Preserve UI progress display at last known value
5. Begin exponential backoff reconnection
6. On successful reconnect:
   - Send "ping" to verify job still exists
   - Server responds with current state
   - Update UI with latest progress
   - Resume normal message flow
7. If job completed while offline:
   - Detect via server response
   - Show "Job completed" instead of resuming
   - Fetch final results

Resilience:
- Connection can be lost and restored instantly
- User experience: see "Reconnecting" for <2 seconds
- Resume transparently without user action
- Preserve state across brief disconnections (< 2 min)
```

**Implementation:**
```typescript
websocket.onclose = (event) => {
  setIsConnected(false);
  setIsReconnecting(true);
  setError("Connection lost. Reconnecting...");

  // Save state
  setLastKnownProgress(progress);
  setLastKnownStage(stage);

  // Schedule reconnection
  const backoff = calculateBackoff(reconnectAttempt);
  reconnectTimeoutRef.current = setTimeout(() => {
    reconnect();
  }, backoff);
};
```

---

### 4. Component Unmounts During Reconnection Attempt

#### Scenario Description
While the hook is attempting to reconnect (during the exponential backoff delay), the component unmounts:
- User navigates away from page
- Component is removed from DOM
- React.StrictMode causes unmount
- Modal closes
- Page refresh/reload
- Browser tab closed

#### What Should Happen
1. Detect component unmount via cleanup function
2. Cancel any pending reconnection timers
3. Abort any pending fetch/WebSocket creation
4. Close WebSocket if still open
5. Clear all state to prevent memory leaks
6. Suppress state update warnings
7. No error messages needed (user left intentionally)

#### Error Messages to Display
```
// None - this is expected behavior
// (User already left the page)
```

#### State Changes Required
```typescript
// No state updates after unmount
// Return early from all effects
// Clear refs: reconnectTimeoutRef.current = null
```

#### Recovery Strategy
```
Cleanup Pattern:
1. Use cleanup function in useEffect:
   return () => {
     // This runs on unmount
   }

2. Cancel pending reconnection:
   if (reconnectTimeoutRef.current) {
     clearTimeout(reconnectTimeoutRef.current);
   }

3. Close WebSocket:
   if (websocket && websocket.readyState === WebSocket.OPEN) {
     websocket.close(1000, "Component unmounting");
   }

4. Abort pending connection:
   if (abortController.signal) {
     abortController.abort();
   }

5. Clear state refs:
   isMountedRef.current = false; // Used to gate state updates

6. Use isMountedRef to prevent state updates:
   if (!isMountedRef.current) return; // Skip state updates
```

**Implementation:**
```typescript
const isMountedRef = useRef(true);
const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
const abortControllerRef = useRef<AbortController>();

useEffect(() => {
  return () => {
    // Cleanup on unmount
    isMountedRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (websocket) {
      websocket.close(1000, "Component unmounting");
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);

// Before any setState call:
if (!isMountedRef.current) return;
setState(newValue);
```

---

### 5. Multiple Rapid jobId Changes

#### Scenario Description
User rapidly switches between different jobs (e.g., clicking different project items):
- Job ID changes before previous connection stabilizes
- Multiple WebSocket connections attempting to open
- Race conditions between message subscriptions
- Progress updates arrive out of order
- Memory leak from unclosed connections

#### What Should Happen
1. Detect jobId has changed
2. Close previous WebSocket connection
3. Cancel pending reconnection timers
4. Reset all progress state to initial values
5. Start new connection with new jobId
6. Ensure only one active connection at a time
7. Messages from old jobId are ignored

#### Error Messages to Display
```typescript
// For user
"Switching to new project..."

// Or simply: show spinner while loading
// Message clears once new connection established
```

#### State Changes Required
```typescript
// OLD connection state cleared:
{
  isConnected: false,
  progress: 0,
  stage: "pending",
  message: "",
  error: null
}

// NEW connection initiated with new jobId
{
  isConnected: false,
  isReconnecting: true,
  reconnectAttempt: 0,
  currentJobId: "new-job-123"
}
```

#### Recovery Strategy
```
Dependency Tracking:
1. Create useEffect with jobId as dependency
2. On jobId change:
   - Close previous WebSocket
   - Cancel reconnection timers
   - Clear all state
   - Abort pending requests
3. Create new connection for new jobId
4. Track previous jobId to ignore old messages

Message Filtering:
- Tag each message with expected jobId
- Ignore messages that don't match current jobId
- Log warning if old jobId message arrives

Connection Cleanup:
- One connection per jobId at a time
- Close immediately when switching
- No lingering connections
```

**Implementation:**
```typescript
useEffect(() => {
  // Close old connection
  if (websocket) {
    websocket.close(1000, "Job ID changed");
  }
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }

  // Reset state
  setProgress(0);
  setStage("pending");
  setMessage("");
  setError(null);
  setIsConnected(false);
  setReconnectAttempt(0);

  // Connect to new job
  if (jobId) {
    connectWebSocket(jobId);
  }
}, [jobId]); // Only run when jobId changes

// In message handler:
const handleProgressMessage = (data) => {
  if (data.job_id !== jobId) {
    console.warn(`Ignoring message for old job: ${data.job_id}`);
    return; // Ignore old messages
  }
  // Process message
};
```

---

### 6. Server Closes Connection Gracefully vs Abruptly

#### Scenario Description
WebSocket connection closes in different ways:

**Graceful Closure (4000+ range):**
- Server closes with code 1000 (normal)
- Server closes with code 1001 (going away)
- Server sends close frame with reason

**Abrupt Closure (1000-3999 range or connection reset):**
- Server crashes
- Network connection reset
- Connection timeout (no keep-alive)
- Firewall/proxy forcibly closes
- No close frame sent

#### What Should Happen

**Graceful (1000, 1001, 1002, 1003):**
1. Interpret as intentional closure
2. Check close reason
3. If "job completed": don't reconnect, show final message
4. If "job failed": don't reconnect, show error
5. If "server maintenance": show message, reconnect later
6. If "user replaced": handle job ID change

**Abrupt (no close code or code 1006):**
1. Interpret as unintended disconnection
2. Reconnect immediately with backoff
3. Assume job is still running
4. Resume tracking from last known progress

#### Error Messages to Display
```typescript
// Graceful - job completed
"Job completed successfully!"

// Graceful - job failed
"Transcription failed: Audio format not supported"

// Graceful - maintenance
"Server is being updated. Reconnecting in 30 seconds..."

// Abrupt - connection lost
"Connection lost. Reconnecting..."

// Abrupt - timeout
"Connection timeout. Retrying..."
```

#### State Changes Required
```typescript
// Graceful completion
{
  isConnected: false,
  isReconnecting: false,
  stage: "completed",
  progress: 100,
  message: "Transcription completed",
  error: null,
  shouldReconnect: false
}

// Abrupt disconnection
{
  isConnected: false,
  isReconnecting: true,
  reconnectAttempt: 1,
  error: "Connection lost",
  message: "Reconnecting...",
  shouldReconnect: true
}
```

#### Recovery Strategy
```
Close Code Analysis:
1000 = Normal Closure → Don't reconnect
1001 = Going Away (server shutdown) → Show message, reconnect after delay
1002 = Protocol Error → Log error, attempt 1 reconnect, then give up
1003 = Unsupported Data → Don't reconnect, show error
1006 = Abnormal Closure → Reconnect immediately
1008 = Policy Violation → Don't reconnect, show error
1009 = Message Too Big → Don't reconnect, show error
1011 = Server Error → Reconnect with backoff
1012 = Service Restart → Reconnect with longer delay
1013 = Try Again Later → Reconnect with longer delay (server is overloaded)

No Close Code (Abrupt):
→ Treat as 1006, reconnect with backoff

Close Reason Analysis:
- Parse reason string
- Match against known patterns: "completed", "failed", "maintenance", "timeout"
- Adjust reconnection strategy accordingly
```

**Implementation:**
```typescript
const handleWebSocketClose = (event: CloseEvent) => {
  const code = event.code;
  const reason = event.reason;

  console.log(`WebSocket closed: ${code} - ${reason}`);

  // Check if graceful or abrupt
  if ([1000, 1001, 1002, 1003, 1008, 1009, 1011].includes(code)) {
    // Parse reason
    if (reason.includes("completed")) {
      setStage("completed");
      setProgress(100);
      setIsReconnecting(false);
      return;
    }
    if (reason.includes("failed")) {
      setError("Job failed: " + reason);
      setIsReconnecting(false);
      return;
    }
  }

  // Default to reconnect for other cases
  setIsConnected(false);
  setIsReconnecting(true);
  scheduleReconnection();
};
```

---

### 7. Maximum Reconnection Attempts Exceeded

#### Scenario Description
After retrying the configured number of times (5-6 attempts over ~2 minutes), all connections fail:
- Server is down for extended period
- Network is completely unavailable
- Firewall blocking all connections
- DNS permanently broken
- Server at capacity, rejecting connections

#### What Should Happen
1. Stop attempting to reconnect
2. Show clear error message to user
3. Provide manual action options:
   - "Refresh Page" button
   - "Go Back" to home
   - "Contact Support" link
   - "Retry Now" button (for manual retry)
4. Log error details for debugging
5. Store error state persistently (in state, not localStorage)
6. Allow user to manually trigger single retry

#### Error Messages to Display
```typescript
// After max attempts reached
"Unable to connect to progress updates after 5 attempts.
The server may be down or unreachable.
Please refresh the page to try again."

// With specific reason if known
"Unable to connect to progress updates.
Server not responding (connection timeout).
Please check your internet connection or contact support."

// Persistent error message on page
"Connection Failed"
"We couldn't connect to the server. Try refreshing the page."
```

#### State Changes Required
```typescript
{
  isConnected: false,
  isReconnecting: false,
  error: "Max reconnection attempts exceeded",
  reconnectAttempt: 5,
  maxReconnectAttempts: 5,
  shouldShowManualRetry: true,
  shouldShowContactSupport: true,
  canRetryManually: true,
  lastErrorCode: "MAX_ATTEMPTS_EXCEEDED",
  lastErrorTime: timestamp,
  connectionFailureReason: "Network or Server Error"
}
```

#### Recovery Strategy
```
Final Error Handling:
1. After max attempts exceeded:
   - Clear reconnection timeout
   - Set isReconnecting = false
   - Set error with clear message
   - Show UI with action buttons

User Actions Available:
- Refresh Page: Simple reload of entire app
- Go Back: Navigate to home/job list
- Retry Now: Single manual reconnection attempt
- Contact Support: Open support link

Manual Retry:
- Allow user to click "Retry Now" button
- Attempt ONE more connection
- If successful: proceed normally
- If failed: show error again

Logging:
- Log error with context
- Include: jobId, last progress, reconnect count, last error code
- Send to error tracking (Sentry, etc.)
- Include in user feedback form

Do NOT:
- Auto-refresh page
- Repeatedly reconnect forever
- Spam retry without user action
- Hide error from user
```

**Implementation:**
```typescript
const MAX_RECONNECT_ATTEMPTS = 5;

const handleReconnectionFailure = () => {
  if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
    // Give up
    setIsReconnecting(false);
    setError("Unable to connect after " + MAX_RECONNECT_ATTEMPTS + " attempts");
    setCanRetryManually(true);

    // Log for debugging
    console.error("Max reconnection attempts exceeded", {
      jobId,
      lastProgress: progress,
      lastStage: stage,
      attempts: reconnectAttempt
    });

    return;
  }

  // Schedule next retry
  const backoff = calculateBackoff(reconnectAttempt);
  reconnectTimeoutRef.current = setTimeout(() => {
    reconnect();
  }, backoff);
};

// User-triggered manual retry
const handleManualRetry = () => {
  setCanRetryManually(false);
  setReconnectAttempt(0); // Reset to allow new attempt series
  reconnect();
};
```

---

### 8. WebSocket Not Supported in Browser

#### Scenario Description
User's browser doesn't support WebSocket API:
- Very old browser (IE 8 and earlier)
- Embedded browser or WebView with limited features
- Browser running with JS disabled partially
- Custom/development environment without WebSocket support

#### What Should Happen
1. Detect WebSocket support on mount
2. If not supported:
   - Don't attempt to create WebSocket
   - Show graceful degradation message
   - Offer alternative (polling) or upgrade message
   - Log warning
3. If supported:
   - Proceed normally

#### Error Messages to Display
```typescript
// Option 1: Upgrade message
"This browser is too old to support real-time progress tracking.
Please upgrade to a modern browser (Chrome 16+, Firefox 11+, Safari 5.1+, Edge 12+)"

// Option 2: Fallback to polling
"Using fallback progress tracking (updates every 2 seconds)"

// Option 3: Disable feature gracefully
"Live progress updates are not available in your browser.
You can still view results after transcription completes."
```

#### State Changes Required
```typescript
{
  isConnected: false,
  isSupported: false,
  error: "WebSocket not supported in this browser",
  useFallback: true,
  fallbackMethod: "polling", // or "disabled"
  shouldShowUpgradeMessage: true
}
```

#### Recovery Strategy
```
Browser Support Detection:
1. On hook mount, check:
   if (typeof WebSocket === 'undefined') {
     // Not supported
   }

2. Set isSupported flag

3. Adjust behavior:
   - If supported: use WebSocket
   - If not supported & polling available: use polling fallback
   - If not supported & polling disabled: show message only

Fallback Options:
A) Polling (less ideal, but works):
   - Fetch progress from API every 2-5 seconds
   - Display message: "Using fallback updates"
   - Stop polling when complete or failed

B) Degraded experience:
   - Show initial status only
   - Tell user to refresh to see updates
   - Display message: "Live updates not available"

C) Upgrade prompt:
   - Clear message about browser support
   - Link to browser download pages
   - Alternative: use polling approach

Recommended: Option A or C
- Let user know clearly what's happening
- Don't silently fail
- Provide clear next steps
```

**Implementation:**
```typescript
const isWebSocketSupported = () => {
  return typeof WebSocket !== 'undefined' &&
         typeof window !== 'undefined';
};

useEffect(() => {
  if (!jobId) return;

  // Check browser support
  if (!isWebSocketSupported()) {
    setIsSupported(false);
    setError("WebSocket not supported. Please upgrade your browser.");

    // Fallback to polling if enabled
    if (useFallbackPolling) {
      startPollingFallback();
    }
    return;
  }

  // Proceed with WebSocket
  connectWebSocket(jobId);
}, [jobId]);

const startPollingFallback = () => {
  setUseFallback(true);
  const pollInterval = setInterval(async () => {
    try {
      const result = await fetchJobProgress(jobId);
      setProgress(result.progress);
      setStage(result.stage);

      if (result.stage === "completed" || result.stage === "failed") {
        clearInterval(pollInterval);
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 2000); // Poll every 2 seconds
};
```

---

## State Machine Overview

The hook should manage these states:

```
DISCONNECTED
├─ (jobId provided & supported)
└─ → CONNECTING

CONNECTING
├─ (connection successful)
├─ → CONNECTED
├─ (connection failed & attempts remaining)
└─ → RECONNECTING

CONNECTED
├─ (message received)
├─ → CONNECTED (state updated)
├─ (connection lost)
├─ → RECONNECTING
├─ (jobId changed)
└─ → DISCONNECTED

RECONNECTING
├─ (connection successful)
├─ → CONNECTED
├─ (max attempts exceeded)
├─ → FAILED
├─ (connection interrupted)
└─ → RECONNECTING

FAILED
├─ (user clicks retry)
├─ → CONNECTING
├─ (jobId changed)
└─ → DISCONNECTED

UNSUPPORTED
├─ (start polling fallback)
├─ → POLLING
└─ (show upgrade message)
```

---

## Error Severity Classification

### Critical (Block User)
1. WebSocket not supported → Show upgrade message
2. Max reconnection attempts exceeded → Block UI, show error
3. Job failed on server → Show failure reason

### High (Show Warning)
1. Connection lost → Show reconnecting message
2. Invalid JSON from server → Log, continue
3. Network interruption → Show reconnecting, preserve state

### Medium (Log & Continue)
1. Invalid message count high → Reconnect if threshold exceeded
2. Component unmount during reconnect → Normal cleanup
3. Multiple rapid job changes → Normal operation

### Low (Debug Only)
1. Heartbeat ping/pong messages → Log to console
2. Graceful closure codes → Log with context
3. Connection metadata → Periodic logging

---

## Testing Checklist

### Unit Tests (useProgress Hook)
- [ ] Connection success path
- [ ] Connection failure with retry
- [ ] Invalid JSON handling
- [ ] Job ID change during connection
- [ ] Component unmount cleanup
- [ ] Max reconnection attempts
- [ ] Browser support detection
- [ ] Message filtering for old job IDs
- [ ] State updates gated by isMounted flag
- [ ] Heartbeat/ping-pong messages

### Integration Tests
- [ ] Full reconnection flow with real WebSocket
- [ ] Multiple rapid job switches
- [ ] Network interruption simulation
- [ ] Server graceful closure
- [ ] Server abrupt closure
- [ ] Invalid message recovery
- [ ] Progress stage transitions
- [ ] Completion detection
- [ ] Failure detection
- [ ] Polling fallback (if implemented)

### E2E Tests
- [ ] User starts job, watches progress, completion
- [ ] User starts job, network goes down, comes back online
- [ ] User rapidly switches between jobs
- [ ] User refreshes page during job
- [ ] User closes browser tab
- [ ] Server returns invalid JSON
- [ ] Server closes connection gracefully
- [ ] Browser doesn't support WebSocket
- [ ] Old browser with polling fallback

---

## Summary Table

| Scenario | What Happens | Error Message | Recovery |
|----------|-------------|---------------|----------|
| **Connection Failed** | Immediate failure, retry with backoff | "Unable to connect..." | Exponential backoff, max 5 attempts |
| **Invalid JSON** | Parse error caught, message skipped | None (logged only) | Continue listening, reconnect if too many errors |
| **Network Interruption** | WebSocket closes, reconnect begins | "Reconnecting..." | Resume from last known state |
| **Component Unmounts** | Cleanup runs, timers cancelled | None | No state updates after unmount |
| **Rapid Job Changes** | Close old connection, start new | "Switching..." | Reset state, one connection at a time |
| **Graceful Closure** | Parse close code and reason | Varies (completion, failure, etc.) | May not reconnect if intentional |
| **Max Attempts Exceeded** | Stop retrying, show error | "Unable to connect after 5 attempts" | Manual retry button, refresh page |
| **No WebSocket Support** | Fallback to polling or show message | "Upgrade browser" or "Using fallback" | Upgrade or polling alternative |

---

## Configuration Recommendations

```typescript
// Hook configuration constants
const HOOK_CONFIG = {
  // Reconnection
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
  BACKOFF_JITTER_MS: 1000,

  // Error thresholds
  MAX_INVALID_MESSAGES: 10,
  INVALID_MESSAGE_WINDOW_MS: 60000,
  CONNECTION_TIMEOUT_MS: 15000,

  // Heartbeat
  HEARTBEAT_TIMEOUT_MS: 45000, // Should exceed server's 30s interval

  // Polling fallback (if used)
  POLL_INTERVAL_MS: 2000,
  MAX_POLL_ATTEMPTS: 30, // 60 seconds total

  // UI behavior
  SHOW_RECONNECTING_AFTER_MS: 500, // Don't show for brief glitches
  SHOW_ERROR_AFTER_MS: 2000, // Don't show for quick recovery
};
```

---

## Conclusion

The `useProgress` hook must be resilient to network failures, server errors, and user interactions while maintaining a clear user experience. Each edge case requires specific handling to prevent crashes, memory leaks, and confusing UI states. By implementing these strategies, the hook will provide reliable real-time progress tracking for transcription jobs.

**Critical Priorities:**
1. Never crash the app (catch all errors)
2. Always allow cleanup (unmount, job changes)
3. Preserve state across brief disconnections
4. Give up gracefully after max attempts
5. Provide clear error messages and recovery actions
6. Handle unsupported browsers gracefully
