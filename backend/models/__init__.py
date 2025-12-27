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

from .composite_schemas import (
    # Enums
    ScaleMode,
    AudioMixMode,
    BlendMode,
    # Core models
    SourceRegion,
    TemplateSlot,
    CompositeTemplate,
    VideoSource,
    CompositeRequest,
    # Template factories
    create_vertical_split_template,
    create_pip_template,
    create_side_by_side_template,
    create_triple_stack_template,
    get_preset_template,
    list_preset_templates,
    PRESET_TEMPLATES,
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
    # Composite schemas - Enums
    "ScaleMode",
    "AudioMixMode",
    "BlendMode",
    # Composite schemas - Core models
    "SourceRegion",
    "TemplateSlot",
    "CompositeTemplate",
    "VideoSource",
    "CompositeRequest",
    # Composite schemas - Template utilities
    "create_vertical_split_template",
    "create_pip_template",
    "create_side_by_side_template",
    "create_triple_stack_template",
    "get_preset_template",
    "list_preset_templates",
    "PRESET_TEMPLATES",
]
