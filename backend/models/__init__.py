"""
Models package for AI Clips backend.

Contains Pydantic schemas for data validation and serialization.
"""

from .schemas import (
    ProjectSchema,
    TranscriptionSchema,
    SegmentSchema,
    WordTimingSchema,
    ClipSchema,
    SourceVideoSchema,
    ProjectSettingsSchema,
    ProjectIndexEntry,
    ProjectIndex,
    TranscriptionStatus,
    ClipStatus,
)

from .transcription_moment import (
    TranscriptionMoment,
    TranscriptionMomentCollection,
    ProjectTranscriptionMoment,
    MomentType,
    MomentSource,
)

__all__ = [
    # Core schemas
    "ProjectSchema",
    "TranscriptionSchema",
    "SegmentSchema",
    "WordTimingSchema",
    "ClipSchema",
    "SourceVideoSchema",
    "ProjectSettingsSchema",
    "ProjectIndexEntry",
    "ProjectIndex",
    "TranscriptionStatus",
    "ClipStatus",
    # Transcription moment models
    "TranscriptionMoment",
    "TranscriptionMomentCollection",
    "ProjectTranscriptionMoment",
    "MomentType",
    "MomentSource",
]
