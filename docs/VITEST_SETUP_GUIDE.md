# Vitest Setup & Configuration Guide

## 1. Installation Instructions

### Step 1: Install Dependencies
```bash
cd frontend
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Step 2: Update package.json Scripts

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

### Step 3: Create vitest.config.js

Create `frontend/vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Global test setup
    globals: true,                         // Allows describe/test/expect without imports
    environment: 'jsdom',                  // Simulates browser DOM
    setupFiles: ['./src/__tests__/setup.js'], // Global test setup file

    // Test discovery
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/__tests__/**',
        'src/main.jsx',
      ],
      // Coverage thresholds
      lines: 85,
      functions: 85,
      branches: 75,
      statements: 85,
      all: true,
    },

    // Performance
    testTimeout: 10000,                    // 10s timeout for async tests
    hookTimeout: 10000,
    isolate: true,                         // Run tests in isolation
    threads: true,                         // Use threads for parallel execution
    maxThreads: 4,
    minThreads: 1,

    // Reporting
    reporter: 'verbose',                   // Show test names and results
    // reportOnFailure: true,

    // Mocking
    mockReset: true,                       // Reset mocks between tests
    restoreMocks: true,                    // Restore mocks between tests
    clearMocks: true,                      // Clear mocks between tests
  },

  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

---

## 2. Global Test Setup

Create `frontend/src/__tests__/setup.js`:

```javascript
import '@testing-library/jest-dom';
import { expect, afterEach, vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ============================================================================
// CLEANUP
// ============================================================================

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock WebSocket
global.WebSocket = vi.fn(function(url) {
  this.url = url;
  this.readyState = 0;
  this.addEventListener = vi.fn();
  this.removeEventListener = vi.fn();
  this.send = vi.fn();
  this.close = vi.fn();

  // Simulate async connection
  setTimeout(() => {
    if (this.onopen) this.onopen();
  }, 0);
});

// Mock fetch globally
const mockFetch = vi.fn();

global.fetch = mockFetch;

/**
 * Helper: Setup successful upload response
 */
global.mockSuccessfulUpload = (jobId = 'test-job-123') => {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ job_id: jobId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
};

/**
 * Helper: Setup failed upload response
 */
global.mockFailedUpload = (status = 500, detail = 'Upload failed') => {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ detail }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
};

/**
 * Helper: Setup result fetch response
 */
global.mockFetchResult = (transcript = 'Test transcript') => {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ result: transcript }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
};

