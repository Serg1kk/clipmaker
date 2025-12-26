import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WebSocketState,
  ProgressMessage,
  ProgressMessageType,
  UseProgressInput,
  UseProgressReturn,
  ReconnectConfig,
  DEFAULT_RECONNECT_CONFIG,
  NO_RECONNECT_CODES,
  isProgressMessage,
} from './types/progress.types';

/**
 * Builds the WebSocket URL for a given job ID
 * Uses the current window location to determine protocol (ws/wss) and host
 */
function buildDefaultWebSocketUrl(jobId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/job/${jobId}`;
}

/**
 * Parses an incoming WebSocket message event into a ProgressMessage
 * Handles invalid JSON gracefully
 */
function defaultParseMessage(event: MessageEvent): ProgressMessage {
  try {
    const data = JSON.parse(event.data);
    if (isProgressMessage(data)) {
      return data;
    }
    // If data has no type, wrap it as a status message
    return {
      type: ProgressMessageType.STATUS,
      message: String(data),
    };
  } catch {
    // Invalid JSON - treat as plain text status
    return {
      type: ProgressMessageType.STATUS,
      message: String(event.data),
    };
  }
}

/**
 * Calculates the reconnection delay using exponential backoff
 */
function calculateBackoffDelay(
  attempt: number,
  config: ReconnectConfig
): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Custom React hook for tracking job progress via WebSocket
 *
 * Features:
 * - Automatic WebSocket connection management
 * - Exponential backoff reconnection strategy
 * - Graceful error handling
 * - Clean unmount cleanup
 *
 * @param input - Configuration object or just jobId string
 * @returns Progress state and control functions
 *
 * @example
 * ```tsx
 * const { progress, status, isConnected, error, reconnect } = useProgress({
 *   jobId: 'abc-123',
 *   onProgressChange: (p) => console.log(`Progress: ${p}%`),
 * });
 * ```
 */
export function useProgress(input: UseProgressInput | string | null): UseProgressReturn {
  // Normalize input to always be UseProgressInput
  const config: UseProgressInput =
    typeof input === 'string'
      ? { jobId: input }
      : input === null
        ? { jobId: null }
        : input;

  const {
    jobId,
    onProgressChange,
    onStatusChange,
    onError,
    reconnectConfig: userReconnectConfig,
    buildWebSocketUrl = buildDefaultWebSocketUrl,
    parseMessage = defaultParseMessage,
  } = config;

  // Merge user config with defaults
  const reconnectConfig: ReconnectConfig = {
    ...DEFAULT_RECONNECT_CONFIG,
    // Override with task requirements: max 10 attempts
    maxAttempts: 10,
    ...userReconnectConfig,
  };

  // State for progress tracking
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WebSocketState>(WebSocketState.DISCONNECTED);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);

  // Refs for WebSocket and timers (to avoid stale closures)
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const isManualDisconnectRef = useRef<boolean>(false);

  // Clear any pending reconnection timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Clean up WebSocket connection
  const cleanup = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();

    if (wsRef.current) {
      // Remove all event listeners to prevent callbacks after cleanup
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      // Close if not already closed
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Client cleanup');
      }
      wsRef.current = null;
    }

    if (isMountedRef.current) {
      setWsState(WebSocketState.CLOSED);
    }
  }, [clearReconnectTimeout]);

  // Disconnect without preventing future connections
  const disconnect = useCallback(() => {
    cleanup();
    if (isMountedRef.current) {
      setWsState(WebSocketState.DISCONNECTED);
    }
  }, [cleanup]);

  // Reset all state to initial values
  const reset = useCallback(() => {
    setProgress(0);
    setStatus('');
    setError(null);
    setReconnectAttempts(0);
    reconnectAttemptsRef.current = 0;
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!jobId || !isMountedRef.current) {
      return;
    }

    // Clean up any existing connection first
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Reconnecting');
      }
    }

    isManualDisconnectRef.current = false;
    setWsState(reconnectAttemptsRef.current > 0
      ? WebSocketState.RECONNECTING
      : WebSocketState.CONNECTING
    );
    setError(null);

    const url = buildWebSocketUrl(jobId);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;

        setWsState(WebSocketState.CONNECTED);
        setError(null);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;

        const message = parseMessage(event);

        // Handle different message types
        switch (message.type) {
          case ProgressMessageType.PROGRESS:
          case 'progress': {
            const rawProgress = message.progress ?? progress;
            // Clamp progress to 0-100 range
            const newProgress = Math.max(0, Math.min(100, rawProgress));
            setProgress(newProgress);
            onProgressChange?.(newProgress);

            if (message.status || message.message) {
              const newStatus = message.status || message.message || '';
              setStatus(newStatus);
              onStatusChange?.(newStatus);
            }
            break;
          }

          case ProgressMessageType.STATUS:
          case 'status': {
            const newStatus = message.status || message.message || '';
            setStatus(newStatus);
            onStatusChange?.(newStatus);
            break;
          }

          case ProgressMessageType.ERROR:
          case 'error': {
            const errorMsg = message.error || message.message || 'Unknown error';
            setError(errorMsg);
            onError?.(errorMsg);
            break;
          }

          case ProgressMessageType.COMPLETE:
          case 'complete': {
            setProgress(100);
            onProgressChange?.(100);
            const completeStatus = message.status || message.message || 'Complete';
            setStatus(completeStatus);
            onStatusChange?.(completeStatus);
            break;
          }

          case ProgressMessageType.PING:
          case 'ping': {
            // Respond to ping with pong to keep connection alive
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
          }

          case ProgressMessageType.PONG:
          case 'pong': {
            // Pong received, connection is healthy
            break;
          }

          default: {
            // Unknown message type - treat as status if has message/status
            if (message.message || message.status) {
              const newStatus = message.status || message.message || '';
              setStatus(newStatus);
              onStatusChange?.(newStatus);
            }

            // Update progress if present
            if (typeof message.progress === 'number') {
              setProgress(message.progress);
              onProgressChange?.(message.progress);
            }
          }
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;

        // WebSocket error event doesn't provide useful info
        // The close event will follow with more details
        setError('Connection error');
      };

      ws.onclose = (event: CloseEvent) => {
        if (!isMountedRef.current) return;

        wsRef.current = null;
        setWsState(WebSocketState.DISCONNECTED);

        // Don't reconnect if:
        // 1. Manual disconnect
        // 2. Clean close (code 1000)
        // 3. Code in no-reconnect list
        // 4. Max attempts reached
        const shouldReconnect =
          !isManualDisconnectRef.current &&
          !NO_RECONNECT_CODES.has(event.code) &&
          reconnectAttemptsRef.current < reconnectConfig.maxAttempts;

        if (shouldReconnect) {
          const delay = calculateBackoffDelay(
            reconnectAttemptsRef.current,
            reconnectConfig
          );

          reconnectAttemptsRef.current += 1;
          setReconnectAttempts(reconnectAttemptsRef.current);
          setWsState(WebSocketState.RECONNECTING);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !isManualDisconnectRef.current) {
              connect();
            }
          }, delay);
        } else if (
          reconnectAttemptsRef.current >= reconnectConfig.maxAttempts &&
          !isManualDisconnectRef.current
        ) {
          const errorMsg = `Connection failed after ${reconnectConfig.maxAttempts} attempts`;
          setError(errorMsg);
          onError?.(errorMsg);
        }
      };
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMsg = err instanceof Error ? err.message : 'Failed to create WebSocket';
      setError(errorMsg);
      onError?.(errorMsg);
      setWsState(WebSocketState.DISCONNECTED);
    }
  }, [
    jobId,
    buildWebSocketUrl,
    parseMessage,
    reconnectConfig,
    onProgressChange,
    onStatusChange,
    onError,
    progress,
  ]);

  // Manual reconnect - resets attempt counter
  const reconnect = useCallback(() => {
    cleanup();
    reset();
    isManualDisconnectRef.current = false;

    // Use setTimeout to ensure cleanup completes
    setTimeout(() => {
      if (isMountedRef.current && jobId) {
        connect();
      }
    }, 100);
  }, [cleanup, reset, connect, jobId]);

  // Effect to manage connection lifecycle based on jobId
  useEffect(() => {
    isMountedRef.current = true;

    if (jobId) {
      // Reset state and connect for new job
      reset();
      connect();
    } else {
      // No jobId - disconnect and reset
      disconnect();
      reset();
    }

    // Cleanup on unmount or jobId change
    return () => {
      isMountedRef.current = false;
      clearReconnectTimeout();

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        if (wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close(1000, 'Component unmount');
        }
        wsRef.current = null;
      }
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute isConnected from wsState
  const isConnected = wsState === WebSocketState.CONNECTED;

  return {
    progress,
    status,
    isConnected,
    error,
    wsState,
    reconnectAttempts,
    reconnect,
    reset,
    disconnect,
    cleanup,
  };
}

// Default export for convenience
export default useProgress;
