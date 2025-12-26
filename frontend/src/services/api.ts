/**
 * API Service for fetching video files from the backend
 */

export interface VideoFileMetadata {
  name: string;
  path: string;
  full_path: string;
  size_bytes: number;
  size_formatted: string;
  modified: string;
  extension: string;
  duration_seconds: number | null;
  duration_formatted: string | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  frame_rate: number | null;
  bitrate_kbps: number | null;
  format_name: string | null;
  has_audio: boolean | null;
}

export interface VideoFilesListResponse {
  videos_path: string;
  total_count: number;
  total_size_bytes: number;
  total_size_formatted: string;
  files: VideoFileMetadata[];
  error?: string;
}

/**
 * Fetch all video files from the /files endpoint
 */
export async function fetchVideoFiles(includeMetadata = true): Promise<VideoFilesListResponse> {
  const url = `/files?include_metadata=${includeMetadata}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch video files: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Start a new transcription project with a video file
 */
export async function startProject(filePath: string): Promise<{ job_id: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append('file_path', filePath);

  const response = await fetch(`/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to start project: ${response.statusText}`);
  }

  return response.json();
}
