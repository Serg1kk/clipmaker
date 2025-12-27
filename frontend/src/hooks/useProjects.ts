import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../components/ProjectCard';

interface ProjectsResponse {
  projects: Project[];
  total: number;
}

interface CreateProjectData {
  name: string;
  description?: string;
  video_path?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface UseProjectsReturn {
  projects: Project[];
  total: number;
  loading: boolean;
  error: string | null;
  creating: boolean;
  refetch: () => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project | null>;
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
  const [creating, setCreating] = useState(false);
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

  const createProject = useCallback(async (data: CreateProjectData): Promise<Project | null> => {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create project: ${response.statusText}`);
      }

      const newProject: Project = await response.json();

      // Add to local state
      setProjects((prev) => [newProject, ...prev]);
      setTotal((prev) => prev + 1);

      return newProject;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      console.error('Error creating project:', err);
      return null;
    } finally {
      setCreating(false);
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
    creating,
    error,
    refetch: fetchProjects,
    createProject,
    deleteProject,
  };
}

export default useProjects;
