# Test Architecture & Visual Guide

## Test Pyramid Overview

```
                          /\
                         /  \
                        /    \
                       /  E2E \           End-to-End Tests
                      /        \          - Complete workflows
                     /----------\         - Real user scenarios
                    /            \        - ~10 tests, 5 min
                   /  Integration \
                  /                \      Integration Tests
                 /                  \     - Component interactions
                /--------------------\   - Status transitions
               /                      \   - ~10 tests, 5 min
              /                        \
             /       UNIT TESTS         \  Unit Tests
            /                            \ - Utilities (12 tests)
           /                              \- Hooks (38 tests)
          /                                \- Components (40 tests)
         /________________________________\ - ~90 tests, 4 min

Total: ~150 tests, <5 seconds execution
Coverage: 85%+ across all layers
```

---

## Test Coverage Map

### Layer 1: Utility Functions (12 tests)
```
statusHelpers.test.js (11 tests)
├── getStatusColor()
│   ├── IDLE → colors
│   ├── UPLOADING → colors
│   ├── PROCESSING → colors
│   ├── COMPLETED → colors
│   ├── ERROR → colors
│   ├── Unknown → default colors
│   └── Structure validation
│
└── getWsIndicatorColor()
    ├── CONNECTED → green
    ├── CONNECTING → orange
    ├── RECONNECTING → orange
    ├── DISCONNECTED → red
    └── Unknown → default

formatting.test.js (8 tests)
└── formatEta()
    ├── Null/Undefined → ""
    ├── Zero/Negative → ""
    ├── Seconds < 60 → "Xs"
    ├── Seconds >= 60 → "XmYs"
    ├── Rounding precision
    ├── Large values (hours)
    ├── Edge case: 60s
    └── Parameter validation
```

### Layer 2: Custom Hooks (38 tests)
```
useWebSocket.test.js (38 tests)
├── Initialization (3 tests)
│   ├── Hook returns correct shape
│   ├── Initial wsState = DISCONNECTED
│   └── Cleanup on unmount
│
├── Connection Lifecycle (8 tests)
│   ├── URL construction (ws:// vs wss://)
│   ├── jobId parameter handling
│   ├── State: CONNECTING → CONNECTED
│   ├── Previous connection cleanup
│   ├── Reconnect counter reset
│   ├── Connection error handling
│   └── Protocol detection
│
├── Message Processing (6 tests)
│   ├── JSON parsing
│   ├── onMessage callback
│   ├── Ping/Pong handling
│   ├── Invalid JSON handling
│   ├── Error logging
│   └── Operation continuity on errors
│
├── Error Handling (3 tests)
│   ├── State: ERROR → DISCONNECTED
│   ├── onError callback
│   └── Console logging
│
├── Auto-Reconnection (7 tests)
│   ├── Abnormal close triggers reconnect
│   ├── Normal close (1000) → no reconnect
│   ├── Max attempts (5) enforcement
│   ├── Exponential backoff (1s, 2s, 4s, 8s, 16s)
│   ├── State: RECONNECTING
│   ├── Timeout cleanup
│   └── Reconnect logging
│
└── Cleanup & Dependencies (5 tests)
    ├── WebSocket closure
    ├── Timeout cancellation
    ├── Ref cleanup
    ├── Counter reset
    └── Effect dependencies
```

### Layer 3: Component Tests (95+ tests)

#### 3a. Rendering Tests (10 tests)
```
├── Initial Render State
│   ├── Title visible
│   ├── Subtitle visible
│   ├── Dropzone present
│   ├── Upload icon (🎬)
│   ├── Upload hint text
│   ├── File input hidden
│   ├── Status card hidden
│   ├── Error hidden
│   ├── Result card hidden
│   └── Reset button hidden
```

#### 3b. File Input Tests (5 tests)
```
├── Click Behavior
│   ├── Dropzone click triggers file input
│   ├── File input accepts video/*
│   ├── handleFileSelect calls uploadFile
│   ├── Null selection handling
│   └── File state update
```

#### 3c. Drag & Drop Tests (10 tests)
```
├── Drag Events
│   ├── dragover → isDragging = true
│   ├── Active style applied
│   ├── dragleave → isDragging = false
│   ├── drop → file extraction
│   ├── preventDefault called
│   │
│   ├── Drop Validation
│   ├── Ignored when status ≠ IDLE
│   ├── Ignored with no files
│   ├── Ignored when disabled
│   └── uploadFile called on success
```