// Reset fetch mock before each test
beforeEach(() => {
  mockFetch.mockReset();
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
window.scrollTo = vi.fn();

// ============================================================================
// CUSTOM MATCHERS
// ============================================================================

expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// ============================================================================
// CONSOLE MOCKING (Suppress expected warnings in tests)
// ============================================================================

const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  // Suppress console output during tests (restore in afterEach)
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// ============================================================================
// TEST DATA
// ============================================================================

global.testFile = new File(['test content'], 'test-video.mp4', {
  type: 'video/mp4',
});

global.testFiles = {
  mp4: new File(['video data'], 'test.mp4', { type: 'video/mp4' }),
  mov: new File(['video data'], 'test.mov', { type: 'video/quicktime' }),
  avi: new File(['video data'], 'test.avi', { type: 'video/x-msvideo' }),
  mkv: new File(['video data'], 'test.mkv', { type: 'video/x-matroska' }),
  webm: new File(['video data'], 'test.webm', { type: 'video/webm' }),
};
```

---

## 3. Test Fixtures

Create `frontend/src/__tests__/fixtures/mockData.js`:

```javascript
/**
 * Mock WebSocket Messages
 */
export const mockWebSocketMessages = {
  ping: {
    type: 'ping',
  },

  progressUpdate: {
    type: 'progress',
    progress: 50,
    message: 'Extracting audio...',
    stage: 'processing',
    job_id: 'test-job-123',
    details: {
      eta_seconds: 45,
    },
  },

  progressComplete: {
    type: 'progress',
    progress: 100,
    message: 'Transcription complete',
    stage: 'completed',
    job_id: 'test-job-123',
  },

  progressFailed: {
    type: 'progress',
    message: 'Transcription failed: unsupported format',
    stage: 'failed',
    job_id: 'test-job-123',
  },

  initialStatus: {
    type: 'initial_status',
    status: 'processing',
    progress: 25,
    job_id: 'test-job-123',
  },

  initialStatusCompleted: {
    type: 'initial_status',
    status: 'completed',
    progress: 100,
    job_id: 'test-job-123',
  },

  waiting: {
    type: 'waiting',
  },
};

/**
 * Mock API Responses
 */
export const mockApiResponses = {
  uploadSuccess: {
    job_id: 'test-job-123',
  },

  uploadError: {
    detail: 'File size exceeds 5GB limit',
  },

  transcriptResult: {
    result: 'This is the transcribed text from the video. It contains multiple sentences and paragraphs representing the audio content.',
  },

  emptyTranscript: {
    result: '',
  },
};

/**
 * Status Constants
 */
export const STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

/**
 * WebSocket States
 */
export const WS_STATE = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

/**
 * Color Mappings (from App.jsx)
 */
export const statusColors = {
  [STATUS.IDLE]: { bg: '#333', text: '#888' },
  [STATUS.UPLOADING]: { bg: '#2a3a4a', text: '#4a9eff' },
  [STATUS.PROCESSING]: { bg: '#3a3a2a', text: '#ffb84a' },
  [STATUS.COMPLETED]: { bg: '#2a3a2a', text: '#4aff6b' },
  [STATUS.ERROR]: { bg: '#3a2a2a', text: '#ff6b6b' },
};

export const wsIndicatorColors = {
  [WS_STATE.CONNECTED]: '#4aff6b',
  [WS_STATE.CONNECTING]: '#ffb84a',
  [WS_STATE.RECONNECTING]: '#ffb84a',
  [WS_STATE.DISCONNECTED]: '#ff6b6b',
};

/**
 * Test Utilities
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockFile = (name = 'test.mp4', size = 1000) => {
  const blob = new Blob(['x'.repeat(size)], { type: 'video/mp4' });
  return new File([blob], name, { type: 'video/mp4' });
};

export const createDragEvent = (files = []) => {
  const dataTransfer = {
    files,
    items: files.map(file => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file,
    })),
  };

  return {
    dataTransfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
};

export const createChangeEvent = (file) => {
  return {
    target: {
      files: [file],
    },
  };
};
```

---

## 4. Running Tests

### Development Mode (Watch)
```bash
npm run test:watch
```
Tests re-run on file changes

### Run All Tests Once
```bash
npm run test:run
```
Perfect for CI/CD

### With Coverage Report
```bash
npm run test:coverage
```
Generates HTML report in `coverage/` folder

### UI Mode (Visual Dashboard)
```bash
npm run test:ui
```
Opens interactive test dashboard in browser

---

## 5. Test File Structure

Create these directories:
```bash
mkdir -p frontend/src/__tests__/{utils,hooks,fixtures}
```

### Template: Unit Test
```javascript
// frontend/src/__tests__/utils/example.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { functionToTest } from '../../utils/example';

describe('functionToTest', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should return expected result', () => {
    const result = functionToTest('input');
    expect(result).toBe('expected');
  });
});
```

### Template: Hook Test
```javascript
// frontend/src/__tests__/hooks/useExample.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExample } from '../../hooks/useExample';

describe('useExample', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useExample());
    expect(result.current.state).toBe('default');
  });

  it('should update state on action', () => {
    const { result } = renderHook(() => useExample());

    act(() => {
      result.current.setState('new');
    });

    expect(result.current.state).toBe('new');
  });
});
```

### Template: Component Test
```javascript
// frontend/src/__tests__/App.test.jsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('App Component', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it('should render initial state', () => {
    render(<App />);
    expect(screen.getByText('Video Transcription')).toBeInTheDocument();
  });

  it('should handle file upload', async () => {
    render(<App />);
    const file = new File(['video'], 'video.mp4', { type: 'video/mp4' });

    const input = screen.getByDisplayValue('file');
    await userEvent.upload(input, file);

    expect(input.files[0]).toBe(file);
  });
});
```

---

## 6. Coverage Report

After running tests, view the HTML coverage report:

```bash
npm run test:coverage
# Then open coverage/index.html in browser
```

Coverage report shows:
- Line-by-line coverage
- Uncovered branches
- Coverage trends
- Missing statements

---

## 7. Debugging Tests

### Print Debug Output
```javascript
import { screen, debug } from '@testing-library/react';

it('should render', () => {
  const { debug } = render(<App />);
  debug(); // Prints current DOM to console
});
```

### Pause Execution
```javascript
it('should pause for inspection', async () => {
  render(<App />);
  debugger; // Add breakpoint
});
```

Run with node debugger:
```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

### Log Specific Elements
```javascript
it('should find element', () => {
  render(<App />);
  const element = screen.getByRole('button');
  console.log(element.outerHTML);
});
```

---

## 8. Common Issues & Solutions

### WebSocket Not Connecting in Tests
```javascript
// Problem: WebSocket closes immediately
// Solution: Mock with proper lifecycle

global.WebSocket = vi.fn(function(url) {
  this.addEventListener = vi.fn();
  this.send = vi.fn();
  this.close = vi.fn();

  // Simulate connection
  setTimeout(() => {
    if (this.onopen) this.onopen();
  }, 0);
});
```

### Timeout Errors in Async Tests
```javascript
// Problem: Test times out waiting for async operation
// Solution: Increase timeout or use fake timers

it('handles async operation', async () => {
  // Increase timeout for this test
}, { timeout: 20000 });

// Or use fake timers
vi.useFakeTimers();
// ... test code ...
vi.runAllTimers();
```

### State Not Updating Between Renders
```javascript
// Problem: State change not reflected
// Solution: Use waitFor

import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

---

## 9. Performance Tips

### Speed Up Tests
1. **Use `vi.mock()` for imports**
   ```javascript
   vi.mock('../api', () => ({
     fetchData: vi.fn(() => Promise.resolve(data)),
   }));
   ```

2. **Avoid real timers**
   ```javascript
   vi.useFakeTimers();
   // Fast forward through delays
   vi.advanceTimersByTime(1000);
   ```

3. **Reuse test data**
   ```javascript
   // Use fixtures instead of creating new data
   import { mockFile } from '../fixtures/mockData';
   ```

4. **Run tests in parallel**
   - Vitest does this by default
   - Use `isolate: false` in config to disable (if needed)

---

## 10. Continuous Integration

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

      - run: cd frontend && npm install

      - run: cd frontend && npm run test:run

      - run: cd frontend && npm run test:coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/coverage-final.json
```

---

## Summary Checklist

- [ ] Install dependencies (`npm install --save-dev ...`)
- [ ] Create `vitest.config.js`
- [ ] Create `src/__tests__/setup.js`
- [ ] Create `src/__tests__/fixtures/mockData.js`
- [ ] Create test directories (`mkdir -p src/__tests__/{utils,hooks}`)
- [ ] Update `package.json` with test scripts
- [ ] Run `npm run test:run` to verify setup
- [ ] Check coverage with `npm run test:coverage`
- [ ] Set up CI/CD (GitHub Actions, etc.)

---

**Status**: Ready to Implement
**Estimated Setup Time**: 15 minutes
**Next Step**: Create first test file in utils/
