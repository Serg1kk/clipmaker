# React Vite App Test Plan

**Project**: Video Transcription UI
**Framework**: React 18.2 + Vite 5.0
**Test Strategy**: Vitest + React Testing Library
**Target Coverage**: 85%+ (statements, branches, functions, lines)

---

## 1. Testing Architecture

### Test Pyramid
```
         /\
        /E2E\      <- Critical user flows
       /------\
      /Integration\ <- Component interactions
     /----------\
    /   Unit     \ <- Individual functions
   /--------------\
```

### Test Layers

**Layer 1: Unit Tests (70% of tests)**
- Pure functions (getStatusColor, formatEta, etc.)
- Hook logic (useWebSocket behavior)
- State management and callbacks
- Event handlers in isolation

**Layer 2: Integration Tests (20% of tests)**
- App component with file upload
- WebSocket message handling flow
- Status transitions
- Error handling and recovery

**Layer 3: E2E Tests (10% of tests)**
- Complete transcription workflow
- UI interactions (drag-drop, file selection)
- Real-world user scenarios

---

## 2. Test File Structure

```
frontend/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── __tests__/
│       ├── App.test.jsx
│       ├── hooks/
│       │   └── useWebSocket.test.js
│       ├── utils/
│       │   ├── statusHelpers.test.js
│       │   └── formatting.test.js
│       └── fixtures/
│           └── mockData.js
├── vitest.config.js
├── vite.config.js
└── package.json
```

---

## 3. Testing Dependencies to Install

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "jsdom": "^23.0.0",
    "happy-dom": "^12.10.3",
    "vi": "latest"
  }
}
```

**Installation Command:**
```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

---

## 4. Detailed Test Cases by Category

### 4.1 Unit Tests: Utility Functions

#### Test File: `src/__tests__/utils/statusHelpers.test.js`

**Function: `getStatusColor(status)`**
- ✅ Returns correct colors for IDLE status
- ✅ Returns correct colors for UPLOADING status
- ✅ Returns correct colors for PROCESSING status
- ✅ Returns correct colors for COMPLETED status
- ✅ Returns correct colors for ERROR status
- ✅ Returns default colors for unknown status
- ✅ Ensures color objects have bg and text properties