#### 3d. Upload Flow Tests (14 tests)
```
├── Initial State Changes
│   ├── status → UPLOADING
│   ├── progress → 0
│   ├── Clear previous errors
│   ├── Clear previous transcript
│   │
├── API Interaction
│   ├── FormData creation
│   ├── POST to /api/transcribe
│   ├── JSON response parsing
│   ├── jobId extraction
│   │
├── Success Flow
│   ├── status → PROCESSING
│   ├── progressMessage set
│   │
└── Error Handling
    ├── Network errors caught
    ├── Non-OK response handling
    ├── Error message display
    ├── Error detail parsing
    └── statusText fallback
```

#### 3e. UI Update Tests (8 tests)
```
├── Status Badge
│   ├── Visible when status ≠ IDLE
│   ├── Shows correct status
│   ├── Correct background color
│   └── Correct text color
│
├── Progress Display
│   ├── Progress bar reflects %
│   ├── File name displayed
│   ├── Progress message shown
│   └── ETA formatted
```

#### 3f. WebSocket Integration Tests (7 tests)
```
├── Indicator Display
│   ├── Visible during PROCESSING
│   ├── Hidden when not PROCESSING
│   ├── Dot color matches state
│   │
├── Status Messages
│   ├── "Live updates" (CONNECTED)
│   ├── "Connecting..." (CONNECTING)
│   ├── "Reconnecting..." (RECONNECTING)
│   └── "Disconnected" (DISCONNECTED)
```

#### 3g. Message Handling Tests (12 tests)
```
├── Progress Message
│   ├── Type check
│   ├── Progress update
│   ├── Message update
│   ├── ETA update
│   ├── Stage: completed → COMPLETED, progress 100
│   ├── Stage: failed → ERROR with message
│   └── fetchResult called
│
├── Initial Status Message
│   ├── Status: completed → COMPLETED
│   ├── Status: failed → ERROR
│   ├── Progress extracted
│   │
└── Waiting Message
    └── progressMessage set
```

#### 3h. Result Display Tests (5 tests)
```
├── Card Display
│   ├── Card visible with transcript
│   ├── Title "Transcript" shown
│   ├── Copy button present
│   ├── Transcript text displayed
│   └── Correct styling applied
```

#### 3i. Copy to Clipboard Tests (3 tests)
```
├── Button Behavior
│   ├── Calls navigator.clipboard.writeText
│   ├── Passes transcript text
│   └── Disabled when no transcript
```

#### 3j. Error Display Tests (5 tests)
```
├── Error Card
│   ├── Visible when error exists
│   ├── Shows error text
│   ├── Correct styling
│   ├── Cleared on new upload
│   └── Network errors handled
```

#### 3k. Reset Functionality Tests (11 tests)
```
├── Button Display
│   ├── Visible after COMPLETED
│   ├── Visible after ERROR
│   ├── Hidden in IDLE
│   │
├── State Reset
│   ├── status → IDLE
│   ├── file → null
│   ├── transcript → ""
│   ├── error → ""
│   ├── progress → 0
│   ├── jobId → null
│   └── Allows new selection
```

#### 3l. Disabled State Tests (5 tests)
```
├── Disabled When Non-IDLE
│   ├── Dropzone disabled
│   ├── File input disabled
│   ├── Opacity reduced
│   ├── Click ignored
│   └── Drop ignored
```

### Layer 4: Integration Tests (8+ tests)

```
Complete Workflows
├── Happy Path: Upload → Process → Complete
│   ├── File selection
│   ├── Upload initiated
│   ├── Progress updates received
│   ├── Completion detected
│   ├── Transcript displayed
│   └── Reset available
│
├── Error Recovery: Upload Fails → Retry
│   ├── Upload failure
│   ├── Error shown
│   ├── Reset button clicked
│   ├── UI reset to IDLE
│   └── New upload succeeds
│
├── WebSocket Resilience: Drop → Reconnect → Resume
│   ├── Connection established
│   ├── Connection drops
│   ├── Reconnecting shown
│   ├── Auto-reconnect attempts
│   ├── Reconnection succeeds
│   └── Updates resume
│
├── State Transitions
│   ├── IDLE → UPLOADING → PROCESSING → COMPLETED → IDLE
│   ├── IDLE → UPLOADING → ERROR → IDLE
│   ├── PROCESSING → ERROR (mid-stream)
│   └── Status changes reflected in UI
│
└── Concurrent Operations
    ├── Multiple rapid file selections
    ├── WebSocket message during status change
    ├── Error during upload
    └── State consistency maintained
```

---

## Mock Strategy

