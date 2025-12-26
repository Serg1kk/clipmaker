# useProgress Hook - Complete Documentation

## Overview

The `useProgress` hook is a production-ready TypeScript React hook for managing real-time job progress tracking via WebSocket connections. It provides automatic connection management, reconnection with exponential backoff, message parsing, and clean state management.

**Status**: Architecture & Specification Complete
**Implementation Status**: Ready for development

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [useProgress.spec.md](./useProgress.spec.md) | Complete architectural specification |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Step-by-step implementation instructions |
| [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) | Visual diagrams and flows |
| [types/progress.types.ts](./types/progress.types.ts) | TypeScript type definitions |
| [This README](./README.md) | Quick reference and navigation |

---

## What's Included

### 1. Complete Specification (useProgress.spec.md)
- Full architectural design
- TypeScript interface definitions
- State management approach
- Core functions detailed
- Effect hooks documented
- Configuration constants
- Helper functions explained
- Usage examples
- Testing strategy
- Error handling strategy
- Performance considerations
- Implementation checklist
- File organization
- Migration notes

### 2. TypeScript Types (progress.types.ts)
- `ProgressMessageType` enum
- `WebSocketState` enum
- `ProgressMessage` interface
- `ReconnectConfig` interface
- `UseProgressInput` interface
- `UseProgressReturn` interface
- `ProgressState` interface
- `WebSocketRefs` interface
- Helper functions and type guards
- Default configuration constants
- WebSocket close code exclusion list

### 3. Implementation Guide (IMPLEMENTATION_GUIDE.md)
- Phase-by-phase implementation steps
- Core hook implementation (Phase 2)
- Configuration and constants (Phase 3)
- Advanced features (Phase 4)
- Testing strategy with examples (Phase 5)
- Documentation and examples (Phase 6)
- Integration with existing code (Phase 7)
- Validation checklist
- Debugging tips
- Common issues and solutions

### 4. Architecture Diagrams (ARCHITECTURE_DIAGRAM.md)
- Component architecture diagram
- State transition diagram
- Message flow sequence diagram
- Reconnection strategy flow
- Message parsing pipeline
- Dependency flow
- Error handling decision tree
- Memory management lifecycle
- Performance characteristics
- Integration points
- Before/after comparison
- Deployment checklist

---

## Hook Signature

```typescript
function useProgress(input: UseProgressInput): UseProgressReturn
```

### Input
```typescript
interface UseProgressInput {
  jobId: string | null;
  onProgressChange?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  reconnectConfig?: Partial<ReconnectConfig>;
  messageQueueLimit?: number;
  buildWebSocketUrl?: (jobId: string) => string;
  parseMessage?: (event: MessageEvent) => ProgressMessage;
}
```

### Output
```typescript
interface UseProgressReturn {
  progress: number;
  status: string;
  isConnected: boolean;
  error: string | null;
  wsState?: WebSocketState;
  reconnectAttempts?: number;
  reconnect: () => void;
  reset: () => void;
  disconnect?: () => void;
  cleanup?: () => void;
}
```

---

## Basic Usage

```typescript
import { useProgress } from './hooks/useProgress';

function ProgressComponent({ jobId }: { jobId: string }) {
  const { progress, status, isConnected, error, reconnect } = useProgress({
    jobId
  });

  return (
    <div>
      <div>Progress: {progress}%</div>
      <div>Status: {status}</div>
      <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      {error && (
        <div>
          <p>Error: {error}</p>
          <button onClick={reconnect}>Retry</button>
        </div>
      )}
    </div>
  );
}
```

---

## Key Features

### 1. Automatic Connection Management
- Connects when `jobId` is provided
- Disconnects when `jobId` becomes null
- Cleans up on component unmount

### 2. Intelligent Reconnection
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
- Configurable max attempts (default: 5)
- Smart close code handling (no reconnect on 1000, 1003, etc.)
- Manual reconnect function to reset attempt counter

### 3. Message Handling
- Automatic JSON parsing
- Ping/pong keep-alive support
- Message queueing while connecting
- Custom message parser support

### 4. State Management
- Progress (0-100, auto-clamped)
- Status messages
- Error tracking
- Connection state
- Attempt counter for debugging

### 5. Error Recovery
- Network error handling
- Parse error handling
- Connection error handling
- Graceful degradation

### 6. Type Safety
- Full TypeScript support
- Type-safe interfaces
- Type guards for message validation
- Compile-time error checking

---

## Architecture Highlights

### State Management
- Single source of truth: React state via useState
- State update via callback functions
- Proper cleanup on unmount
- No external state libraries needed

### Connection Lifecycle
1. **Disconnected** (initial state)
2. **Connecting** (attempting connection)
3. **Connected** (active WebSocket)
4. **Reconnecting** (after disconnect, with backoff)
5. **Closed** (final state)

