import { useState, useEffect, useCallback } from 'react';
import { fetchVideoFiles, type VideoFileMetadata, type VideoFilesListResponse } from '../services/api';

interface UseVideoFilesResult {
  videos: VideoFileMetadata[];
  totalCount: number;
  totalSize: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing video files
 */
export function useVideoFiles(): UseVideoFilesResult {
  const [videos, setVideos] = useState<VideoFileMetadata[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSize, setTotalSize] = useState('0 B');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response: VideoFilesListResponse = await fetchVideoFiles(true);

      if (response.error) {
        setError(response.error);
        setVideos([]);
        setTotalCount(0);
        setTotalSize('0 B');
      } else {
        setVideos(response.files);
        setTotalCount(response.total_count);
        setTotalSize(response.total_size_formatted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video files');
      setVideos([]);
      setTotalCount(0);
      setTotalSize('0 B');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    videos,
    totalCount,
    totalSize,
    isLoading,
    error,
    refetch: fetchData,
  };
}
