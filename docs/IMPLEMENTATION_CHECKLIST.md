# Test Plan Implementation Checklist

**Status**: Ready for Implementation
**Complexity**: Moderate
**Estimated Duration**: 2.5-3 hours
**Team Size**: 1-2 developers

---

## Phase 1: Setup & Configuration (15 minutes)

### Dependencies
- [ ] Run: `npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`
- [ ] Verify: `npm list vitest` shows installed version
- [ ] Update: `package.json` with test scripts (see VITEST_SETUP_GUIDE.md)

### Configuration Files
- [ ] Create: `frontend/vitest.config.js` (copy from VITEST_SETUP_GUIDE.md)
- [ ] Create: `frontend/src/__tests__/setup.js` (copy from VITEST_SETUP_GUIDE.md)
- [ ] Create: `frontend/src/__tests__/fixtures/mockData.js` (copy from VITEST_SETUP_GUIDE.md)

### Directory Structure
- [ ] Create: `frontend/src/__tests__/utils/`
- [ ] Create: `frontend/src/__tests__/hooks/`
- [ ] Create: `frontend/src/__tests__/fixtures/`

### Verification
- [ ] Run: `npm run test:run` (should pass with 0 tests)
- [ ] Run: `npm run test:ui` (dashboard loads)

---

## Phase 2: Utility Function Tests (20 minutes)

### File: `frontend/src/__tests__/utils/statusHelpers.test.js`

#### Tests for `getStatusColor(status)`
- [ ] Test: Returns correct color for IDLE status
- [ ] Test: Returns correct color for UPLOADING status
- [ ] Test: Returns correct color for PROCESSING status
- [ ] Test: Returns correct color for COMPLETED status
- [ ] Test: Returns correct color for ERROR status
- [ ] Test: Returns default color for unknown status
- [ ] Test: Returns object with bg and text properties

**Expected**: 7 passing tests

#### Tests for `getWsIndicatorColor(wsState)`
- [ ] Test: Returns green for CONNECTED state
- [ ] Test: Returns orange for CONNECTING state
- [ ] Test: Returns orange for RECONNECTING state
- [ ] Test: Returns red for DISCONNECTED state
- [ ] Test: Returns default color for unknown state

**Expected**: 5 passing tests

### File: `frontend/src/__tests__/utils/formatting.test.js`

#### Tests for `formatEta(seconds)`
- [ ] Test: Returns empty string for null
- [ ] Test: Returns empty string for undefined
- [ ] Test: Returns empty string for zero
- [ ] Test: Returns empty string for negative number
- [ ] Test: Returns "Xs remaining" for seconds < 60
- [ ] Test: Returns "XmYs remaining" for seconds >= 60
- [ ] Test: Properly rounds seconds
- [ ] Test: Handles exactly 60 seconds correctly

**Expected**: 8 passing tests

### Verification
- [ ] Run: `npm run test:run -- src/__tests__/utils`
- [ ] Expected: 12/12 tests passing
- [ ] Coverage: 100% for utils

---

## Phase 3: Hook Tests (30 minutes)

### File: `frontend/src/__tests__/hooks/useWebSocket.test.js`

#### Tests: Hook Initialization
- [ ] Test: Returns object with wsState and disconnect
- [ ] Test: Initial wsState is DISCONNECTED
- [ ] Test: Properly cleans up on unmount

**Count**: 3 tests

