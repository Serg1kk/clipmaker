# useProgress Hook - Architecture Diagram & Flow

## Component Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Component                              │
│                   (e.g., ProgressTracker)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ calls hook
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        useProgress Hook                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input Parameters:                                               │
│  ├─ jobId: string | null                                        │
│  ├─ onProgressChange?: (n) => void                             │
│  ├─ onStatusChange?: (s) => void                               │
│  ├─ onError?: (e) => void                                      │
│  └─ reconnectConfig?: Partial<ReconnectConfig>                │
│                                                                   │
│  Internal State (useState):                                      │
│  ├─ progress: number          [0-100]                          │
│  ├─ status: string                                             │
│  ├─ error: string | null                                       │
│  └─ wsState: WebSocketState                                    │
│                                                                   │
│  Internal Refs (useRef):                                         │
│  ├─ wsRef: WebSocket | null                                    │
│  ├─ reconnectTimeoutRef: NodeJS.Timeout | null                │
│  ├─ reconnectAttemptsRef: number                              │
│  └─ messageQueueRef: ProgressMessage[]                        │
│                                                                   │
│  Callback Functions (useCallback):                              │
│  ├─ connect()              ─→ establish WebSocket              │
│  ├─ handleMessage()        ─→ parse & update state             │
│  ├─ handleWebSocketClose() ─→ manage reconnection              │
│  ├─ handleWebSocketError() ─→ error recovery                   │
│  ├─ reconnect()            ─→ manual reconnection              │
│  ├─ reset()                ─→ clear state                      │
│  └─ disconnect()           ─→ cleanup resources                │
│                                                                   │
│  Effects (useEffect):                                            │
│  └─ jobId change → connect/disconnect lifecycle               │
│                                                                   │
│  Return Object (UseProgressReturn):                             │
│  ├─ progress: number                                           │
│  ├─ status: string                                             │
│  ├─ isConnected: boolean                                       │
│  ├─ error: string | null                                       │
│  ├─ reconnect: () => void                                      │
│  └─ reset: () => void                                          │
│                                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ creates & manages
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WebSocket Connection                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  URL: ws[s]://host/ws/job/{jobId}                             │
│                                                                   │
│  Message Format (Inbound):                                      │
│  {                                                              │
│    type: 'progress' | 'status' | 'error' | 'ping' | ...      │
│    progress?: number         [0-100]                          │
│    status?: string                                            │
│    message?: string                                           │
│    error?: string                                             │
│    eta_seconds?: number                                       │
│  }                                                             │
│                                                                   │
│  Message Format (Outbound):                                     │
│  { type: 'pong' }                                             │
│                                                                   │
│  Connection States:                                             │
│  ├─ DISCONNECTED  (initial)                                   │
│  ├─ CONNECTING    (first attempt)                             │
│  ├─ CONNECTED     (active)                                    │
│  ├─ RECONNECTING  (after disconnect)                          │
│  └─ CLOSED        (permanently closed)                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Transition Diagram

```
                    ┌─────────────────────┐
                    │   DISCONNECTED      │
                    │   (Initial State)   │
                    └──────────┬──────────┘
                               │
                    (jobId provided)
                               │
                               ▼
                    ┌─────────────────────┐
                    │   CONNECTING        │
                    └──────────┬──────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
              (success)              (failure)
                   │                       │
                   ▼                       ▼
        ┌─────────────────────┐  ┌──────────────────┐
        │    CONNECTED        │  │  DISCONNECTED    │
        └──────────┬──────────┘  └────────┬─────────┘
                   │                      │
         (connection drops)         (reconnectAttempts < max)
                   │                      │
                   ▼                      ▼
        ┌─────────────────────┐  ┌──────────────────┐
        │ DISCONNECTED        │  │  RECONNECTING    │
        └──────────┬──────────┘  └────────┬─────────┘
                   │                      │
            (jobId = null)        (exponential backoff)
            (manual disconnect)           │
                   │                      ▼
                   │              ┌──────────────────┐
                   │              │  CONNECTING      │
                   │              └────────┬─────────┘
                   │                       │
                   └───────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    CLOSED / NULL    │
                    │  (Final State)      │
                    └─────────────────────┘
```

---

## Message Flow Sequence Diagram

