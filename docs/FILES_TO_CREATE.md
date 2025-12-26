# Files to Create During Implementation

This document lists all files that will be created when you implement the test plan.

---

## Configuration Files (3 files)

### 1. frontend/vitest.config.js
**Source**: VITEST_SETUP_GUIDE.md, Section 1
**Status**: Complete configuration provided
**Location**: frontend root
**Size**: ~50 lines
**Action**: Copy from VITEST_SETUP_GUIDE.md Section 1

```
frontend/
└── vitest.config.js  ← Create here
```

---

### 2. frontend/src/__tests__/setup.js
**Source**: VITEST_SETUP_GUIDE.md, Section 2
**Status**: Complete setup code provided
**Location**: frontend/src/__tests__/
**Size**: ~100 lines
**Action**: Copy from VITEST_SETUP_GUIDE.md Section 2

```
frontend/src/
└── __tests__/
    └── setup.js  ← Create here
```

---

### 3. frontend/src/__tests__/fixtures/mockData.js
**Source**: VITEST_SETUP_GUIDE.md, Section 3
**Status**: Complete fixture data provided
**Location**: frontend/src/__tests__/fixtures/
**Size**: ~150 lines
**Action**: Copy from VITEST_SETUP_GUIDE.md Section 3

```
frontend/src/
└── __tests__/
    └── fixtures/
        └── mockData.js  ← Create here
```

---

## Test Files (4 files)

### Unit Tests - Utilities (2 files)

#### 4. frontend/src/__tests__/utils/statusHelpers.test.js
**Test Count**: 12 tests
**Source**: TEST_PLAN.md, Section 4.1
**Functions Tested**:
- getStatusColor(status) - 7 tests
- getWsIndicatorColor(wsState) - 5 tests

**Content**:
- Import statements
- Test setup (beforeEach)
- 12 test cases
- Assertion checks

**Estimated Lines**: 150-200 lines

```
frontend/src/
└── __tests__/
    └── utils/
        └── statusHelpers.test.js  ← Create here
```

**Steps**:
1. Create file with imports
2. Add getStatusColor tests (7 tests)
3. Add getWsIndicatorColor tests (5 tests)
4. Run: `npm run test:run -- statusHelpers`
5. Verify: 12 passing tests

---

#### 5. frontend/src/__tests__/utils/formatting.test.js
**Test Count**: 8 tests
**Source**: TEST_PLAN.md, Section 4.1
**Functions Tested**:
- formatEta(seconds) - 8 tests

**Content**:
- Import statements
- 8 test cases for formatEta()
- Edge cases: null, 0, negatives, seconds, minutes, rounding, large values

**Estimated Lines**: 100-150 lines

```
frontend/src/
└── __tests__/
    └── utils/
        └── formatting.test.js  ← Create here
```

**Steps**:
1. Create file with imports
2. Add formatEta tests
3. Test: null/undefined/zero/negative
4. Test: <60 seconds, >=60 seconds
5. Test: rounding, edge cases
6. Run: `npm run test:run -- formatting`
7. Verify: 8 passing tests

---

### Hook Tests (1 file)

#### 6. frontend/src/__tests__/hooks/useWebSocket.test.js
**Test Count**: 38 tests
**Source**: TEST_PLAN.md, Section 4.2
**Hook Tested**: useWebSocket(jobId, onMessage, onError)

**Content**:
- Import statements
- Test setup (beforeEach, mocks)
- 38 test cases organized by feature:
  - Initialization (3 tests)
  - Connection lifecycle (8 tests)
  - Message handling (6 tests)
  - Error handling (3 tests)
  - Auto-reconnection (7 tests)
  - Disconnect/cleanup (6 tests)
  - Effect dependencies (5 tests)

**Estimated Lines**: 400-500 lines

```
frontend/src/
└── __tests__/
    └── hooks/
        └── useWebSocket.test.js  ← Create here
```

**Key Testing Patterns**:
- Use renderHook from @testing-library/react
- Mock WebSocket with vi.fn()
- Test effect hooks with dependencies
- Test async operations with waitFor()
- Verify cleanup on unmount

