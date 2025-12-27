import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Debounce utility for auto-save operations
function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}
import type { Project } from '../components/ProjectCard';
import VideoFilePicker from '../components/VideoFilePicker';
import VideoTimeline from '../components/timeline/VideoTimeline';
import MomentsSidebar from '../components/MomentsSidebar';
import PreviewLayout from '../components/cropper/PreviewLayout';
import CropOverlay from '../components/cropper/CropOverlay';
import CropSettings from '../components/cropper/CropSettings';
import VideoPlayControls from '../components/cropper/VideoPlayControls';
import SubtitlePreviewOverlay from '../components/cropper/SubtitlePreviewOverlay';
import TextStylingPanel, { TextStyle, DEFAULT_TEXT_STYLE, FontFamily, TextPosition } from '../components/TextStylingPanel';
import { TimelineMarker, TimeRange, engagingMomentToMarker } from '../components/timeline/types';
import type { VideoFileMetadata } from '../services/api';
import type { NormalizedCropCoordinates } from '../components/cropper/types';
import type { TemplateType } from '../components/TemplateSelector';

const API_BASE = '';

// Workflow stages
type WorkflowStage = 'select-video' | 'transcribe' | 'find-moments' | 'edit-moments' | 'render';

// Extended Project type with transcription and moments
interface ExtendedProject extends Project {
  transcription?: {
    text: string;
    segments: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
      words: Array<{ word: string; start: number; end: number }>;
    }>;
    language: string;
    duration: number;
  };
  moments?: Array<{
    id: string;
    start: number;
    end: number;
    reason: string;
    text: string;
    confidence: number;
    crop_template?: string;
    crop_coordinates?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    subtitle_config?: Record<string, unknown>;
    rendered_path?: string | null;
  }>;
  current_moment_id?: string | null;
}

// Progress state for jobs
interface JobProgress {
  stage: string;
  progress: number;
  message: string;
}

