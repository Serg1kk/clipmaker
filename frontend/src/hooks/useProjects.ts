import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../components/ProjectCard';

interface ProjectsResponse {
  projects: Project[];
  total: number;
}

interface UseProjectsReturn {
  projects: Project[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteProject: (id: string) => Promise<boolean>;
}

const API_BASE = '';

/**
 * Custom hook for managing projects data and operations
 */
export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/projects`);

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.statusText}`);
      }

      // Remove from local state
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTotal((prev) => prev - 1);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      setError(message);
      console.error('Error deleting project:', err);
      return false;
    }
  }, []);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    total,
    loading,
    error,
    refetch: fetchProjects,
    deleteProject,
  };
}

export default useProjects;