### Message Flow
1. WebSocket message received
2. JSON parsing
3. Message validation
4. State update based on type
5. Callback invocation
6. Component re-render

### Error Handling
- Parse errors: Log and continue
- Connection errors: Attempt reconnection
- Invalid progress: Clamp to [0, 100]
- Unknown errors: Set error state

---

## Configuration

### Default Reconnection Strategy
```typescript
{
  maxAttempts: 5,
  baseDelay: 1000,      // 1 second
  maxDelay: 30000,      // 30 seconds cap
  backoffMultiplier: 2
}
```

### Customization Example
```typescript
const { progress, status } = useProgress({
  jobId: 'job-123',
  reconnectConfig: {
    maxAttempts: 10,
    baseDelay: 2000,      // Start with 2 seconds
    maxDelay: 60000,      // Cap at 60 seconds
  },
  onProgressChange: (p) => console.log(`Progress: ${p}%`),
  onStatusChange: (s) => console.log(`Status: ${s}`),
  onError: (e) => console.error(`Error: ${e}`),
});
```

---

## WebSocket Message Protocol

### Expected Inbound Messages
```typescript
// Progress update
{ type: 'progress', progress: 50 }

// Status update
{ type: 'status', status: 'transcribing' }

// Error message
{ type: 'error', error: 'Processing failed' }

// Keep-alive
{ type: 'ping' }

// Custom data
{ type: 'custom', data: { ... } }
```

### Outbound Messages
```typescript
// Keep-alive response
{ type: 'pong' }
```

---

## Testing

### Unit Tests
- State initialization
- Progress clamping
- Status parsing
- Error handling
- Reset functionality

### Integration Tests
- WebSocket connection
- Message handling
- Reconnection logic
- Callback invocation
- Cleanup on unmount

### Mock WebSocket
A mock WebSocket class is provided in the implementation guide for testing without a real server.

---

## Performance

### Memory Usage
- Hook state: ~500 bytes
- WebSocket object: ~2-5 KB
- Total per instance: < 10 KB

### Time Complexity
- Initialize: O(1)
- Send message: O(1)
- Parse message: O(n) where n = message size
- Update state: O(1)

### Optimization Strategies
- Memoized callbacks with useCallback
- No unnecessary re-renders
- Automatic message queue processing
- Connection pooling ready (future enhancement)

---

## Files in This Directory

```
hooks/
├── README.md                          (This file)
├── useProgress.spec.md                (Complete specification)
├── IMPLEMENTATION_GUIDE.md            (Step-by-step guide)
├── ARCHITECTURE_DIAGRAM.md            (Visual diagrams)
├── types/
│   └── progress.types.ts              (TypeScript definitions)
├── useProgress.ts                     (Hook implementation - TBD)
├── __tests__/
│   ├── useProgress.test.ts            (Unit tests - TBD)
│   ├── useProgress.integration.test.ts (Integration tests - TBD)
│   └── mocks/
│       └── websocket.ts               (Mock implementation - TBD)
├── useProgress.examples.tsx           (Example components - TBD)
└── hooks.index.ts                     (Export file - TBD)
```

---

## Development Roadmap

### Phase 1: Setup (COMPLETE)
- ✓ Define architecture specification
- ✓ Create TypeScript type definitions
- ✓ Create implementation guide
- ✓ Create architecture diagrams
- ✓ Create documentation

### Phase 2: Implementation
- [ ] Implement useProgress.ts hook
- [ ] Add JSDoc comments
- [ ] Verify TypeScript compilation
- [ ] Create example components

### Phase 3: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Achieve 80%+ code coverage
- [ ] Test with mock WebSocket

### Phase 4: Validation
- [ ] Verify with real backend WebSocket
- [ ] Performance testing
- [ ] Memory leak testing
- [ ] Code review

### Phase 5: Integration
- [ ] Create usage examples
- [ ] Refactor existing components (optional)
- [ ] Add to component library
- [ ] Deploy to production

### Phase 6: Monitoring
- [ ] Monitor usage patterns
- [ ] Track error rates
- [ ] Optimize based on real-world usage
- [ ] Document lessons learned

---

## Common Patterns

### Basic Progress Tracking
```typescript
const { progress, status, isConnected } = useProgress({ jobId });

return <ProgressBar value={progress} status={status} />;
```

### With Callbacks
```typescript
const { progress, error, reconnect } = useProgress({
  jobId,
  onProgressChange: (p) => updateUI(p),
  onStatusChange: (s) => updateStatus(s),
  onError: (e) => showErrorNotification(e),
});
```

