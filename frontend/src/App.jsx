import { useState, useCallback, useRef, useEffect } from 'react';

const STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

// WebSocket connection states
const WS_STATE = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#888',
    fontSize: '1rem',
  },
  dropzone: {
    border: '2px dashed #333',
    borderRadius: '12px',
    padding: '60px 40px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: '#1a1a1a',
  },
  dropzoneActive: {
    borderColor: '#4a9eff',
    background: '#1a2a3a',
  },
  dropzoneDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  uploadIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  uploadText: {
    color: '#ccc',
    marginBottom: '8px',
  },
  uploadHint: {
    color: '#666',
    fontSize: '0.875rem',
  },
  fileInput: {
    display: 'none',
  },
  statusCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '24px',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  statusTitle: {
    fontWeight: '500',
    color: '#fff',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  progressBar: {
    height: '4px',
    background: '#333',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  progressFill: {
    height: '100%',
    background: '#4a9eff',
    transition: 'width 0.3s ease',
  },
  fileName: {
    color: '#888',
    fontSize: '0.875rem',
  },
  progressDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
  },
  progressMessage: {
    color: '#aaa',
    fontSize: '0.875rem',
  },
  etaText: {
    color: '#666',
    fontSize: '0.75rem',
  },
  resultCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '24px',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  resultTitle: {
    fontWeight: '500',
    color: '#fff',
  },
  copyButton: {
    background: '#333',
    border: 'none',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  transcriptBox: {
    background: '#0f0f0f',
    borderRadius: '8px',
    padding: '16px',
    maxHeight: '400px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  errorMessage: {
    background: '#2a1a1a',
    border: '1px solid #4a2a2a',
    borderRadius: '8px',
    padding: '16px',
    color: '#ff6b6b',
    marginTop: '16px',
  },
  resetButton: {
    background: '#333',
    border: 'none',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    marginTop: '16px',
    width: '100%',
  },
  wsIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '8px',
  },
  wsIndicatorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
};

const getStatusColor = (status) => {
  const colors = {
    [STATUS.IDLE]: { bg: '#333', text: '#888' },
    [STATUS.UPLOADING]: { bg: '#2a3a4a', text: '#4a9eff' },
    [STATUS.PROCESSING]: { bg: '#3a3a2a', text: '#ffb84a' },
    [STATUS.COMPLETED]: { bg: '#2a3a2a', text: '#4aff6b' },
    [STATUS.ERROR]: { bg: '#3a2a2a', text: '#ff6b6b' },
  };
  return colors[status] || colors[STATUS.IDLE];
};

const getWsIndicatorColor = (wsState) => {
  const colors = {
    [WS_STATE.CONNECTED]: '#4aff6b',
    [WS_STATE.CONNECTING]: '#ffb84a',
    [WS_STATE.RECONNECTING]: '#ffb84a',
    [WS_STATE.DISCONNECTED]: '#ff6b6b',
  };
  return colors[wsState] || '#666';
};

