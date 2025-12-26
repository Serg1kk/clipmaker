"""
Services package for AI Clips backend.

This package contains service modules for various processing tasks:
- ffmpeg_service: Audio extraction and video processing
- file_browser_service: File system navigation and browsing
- storage_service: Project persistence and JSON storage
- websocket_service: Real-time communication
- whisper_service: Audio transcription with word-level timestamps
"""

from .file_browser_service import FileBrowserService
from .ffmpeg_service import (
    FFmpegService,
    FFmpegError,
    FFmpegNotFoundError,
    InvalidVideoError,
    DiskSpaceError,
    ExtractionTimeoutError,
    VideoInfo,
    ExtractionProgress,
    AudioFormat,
    extract_audio,
    get_video_info,
    validate_video_file,
)
from .storage_service import (
    StorageService,
    StorageServiceError,
    ProjectNotFoundError,
    get_storage_service,
)
# Whisper service requires torch - import conditionally
try:
    from .whisper_service import (
        WhisperService,
        TranscriptionResult,
        WordInfo,
        SegmentInfo,
        get_whisper_service,
        MODEL_CONFIGS,
    )
except ImportError:
    # Torch not installed - whisper functionality will be unavailable
    WhisperService = None
    TranscriptionResult = None
    WordInfo = None
    SegmentInfo = None
    get_whisper_service = None
    MODEL_CONFIGS = None
from .websocket_service import (
    ConnectionManager,
    ProgressTracker,
    ProgressMessage,
    ProgressStage,
    connection_manager,
    handle_websocket_messages,
)
from .engaging_moments import (
    EngagingMoment,
    EngagingMomentsResponse,
    find_engaging_moments,
    find_engaging_moments_async,
    find_engaging_moments_response,
)
from .karaoke_generator import (
    generate_karaoke_ass,
    generate_karaoke_ass_multiline,
    KaraokeStyle,
    KaraokeConfig,
    ASSColor,
    ASSAlignment,
    KaraokeEffect,
)

__all__ = [
    # File Browser
    "FileBrowserService",
    # FFmpeg Service
    "FFmpegService",
    "FFmpegError",
    "FFmpegNotFoundError",
    "InvalidVideoError",
    "DiskSpaceError",
    "ExtractionTimeoutError",
    "VideoInfo",
    "ExtractionProgress",
    "AudioFormat",
    "extract_audio",
    "get_video_info",
    "validate_video_file",
    # Storage Service
    "StorageService",
    "StorageServiceError",
    "ProjectNotFoundError",
    "get_storage_service",
    # Whisper Service
    "WhisperService",
    "TranscriptionResult",
    "WordInfo",
    "SegmentInfo",
    "get_whisper_service",
    "MODEL_CONFIGS",
    # WebSocket Service
    "ConnectionManager",
    "ProgressTracker",
    "ProgressMessage",
    "ProgressStage",
    "connection_manager",
    "handle_websocket_messages",
    # Engaging Moments Service
    "EngagingMoment",
    "EngagingMomentsResponse",
    "find_engaging_moments",
    "find_engaging_moments_async",
    "find_engaging_moments_response",
    # Karaoke Generator
    "generate_karaoke_ass",
    "generate_karaoke_ass_multiline",
    "KaraokeStyle",
    "KaraokeConfig",
    "ASSColor",
    "ASSAlignment",
    "KaraokeEffect",
]
