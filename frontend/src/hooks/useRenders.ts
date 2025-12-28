import { useState, useEffect, useCallback } from 'react';

/**
 * Render model matching backend Render model
 */
export interface Render {
  id: string;
  project_id: string;
  project_name: string;
  moment_id: string;
  moment_reason: string;
  file_path: string;
  file_size_bytes: number;
  file_size_formatted: string;
  duration_seconds: number;
  thumbnail_path: string | null;
  created_at: string;
  crop_template: string;
  crop_coordinates: Record<string, unknown>[];
  subtitle_config: Record<string, unknown>;
}

interface RendersResponse {
  renders: Render[];
  total: number;
}

interface UseRendersOptions {
  projectId?: string;  // Filter renders by project ID
}

interface UseRendersReturn {
  renders: Render[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteRender: (id: string) => Promise<boolean>;
  streamUrl: (id: string) => string;
  downloadUrl: (id: string) => string;
}

const API_BASE = '';

/**
 * Custom hook for managing renders data and operations
 * @param options.projectId - Optional project ID to filter renders
 */
export function useRenders(options: UseRendersOptions = {}): UseRendersReturn {
  const { projectId } = options;
  const [renders, setRenders] = useState<Render[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRenders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/renders`);

      if (!response.ok) {
        throw new Error(`Failed to fetch renders: ${response.statusText}`);
      }

      const data: RendersResponse = await response.json();

      // Filter by projectId if provided
      const filteredRenders = projectId
        ? data.renders.filter(r => r.project_id === projectId)
        : data.renders;

      setRenders(filteredRenders);
      setTotal(filteredRenders.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error fetching renders:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const deleteRender = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/renders/${id}?delete_file=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete render: ${response.statusText}`);
      }

      // Remove from local state
      setRenders((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete render';
      setError(message);
      console.error('Error deleting render:', err);
      return false;
    }
  }, []);

  const streamUrl = useCallback((id: string): string => {
    return `${API_BASE}/renders/${id}/stream`;
  }, []);

  const downloadUrl = useCallback((id: string): string => {
    return `${API_BASE}/renders/${id}/download`;
  }, []);

  // Fetch renders on mount
  useEffect(() => {
    fetchRenders();
  }, [fetchRenders]);

  return {
    renders,
    total,
    loading,
    error,
    refetch: fetchRenders,
    deleteRender,
    streamUrl,
    downloadUrl,
  };
}

export default useRenders;
