import { useState, useCallback } from 'react';

const STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
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

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setStatus(STATUS.IDLE);
    setProgress(0);
    setFile(null);
    setTranscript('');
    setError('');
    setTaskId(null);
  }, []);

  const pollStatus = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/transcribe/${id}`);
      const data = await response.json();

      if (data.status === 'completed') {
        setStatus(STATUS.COMPLETED);
        setProgress(100);
        setTranscript(data.transcript || 'No transcript available');
      } else if (data.status === 'failed') {
        setStatus(STATUS.ERROR);
        setError(data.error || 'Transcription failed');
      } else {
        setProgress(data.progress || 50);
        setTimeout(() => pollStatus(id), 2000);
      }
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError('Failed to check transcription status');
    }
  }, []);

  const uploadFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus(STATUS.UPLOADING);
    setProgress(0);
    setError('');
    setTranscript('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setStatus(STATUS.PROCESSING);
      setProgress(25);

      pollStatus(data.task_id);
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message || 'Failed to upload file');
    }
  }, [pollStatus]);

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
          {status === STATUS.IDLE ? '🎬' : status === STATUS.COMPLETED ? '✅' : '⏳'}
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