```
Component          Hook              WebSocket           Backend
   │                │                    │                 │
   │──jobId────────►│                    │                 │
   │                │                    │                 │
   │                │────connect────────►│                 │
   │                │                    │                 │
   │                │◄──onopen──────────│                 │
   │                │                    │                 │
   │◄──isConnected──│                    │                 │
   │     (true)     │                    │                 │
   │                │◄───message(progress: 25)─────────────│
   │                │                    │                 │
   │◄──progress(25)─│ (update state)     │                 │
   │                │──pong────────────►│                 │
   │                │                    │                 │
   │                │◄───message(progress: 50)─────────────│
   │                │                    │                 │
   │◄──progress(50)─│                    │                 │
   │◄──status(...)──│                    │                 │
   │                │                    │                 │
   │   ... (more updates) ...            │                 │
   │                │                    │                 │
   │                │◄───message(progress: 100)───────────│
   │                │                    │                 │
   │◄──progress(100)│                    │                 │
   │                │                    │                 │
   │  (unmount)     │                    │                 │
   │────cleanup────►│                    │                 │
   │                │────close────────►│                 │
   │                │                    │                 │
   └────────────────────────────────────────────────────┘
```

---

## Reconnection Strategy Flow

```
WebSocket Connection Lost
      │
      ├─ Is close code in NO_RECONNECT_CODES?
      │     ├─ YES ─► Stop (no reconnection)
      │     └─ NO  ─► Continue
      │
      ├─ Have max attempts been reached? (maxAttempts = 5)
      │     ├─ YES ─► Stop (no more reconnection)
      │     └─ NO  ─► Continue
      │
      ├─ Calculate backoff delay:
      │     │
      │     ├─ delay = baseDelay × (multiplier ^ attempt)
      │     │          = 1000ms × (2 ^ attempt)
      │     │
      │     │ Attempt:  Delay:
      │     │   1       1000ms (1s)
      │     │   2       2000ms (2s)
      │     │   3       4000ms (4s)
      │     │   4       8000ms (8s)
      │     │   5      16000ms (16s)
      │     │ (capped at maxDelay = 30000ms)
      │     │
      │     └─► Wait for delay period
      │
      └─► Attempt reconnection
            │
            ├─ Success ─► Reset attempts to 0, return to CONNECTED
            │
            └─ Failure ─► Increment attempt counter, repeat flow
```

---

## Message Parsing Pipeline

```
Raw WebSocket Message
      │
      ▼
JSON.parse(event.data)
      │
      ├─ Parse Error? ─► Set error state, return
      │
      ▼
Validate Message Type
      │
      ├─ type === 'ping'? ─► Send pong, return
      │
      ├─ type === 'progress'?
      │     ├─ Extract progress value
      │     ├─ Clamp to [0, 100]
      │     ├─ Update state
      │     ├─ Call onProgressChange callback
      │     └─ Continue
      │
      ├─ type === 'status' or status field?
      │     ├─ Extract status string
      │     ├─ Update state
      │     ├─ Call onStatusChange callback
      │     └─ Continue
      │
      ├─ type === 'error' or error field?
      │     ├─ Extract error message
      │     ├─ Update error state
      │     ├─ Call onError callback
      │     └─ Continue
      │
      └─ Extract any other fields
            └─ Store for use by application
```

---

## Dependency Flow (useCallback & useEffect)

```
╔═══════════════════════════════════════════════════════════════╗
║                    useCallback Dependencies                    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  connect()                                                     ║
║  └─ deps: [jobId, onMessage?, onError?]                      ║
║                                                                ║
║  handleMessage()                                              ║
║  └─ deps: [wsState, onProgressChange?, onStatusChange?,       ║
║            onError?]                                          ║
║                                                                ║
║  handleWebSocketClose()                                       ║
║  └─ deps: [jobId, config, connect]                           ║
║                                                                ║
║  handleWebSocketError()                                       ║
║  └─ deps: [config, onError?, connect]                        ║
║                                                                ║
║  reconnect()                                                  ║
║  └─ deps: [connect]                                          ║
║                                                                ║
║  reset()                                                      ║
║  └─ deps: []                                                 ║
║                                                                ║
║  disconnect()                                                 ║
║  └─ deps: []                                                 ║
║                                                                ║
╠═══════════════════════════════════════════════════════════════╣
║                     useEffect Dependencies                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  Main Effect (lifecycle)                                     ║
║  ├─ Trigger: jobId changes                                   ║
║  ├─ Action: connect() if jobId provided                      ║
║  ├─ Cleanup: disconnect() on unmount or jobId change         ║
║  └─ deps: [jobId, connect, disconnect, reset]               ║
║                                                                ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Error Handling Decision Tree

```
WebSocket Error Event
      │
      ├─ Network Error?
      │     ├─ YES ─► Attempt exponential backoff reconnection
      │     └─ NO  ─► Continue
      │
      ├─ Connection Refused?
      │     ├─ YES ─► Attempt exponential backoff reconnection
      │     └─ NO  ─► Continue
      │
      ├─ Invalid Server Response?
      │     ├─ YES ─► Stop reconnection (policy violation)
      │     └─ NO  ─► Continue
      │
      ├─ Message Parse Error?
      │     ├─ YES ─► Log error, update error state, continue
      │     └─ NO  ─► Continue
      │
      └─ Unknown Error
            └─► Set error state, attempt reconnection