#### Tests: Connection Lifecycle
- [ ] Test: Creates WebSocket with correct URL (ws:// for HTTP)
- [ ] Test: Creates WebSocket with correct URL (wss:// for HTTPS)
- [ ] Test: Includes jobId in WebSocket URL
- [ ] Test: Sets wsState to CONNECTING on connect attempt
- [ ] Test: Sets wsState to CONNECTED on success
- [ ] Test: Closes existing connection before creating new
- [ ] Test: Resets reconnect attempts on success
- [ ] Test: Handles connection timeout gracefully

**Count**: 8 tests

#### Tests: Message Handling
- [ ] Test: Parses JSON messages correctly
- [ ] Test: Calls onMessage with parsed data
- [ ] Test: Responds to ping with pong
- [ ] Test: Does not forward ping to onMessage
- [ ] Test: Logs error on invalid JSON
- [ ] Test: Continues operation after parse error

**Count**: 6 tests

#### Tests: Error Handling
- [ ] Test: Sets wsState to DISCONNECTED on error
- [ ] Test: Calls onError callback
- [ ] Test: Logs error to console

**Count**: 3 tests

#### Tests: Auto-Reconnection
- [ ] Test: Attempts reconnect on abnormal close
- [ ] Test: Does not reconnect after normal close (1000)
- [ ] Test: Respects max reconnect attempts (5)
- [ ] Test: Uses exponential backoff (1s, 2s, 4s, 8s, 16s)
- [ ] Test: Sets wsState to RECONNECTING
- [ ] Test: Clears reconnect timeout on disconnect
- [ ] Test: Logs reconnection attempts

**Count**: 7 tests

#### Tests: Disconnect
- [ ] Test: Closes WebSocket with code 1000
- [ ] Test: Clears pending reconnect timeout
- [ ] Test: Sets wsRef to null
- [ ] Test: Resets reconnect counter
- [ ] Test: Sets wsState to DISCONNECTED
- [ ] Test: Handles disconnect when no WS exists

**Count**: 6 tests

#### Tests: Effect Dependencies
- [ ] Test: Connects when jobId becomes non-null
- [ ] Test: Does not connect if jobId is null
- [ ] Test: Re-connects when jobId changes
- [ ] Test: Disconnects on unmount
- [ ] Test: Handles dependency changes

**Count**: 5 tests

### Verification
- [ ] Run: `npm run test:run -- src/__tests__/hooks`
- [ ] Expected: 38/38 tests passing
- [ ] Coverage: 95%+ for useWebSocket hook

---

## Phase 4: Component Render Tests (20 minutes)

### File: `frontend/src/__tests__/App.test.jsx`

#### Tests: Initial Render
- [ ] Test: Renders title "Video Transcription"
- [ ] Test: Renders subtitle
- [ ] Test: Renders dropzone
- [ ] Test: Shows film emoji in IDLE state
- [ ] Test: Shows upload hint text
- [ ] Test: Hides file input
- [ ] Test: Status card not visible initially
- [ ] Test: Error message not visible initially
- [ ] Test: Result card not visible initially
- [ ] Test: Reset button not visible initially

**Count**: 10 tests

#### Tests: File Input & Click
- [ ] Test: Clicking dropzone triggers file input
- [ ] Test: File input accepts video/* files
- [ ] Test: handleFileSelect calls uploadFile
- [ ] Test: Handles null file selection
- [ ] Test: Updates file state on selection

**Count**: 5 tests

#### Tests: Drag & Drop
- [ ] Test: Sets isDragging=true on dragover
- [ ] Test: Applies active style when dragging
- [ ] Test: Sets isDragging=false on dragleave
- [ ] Test: Handles drop correctly
- [ ] Test: Prevents default behavior
- [ ] Test: Extracts file from dataTransfer
- [ ] Test: Ignores drop when status !== IDLE
- [ ] Test: Calls uploadFile on valid drop
- [ ] Test: Ignores drop with no files
- [ ] Test: Ignores drop when disabled

**Count**: 10 tests

#### Tests: Upload Flow
- [ ] Test: Sets status to UPLOADING
- [ ] Test: Resets progress to 0
- [ ] Test: Clears previous errors
- [ ] Test: Clears previous transcript
- [ ] Test: Creates FormData with file
- [ ] Test: POSTs to /api/transcribe
- [ ] Test: Parses response as JSON
- [ ] Test: Sets jobId from response
- [ ] Test: Updates status to PROCESSING
- [ ] Test: Handles network errors
- [ ] Test: Handles non-OK response
- [ ] Test: Shows error message on failure
- [ ] Test: Parses error detail from response
- [ ] Test: Uses statusText as fallback

**Count**: 14 tests

### Verification
- [ ] Run: `npm run test:run -- src/__tests__/App.test.jsx --reporter=verbose`
- [ ] Expected: 39/39 tests passing so far
- [ ] No console errors

---

## Phase 5: Component Interaction Tests (25 minutes)

### File: `frontend/src/__tests__/App.test.jsx` (continued)

#### Tests: Status UI Updates
- [ ] Test: Status badge visible when not IDLE
- [ ] Test: Badge shows correct status text
- [ ] Test: Badge has correct background color
- [ ] Test: Badge has correct text color
- [ ] Test: Progress bar width reflects progress
- [ ] Test: Progress bar starts at 0%
- [ ] Test: File name displayed in card
- [ ] Test: Progress message displayed

**Count**: 8 tests

#### Tests: WebSocket Indicator
- [ ] Test: Indicator visible during PROCESSING
- [ ] Test: Shows "Live updates" when connected
- [ ] Test: Shows "Connecting..." when connecting
- [ ] Test: Shows "Reconnecting..." when reconnecting
- [ ] Test: Shows "Disconnected" when disconnected
- [ ] Test: Dot color matches ws state
- [ ] Test: Indicator hidden when not PROCESSING

**Count**: 7 tests

#### Tests: WebSocket Message Handling
- [ ] Test: Handles 'progress' message
- [ ] Test: Updates progress from message
- [ ] Test: Updates progressMessage
- [ ] Test: Updates etaSeconds
- [ ] Test: Sets status=COMPLETED when stage='completed'
- [ ] Test: Sets progress=100 on completion
- [ ] Test: Calls fetchResult on completion
- [ ] Test: Sets status=ERROR when stage='failed'
- [ ] Test: Sets error message
- [ ] Test: Handles 'initial_status' message
- [ ] Test: Handles 'waiting' message
- [ ] Test: Logs unknown message types

**Count**: 12 tests

#### Tests: Result Display
- [ ] Test: Result card visible with transcript
- [ ] Test: Shows "Transcript" title
- [ ] Test: Shows Copy button
- [ ] Test: Displays transcript text
- [ ] Test: Transcript box styled correctly

**Count**: 5 tests

#### Tests: Copy to Clipboard
- [ ] Test: Copy button calls navigator.clipboard.writeText
- [ ] Test: Passes transcript text to clipboard
- [ ] Test: Button disabled when no transcript

**Count**: 3 tests

#### Tests: Error Handling
- [ ] Test: Error message visible when error exists
- [ ] Test: Shows error text
- [ ] Test: Error styling applied
- [ ] Test: Errors cleared on new upload
- [ ] Test: Network errors handled

**Count**: 5 tests

### Verification
- [ ] Run: `npm run test:run -- src/__tests__/App.test.jsx`
- [ ] Expected: 74/74 tests passing
- [ ] Coverage: 85%+ for App component

---

## Phase 6: Integration & Reset Tests (20 minutes)

### File: `frontend/src/__tests__/App.test.jsx` (continued)

#### Tests: Reset Functionality
- [ ] Test: Reset button visible after completion
- [ ] Test: Reset button visible after error
- [ ] Test: Reset button hidden in IDLE
- [ ] Test: Clicking reset calls resetState
- [ ] Test: Clears status to IDLE
- [ ] Test: Clears file
- [ ] Test: Clears transcript
- [ ] Test: Clears error
- [ ] Test: Resets progress to 0
- [ ] Test: Resets jobId to null
- [ ] Test: Allows new file selection

**Count**: 11 tests

#### Tests: Disabled State
- [ ] Test: Dropzone disabled when status !== IDLE
- [ ] Test: File input disabled when status !== IDLE
- [ ] Test: Opacity reduced when disabled
- [ ] Test: Click disabled dropzone has no effect
- [ ] Test: Drop on disabled dropzone ignored

**Count**: 5 tests

#### Integration: Complete Workflow
- [ ] Test: Select file → uploads → processing → completes
- [ ] Test: Upload fails → shows error → retry succeeds
- [ ] Test: WebSocket drops → reconnects → resumes
- [ ] Test: IDLE → UPLOADING → PROCESSING → COMPLETED → IDLE
- [ ] Test: IDLE → UPLOADING → ERROR

**Count**: 5 tests

### Verification
- [ ] Run: `npm run test:run -- src/__tests__/App.test.jsx`
- [ ] Expected: 95/95 tests passing total
- [ ] Coverage report: 85%+ overall

---

## Phase 7: Final Validation & Coverage (15 minutes)

### Coverage Report
- [ ] Run: `npm run test:coverage`
- [ ] View: `coverage/index.html` in browser
- [ ] Verify:
  - [ ] Statements: >= 85%
  - [ ] Branches: >= 75%
  - [ ] Functions: >= 85%
  - [ ] Lines: >= 85%

### Missing Coverage
- [ ] Identify any uncovered lines
- [ ] Add tests for missing branches
- [ ] Document intentional gaps (if any)

### Test Quality Review
- [ ] All test names are descriptive
- [ ] No test dependencies
- [ ] Proper setup/teardown
- [ ] Mocks are appropriate
- [ ] No hardcoded timeouts (except WebSocket)
- [ ] Performance: Most tests < 50ms

### Documentation
- [ ] Update: `docs/TEST_RESULTS.md` with final coverage
- [ ] Document: Any skipped tests or limitations
- [ ] Add: Instructions for running tests to `docs/`

---

## Phase 8: CI/CD Integration (Optional - 10 minutes)

### GitHub Actions
- [ ] Create: `.github/workflows/test.yml`
- [ ] Configure: Node version
- [ ] Add: Coverage upload (codecov)
- [ ] Test: Pipeline runs on push/PR

### Pre-commit Hooks (Optional)
- [ ] Install: `husky`
- [ ] Configure: Run tests before commit
- [ ] Optional: Run linting before tests

---

## Files Created Summary

### Configuration Files (3)
- [ ] `frontend/vitest.config.js` - ~50 lines
- [ ] `frontend/src/__tests__/setup.js` - ~100 lines
- [ ] `frontend/src/__tests__/fixtures/mockData.js` - ~150 lines

### Test Files (3)
- [ ] `frontend/src/__tests__/utils/statusHelpers.test.js` - ~150 lines
- [ ] `frontend/src/__tests__/utils/formatting.test.js` - ~100 lines
- [ ] `frontend/src/__tests__/hooks/useWebSocket.test.js` - ~400 lines
- [ ] `frontend/src/__tests__/App.test.jsx` - ~600 lines

### Documentation Files (Already Created)
- [ ] `docs/TEST_PLAN.md` - Comprehensive test plan
- [ ] `docs/TEST_PLAN_SUMMARY.md` - Quick reference
- [ ] `docs/VITEST_SETUP_GUIDE.md` - Setup instructions
- [ ] `docs/IMPLEMENTATION_CHECKLIST.md` - This file

**Total Code**: ~1,550 lines
**Total Documentation**: ~3,000 lines

---

## Success Criteria

### All Tests Pass
- [ ] `npm run test:run` returns 0 failures
- [ ] 95+ tests passing
- [ ] No console warnings/errors

### Coverage Targets Met
- [ ] Statements: >= 85%
- [ ] Branches: >= 75%
- [ ] Functions: >= 85%
- [ ] Lines: >= 85%

### Code Quality
- [ ] All tests named descriptively
- [ ] No hardcoded values (use fixtures)
- [ ] Proper mocking strategy
- [ ] Fast execution (< 5 seconds total)

### Documentation Complete
- [ ] TEST_PLAN.md updated if needed
- [ ] All setup instructions clear
- [ ] Coverage report generated
- [ ] Team can run tests independently

---

## Troubleshooting

### Tests Not Finding Files
```bash
# Check vitest config
npm run test:run -- --reporter=verbose

# Verify file paths
ls -la frontend/src/__tests__/
```

### WebSocket Mock Not Working
```javascript
// Ensure setup.js is loaded
import { expect } from 'vitest';
expect(global.WebSocket).toBeDefined();
```

### Coverage Not Generated
```bash
# Install coverage provider
npm install --save-dev @vitest/coverage-v8

# Run with coverage
npm run test:coverage
```

### Timeout Issues
```javascript
// Increase timeout for WebSocket tests
it('test name', async () => {
  // test code
}, { timeout: 10000 });
```

---

## Timeline Estimate

| Phase | Task | Time | Tests |
|-------|------|------|-------|
| 1 | Setup & config | 15 min | - |
| 2 | Utils tests | 20 min | 12 |
| 3 | Hook tests | 30 min | 38 |
| 4 | Render tests | 20 min | 39 |
| 5 | Interaction tests | 25 min | 40 |
| 6 | Integration tests | 20 min | 21 |
| 7 | Validation | 15 min | - |
| 8 | CI/CD (opt) | 10 min | - |
| **Total** | | **155 min** | **150+** |

**With 2 developers working in parallel**: ~90 minutes

---

## Sign-Off

- [ ] Lead Developer: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______
- [ ] Team Review: _________________ Date: _______

---

**Status**: Ready to Implement
**Last Updated**: 2025-12-26
**Document Version**: 1.0
