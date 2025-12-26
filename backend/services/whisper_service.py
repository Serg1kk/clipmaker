"""
Whisper Transcription Service

Provides audio transcription with word-level timestamps using OpenAI's Whisper model.
Optimized for Apple Silicon (M1/M2) with Metal Performance Shaders (MPS) support.

Features:
- Word-level timestamp extraction
- Multi-language support (auto-detection)
- Chunked processing for long files
- Memory management for M1 Mac optimization
- Progress callbacks for real-time updates
"""

import gc
import logging
import os
import platform
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

import torch

logger = logging.getLogger(__name__)


@dataclass
class WordInfo:
    """Word-level timing information."""
    word: str
    start: float
    end: float
    probability: float


@dataclass
class SegmentInfo:
    """Segment-level timing information with word details."""
    id: int
    start: float
    end: float
    text: str
    words: list[WordInfo] = field(default_factory=list)


@dataclass
class TranscriptionResult:
    """Complete transcription result with word-level timestamps."""
    text: str
    segments: list[SegmentInfo]
    language: str
    duration: float = 0.0
    model_name: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format for JSON serialization."""
        return {
            "text": self.text,
            "segments": [
                {
                    "id": seg.id,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "words": [
                        {
                            "word": w.word,
                            "start": w.start,
                            "end": w.end,
                            "probability": w.probability
                        }
                        for w in seg.words
                    ]
                }
                for seg in self.segments
            ],
            "language": self.language,
            "duration": self.duration,
            "model_name": self.model_name
        }


# Model configurations optimized for M1 16GB
MODEL_CONFIGS = {
    "tiny": {
        "name": "tiny",
        "description": "Fast, lower accuracy (~1GB VRAM)",
        "size_mb": 75,
        "recommended_ram_gb": 4,
        "speed_factor": 32,  # ~32x realtime on M1
    },
    "base": {
        "name": "base",
        "description": "Good balance of speed and accuracy (~1GB VRAM)",
        "size_mb": 142,
        "recommended_ram_gb": 4,
        "speed_factor": 16,  # ~16x realtime on M1
    },
    "small": {
        "name": "small",
        "description": "Better accuracy, slower (~2GB VRAM)",
        "size_mb": 466,
        "recommended_ram_gb": 6,
        "speed_factor": 6,  # ~6x realtime on M1
    },
    "medium": {
        "name": "medium",
        "description": "High accuracy, needs memory management (~5GB VRAM)",
        "size_mb": 1457,
        "recommended_ram_gb": 10,
        "speed_factor": 2,  # ~2x realtime on M1
    },
    "large": {
        "name": "large",
        "description": "Highest accuracy, may need CPU fallback (~10GB VRAM)",
        "size_mb": 2872,
        "recommended_ram_gb": 16,
        "speed_factor": 1,  # ~1x realtime on M1
    },
}

# Language-specific model recommendations
LANGUAGE_MODELS = {
    "en": "base",  # English - base is sufficient
    "ru": "small",  # Russian - needs more capacity
    "multilingual": "small",  # For mixed content
}


class WhisperService:
    """
    Whisper transcription service with word-level timestamps.

    Optimized for Apple Silicon M1/M2 with automatic device detection
    and memory management.
    """

    def __init__(
        self,
        model_size: str = "base",
        device: Optional[str] = None,
        compute_type: str = "float16",
        download_root: Optional[str] = None,
    ):
        """
        Initialize the Whisper service.

        Args:
            model_size: Whisper model size (tiny, base, small, medium, large)
            device: Device to use (None for auto-detection, 'cpu', 'cuda', 'mps')
            compute_type: Computation precision (float16, float32, int8)
            download_root: Directory for model downloads
        """
        self.model_size = model_size
        self.compute_type = compute_type
        self.download_root = download_root or str(Path.home() / ".cache" / "whisper")
        self._model = None

        # Auto-detect device
        self.device = device or self._detect_device()
        logger.info(f"WhisperService initialized: model={model_size}, device={self.device}")

    def _detect_device(self) -> str:
        """
        Detect the best available device for inference.

        Returns:
            Device string ('mps' for Apple Silicon, 'cuda' for NVIDIA, 'cpu' fallback)
        """
        # Check for Apple Silicon (M1/M2)
        if platform.system() == "Darwin" and platform.machine() == "arm64":
            if torch.backends.mps.is_available():
                logger.info("Apple Silicon detected - using MPS acceleration")
                return "mps"

        # Check for CUDA
        if torch.cuda.is_available():
            logger.info(f"CUDA detected - using GPU: {torch.cuda.get_device_name(0)}")
            return "cuda"

        logger.info("No GPU acceleration available - using CPU")
        return "cpu"

    def _get_torch_dtype(self) -> torch.dtype:
        """Get the appropriate torch dtype based on device and compute_type."""
        if self.compute_type == "float32":
            return torch.float32
        elif self.compute_type == "int8":
            # INT8 is mainly for CPU optimization
            return torch.float32
        else:
            # float16 for GPU acceleration
            if self.device in ("cuda", "mps"):
                return torch.float16
            return torch.float32

    def _load_model(self) -> Any:
        """
        Load the Whisper model with lazy initialization.

        Returns:
            Loaded Whisper model
        """
        if self._model is not None:
            return self._model

        try:
            import whisper
        except ImportError:
            raise ImportError(
                "openai-whisper is not installed. Install with: "
                "pip install openai-whisper"
            )

        logger.info(f"Loading Whisper model: {self.model_size}")

        # Clear memory before loading
        gc.collect()
        if self.device == "cuda":
            torch.cuda.empty_cache()

        # Load model
        self._model = whisper.load_model(
            self.model_size,
            device=self.device if self.device != "mps" else "cpu",  # Load on CPU first for MPS
            download_root=self.download_root,
        )

        # Move to MPS if available (Whisper loads to CPU by default for MPS)
        if self.device == "mps":
            self._model = self._model.to("mps")

        logger.info(f"Model loaded successfully on {self.device}")
        return self._model

    def unload_model(self) -> None:
        """Unload the model to free memory."""
        if self._model is not None:
            del self._model
            self._model = None
            gc.collect()
            if self.device == "cuda":
                torch.cuda.empty_cache()
            logger.info("Model unloaded")

    def transcribe_audio(
        self,
        audio_path: str,
        model_size: Optional[str] = None,
        language: Optional[str] = None,
        task: str = "transcribe",
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio file without word-level timestamps.

        Args:
            audio_path: Path to the audio/video file
            model_size: Override model size for this transcription
            language: Language code (None for auto-detection)
            task: 'transcribe' or 'translate' (translate to English)
            progress_callback: Callback function(progress: float, message: str)

        Returns:
            TranscriptionResult with segments (no word-level timestamps)
        """
        return self.transcribe_with_word_timestamps(
            audio_path=audio_path,
            model_size=model_size,
            language=language,
            task=task,
            word_timestamps=False,
            progress_callback=progress_callback,
        )

    def transcribe_with_word_timestamps(
        self,
        audio_path: str,
        model_size: Optional[str] = None,
        language: Optional[str] = None,
        task: str = "transcribe",
        word_timestamps: bool = True,
        initial_prompt: Optional[str] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio with word-level timestamps.

        Args:
            audio_path: Path to the audio/video file
            model_size: Override model size for this transcription
            language: Language code (None for auto-detection)
            task: 'transcribe' or 'translate' (translate to English)
            word_timestamps: Whether to include word-level timestamps
            initial_prompt: Optional prompt to guide transcription
            progress_callback: Callback function(progress: float, message: str)

        Returns:
            TranscriptionResult with word-level timestamps
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Update model size if specified
        if model_size and model_size != self.model_size:
            self.unload_model()
            self.model_size = model_size

        if progress_callback:
            progress_callback(0.0, "Loading model...")

        model = self._load_model()

        if progress_callback:
            progress_callback(10.0, "Starting transcription...")

        # Build transcription options
        options = {
            "task": task,
            "word_timestamps": word_timestamps,
            "verbose": False,
        }

        if language:
            options["language"] = language

        if initial_prompt:
            options["initial_prompt"] = initial_prompt

        # For MPS, we need fp32 for some operations
        if self.device == "mps":
            options["fp16"] = False
        elif self.device == "cuda":
            options["fp16"] = True
        else:
            options["fp16"] = False

        try:
            if progress_callback:
                progress_callback(20.0, "Transcribing audio...")

            # Run transcription
            result = model.transcribe(str(audio_path), **options)

            if progress_callback:
                progress_callback(80.0, "Processing results...")

            # Convert to our format
            segments = []
            for i, seg in enumerate(result.get("segments", [])):
                words = []

                if word_timestamps and "words" in seg:
                    for word_data in seg["words"]:
                        words.append(WordInfo(
                            word=word_data.get("word", "").strip(),
                            start=round(word_data.get("start", 0.0), 3),
                            end=round(word_data.get("end", 0.0), 3),
                            probability=round(word_data.get("probability", 0.0), 3),
                        ))

                segments.append(SegmentInfo(
                    id=i,
                    start=round(seg.get("start", 0.0), 3),
                    end=round(seg.get("end", 0.0), 3),
                    text=seg.get("text", "").strip(),
                    words=words,
                ))

            # Calculate duration from last segment
            duration = segments[-1].end if segments else 0.0

            transcription = TranscriptionResult(
                text=result.get("text", "").strip(),
                segments=segments,
                language=result.get("language", "unknown"),
                duration=duration,
                model_name=self.model_size,
            )

            if progress_callback:
                progress_callback(100.0, "Transcription complete")

            return transcription

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    def transcribe_chunked(
        self,
        audio_path: str,
        chunk_duration_seconds: int = 300,  # 5 minutes
        model_size: Optional[str] = None,
        language: Optional[str] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> TranscriptionResult:
        """
        Transcribe long audio files in chunks for memory efficiency.

        This method splits the audio into smaller segments for processing,
        which is useful for very long files that might exceed memory limits.

        Args:
            audio_path: Path to the audio/video file
            chunk_duration_seconds: Duration of each chunk in seconds
            model_size: Override model size for this transcription
            language: Language code (None for auto-detection)
            progress_callback: Callback function(progress: float, message: str)

        Returns:
            TranscriptionResult with combined results from all chunks
        """
        # For now, use the standard transcription
        # Whisper handles chunking internally for long files
        # This method can be extended for more fine-grained control
        return self.transcribe_with_word_timestamps(
            audio_path=audio_path,
            model_size=model_size,
            language=language,
            progress_callback=progress_callback,
        )

    @staticmethod
    def get_available_models() -> list[dict[str, Any]]:
        """
        Get list of available Whisper models with their configurations.

        Returns:
            List of model configuration dictionaries
        """
        return [
            {
                "name": config["name"],
                "description": config["description"],
                "size_mb": config["size_mb"],
                "recommended_ram_gb": config["recommended_ram_gb"],
                "speed_factor": config["speed_factor"],
            }
            for config in MODEL_CONFIGS.values()
        ]

    @staticmethod
    def get_recommended_model(language: str = "en", max_ram_gb: int = 16) -> str:
        """
        Get the recommended model for a given language and RAM constraint.

        Args:
            language: Target language code
            max_ram_gb: Maximum available RAM in GB

        Returns:
            Recommended model name
        """
        # Get language-specific recommendation
        recommended = LANGUAGE_MODELS.get(language, "base")

        # Check RAM constraint
        model_config = MODEL_CONFIGS.get(recommended, MODEL_CONFIGS["base"])
        if model_config["recommended_ram_gb"] > max_ram_gb:
            # Fall back to a smaller model
            for model_name in ["base", "tiny"]:
                if MODEL_CONFIGS[model_name]["recommended_ram_gb"] <= max_ram_gb:
                    return model_name

        return recommended

    def download_model(
        self,
        model_name: str,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bool:
        """
        Download a Whisper model if not already cached.

        Args:
            model_name: Name of the model to download
            progress_callback: Callback function(progress: float, message: str)

        Returns:
            True if download successful or model already exists
        """
        if model_name not in MODEL_CONFIGS:
            raise ValueError(f"Unknown model: {model_name}. Available: {list(MODEL_CONFIGS.keys())}")

        try:
            import whisper

            if progress_callback:
                progress_callback(0.0, f"Checking model {model_name}...")

            # This will download if not present
            model_path = whisper._download(
                whisper._MODELS[model_name],
                self.download_root,
                in_memory=False,
            )

            if progress_callback:
                progress_callback(100.0, f"Model {model_name} ready")

            return Path(model_path).exists()

        except Exception as e:
            logger.error(f"Failed to download model {model_name}: {e}")
            raise

    @staticmethod
    def get_supported_languages() -> list[dict[str, str]]:
        """
        Get list of supported languages.

        Returns:
            List of language dictionaries with code and name
        """
        # Common languages supported by Whisper
        return [
            {"code": "en", "name": "English"},
            {"code": "ru", "name": "Russian"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "pl", "name": "Polish"},
            {"code": "uk", "name": "Ukrainian"},
            {"code": "zh", "name": "Chinese"},
            {"code": "ja", "name": "Japanese"},
            {"code": "ko", "name": "Korean"},
            {"code": "ar", "name": "Arabic"},
            {"code": "hi", "name": "Hindi"},
            {"code": "tr", "name": "Turkish"},
        ]

    def get_device_info(self) -> dict[str, Any]:
        """
        Get information about the current device configuration.

        Returns:
            Dictionary with device and memory information
        """
        info = {
            "device": self.device,
            "platform": platform.system(),
            "machine": platform.machine(),
            "compute_type": self.compute_type,
            "model_loaded": self._model is not None,
            "current_model": self.model_size,
        }

        if self.device == "cuda" and torch.cuda.is_available():
            info["gpu_name"] = torch.cuda.get_device_name(0)
            info["gpu_memory_total_gb"] = round(
                torch.cuda.get_device_properties(0).total_memory / (1024**3), 2
            )
        elif self.device == "mps":
            info["gpu_name"] = "Apple Silicon (Metal)"
            info["mps_available"] = torch.backends.mps.is_available()

        return info


# Singleton instance for reuse
_whisper_service: Optional[WhisperService] = None


def get_whisper_service(
    model_size: str = "base",
    force_new: bool = False,
) -> WhisperService:
    """
    Get or create a WhisperService instance.

    Args:
        model_size: Whisper model size
        force_new: Force creation of a new instance

    Returns:
        WhisperService instance
    """
    global _whisper_service

    if force_new or _whisper_service is None:
        _whisper_service = WhisperService(model_size=model_size)
    elif _whisper_service.model_size != model_size:
        _whisper_service.unload_model()
        _whisper_service.model_size = model_size

    return _whisper_service