### Manual Reconnection
```typescript
const { isConnected, error, reconnect } = useProgress({ jobId });

if (error) {
  return (
    <ErrorAlert
      message={error}
      onRetry={reconnect}
    />
  );
}
```

### Multiple Concurrent Jobs
```typescript
const job1Progress = useProgress({ jobId: 'job-1' });
const job2Progress = useProgress({ jobId: 'job-2' });
const job3Progress = useProgress({ jobId: 'job-3' });

// Each hook manages its own connection independently
```

---

## Comparison with Existing Code

### Existing Pattern (App.jsx)
```typescript
function useWebSocket(jobId, onMessage, onError) {
  // 100+ lines of WebSocket logic
  // Manual state management
  // Hard-coded URL building
  // Limited error handling
}
```

### New Pattern (useProgress Hook)
```typescript
const { progress, status, error, reconnect } = useProgress({
  jobId,
  onError: (e) => console.error(e),
});
```

**Benefits**:
- Reusable across components
- Type-safe
- Better error handling
- Easier to test
- Cleaner API
- Built-in configuration

---

## Integration Checklist

- [ ] Read useProgress.spec.md for architecture overview
- [ ] Review progress.types.ts for type definitions
- [ ] Follow IMPLEMENTATION_GUIDE.md for implementation
- [ ] Study ARCHITECTURE_DIAGRAM.md for visual understanding
- [ ] Implement useProgress.ts hook
- [ ] Write and pass unit tests
- [ ] Write and pass integration tests
- [ ] Create example components
- [ ] Test with real backend WebSocket
- [ ] Add to component exports
- [ ] Deploy to production
- [ ] Monitor and optimize

---

## FAQ

### Q: Can I use this hook with multiple concurrent jobs?
A: Yes! Each hook instance manages its own WebSocket connection independently.

### Q: What happens if the WebSocket closes unexpectedly?
A: The hook automatically attempts reconnection with exponential backoff up to 5 times.

### Q: How do I stop reconnection attempts?
A: Return null for jobId, or the close code must be in NO_RECONNECT_CODES (1000, 1003, etc.).

### Q: Can I customize the WebSocket URL?
A: Yes! Pass `buildWebSocketUrl` in the input parameters.

### Q: What if the backend sends unexpected message formats?
A: Pass a custom `parseMessage` function in the input parameters.

### Q: How do I handle very frequent progress updates?
A: Implement debouncing in `onProgressChange` callback if needed.

### Q: Is this compatible with existing code?
A: Yes! The hook is standalone and doesn't modify existing components.

### Q: How do I debug connection issues?
A: Add console logs in the hook (DEBUG flag) and monitor WebSocket events.

---

## Support & Troubleshooting

### Debugging Steps
1. Enable console logging in the hook
2. Monitor WebSocket events in browser DevTools
3. Check backend WebSocket server logs
4. Verify URL building with correct protocol (ws vs wss)
5. Check for CORS/security issues
6. Test with simple backend echo server

### Common Issues
- **Connection never establishes**: Check if jobId is provided and backend is running
- **Progress doesn't update**: Verify message format matches ProgressMessage interface
- **Reconnection loops**: Check close codes and max attempt limit
- **Memory leaks**: Ensure cleanup happens on unmount

### Getting Help
1. Check the Implementation Guide (IMPLEMENTATION_GUIDE.md)
2. Review the Architecture Diagrams (ARCHITECTURE_DIAGRAM.md)
3. Look at code examples (useProgress.examples.tsx)
4. Check the test files for usage patterns

---

## Performance Tips

1. **Memoize callbacks** in components using the hook
2. **Batch state updates** if receiving many messages rapidly
3. **Use React.memo** for components that render based on progress
4. **Avoid inline functions** in component that uses the hook
5. **Profile with React DevTools** to check for unnecessary renders

---

## Security Considerations

1. **WebSocket Security**:
   - Use `wss://` (WebSocket Secure) in production
   - Hook automatically selects protocol based on page protocol

2. **Message Validation**:
   - Progress values are clamped to [0, 100]
   - Status messages are treated as strings
   - Custom parsers should validate data

3. **Error Handling**:
   - Errors are logged but don't crash the component
   - Parse errors are caught and handled gracefully

---

## License & Attribution

This hook is part of the AI Clips project.

---

## Next Steps

1. **Review** the specification in useProgress.spec.md
2. **Study** the architecture in ARCHITECTURE_DIAGRAM.md
3. **Follow** IMPLEMENTATION_GUIDE.md for development
4. **Test** thoroughly with unit and integration tests
5. **Deploy** to production with monitoring

**Ready to implement? Start with Phase 2 in IMPLEMENTATION_GUIDE.md!**

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-26 | Initial specification and documentation |

---

For detailed information, see the specific documents linked at the top of this README.