const ProjectEditor = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ExtendedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Workflow state
  const [currentStage, setCurrentStage] = useState<WorkflowStage>('select-video');
  const [transcribeProgress, setTranscribeProgress] = useState<JobProgress | null>(null);
  const [momentsProgress, setMomentsProgress] = useState<JobProgress | null>(null);
  const [renderProgress, setRenderProgress] = useState<JobProgress | null>(null);

  // Moment editing state
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null);
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [cropTemplate, setCropTemplate] = useState<TemplateType>('1-frame');
  const [cropCoordinates, setCropCoordinates] = useState<NormalizedCropCoordinates[]>([]);
  const [sourceVideoDimensions, setSourceVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Determine workflow stage based on project state
  useEffect(() => {
    if (!project) return;

    if (!project.video_path) {
      setCurrentStage('select-video');
    } else if (!project.transcription) {
      setCurrentStage('transcribe');
    } else if (!project.moments || project.moments.length === 0) {
      setCurrentStage('find-moments');
    } else {
      setCurrentStage('edit-moments');
    }
  }, [project]);

  // Restore selected moment state from project on initial load
  useEffect(() => {
    if (!project?.moments || project.moments.length === 0) return;

    // If we have a saved current_moment_id, restore it
    if (project.current_moment_id && !selectedMomentId) {
      const savedMoment = project.moments.find(m => m.id === project.current_moment_id);
      if (savedMoment) {
        setSelectedMomentId(savedMoment.id);
        setSelectedRange({ start: savedMoment.start, end: savedMoment.end });

        // Restore crop settings
        if (savedMoment.crop_template) {
          setCropTemplate(savedMoment.crop_template as TemplateType);
        }
        if (savedMoment.crop_coordinates) {
          setCropCoordinates(savedMoment.crop_coordinates as NormalizedCropCoordinates[]);
        }

        // Restore subtitle settings
        if (savedMoment.subtitle_config) {
          const cfg = savedMoment.subtitle_config as Record<string, unknown>;
          setTextStyle({
            subtitlesEnabled: cfg.enabled as boolean ?? true,
            fontFamily: (cfg.font_family as FontFamily) ?? DEFAULT_TEXT_STYLE.fontFamily,
            fontSize: cfg.font_size as number ?? DEFAULT_TEXT_STYLE.fontSize,
            textColor: cfg.text_color as string ?? DEFAULT_TEXT_STYLE.textColor,
            position: (cfg.position as TextPosition) ?? DEFAULT_TEXT_STYLE.position,
          });
        }
      }
    }
  }, [project?.moments, project?.current_moment_id, selectedMomentId]);

  // Convert project moments to timeline markers
  const timelineMarkers = useMemo((): TimelineMarker[] => {
    if (!project?.moments) return [];
    return project.moments.map((m, i) => engagingMomentToMarker({
      id: m.id,  // Pass actual backend ID
      start: m.start,
      end: m.end,
      reason: m.reason,
      text: m.text,
      confidence: m.confidence,
    }, i));
  }, [project?.moments]);

  // Get selected moment
  const selectedMoment = useMemo(() => {
    if (!selectedMomentId || !project?.moments) return null;
    return project.moments.find(m => m.id === selectedMomentId) || null;
  }, [selectedMomentId, project?.moments]);

  // Fetch project
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Project not found');
          }
          throw new Error(`Failed to fetch project: ${response.statusText}`);
        }

        const data: ExtendedProject = await response.json();
        setProject(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // WebSocket connection handler
  const connectWebSocket = useCallback((jobId: string, onProgress: (progress: JobProgress) => void, onComplete: () => void) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/job/${jobId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        onProgress({
          stage: data.stage || 'processing',
          progress: data.progress || 0,
          message: data.message || '',
        });

        if (data.stage === 'completed' || data.stage === 'failed') {
          onComplete();
          ws.close();
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
    };

    wsRef.current = ws;
    return ws;
  }, []);

  // Refresh project data
  const refreshProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`);
      if (response.ok) {
        const data: ExtendedProject = await response.json();
        setProject(data);
      }
    } catch (e) {
      console.error('Failed to refresh project:', e);
    }
  }, [projectId]);

  const handleBack = () => {
    navigate('/projects');
  };

  const handleVideoSelect = useCallback(async (video: VideoFileMetadata) => {
    if (!projectId || !project) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: video.full_path,
          // Clear transcription and moments when video changes
          transcription: null,
          moments: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.statusText}`);
      }

      const updatedProject: ExtendedProject = await response.json();
      setProject(updatedProject);
      setShowVideoPicker(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save video selection';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [projectId, project]);

  const handleClearVideo = useCallback(async () => {
    if (!projectId || !project) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: null,
          transcription: null,
          moments: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.statusText}`);
      }

      const updatedProject: ExtendedProject = await response.json();
      setProject(updatedProject);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear video';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [projectId, project]);

  // Handle transcribe
  const handleTranscribe = useCallback(async () => {
    if (!projectId || !project?.video_path) return;

    setTranscribeProgress({ stage: 'starting', progress: 0, message: 'Starting transcription...' });

    try {
      // Backend expects form-data with file_path, not JSON
      const formData = new FormData();
      formData.append('file_path', project.video_path);

      const response = await fetch(`${API_BASE}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to start transcription: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.job_id;

      // Simulated progress animation (Whisper doesn't report intermediate progress)
      let simulatedProgress = 0;
      let simulationInterval: ReturnType<typeof setInterval> | null = null;

      const startSimulation = () => {
        simulationInterval = setInterval(() => {
          // Slowly increment progress, slowing down as we approach 85%
          if (simulatedProgress < 25) {
            // Extraction phase: quick
            simulatedProgress += 2;
          } else if (simulatedProgress < 50) {
            // Early transcription: moderate
            simulatedProgress += 0.8;
          } else if (simulatedProgress < 70) {
            // Mid transcription: slower
            simulatedProgress += 0.4;
          } else if (simulatedProgress < 82) {
            // Late transcription: very slow (asymptotic approach)
            simulatedProgress += 0.15;
          }
          // Cap at 82% - real completion will jump to 100%
          simulatedProgress = Math.min(simulatedProgress, 82);

          let stage = 'Transcribing';
          let message = 'Transcribing audio...';
          if (simulatedProgress < 25) {
            stage = 'Extracting Audio';
            message = 'Extracting audio from video...';
          } else if (simulatedProgress >= 80) {
            message = 'Almost done, processing audio...';
          }

          setTranscribeProgress({
            stage,
            progress: Math.round(simulatedProgress),
            message,
          });
        }, 500);
      };
      startSimulation();

      connectWebSocket(jobId,
        (progress) => {
          // Real WebSocket updates - use actual progress if higher
          if (progress.progress > simulatedProgress) {
            simulatedProgress = progress.progress;
          }
          setTranscribeProgress(progress);
        },
        async () => {
          // Stop simulation on completion
          if (simulationInterval) clearInterval(simulationInterval);

          // Fetch transcription result and save to project
          try {
            const resultResponse = await fetch(`${API_BASE}/transcribe/${jobId}`);
            if (resultResponse.ok) {
              const jobStatus = await resultResponse.json();
              const result = jobStatus.result_data;

              if (result) {
                // Save transcription to project
                await fetch(`${API_BASE}/projects/${projectId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    transcription: {
                      text: result.text || '',
                      segments: result.segments || [],
                      language: result.language || 'en',
                      duration: result.duration || 0,
                    },
                  }),
                });

                await refreshProject();
              }
            }
          } catch (e) {
            console.error('Failed to save transcription:', e);
          }
          setTranscribeProgress(null);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to transcribe';
      setError(message);
      setTranscribeProgress(null);
    }
  }, [projectId, project?.video_path, connectWebSocket, refreshProject]);

  // Handle find moments
  const handleFindMoments = useCallback(async () => {
    if (!projectId || !project?.transcription) return;

    setMomentsProgress({ stage: 'starting', progress: 0, message: 'Starting AI analysis...' });

    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/moments/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_duration: 13, max_duration: 60 }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start AI analysis: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.job_id;

      connectWebSocket(jobId,
        (progress) => setMomentsProgress(progress),
        async () => {
          await refreshProject();
          setMomentsProgress(null);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to find moments';
      setError(message);
      setMomentsProgress(null);
    }
  }, [projectId, project?.transcription, connectWebSocket, refreshProject]);

  // Handle render moment - connects to /ws/render/{job_id} for progress
  const handleRenderMoment = useCallback(async () => {
    if (!projectId || !selectedMoment || !project?.video_path) return;

    setRenderProgress({ stage: 'starting', progress: 0, message: 'Starting render...' });

    try {
      // First save the current crop/subtitle settings to the moment
      await fetch(`${API_BASE}/projects/${projectId}/moments/${selectedMoment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_template: cropTemplate,
          crop_coordinates: cropCoordinates,
          subtitle_config: textStyle.subtitlesEnabled ? {
            enabled: true,
            font_name: textStyle.fontFamily,
            font_size: textStyle.fontSize,
            primary_color: textStyle.textColor,
            position: textStyle.position,
          } : { enabled: false },
        }),
      });

      // Now call the render endpoint with project_id and moment_id only
      const response = await fetch(`${API_BASE}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          moment_id: selectedMoment.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to start render: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.job_id;

      // Connect to the render-specific WebSocket endpoint
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/render/${jobId}`);

      ws.onmessage = (event) => {
        try {
          const msgData = JSON.parse(event.data);

          if (msgData.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          // Handle initial status
          if (msgData.type === 'initial_render_status' || msgData.type === 'render_progress') {
            setRenderProgress({
              stage: msgData.current_phase || msgData.stage || 'processing',
              progress: msgData.progress || 0,
              message: msgData.message || '',
            });
          }

          // Handle completion
          if (msgData.type === 'render_complete' || msgData.status === 'completed') {
            setRenderProgress({
              stage: 'completed',
              progress: 100,
              message: `Render complete: ${msgData.output_path || 'clip ready'}`,
            });
            refreshProject();
            ws.close();
            // Clear progress after showing completion briefly
            setTimeout(() => setRenderProgress(null), 3000);
          }

          // Handle failure
          if (msgData.type === 'render_failed' || msgData.status === 'failed') {
            setError(msgData.error || msgData.message || 'Render failed');
            setRenderProgress(null);
            ws.close();
          }
        } catch (e) {
          console.error('WebSocket message error:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setError('Connection error during render');
        setRenderProgress(null);
      };

      ws.onclose = () => {
        // Only clear progress if not already completed
        if (renderProgress?.stage !== 'completed') {
          refreshProject();
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to render';
      setError(message);
      setRenderProgress(null);
    }
  }, [projectId, selectedMoment, project?.video_path, cropTemplate, cropCoordinates, textStyle, refreshProject, renderProgress?.stage]);

  // Handle moment selection
  const handleMomentClick = useCallback(async (marker: TimelineMarker) => {
    try {
      // Validate marker before processing
      if (!marker || !marker.id) {
        console.error('handleMomentClick: Invalid marker', marker);
        return;
      }

      setSelectedMomentId(marker.id);
      // Seek video to moment start
      if (videoRef.current && typeof marker.startTime === 'number') {
        videoRef.current.currentTime = marker.startTime;
      }
      setCurrentTime(marker.startTime ?? 0);
      setSelectedRange({
        start: marker.startTime ?? 0,
        end: marker.endTime ?? 0
      });

      // Load the moment's saved settings
      const moment = project?.moments?.find(m => m.id === marker.id);
      if (moment) {
        // Restore crop settings
        if (moment.crop_template) {
          setCropTemplate(moment.crop_template as TemplateType);
        }
        if (moment.crop_coordinates && Array.isArray(moment.crop_coordinates)) {
          setCropCoordinates(moment.crop_coordinates as NormalizedCropCoordinates[]);
        } else {
          setCropCoordinates([]);
        }

        // Restore subtitle settings
        if (moment.subtitle_config) {
          const cfg = moment.subtitle_config as Record<string, unknown>;
          setTextStyle({
            subtitlesEnabled: cfg.enabled as boolean ?? true,
            fontFamily: (cfg.font_family as FontFamily) ?? DEFAULT_TEXT_STYLE.fontFamily,
            fontSize: cfg.font_size as number ?? DEFAULT_TEXT_STYLE.fontSize,
            textColor: cfg.text_color as string ?? DEFAULT_TEXT_STYLE.textColor,
            position: (cfg.position as TextPosition) ?? DEFAULT_TEXT_STYLE.position,
          });
        } else {
          setTextStyle(DEFAULT_TEXT_STYLE);
        }
      }

      // Save current_moment_id to project for state persistence
      if (projectId) {
        try {
          await fetch(`${API_BASE}/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_moment_id: marker.id }),
          });
        } catch (e) {
          console.error('Failed to save current moment:', e);
        }
      }
    } catch (error) {
      console.error('handleMomentClick error:', error);
      // Don't rethrow - prevent grey screen crash
    }
  }, [project?.moments, projectId]);

  // Handle moment delete
  const handleMomentDelete = useCallback(async (momentId: string) => {
    if (!projectId || !project?.moments) return;

    const updatedMoments = project.moments.filter(m => m.id !== momentId);

    try {
      await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moments: updatedMoments }),
      });

      await refreshProject();
      if (selectedMomentId === momentId) {
        setSelectedMomentId(null);
      }
    } catch (e) {
      console.error('Failed to delete moment:', e);
    }
  }, [projectId, project?.moments, selectedMomentId, refreshProject]);

  // Debounced save function for crop coordinates
  const saveCropToBackend = useCallback(async (
    coords: NormalizedCropCoordinates[],
    template: TemplateType,
    momentId: string
  ) => {
    if (!projectId) return;
    try {
      await fetch(`${API_BASE}/projects/${projectId}/moments/${momentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_template: template,
          crop_coordinates: coords,
        }),
      });
    } catch (e) {
      console.error('Failed to save crop:', e);
    }
  }, [projectId]);

  const debouncedSaveCrop = useDebouncedCallback(saveCropToBackend, 500);

  // Handle crop change - save to moment with debouncing
  const handleCropChange = useCallback((coords: NormalizedCropCoordinates[]) => {
    setCropCoordinates(coords);

    if (!selectedMomentId) return;
    debouncedSaveCrop(coords, cropTemplate, selectedMomentId);
  }, [selectedMomentId, cropTemplate, debouncedSaveCrop]);

  // Handle template change
  const handleTemplateChange = useCallback(async (template: TemplateType) => {
    try {
      // Validate template value
      if (!template || !['1-frame', '2-frame', '3-frame'].includes(template)) {
        console.error('handleTemplateChange: Invalid template', template);
        return;
      }

      setCropTemplate(template);

      if (!projectId || !selectedMomentId) return;

      try {
        await fetch(`${API_BASE}/projects/${projectId}/moments/${selectedMomentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crop_template: template }),
        });
      } catch (e) {
        console.error('Failed to save template:', e);
      }
    } catch (error) {
      console.error('handleTemplateChange error:', error);
      // Don't rethrow - prevent grey screen crash
    }
  }, [projectId, selectedMomentId]);

  // Debounced save function for subtitle config
  const saveSubtitleToBackend = useCallback(async (
    style: TextStyle,
    momentId: string
  ) => {
    if (!projectId) return;
    try {
      await fetch(`${API_BASE}/projects/${projectId}/moments/${momentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitle_config: {
            enabled: style.subtitlesEnabled,
            font_family: style.fontFamily,
            font_size: style.fontSize,
            text_color: style.textColor,
            position: style.position,
          },
        }),
      });
    } catch (e) {
      console.error('Failed to save subtitle config:', e);
    }
  }, [projectId]);

  const debouncedSaveSubtitle = useDebouncedCallback(saveSubtitleToBackend, 500);

  // Handle subtitle style change with debouncing
  const handleStyleChange = useCallback((style: TextStyle) => {
    setTextStyle(style);

    if (!selectedMomentId) return;
    debouncedSaveSubtitle(style, selectedMomentId);
  }, [selectedMomentId, debouncedSaveSubtitle]);

  // Video URL helper
  const getVideoUrl = (videoPath: string): string => {
    const encodedPath = encodeURIComponent(videoPath);
    return `${API_BASE}/video-stream?path=${encodedPath}`;
  };

  // Progress bar component
  const ProgressBar = ({ progress, stage, message }: JobProgress) => (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300 capitalize">{stage}</span>
        <span className="text-sm text-blue-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">{message}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={handleBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="max-w-full px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          aria-label="Back to projects"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-gray-400 text-sm">
            Stage: <span className="text-blue-400 capitalize">{currentStage.replace('-', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Main layout - changes based on whether moment is selected */}
      {currentStage === 'edit-moments' && selectedMoment ? (
        /* New 50/25/25 Grid Layout when moment is selected */
        <div className="grid h-[calc(100vh-120px)] overflow-hidden" style={{ gridTemplateColumns: '50% 25% 25%' }}>
          {/* Left Column (50%): Source Video with CropOverlay + Timeline */}
          <div className="flex flex-col min-h-0 pr-3">
            {/* Source Video Container with CropOverlay */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex flex-col flex-1 min-h-0">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Source Video
                <span className="text-xs text-gray-500 ml-auto">Drag frames to adjust crop</span>
              </h4>
              <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative min-h-0">
                {/* Video Element - controls hidden when CropOverlay is active */}
                <video
                  ref={videoRef}
                  src={getVideoUrl(project.video_path!)}
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => {
                    setVideoDuration(e.currentTarget.duration);
                    setSourceVideoDimensions({
                      width: e.currentTarget.videoWidth,
                      height: e.currentTarget.videoHeight
                    });
                  }}
                />
                {/* Floating Play Controls - z-index above CropOverlay */}
                <VideoPlayControls
                  videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                  currentTime={currentTime}
                  duration={videoDuration}
                />
                {/* CropOverlay positioned absolute over video */}
                <CropOverlay
                  template={cropTemplate}
                  initialCoordinates={cropCoordinates}
                  onNormalizedCropChange={handleCropChange}
                  className="pointer-events-auto"
                />
                {/* Subtitle Preview on Source Video */}
                {textStyle.subtitlesEnabled && (
                  <SubtitlePreviewOverlay
                    enabled={textStyle.subtitlesEnabled}
                    fontFamily={textStyle.fontFamily}
                    fontSize={textStyle.fontSize}
                    textColor={textStyle.textColor}
                    position={textStyle.position}
                    sampleText={(selectedMoment?.text ?? '').slice(0, 80) || 'Subtitle preview'}
                  />
                )}
              </div>
            </div>

            {/* Timeline with markers - below video */}
            {timelineMarkers.length > 0 && (
              <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 p-3 flex-shrink-0">
                <VideoTimeline
                  duration={videoDuration}
                  currentTime={currentTime}
                  markers={timelineMarkers}
                  selectedRange={selectedRange}
                  onSeek={(time) => {
                    if (videoRef.current) videoRef.current.currentTime = time;
                    setCurrentTime(time);
                  }}
                  onMarkerClick={handleMomentClick}
                  onRangeSelect={setSelectedRange}
                />
              </div>
            )}

            {/* Crop Settings Panel - shows raw and normalized coordinates */}
            {cropCoordinates.length > 0 && (
              <CropSettings
                normalizedCoordinates={cropCoordinates}
                videoDimensions={sourceVideoDimensions || undefined}
                className="mt-3 flex-shrink-0"
                defaultCollapsed={false}
              />
            )}

            {/* Subtitle Settings Panel - next to Crop Settings */}
            <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 p-3 flex-shrink-0">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Subtitle Settings
              </h4>
              <TextStylingPanel
                initialStyle={textStyle}
                onStyleChange={handleStyleChange}
                compact={true}
              />
            </div>
          </div>

          {/* Center Column (25%): Templates + Preview */}
          <div className="flex flex-col min-h-0 px-2 overflow-y-auto">
            {/* Vertical Template Selector with 9:16 icons */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 mb-3">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Template</h4>
              <div className="flex flex-col gap-2">
                {(['1-frame', '2-frame', '3-frame'] as TemplateType[]).map((template) => (
                  <button
                    key={template}
                    onClick={() => handleTemplateChange(template)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      cropTemplate === template
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {/* 9:16 Frame Icon */}
                    <svg viewBox="0 0 18 32" className="w-4 h-7 flex-shrink-0">
                      <rect x="1" y="1" width="16" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      {template === '1-frame' && (
                        <rect x="3" y="3" width="12" height="26" rx="1" fill="currentColor" opacity="0.3" />
                      )}
                      {template === '2-frame' && (
                        <>
                          <rect x="3" y="3" width="12" height="12" rx="1" fill="currentColor" opacity="0.3" />
                          <rect x="3" y="17" width="12" height="12" rx="1" fill="currentColor" opacity="0.3" />
                        </>
                      )}
                      {template === '3-frame' && (
                        <>
                          <rect x="3" y="3" width="5" height="8" rx="1" fill="currentColor" opacity="0.3" />
                          <rect x="10" y="3" width="5" height="8" rx="1" fill="currentColor" opacity="0.3" />
                          <rect x="3" y="13" width="12" height="16" rx="1" fill="currentColor" opacity="0.3" />
                        </>
                      )}
                    </svg>
                    <span className="text-sm font-medium">
                      {template === '1-frame' ? 'Single' : template === '2-frame' ? 'Split' : 'Triple'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 9:16 Preview */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex-1 flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                9:16 Preview
              </h4>
              <div className="flex-1 flex items-center justify-center">
                <PreviewLayout
                  src={getVideoUrl(project.video_path!)}
                  srcType="video"
                  template={cropTemplate}
                  normalizedCoordinates={cropCoordinates}
                  width={180}
                  textStyle={textStyle}
                  subtitleText={(selectedMoment?.text ?? '').slice(0, 50) || 'Sample subtitle'}
                  mainVideoRef={videoRef}
                  currentTime={currentTime}
                />
              </div>
            </div>

            {/* Render Button and Status */}
            <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 p-3 flex-shrink-0">
              {renderProgress ? (
                <ProgressBar {...renderProgress} />
              ) : (
                <button
                  onClick={handleRenderMoment}
                  disabled={cropCoordinates.length === 0}
                  className={`w-full px-4 py-3 text-white rounded-lg font-medium flex items-center justify-center gap-2 ${
                    cropCoordinates.length === 0
                      ? 'bg-gray-600 cursor-not-allowed opacity-60'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {cropCoordinates.length === 0 ? 'Set crop first' : 'Render Clip'}
                </button>
              )}

              {selectedMoment.rendered_path && (
                <div className="mt-3 bg-green-900/30 border border-green-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm truncate">{selectedMoment.rendered_path.split('/').pop()}</span>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a
                        href={`${API_BASE}/video-stream?path=${encodeURIComponent(selectedMoment.rendered_path)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View
                      </a>
                      <a
                        href={`${API_BASE}/video-stream?path=${encodeURIComponent(selectedMoment.rendered_path)}&download=1`}
                        download
                        className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (25%): AI Moments Sidebar - scrollable */}
          <div className="pl-2 overflow-hidden">
            <MomentsSidebar
              moments={timelineMarkers}
              selectedMomentId={selectedMomentId}
              onMomentClick={handleMomentClick}
              onMomentDelete={handleMomentDelete}
              className="h-full overflow-y-auto"
            />
          </div>
        </div>
      ) : (
        /* Original layout for non-edit stages or when no moment selected */
        <div className="flex gap-6">
          {/* Left side: Video and controls */}
          <div className="flex-1 min-w-0">
            {/* Video display or picker */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
              {showVideoPicker ? (
                <VideoFilePicker
                  selectedPath={project.video_path}
                  onSelect={handleVideoSelect}
                  onCancel={() => setShowVideoPicker(false)}
                />
              ) : project.video_path ? (
                <div>
                  {/* Video Player - Native element for timeline integration */}
                  <div className="bg-gray-900 rounded-lg overflow-hidden mb-4 relative flex items-center justify-center" style={{ maxHeight: '50vh' }}>
                    <video
                      ref={videoRef}
                      src={getVideoUrl(project.video_path)}
                      className="max-w-full max-h-[50vh] object-contain"
                      controls
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => {
                        setVideoDuration(e.currentTarget.duration);
                        setSourceVideoDimensions({
                          width: e.currentTarget.videoWidth,
                          height: e.currentTarget.videoHeight
                        });
                      }}
                    />
                  </div>

                  {/* Timeline with markers */}
                  {timelineMarkers.length > 0 && (
                    <div className="mb-4">
                      <VideoTimeline
                        duration={videoDuration}
                        currentTime={currentTime}
                        markers={timelineMarkers}
                        selectedRange={selectedRange}
                        onSeek={(time) => {
                          if (videoRef.current) videoRef.current.currentTime = time;
                          setCurrentTime(time);
                        }}
                        onMarkerClick={handleMomentClick}
                        onRangeSelect={setSelectedRange}
                      />
                    </div>
                  )}

                  {/* Video info */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    <span className="truncate flex-1">{project.video_path.split('/').pop()}</span>
                    <button
                      onClick={() => setShowVideoPicker(true)}
                      disabled={saving}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Change video"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg flex items-center justify-center" style={{ height: '40vh', minHeight: '250px' }}>
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    <p className="mb-4">No video attached</p>
                    <button
                      onClick={() => setShowVideoPicker(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                    >
                      Select Video
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Workflow buttons */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
              <h3 className="text-lg font-semibold text-white mb-4">Workflow</h3>

              {/* Step 1: Transcribe */}
              {currentStage === 'transcribe' && (
                <div>
                  {transcribeProgress ? (
                    <ProgressBar {...transcribeProgress} />
                  ) : (
                    <button
                      onClick={handleTranscribe}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Transcribe Video
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Find Moments */}
              {currentStage === 'find-moments' && (
                <div>
                  {momentsProgress ? (
                    <ProgressBar {...momentsProgress} />
                  ) : (
                    <button
                      onClick={handleFindMoments}
                      className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Find AI Moments
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Transcription complete: {project.transcription?.segments.length || 0} segments
                  </p>
                </div>
              )}

              {/* Show status when no moment selected in edit stage */}
              {currentStage === 'edit-moments' && !selectedMoment && (
                <p className="text-gray-400 text-sm">
                  Select a moment from the sidebar to edit and render.
                </p>
              )}
            </div>
          </div>

          {/* Right side: Moments Sidebar */}
          {currentStage === 'edit-moments' && (
            <div className="w-80 flex-shrink-0">
              <MomentsSidebar
                moments={timelineMarkers}
                selectedMomentId={selectedMomentId}
                onMomentClick={handleMomentClick}
                onMomentDelete={handleMomentDelete}
                className="h-[calc(100vh-200px)]"
              />
            </div>
          )}
        </div>
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-4">
            <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-white">Saving...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectEditor;