**Function: `getWsIndicatorColor(wsState)`**
- ✅ Returns green (#4aff6b) for CONNECTED state
- ✅ Returns orange (#ffb84a) for CONNECTING state
- ✅ Returns orange (#ffb84a) for RECONNECTING state
- ✅ Returns red (#ff6b6b) for DISCONNECTED state
- ✅ Returns default color for unknown state

---

#### Test File: `src/__tests__/utils/formatting.test.js`

**Function: `formatEta(seconds)`**
- ✅ Returns empty string for null/undefined
- ✅ Returns empty string for zero or negative seconds
- ✅ Returns "Xs remaining" for less than 60 seconds
  - Example: 45 seconds → "45s remaining"
  - Example: 1 second → "1s remaining"
- ✅ Returns "XmYs remaining" for seconds >= 60
  - Example: 125 seconds → "2m 5s remaining"
  - Example: 3661 seconds → "61m 1s remaining"
- ✅ Properly rounds seconds
  - Example: 45.7 seconds → "46s remaining"
- ✅ Handles edge case: exactly 60 seconds → "1m 0s remaining"
- ✅ Handles large values (hours) correctly
  - Example: 7200 seconds → "120m 0s remaining"

---

### 4.2 Unit Tests: Hook Logic

#### Test File: `src/__tests__/hooks/useWebSocket.test.js`

**Hook: `useWebSocket(jobId, onMessage, onError)`**

**Setup & Teardown**
- ✅ Returns object with wsState and disconnect properties
- ✅ Initial wsState is DISCONNECTED
- ✅ Properly cleans up on unmount

**Connection Logic**
- ✅ Creates WebSocket with correct URL format
- ✅ Constructs ws:// URL for HTTP protocol
- ✅ Constructs wss:// URL for HTTPS protocol
- ✅ Sets wsState to CONNECTING when connecting
- ✅ Sets wsState to CONNECTED on successful connection
- ✅ Closes existing connection before creating new one
- ✅ Resets reconnect attempts counter on successful connection

**Message Handling**
- ✅ Parses JSON messages correctly
- ✅ Calls onMessage callback with parsed data
- ✅ Handles ping messages and responds with pong
- ✅ Does not forward ping messages to onMessage
- ✅ Logs error on invalid JSON
- ✅ Continues operation on parse errors

**Error Handling**
- ✅ Sets wsState to DISCONNECTED on error
- ✅ Calls onError callback on WebSocket error
- ✅ Logs error to console

**Auto-Reconnection**
- ✅ Attempts reconnection on abnormal close (code !== 1000)
- ✅ Respects max reconnect attempts (5 attempts)
- ✅ Does not reconnect after normal close (code 1000)
- ✅ Uses exponential backoff for reconnect delays
  - Attempt 1: 1000ms
  - Attempt 2: 2000ms
  - Attempt 3: 4000ms
  - Attempt 4: 8000ms
  - Attempt 5: 16000ms
- ✅ Sets wsState to RECONNECTING on reconnect attempts
- ✅ Clears reconnect timeout on clean disconnect
- ✅ Logs reconnection attempts with attempt number

**Disconnect Logic**
- ✅ Closes WebSocket with code 1000 and reason "Client disconnect"
- ✅ Clears any pending reconnect timeout
- ✅ Sets wsRef to null
- ✅ Resets reconnect attempts counter
- ✅ Sets wsState to DISCONNECTED
- ✅ Handles disconnect when no WebSocket exists

**Effect & Dependencies**
- ✅ Connects when jobId becomes non-null
- ✅ Does not connect if jobId is null
- ✅ Re-connects when jobId changes
- ✅ Disconnects on unmount
- ✅ Handles dependency changes correctly

---

### 4.3 Component Tests: App Component

#### Test File: `src/__tests__/App.test.jsx`

**Initial Render**
- ✅ Renders title "Video Transcription"
- ✅ Renders subtitle text
- ✅ Renders dropzone with correct initial state
- ✅ Displays upload icon (🎬) in IDLE state
- ✅ Displays upload hint text
- ✅ File input is hidden
- ✅ Status card is not visible initially
- ✅ Error message is not visible initially
- ✅ Result card is not visible initially
- ✅ Reset button is not visible initially

**File Input Handling**
- ✅ Clicking dropzone triggers file input click
- ✅ File input accepts video/* files
- ✅ handleFileSelect calls uploadFile when file selected
- ✅ Handles null file selection gracefully
- ✅ Updates file state on selection

**Drag & Drop Functionality**
- ✅ Sets isDragging=true on dragover
- ✅ Applies dropzoneActive style when dragging
- ✅ Sets isDragging=false on dragleave
- ✅ Handles drop event correctly
- ✅ Prevents default drag behavior
- ✅ Extracts file from dataTransfer
- ✅ Ignores drop when status !== IDLE
- ✅ Calls uploadFile on successful drop
- ✅ Handles drop with no files gracefully
- ✅ Prevents drop when disabled (non-IDLE status)

**File Upload Flow**
- ✅ Updates status to UPLOADING on upload start
- ✅ Sets progress to 0
- ✅ Clears previous errors and transcripts
- ✅ Creates FormData with file
- ✅ Sends POST to /api/transcribe
- ✅ Parses response as JSON
- ✅ Sets jobId from response
- ✅ Updates status to PROCESSING after upload success
- ✅ Handles network errors gracefully
- ✅ Handles non-OK response status
- ✅ Sets error message on upload failure
- ✅ Parses error detail from response
- ✅ Uses statusText as fallback error message

**Status Badge Rendering**
- ✅ Displays status badge in status card (non-IDLE)
- ✅ Badge shows correct status text
- ✅ Badge has correct background color for status
- ✅ Badge has correct text color for status

**Progress Bar Display**
- ✅ Progress bar width reflects current progress
- ✅ Progress bar starts at 0%
- ✅ Progress bar updates on progress change
- ✅ File name displayed in status card
- ✅ Progress message displayed
- ✅ ETA text formatted correctly

**WebSocket Integration**
- ✅ WebSocket indicator visible during PROCESSING
- ✅ Shows "Live updates" when connected
- ✅ Shows "Connecting..." when connecting
- ✅ Shows "Reconnecting..." when reconnecting
- ✅ Shows "Disconnected" when disconnected
- ✅ Indicator dot color matches ws state
- ✅ Indicator not visible when not PROCESSING

**Message Handling**
- ✅ Handles 'progress' message type
- ✅ Updates progress from message
- ✅ Updates progressMessage from message
- ✅ Updates etaSeconds from message.details
- ✅ Sets status to COMPLETED when stage='completed'
- ✅ Sets progress to 100 on completion
- ✅ Calls fetchResult on completion
- ✅ Sets status to ERROR when stage='failed'
- ✅ Sets error message from failed message
- ✅ Handles 'initial_status' message type
- ✅ Handles 'waiting' message type
- ✅ Logs unknown message types

**Result Display**
- ✅ Result card visible when transcript exists
- ✅ Displays "Transcript" title
- ✅ Shows Copy button
- ✅ Transcript box shows transcript text
- ✅ Transcript box styled correctly

**Copy to Clipboard**
- ✅ Copy button calls navigator.clipboard.writeText
- ✅ Copy button passes transcript text
- ✅ Copy button is disabled when no transcript

**Error Handling**
- ✅ Error message visible when error exists
- ✅ Error message displays error text
- ✅ Error styling applied correctly
- ✅ Errors cleared on new upload
- ✅ Network error handled
- ✅ Parse error handled

**Reset Functionality**
- ✅ Reset button visible after completion
- ✅ Reset button visible after error
- ✅ Reset button not visible in IDLE
- ✅ Clicking reset calls resetState
- ✅ resetState clears all state to initial values
- ✅ resetState disconnects WebSocket
- ✅ resetState clears file, transcript, error
- ✅ resetState resets progress to 0
- ✅ resetState allows new file selection

**Disabled State Management**
- ✅ Dropzone disabled when status !== IDLE
- ✅ File input disabled when status !== IDLE
- ✅ Dropzone opacity reduced when disabled
- ✅ Click on disabled dropzone has no effect
- ✅ Drop on disabled dropzone ignored

**Styling & CSS Classes**
- ✅ Container has max-width: 800px
- ✅ Header centered
- ✅ Title styled correctly
- ✅ Dropzone border styling applied
- ✅ Status card styling applied
- ✅ Result card styling applied
- ✅ All inline styles applied correctly

---

### 4.4 Integration Tests

#### Test File: `src/__tests__/App.test.jsx` - Integration Suite

**Complete Upload & Processing Flow**
```javascript
Test: "should complete full transcription workflow"
  Steps:
  1. Render App component
  2. Select video file via file input
  3. Verify upload starts (status=UPLOADING)
  4. Mock successful upload response
  5. Verify status changes to PROCESSING
  6. Simulate WebSocket connection
  7. Simulate progress message from WS
  8. Simulate completion message
  9. Verify transcript displayed
  10. Verify Copy button works
  11. Click reset button
  12. Verify state reset to IDLE
```

**Error Recovery Flow**
```javascript
Test: "should handle upload error and allow retry"
  Steps:
  1. Select file
  2. Mock failed upload (500 error)
  3. Verify error message displayed
  4. Verify reset button shown
  5. Click reset button
  6. Select different file
  7. Verify upload attempted again
```

**WebSocket Failure & Recovery**
```javascript
Test: "should handle WebSocket disconnection and reconnect"
  Steps:
  1. Start upload
  2. Establish WebSocket connection
  3. Simulate WebSocket close (abnormal)
  4. Verify reconnecting state displayed
  5. Verify reconnection attempts
  6. Simulate successful reconnection
  7. Verify live updates displayed
```

**Multiple Status Transitions**
```javascript
Test: "should handle all status transitions correctly"
  Verify:
  - IDLE → UPLOADING → PROCESSING → COMPLETED
  - IDLE → UPLOADING → ERROR
  - PROCESSING → ERROR → IDLE
```

---

## 5. Testing Library Setup

### `vitest.config.js`
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/__tests__/**',
        'src/main.jsx',
      ],
      lines: 85,
      functions: 85,
      branches: 75,
      statements: 85,
    },
  },
});
```

### `src/__tests__/setup.js`
```javascript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock fetch
global.fetch = vi.fn();
```

### `src/__tests__/fixtures/mockData.js`
```javascript
export const mockStatusMessages = {
  progress: {
    type: 'progress',
    progress: 50,
    message: 'Transcribing audio...',
    stage: 'processing',
    job_id: 'test-job-123',
    details: { eta_seconds: 30 },
  },
  completed: {
    type: 'progress',
    progress: 100,
    message: 'Transcription complete',
    stage: 'completed',
    job_id: 'test-job-123',
  },
  failed: {
    type: 'progress',
    message: 'Transcription failed',
    stage: 'failed',
    job_id: 'test-job-123',
  },
};

export const mockTranscriptResponse = {
  result: 'This is the transcribed text from the video...',
};
```

---

## 6. npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "test:run": "vitest run"
  }
}
```

---

## 7. Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Statements | 85% | TBD |
| Branches | 75% | TBD |
| Functions | 85% | TBD |
| Lines | 85% | TBD |

**High-Priority Coverage:**
- All event handlers (100%)
- Status transitions (100%)
- WebSocket lifecycle (95%)
- Error cases (90%)

---

## 8. Test Execution Strategy

### Phase 1: Setup (10 mins)
- Install dependencies
- Create vitest.config.js
- Create setup.js
- Create fixture files

### Phase 2: Unit Tests (45 mins)
- Write utility function tests
- Write hook tests
- Achieve 90% coverage on utils

### Phase 3: Component Tests (60 mins)
- Write App component tests
- Test all status states
- Test user interactions
- Test error handling

### Phase 4: Integration Tests (30 mins)
- Full workflow tests
- Multi-step scenarios
- Error recovery flows

### Phase 5: Final Validation (15 mins)
- Run full coverage report
- Verify all targets met
- Document any gaps
- Run tests in CI mode

**Total Estimated Time: ~160 minutes (2.5 hours)**

---

## 9. Key Testing Considerations

### Async Operations
- Mock fetch with appropriate delays
- Mock WebSocket lifecycle
- Use waitFor for state updates
- Handle promise rejections

### State Management
- Test each state transition
- Verify state cleanup on reset
- Test concurrent state changes
- Mock useCallback dependencies

### Event Handling
- Test drag-drop events
- Test file input events
- Test button clicks
- Mock DOM events

### Edge Cases
- Empty file selection
- Multiple rapid clicks
- Network timeouts
- WebSocket errors during different stages
- Invalid JSON responses
- Large file uploads

### Performance
- Tests should complete in <100ms each
- Avoid unnecessary re-renders in assertions
- Mock expensive operations
- Use lazy evaluation

---

## 10. Maintenance & Evolution

### When to Update Tests
- ✅ When adding new features
- ✅ When changing component behavior
- ✅ When fixing bugs
- ✅ When refactoring styles

### Test Review Checklist
- [ ] Test names clearly describe behavior
- [ ] One assertion per test (where possible)
- [ ] No test dependencies
- [ ] Proper setup and teardown
- [ ] All edge cases covered
- [ ] Mocks are appropriate
- [ ] Tests are deterministic

---

## 11. CI/CD Integration

### GitHub Actions Example
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm run test:run
      - run: npm run test:coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Summary

This test plan provides comprehensive coverage for the React Vite video transcription app with:

- **100+ specific test cases** across unit, integration, and E2E layers
- **Detailed testing setup** with Vitest and React Testing Library
- **Clear file structure** for organized test code
- **Specific test data** and mock implementations
- **Coverage targets** (85%+) with tracking guidelines
- **Integration scenarios** for real-world workflows
- **Maintenance guidelines** for long-term test health

The modular approach allows for parallel test development and gradual implementation over 2-3 hours.
