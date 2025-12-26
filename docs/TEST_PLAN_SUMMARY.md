# Test Plan - Quick Reference

## Project Overview
**App**: Video Transcription React Vite UI
**Current State**: Single monolithic App.jsx component with file upload, WebSocket integration, and real-time progress tracking
**Testing Approach**: Vitest + React Testing Library

---

## Test Organization

### File Structure
```
frontend/src/__tests__/
├── App.test.jsx              (Component + integration tests)
├── hooks/
│   └── useWebSocket.test.js   (Custom hook tests)
├── utils/
│   ├── statusHelpers.test.js  (getStatusColor, getWsIndicatorColor)
│   └── formatting.test.js     (formatEta)
├── fixtures/
│   └── mockData.js            (Shared test data)
└── setup.js                   (Vitest configuration)
```

---

## Test Coverage by Category

### 1. Utility Function Tests (15 tests)
**File**: `src/__tests__/utils/statusHelpers.test.js`
- `getStatusColor()` - 7 tests (all status types + unknown)
- `getWsIndicatorColor()` - 4 tests (all WS states + unknown)

**File**: `src/__tests__/utils/formatting.test.js`
- `formatEta()` - 8 tests (seconds, minutes, rounding, edge cases)

### 2. Hook Tests (30+ tests)
**File**: `src/__tests__/hooks/useWebSocket.test.js`
- Connection lifecycle (8 tests)
- Message handling (6 tests)
- Error handling (3 tests)
- Auto-reconnection with exponential backoff (7 tests)
- Disconnect & cleanup (5 tests)
- Effect dependencies (3 tests)

### 3. Component Tests (65+ tests)
**File**: `src/__tests__/App.test.jsx`

**Rendering** (10 tests)
- Initial UI state, icons, text, visibility

**File Input** (5 tests)
- Click handling, file acceptance, file selection

**Drag & Drop** (8 tests)
- Enter/leave, active state, drop handling, type validation

**Upload Flow** (12 tests)
- State transitions, FormData creation, API calls, error handling

**UI Updates** (8 tests)
- Status badge, progress bar, file name, messages, ETA

**WebSocket Integration** (8 tests)
- Indicator display, state colors, message handling

**Result Display** (6 tests)
- Transcript visibility, Copy button, formatting

**Error Handling** (5 tests)
- Error message display, network errors, recovery

**Reset Functionality** (7 tests)
- Reset button visibility, state cleanup, re-enablement

### 4. Integration Tests (8+ tests)
**File**: `src/__tests__/App.test.jsx` - Integration Suite
- Complete upload & processing flow
- Error recovery flow
- WebSocket failure & reconnection
- Multiple status transitions
- Concurrent operations

---

## Dependencies to Install

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom
```

**Total**: 6 dev dependencies (~50 MB)

---

## NPM Scripts

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:watch": "vitest --watch",
  "test:run": "vitest run"
}
```

---

## Coverage Targets

| Metric | Target | Why |
|--------|--------|-----|
| Statements | 85% | Ensure all code paths tested |
| Branches | 75% | Cover conditional logic |
| Functions | 85% | All handlers and utilities |
| Lines | 85% | Overall code coverage |

**Priority Coverage**:
- Event handlers: 100%
- Status transitions: 100%
- WebSocket lifecycle: 95%
- Error cases: 90%

---

## Key Test Scenarios

### 1. Happy Path
User uploads video → Progress shown → Transcription completes → Result displayed

### 2. Error Recovery
Upload fails → Error shown → User clicks reset → New upload succeeds

### 3. WebSocket Resilience
Connection established → Connection drops → Auto-reconnect → Resume updates

### 4. State Management
IDLE → UPLOADING → PROCESSING → COMPLETED → IDLE (on reset)

### 5. UI Interactions
- Drag-drop file onto dropzone
- Click to browse and select file
- Click copy button for transcript
- Click reset button to start over

---

## Test Implementation Timeline

| Phase | Task | Time | Tests |
|-------|------|------|-------|
| 1 | Setup & configuration | 10 min | - |
| 2 | Utility functions | 15 min | 15 |
| 3 | Hook logic | 20 min | 30+ |
| 4 | Component rendering | 20 min | 25 |
| 5 | User interactions | 20 min | 25 |
| 6 | Integration flows | 20 min | 10+ |
| 7 | Coverage & review | 15 min | - |
| **Total** | | **120 min** | **105+** |

---

## Files to Create

1. **`vitest.config.js`** - Test runner configuration
2. **`src/__tests__/setup.js`** - Global test setup, mocks
3. **`src/__tests__/fixtures/mockData.js`** - Shared test data
4. **`src/__tests__/utils/statusHelpers.test.js`** - 11 utility tests
5. **`src/__tests__/utils/formatting.test.js`** - 8 formatting tests
6. **`src/__tests__/hooks/useWebSocket.test.js`** - 30+ hook tests
7. **`src/__tests__/App.test.jsx`** - 75+ component + integration tests

**Total Test Code**: ~2000 lines across 7 files

---

## Vitest Configuration Highlights

```javascript
// vitest.config.js
export default defineConfig({
  test: {
    environment: 'jsdom',           // DOM testing
    globals: true,                   // describe/test/expect
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 85,
      functions: 85,
      branches: 75,
      statements: 85,
    },
  },
});
```

---

## Key Mocks Required

### WebSocket
```javascript
// Auto-respond to messages, handle connection/close
global.WebSocket = vi.fn((url) => ({
  addEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}));
```

### fetch API
```javascript
// Mock upload endpoint, progress endpoint, result endpoint
global.fetch = vi.fn((url, options) => {
  if (url === '/api/transcribe') return mockUploadResponse();
  if (url.includes('/api/transcribe/')) return mockResultResponse();
});
```

### clipboard API
```javascript
Object.assign(navigator, {
  clipboard: { writeText: vi.fn() },
});
```

---

## Quality Metrics

### Code Quality
- **Coverage**: 85%+
- **Test Count**: 105+
- **Average Test Duration**: <50ms
- **Suite Total**: <5 seconds

### Maintainability
- **Test Names**: Descriptive (what + why)
- **Assertion Density**: 1-3 per test
- **Code Reuse**: Fixtures, helpers
- **Mock Management**: Centralized

---

## Next Steps

1. **Review this plan** with team
2. **Install dependencies** (`npm install --save-dev ...`)
3. **Create vitest.config.js** and setup files
4. **Implement tests by category** (utilities → hooks → components)
5. **Run coverage report** and verify targets met
6. **Add to CI/CD** pipeline

---

## References

- **Vitest Docs**: https://vitest.dev
- **React Testing Library**: https://testing-library.com/react
- **Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

**Status**: Plan Ready for Implementation
**Complexity**: Moderate (Custom WebSocket hook requires careful testing)
**Risk**: Low (Comprehensive mocking strategy reduces external dependencies)