**Steps**:
1. Create file with imports
2. Mock WebSocket, timers
3. Write initialization tests (3)
4. Write connection tests (8)
5. Write message handling tests (6)
6. Write error handling tests (3)
7. Write reconnection tests (7)
8. Write cleanup tests (6)
9. Write dependency tests (5)
10. Run: `npm run test:run -- useWebSocket`
11. Verify: 38 passing tests

---

### Component Tests (1 file)

#### 7. frontend/src/__tests__/App.test.jsx
**Test Count**: 95+ tests
**Source**: TEST_PLAN.md, Section 4.3 & 4.4
**Component Tested**: App.jsx

**Content**:
- Import statements
- Test setup (beforeEach, mocks)
- 95+ test cases organized by feature:
  - Rendering tests (10 tests)
  - File input tests (5 tests)
  - Drag & drop tests (10 tests)
  - Upload flow tests (14 tests)
  - UI update tests (8 tests)
  - WebSocket integration (7 tests)
  - Message handling (12 tests)
  - Result display (5 tests)
  - Copy to clipboard (3 tests)
  - Error handling (5 tests)
  - Reset functionality (11 tests)
  - Disabled state (5 tests)
  - Integration tests (8 tests)

**Estimated Lines**: 600-800 lines

```
frontend/src/
└── __tests__/
    └── App.test.jsx  ← Create here
```

**Key Testing Patterns**:
- Use render() from @testing-library/react
- Use screen queries (getByText, getByRole, etc)
- User interactions with userEvent
- File uploads with File objects
- Drag & drop events
- WebSocket message simulation
- State assertions
- DOM content verification

**Steps**:
1. Create file with imports
2. Setup test component
3. Write rendering tests (10)
4. Write file input tests (5)
5. Write drag & drop tests (10)
6. Write upload flow tests (14)
7. Write UI update tests (8)
8. Write WebSocket tests (7)
9. Write message handling tests (12)
10. Write result display tests (5)
11. Write clipboard tests (3)
12. Write error tests (5)
13. Write reset tests (11)
14. Write disabled state tests (5)
15. Write integration tests (8)
16. Run: `npm run test:run -- App.test`
17. Verify: 95+ passing tests

---

## Directory Structure Created

After implementation, your test directory structure will be:

```
frontend/
├── vitest.config.js                 ← New
├── vite.config.js
├── package.json                     (updated with test scripts)
│
└── src/
    ├── App.jsx
    ├── main.jsx
    │
    └── __tests__/                   ← New directory
        ├── setup.js                 ← New
        ├── App.test.jsx             ← New (95+ tests)
        │
        ├── fixtures/                ← New directory
        │   └── mockData.js          ← New
        │
        ├── utils/                   ← New directory
        │   ├── statusHelpers.test.js   ← New (12 tests)
        │   └── formatting.test.js      ← New (8 tests)
        │
        └── hooks/                   ← New directory
            └── useWebSocket.test.js ← New (38 tests)
```

---

## File Creation Timeline

### Phase 1: Setup (15 minutes)
- [ ] Create frontend/vitest.config.js
- [ ] Create frontend/src/__tests__/setup.js
- [ ] Create frontend/src/__tests__/fixtures/mockData.js
- [ ] Create directories: __tests__, utils, hooks, fixtures
- [ ] Update package.json with test scripts

### Phase 2: Utility Tests (20 minutes)
- [ ] Create frontend/src/__tests__/utils/statusHelpers.test.js
- [ ] Create frontend/src/__tests__/utils/formatting.test.js
- [ ] Verify: 20 tests passing

### Phase 3: Hook Tests (30 minutes)
- [ ] Create frontend/src/__tests__/hooks/useWebSocket.test.js
- [ ] Verify: 38 tests passing

### Phase 4-6: Component Tests (60 minutes)
- [ ] Create frontend/src/__tests__/App.test.jsx
- [ ] Verify: 95+ tests passing

### Phase 7: Validation (15 minutes)
- [ ] Run coverage report
- [ ] Verify 85%+ coverage
- [ ] Verify <6 seconds execution time