const formatEta = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s remaining`;
};

/**
 * Custom hook for WebSocket connection with auto-reconnect
 */
function useWebSocket(jobId, onMessage, onError) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const [wsState, setWsState] = useState(WS_STATE.DISCONNECTED);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = useCallback(() => {
    if (!jobId) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setWsState(reconnectAttemptsRef.current > 0 ? WS_STATE.RECONNECTING : WS_STATE.CONNECTING);

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/job/${jobId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for job:', jobId);
        setWsState(WS_STATE.CONNECTED);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle ping messages
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          // Forward other messages to handler
          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        if (onError) {
          onError(event);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setWsState(WS_STATE.DISCONNECTED);

        // Attempt reconnection if not a clean close and under max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current += 1;

          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setWsState(WS_STATE.DISCONNECTED);
    }
  }, [jobId, onMessage, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
    setWsState(WS_STATE.DISCONNECTED);
  }, []);

  // Connect when jobId changes
  useEffect(() => {
    if (jobId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [jobId, connect, disconnect]);

  return { wsState, disconnect };
}

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [etaSeconds, setEtaSeconds] = useState(null);

  // Handle WebSocket messages
  const handleWsMessage = useCallback((data) => {
    console.log('WebSocket message:', data);

    switch (data.type) {
      case 'progress':
        setProgress(data.progress || 0);
        setProgressMessage(data.message || '');
        if (data.details?.eta_seconds) {
          setEtaSeconds(data.details.eta_seconds);
        }

        if (data.stage === 'completed') {
          setStatus(STATUS.COMPLETED);
          setProgress(100);
          // Fetch the final result
          fetchResult(data.job_id);
        } else if (data.stage === 'failed') {
          setStatus(STATUS.ERROR);
          setError(data.message || 'Transcription failed');
        }
        break;

      case 'initial_status':
        if (data.status === 'completed') {
          setStatus(STATUS.COMPLETED);
          setProgress(100);
          fetchResult(data.job_id);
        } else if (data.status === 'failed') {
          setStatus(STATUS.ERROR);
        } else {
          setProgress(data.progress || 0);
        }
        break;

      case 'waiting':
        setProgressMessage('Waiting for job to start...');
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }, []);

  const handleWsError = useCallback(() => {
    // WebSocket errors are logged, but we don't necessarily want to show an error
    // to the user as the WebSocket might reconnect
    console.log('WebSocket connection error - will attempt reconnect');
  }, []);

  // Use WebSocket hook
  const { wsState, disconnect: disconnectWs } = useWebSocket(
    jobId,
    handleWsMessage,
    handleWsError
  );

  // Fetch the final result when transcription is complete
  const fetchResult = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/transcribe/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch result');
      }
      const data = await response.json();
      setTranscript(data.result || 'No transcript available');
    } catch (err) {
      console.error('Failed to fetch result:', err);
      setError('Failed to fetch transcription result');
    }
  }, []);

  const resetState = useCallback(() => {
    disconnectWs();
    setStatus(STATUS.IDLE);
    setProgress(0);
    setFile(null);
    setTranscript('');
    setError('');
    setJobId(null);
    setProgressMessage('');
    setEtaSeconds(null);
  }, [disconnectWs]);

  const uploadFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus(STATUS.UPLOADING);
    setProgress(0);
    setError('');
    setTranscript('');
    setProgressMessage('Uploading file...');
    setEtaSeconds(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Set job ID - this triggers WebSocket connection
      setJobId(data.job_id);
      setStatus(STATUS.PROCESSING);
      setProgressMessage('Connecting to progress stream...');

    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message || 'Failed to upload file');
      setProgressMessage('');
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      uploadFile(selectedFile);
    }
  }, [uploadFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    if (status !== STATUS.IDLE) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      uploadFile(droppedFile);
    }
  }, [status, uploadFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (status === STATUS.IDLE) {
      setIsDragging(true);
    }
  }, [status]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(transcript);
  }, [transcript]);

  const isDisabled = status !== STATUS.IDLE;
  const statusColor = getStatusColor(status);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Video Transcription</h1>
        <p style={styles.subtitle}>Upload a video file to extract text transcript</p>
      </header>

      <div
        style={{
          ...styles.dropzone,
          ...(isDragging ? styles.dropzoneActive : {}),
          ...(isDisabled ? styles.dropzoneDisabled : {}),
        }}
        onClick={() => !isDisabled && document.getElementById('fileInput').click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div style={styles.uploadIcon}>
          {status === STATUS.IDLE ? '\uD83C\uDFAC' : status === STATUS.COMPLETED ? '\u2705' : '\u23F3'}
        </div>
        <p style={styles.uploadText}>
          {status === STATUS.IDLE
            ? 'Drop your video here or click to browse'
            : status === STATUS.UPLOADING
            ? 'Uploading...'
            : status === STATUS.PROCESSING
            ? 'Processing transcription...'
            : status === STATUS.COMPLETED
            ? 'Transcription complete!'
            : 'Error occurred'}
        </p>
        <p style={styles.uploadHint}>Supports MP4, MOV, AVI, MKV, WebM</p>
        <input
          id="fileInput"
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          style={styles.fileInput}
          disabled={isDisabled}
        />
      </div>

      {status !== STATUS.IDLE && (
        <div style={styles.statusCard}>
          <div style={styles.statusHeader}>
            <span style={styles.statusTitle}>Status</span>
            <span
              style={{
                ...styles.statusBadge,
                background: statusColor.bg,
                color: statusColor.text,
              }}
            >
              {status}
            </span>
          </div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          {file && <p style={styles.fileName}>{file.name}</p>}

          {/* Progress details */}
          <div style={styles.progressDetails}>
            <span style={styles.progressMessage}>{progressMessage}</span>
            <span style={styles.etaText}>{formatEta(etaSeconds)}</span>
          </div>

          {/* WebSocket connection indicator */}
          {status === STATUS.PROCESSING && (
            <div style={styles.wsIndicator}>
              <span
                style={{
                  ...styles.wsIndicatorDot,
                  background: getWsIndicatorColor(wsState),
                }}
              />
              <span>
                {wsState === WS_STATE.CONNECTED
                  ? 'Live updates'
                  : wsState === WS_STATE.CONNECTING
                  ? 'Connecting...'
                  : wsState === WS_STATE.RECONNECTING
                  ? 'Reconnecting...'
                  : 'Disconnected'}
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {transcript && (
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>
            <span style={styles.resultTitle}>Transcript</span>
            <button style={styles.copyButton} onClick={copyToClipboard}>
              Copy
            </button>
          </div>
          <div style={styles.transcriptBox}>{transcript}</div>
        </div>
      )}

      {(status === STATUS.COMPLETED || status === STATUS.ERROR) && (
        <button style={styles.resetButton} onClick={resetState}>
          Transcribe Another Video
        </button>
      )}
    </div>
  );
}