```
Global Mocks (in setup.js)
├── WebSocket
│   ├── Constructor: new WebSocket(url)
│   ├── Methods: send(), close(), addEventListener()
│   ├── Properties: onopen, onmessage, onerror, onclose
│   └── Behavior: Simulates async connection
│
├── fetch() API
│   ├── POST /api/transcribe (upload)
│   ├── GET /api/transcribe/:jobId (result)
│   └── Error responses (500, 400, etc)
│
└── Clipboard API
    └── navigator.clipboard.writeText()

Test Fixtures (in fixtures/mockData.js)
├── Mock Messages
│   ├── Progress updates
│   ├── Completion messages
│   ├── Error messages
│   └── Connection messages
│
├── Mock Responses
│   ├── Upload success (jobId)
│   ├── Upload errors (detail)
│   └── Transcript results
│
└── Test Data
    ├── Mock files (mp4, mov, avi, etc)
    ├── Status constants
    ├── WebSocket states
    └── Color mappings
```

---

## Test Execution Flow

```
npm run test:run
│
├─ Load vitest.config.js
│
├─ Setup Global Environment (setup.js)
│  ├─ Mock WebSocket
│  ├─ Mock fetch
│  ├─ Mock clipboard
│  └─ Setup cleanup hooks
│
├─ Run Test Files
│  ├─ statusHelpers.test.js
│  │  ├─ getStatusColor tests
│  │  └─ getWsIndicatorColor tests
│  │
│  ├─ formatting.test.js
│  │  └─ formatEta tests
│  │
│  ├─ useWebSocket.test.js
│  │  ├─ Initialization
│  │  ├─ Connection
│  │  ├─ Messages
│  │  ├─ Errors
│  │  ├─ Reconnection
│  │  └─ Cleanup
│  │
│  └─ App.test.jsx
│     ├─ Rendering
│     ├─ File input
│     ├─ Drag & drop
│     ├─ Upload flow
│     ├─ UI updates
│     ├─ WebSocket integration
│     ├─ Message handling
│     ├─ Result display
│     ├─ Error handling
│     ├─ Reset
│     ├─ Disabled state
│     └─ Integration scenarios
│
├─ Cleanup (afterEach)
│  ├─ Clear DOM
│  ├─ Reset mocks
│  ├─ Clear timers
│  └─ Restore state
│
└─ Report Results
   ├─ Test count & status
   ├─ Coverage report
   └─ Performance metrics
```

---

## Coverage Map

```
App.jsx Coverage Targets:
├── Upload Function (100%)
│   ├── State initialization ✓
│   ├── FormData creation ✓
│   ├── API call ✓
│   ├── Success handling ✓
│   └── Error handling ✓
│
├── WebSocket Hook (95%)
│   ├── Connection ✓
│   ├── Messages ✓
│   ├── Errors ✓
│   ├── Reconnection ✓
│   └── Cleanup ✓
│
├── Event Handlers (100%)
│   ├── handleFileSelect ✓
│   ├── handleDrop ✓
│   ├── handleDragOver ✓
│   ├── handleDragLeave ✓
│   ├── copyToClipboard ✓
│   ├── resetState ✓
│   └── handleWsMessage ✓
│
├── State Management (90%)
│   ├── Status transitions ✓
│   ├── Progress updates ✓
│   ├── Error states ✓
│   └── File tracking ✓
│
└── UI Rendering (85%)
    ├── Initial state ✓
    ├── Status updates ✓
    ├── Error display ✓
    ├── Result display ✓
    ├── Disabled states ✓
    └── Responsive styles ○ (CSS not tested)
```

---

## Test Data Flow

```
Test Input
    ↓
    ├─ File Objects (mockData.js)
    ├─ WebSocket Messages (mockData.js)
    ├─ API Responses (global mocks)
    └─ Event Objects (created in tests)
    ↓
Component/Function
    ↓
    ├─ State updates (verified)
    ├─ API calls (mocked, verified)
    ├─ WebSocket events (mocked, verified)
    └─ DOM updates (verified)
    ↓
Test Assertions
    ↓
    ├─ State: expect(state).toBe(value)
    ├─ DOM: expect(screen.getByText()).toBeInTheDocument()
    ├─ Calls: expect(mockFetch).toHaveBeenCalledWith()
    └─ UI: expect(element).toHaveStyle()
    ↓
Results
    ↓
    ├─ ✓ Pass (test continues)
    └─ ✗ Fail (error reported, test stops)
```

---

## Performance Targets

```
Test Type              Expected Duration    Count    Total
─────────────────────────────────────────────────────────────
Utility (statusHelpers)        <10ms         12    ~120ms
Utility (formatting)            <5ms          8     ~40ms
Hook (useWebSocket)           <50ms         38   ~1900ms
Component (App.jsx)           <30ms         95   ~2850ms
Integration                   <100ms         8     ~800ms
─────────────────────────────────────────────────────────────
Total Suite                                153   ~5710ms (~5.7s)
```

**Optimization Strategies**:
- Parallel execution: Vitest default
- Fake timers: WebSocket delays
- Mock isolation: No real network
- Minimal DOM: Targeted queries

---

## CI/CD Integration Points