---

## Package.json Updates

Add these scripts to your `frontend/package.json`:

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

## Dependencies to Install

Run once before creating test files:

```bash
cd frontend
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom
```

---

## Verification Checklist

After creating all files, verify:

### Configuration Files
- [ ] vitest.config.js exists
- [ ] setup.js exists with mocks
- [ ] mockData.js exists with test data
- [ ] package.json has test scripts

### Test Files
- [ ] statusHelpers.test.js exists (12 tests)
- [ ] formatting.test.js exists (8 tests)
- [ ] useWebSocket.test.js exists (38 tests)
- [ ] App.test.jsx exists (95+ tests)

### Execution
- [ ] `npm run test:run` passes all tests
- [ ] Test count >= 150
- [ ] Execution time < 6 seconds
- [ ] No console errors

### Coverage
- [ ] `npm run test:coverage` generates report
- [ ] Statements >= 85%
- [ ] Branches >= 75%
- [ ] Functions >= 85%
- [ ] Lines >= 85%

---

## Code Sources

All code is provided in VITEST_SETUP_GUIDE.md:

| File | Section | Lines |
|------|---------|-------|
| vitest.config.js | Section 1 | 50 |
| setup.js | Section 2 | 100 |
| mockData.js | Section 3 | 150 |
| statusHelpers.test.js | TEST_PLAN.md 4.1 | 150 |
| formatting.test.js | TEST_PLAN.md 4.1 | 100 |
| useWebSocket.test.js | TEST_PLAN.md 4.2 | 400 |
| App.test.jsx | TEST_PLAN.md 4.3 | 600 |

**Total**: 1,550 lines of test code

---

## File Sizes Reference

| File | Size | Type |
|------|------|------|
| vitest.config.js | 50 lines | Configuration |
| setup.js | 100 lines | Setup |
| mockData.js | 150 lines | Fixtures |
| statusHelpers.test.js | 150 lines | Unit test |
| formatting.test.js | 100 lines | Unit test |
| useWebSocket.test.js | 400 lines | Hook test |
| App.test.jsx | 600 lines | Component test |

**Total Test Code**: ~1,550 lines
**Estimated Keystrokes**: ~7,000 (copy-paste from documentation)
**Estimated Implementation Time**: 2-3 hours

---

## Tips for File Creation

1. **Copy Code Carefully**: Copy code blocks exactly from VITEST_SETUP_GUIDE.md
2. **Maintain Indentation**: Ensure proper spacing (2-space indentation)
3. **Import Statements**: Verify all imports are correct for file location
4. **File Paths**: Adjust relative paths based on test file location
5. **Mock Consistency**: Use mockData from fixtures throughout tests
6. **Test Organization**: Group related tests with describe() blocks
7. **Async Handling**: Use waitFor() for async operations
8. **Cleanup**: Ensure afterEach cleanup is in place

---

## Troubleshooting File Creation

### Import Errors
- Verify relative paths are correct
- Check file is in __tests__ directory
- Ensure all dependencies are imported

### Test Not Running
- Verify file ends with .test.js or .test.jsx
- Check vitest.config.js includes pattern
- Run `npm run test:run -- --reporter=verbose`

### Mock Not Working
- Verify setup.js is loaded (check vitest.config.js)
- Check global mocks are defined
- Use `expect(global.WebSocket).toBeDefined()`

### Slow Tests
- Profile with `npm run test:run -- --reporter=verbose --profile`
- Check for real network calls (should be mocked)
- Use fake timers for WebSocket delays

---

## Next Steps

1. Read VITEST_SETUP_GUIDE.md section 1-3 (10 min)
2. Install dependencies (5 min)
3. Create configuration files (10 min)
4. Follow IMPLEMENTATION_CHECKLIST.md phases 2-7 (2-3 hours)
5. Verify all tests pass and coverage meets targets

---

**Status**: Ready for file creation
**Documentation**: Complete
**Code provided**: Yes (in VITEST_SETUP_GUIDE.md)
**Time estimate**: 2-3 hours implementation
