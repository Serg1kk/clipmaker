/**
 * TypeScript type definitions for useProgress hook
 * Organized for clarity and reusability across the application
 */

/**
 * WebSocket message types received from backend
 */
export enum ProgressMessageType {
  PROGRESS = 'progress',
  STATUS = 'status',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  COMPLETE = 'complete',
}

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSED = 'closed',
}

/**
 * Progress message structure received from WebSocket
 * Flexible design to accommodate various backend implementations
 */
export interface ProgressMessage {
  type: ProgressMessageType | string;
  progress?: number;        // 0-100 percentage
  status?: string;          // Human-readable status (e.g., "transcribing", "processing")
  message?: string;         // Additional message text
  error?: string;           // Error message if type is 'error'
  eta_seconds?: number;     // Estimated seconds remaining
  timestamp?: number;       // Unix timestamp from server
  data?: Record<string, unknown>; // Additional arbitrary data
}

/**
 * Configuration for reconnection strategy
 */
export interface ReconnectConfig {
  /** Maximum reconnection attempts before giving up */
  maxAttempts: number;

  /** Initial delay in milliseconds between reconnection attempts */
  baseDelay: number;

  /** Maximum delay cap for exponential backoff */
  maxDelay: number;

  /** Multiplier for exponential backoff calculation (typically 2) */
  backoffMultiplier: number;
}

/**
 * Input parameters for useProgress hook
 */
export interface UseProgressInput {
  /** The job ID to track progress for. Null disables connection. */
  jobId: string | null;

  /** Optional callback when progress value changes (0-100) */
  onProgressChange?: (progress: number) => void;

  /** Optional callback when status message changes */
  onStatusChange?: (status: string) => void;

  /** Optional callback when an error occurs */
  onError?: (error: string) => void;

  /** Optional reconnection configuration override */
  reconnectConfig?: Partial<ReconnectConfig>;

  /** Optional message queue size limit to prevent memory issues */
  messageQueueLimit?: number;

  /** Optional custom WebSocket URL builder */
  buildWebSocketUrl?: (jobId: string) => string;

  /** Optional custom message parser */
  parseMessage?: (event: MessageEvent) => ProgressMessage;
}

/**
 * Return type of useProgress hook
 * Provides all state and control functions needed by consumer
 */
export interface UseProgressReturn {
  // State values
  /** Current progress percentage (0-100) */
  progress: number;

  /** Current status message from backend */
  status: string;

  /** Whether WebSocket is currently connected */
  isConnected: boolean;

  /** Last error message, or null if no error */
  error: string | null;

  /** Current WebSocket connection state (for advanced usage) */
  wsState?: WebSocketState;

  /** Number of reconnection attempts made (for debugging) */
  reconnectAttempts?: number;

  // Control functions
  /** Manually trigger a reconnection, resetting attempt counter */
  reconnect: () => void;

  /** Reset all state to initial values */
  reset: () => void;

  /** Manually disconnect from WebSocket */
  disconnect?: () => void;

  /** Force disconnect and prevent reconnection */
  cleanup?: () => void;
}

/**
 * Internal state for the hook
 * Not exposed to consumers, used for implementation
 */
export interface ProgressState {
  progress: number;
  status: string;
  error: string | null;
  isConnected: boolean;
  reconnectAttempts: number;
  lastUpdate: Date;
  messageQueue: ProgressMessage[];
}

/**
 * Internal WebSocket refs collection
 */
export interface WebSocketRefs {
  ws: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  messageQueue: ProgressMessage[];
  lastMessageTime: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelay: 1000,      // 1 second
  maxDelay: 30000,      // 30 seconds
  backoffMultiplier: 2,
};

/**
 * WebSocket close codes that should NOT trigger reconnection
 */
export const NO_RECONNECT_CODES = new Set([
  1000, // Normal closure
  1003, // Unsupported data
  1008, // Policy violation
  1009, // Message too big
  1011, // Server error
  1012, // Service restart
]);

/**
 * Type guard for ProgressMessage
 */
export function isProgressMessage(data: unknown): data is ProgressMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return typeof obj.type === 'string';
}

/**
 * Type for WebSocket message handler callback
 */
export type MessageHandler = (message: ProgressMessage) => void;

/**
 * Type for WebSocket error handler callback
 */
export type ErrorHandler = (error: string | Event) => void;

/**
 * Type for status change callback
 */
export type StatusChangeCallback = (status: string) => void;

/**
 * Type for progress change callback
 */
export type ProgressChangeCallback = (progress: number) => void;

/**
 * Combined callback type for hook initialization
 */
export type HookCallbacks = {
  onMessage?: MessageHandler;
  onError?: ErrorHandler;
  onStatusChange?: StatusChangeCallback;
  onProgressChange?: ProgressChangeCallback;
};