```
GitHub Actions Workflow
├─ Trigger: push, pull_request
├─ Steps:
│  ├─ Checkout code
│  ├─ Setup Node.js 18
│  ├─ Install dependencies
│  ├─ Run tests: npm run test:run
│  ├─ Generate coverage: npm run test:coverage
│  ├─ Upload to codecov
│  └─ Report results
└─ Status: Pass/Fail

Pre-commit Hook (Optional)
├─ Trigger: git commit
├─ Run: npm run test:run
├─ Fail: Prevents commit
└─ Warning: Slow (5-7s per commit)

Pre-push Hook (Recommended)
├─ Trigger: git push
├─ Run: npm run test:run && npm run test:coverage
├─ Fail: Prevents push
└─ Benefit: Catch issues before remote
```

---

## Success Metrics

```
Test Health Dashboard (after implementation)
│
├─ Coverage
│  ├─ Statements: 85%+ ✓
│  ├─ Branches: 75%+ ✓
│  ├─ Functions: 85%+ ✓
│  └─ Lines: 85%+ ✓
│
├─ Quality
│  ├─ All tests passing: ✓
│  ├─ No flaky tests: ✓
│  ├─ No test interdependencies: ✓
│  └─ Proper mocking: ✓
│
├─ Performance
│  ├─ Suite time < 6s: ✓
│  ├─ Unit tests < 50ms each: ✓
│  ├─ Hook tests < 100ms each: ✓
│  └─ Parallel execution enabled: ✓
│
└─ Maintainability
   ├─ Descriptive test names: ✓
   ├─ DRY test code (fixtures): ✓
   ├─ Clear assertion messages: ✓
   └─ Updated documentation: ✓
```

---

## Document Relationships

```
TEST_PLAN.md (Detailed Spec)
    ↓ Referenced by
    ├─ VITEST_SETUP_GUIDE.md (How to setup)
    │   ↓ Used by
    │   └─ Developer implementing tests
    │
    ├─ IMPLEMENTATION_CHECKLIST.md (What to do)
    │   ↓ Followed by
    │   └─ Developer tracking progress
    │
    ├─ TEST_PLAN_SUMMARY.md (Quick overview)
    │   ↓ Read by
    │   └─ PM, Tech Lead, QA
    │
    ├─ TEST_ARCHITECTURE.md (This file - Visual)
    │   ↓ Reference for
    │   └─ Understanding structure
    │
    └─ TEST_PLAN_README.md (Navigation)
        ↓ First stop for
        └─ Everyone
```

---

## File Structure Visualization

```
frontend/
├── src/
│   ├── App.jsx                       (Component being tested)
│   ├── main.jsx
│   │
│   └── __tests__/                    (Test Directory)
│       ├── setup.js                  (Global config)
│       ├── fixtures/
│       │   └── mockData.js           (Test data)
│       ├── utils/
│       │   ├── statusHelpers.test.js (12 tests)
│       │   └── formatting.test.js    (8 tests)
│       ├── hooks/
│       │   └── useWebSocket.test.js  (38 tests)
│       └── App.test.jsx              (95+ tests)
│
├── vitest.config.js                  (Test runner config)
├── vite.config.js
└── package.json                      (With test scripts)

docs/
├── TEST_PLAN.md                      (2,500+ lines)
├── TEST_PLAN_SUMMARY.md              (500+ lines)
├── VITEST_SETUP_GUIDE.md             (800+ lines)
├── IMPLEMENTATION_CHECKLIST.md       (400+ lines)
├── TEST_PLAN_README.md               (400+ lines)
└── TEST_ARCHITECTURE.md              (This file)
```

---

## Implementation Timeline

```
Hour 1: Setup (0-60 min)
├─ 0-15 min: Install dependencies
├─ 15-30 min: Create config files
├─ 30-45 min: Create setup.js and fixtures
└─ 45-60 min: Verify setup with first test

Hour 2: Unit Tests (60-120 min)
├─ 60-75 min: statusHelpers tests
├─ 75-85 min: formatting tests
├─ 85-105 min: useWebSocket hook tests
└─ 105-120 min: Run & debug

Hour 3: Component Tests (120-180 min)
├─ 120-135 min: Rendering tests
├─ 135-150 min: User interaction tests
├─ 150-170 min: Integration tests
└─ 170-180 min: Coverage verification

Final: 5-10 min coverage report and commit
```

---

## Summary

This architecture provides:

✓ **Complete Coverage**: 150+ tests across all layers
✓ **Fast Execution**: <6 seconds total
✓ **High Quality**: 85%+ coverage targets
✓ **Easy Maintenance**: Centralized mocks, reusable fixtures
✓ **Clear Structure**: Organized test files and patterns
✓ **Production Ready**: CI/CD integration examples included

**Status**: Ready for Implementation