```

---

## Memory Management Lifecycle

```
Hook Mounted
      │
      ├─ Create: WebSocket ref
      ├─ Create: Reconnect timeout ref
      ├─ Create: Attempt counter ref
      ├─ Create: Message queue ref
      └─ Create: State variables
      │
Hook Active (connected)
      │
      ├─ Send: Pong on ping
      ├─ Receive: Progress/status/error messages
      ├─ Update: State based on messages
      └─ Call: Callbacks
      │
      │ (if disconnected)
      │ ├─ Schedule: Reconnection timeout
      │ ├─ Increment: Attempt counter
      │ └─ Enqueue: Pending messages (optional)
      │
Hook Unmounted or jobId changes
      │
      ├─ Clear: Reconnection timeout
      ├─ Close: WebSocket connection
      ├─ Reset: Attempt counter
      ├─ Clear: Message queue
      └─ Clear: All refs
      │
Memory Released
```

---

## Performance Characteristics

```
Operation                  Time Complexity    Space Complexity
──────────────────────────────────────────────────────────────
Initialize Hook           O(1)               O(1)
Send Message             O(1)               O(1)
Parse Message            O(n)               O(n)  [message size]
Update State             O(1)               O(1)
Reconnect Calculation    O(1)               O(1)
Message Queue Process    O(m)               O(m)  [queue size]
Full Connection Cycle    O(n+m)             O(n+m)

n = message payload size
m = queue message count

Memory Usage:
- Hook state:          ~500 bytes
- WebSocket object:    ~2-5 KB
- Message queue:       O(m × n) with m=queue size, n=avg message
- Timeout refs:        ~200 bytes
- Callbacks:           ~300 bytes

Typical: < 10 KB per hook instance
```

---

## Integration Points

```
┌─────────────────────────────────────────────────────┐
│         React Component Layer                       │
│  (Uses hook, renders UI based on state)            │
└────────────────┬────────────────────────────────────┘
                 │
          useProgress Hook
                 │
                 ├─ Calls backend API (indirectly)
                 ├─ Manages WebSocket connection
                 ├─ Parses JSON messages
                 └─ Invokes callbacks
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│           WebSocket Protocol Layer                  │
│  (JSON messages over ws:// or wss://)              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│        Backend Services / Job Processing            │
│  (Receives WebSocket connection, sends updates)    │
└─────────────────────────────────────────────────────┘
```

---

## Quick Comparison: Original vs useProgress Hook

```
BEFORE (App.jsx)                AFTER (useProgress Hook)
─────────────────────────       ──────────────────────

function useWebSocket()         function useProgress(input)
├─ Inline WebSocket logic      ├─ Encapsulated hook
├─ Manual state management     ├─ Built-in state
├─ Hard-coded URL building     ├─ Configurable URL builder
├─ No TypeScript               ├─ Full TypeScript support
├─ Limited error handling      ├─ Comprehensive error handling
└─ Hard to test                └─ Easy to test

Benefits of useProgress:
✓ Reusable across components
✓ Better type safety
✓ Improved error recovery
✓ Testable implementation
✓ Configurable behavior
✓ Message queueing
✓ Custom callbacks
✓ Clean API
```

---

## Deployment Checklist

```
Before Production:
─────────────────
□ All tests passing (unit + integration)
□ TypeScript compilation succeeds
□ ESLint passes without warnings
□ Memory leak tests passed
□ WebSocket error handling tested
□ Reconnection logic verified
□ Works with backend WebSocket server
□ Performance benchmarked
□ Documentation complete
□ Examples working
□ Code review approved

Monitoring in Production:
────────────────────────
□ Track WebSocket connection success rate
□ Monitor reconnection attempts
□ Log message parse errors
□ Track error types and frequency
□ Monitor component render performance
□ Check for memory leaks
□ Track callback invocation latency
```

This architecture provides a solid foundation for a production-ready progress tracking solution!
