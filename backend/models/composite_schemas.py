"""
Pydantic schemas for video compositing with template coordinates.

This module defines the data structures for:
- Source region crop definitions
- Template slot positioning
- Composite template layouts
- Video source assignments
- Full compositing requests

These models support creating 9:16 vertical video layouts from
multiple source videos with precise positioning and layering.
"""

from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional, Union
from uuid import uuid4


def _utc_now() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class ScaleMode(str, Enum):
    """How to scale the source video to fit the slot."""
    FIT = "fit"           # Scale to fit, may have letterbox/pillarbox
    FILL = "fill"         # Scale to fill, may crop edges
    STRETCH = "stretch"   # Stretch to exact dimensions
    NONE = "none"         # No scaling, use original size


class AudioMixMode(str, Enum):
    """How to handle audio from multiple sources."""
    SINGLE = "single"     # Use audio from one source only
    MIX = "mix"           # Mix audio from multiple sources
    MUTE = "mute"         # No audio output


class BlendMode(str, Enum):
    """Blending mode for overlapping video regions."""
    NORMAL = "normal"
    OVERLAY = "overlay"
    MULTIPLY = "multiply"
    SCREEN = "screen"
    ADD = "add"


class SourceRegion(BaseModel):
    """
    Defines the crop region of a source video.

    This model specifies which portion of a source video to extract
    for use in the composite output. Supports both spatial cropping
    and temporal trimming.

    Attributes:
        source_path: Absolute path to the source video file
        crop_x: X coordinate of crop region start (pixels from left)
        crop_y: Y coordinate of crop region start (pixels from top)
        crop_width: Width of the crop region in pixels
        crop_height: Height of the crop region in pixels
        start_time: Optional start time for temporal trimming (seconds)
        end_time: Optional end time for temporal trimming (seconds)
        source_fps: Source video frame rate (auto-detected if not set)
        source_width: Original source video width (auto-detected)
        source_height: Original source video height (auto-detected)
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "source_path": "/path/to/gameplay.mp4",
                "crop_x": 0,
                "crop_y": 0,
                "crop_width": 1920,
                "crop_height": 1080,
                "start_time": 0.0,
                "end_time": 60.0,
                "source_fps": 30.0,
                "source_width": 1920,
                "source_height": 1080
            }
        }
    )

    source_path: str = Field(
        ...,
        description="Absolute path to the source video file"
    )
    crop_x: int = Field(
        default=0,
        ge=0,
        description="X coordinate of crop region start (pixels from left)"
    )
    crop_y: int = Field(
        default=0,
        ge=0,
        description="Y coordinate of crop region start (pixels from top)"
    )
    crop_width: Optional[int] = Field(
        default=None,
        gt=0,
        description="Width of the crop region in pixels (None = full width)"
    )
    crop_height: Optional[int] = Field(
        default=None,
        gt=0,
        description="Height of the crop region in pixels (None = full height)"
    )
    start_time: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Start time for temporal trimming in seconds"
    )
    end_time: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="End time for temporal trimming in seconds"
    )
    source_fps: Optional[float] = Field(
        default=None,
        gt=0.0,
        description="Source video frame rate (auto-detected if not set)"
    )
    source_width: Optional[int] = Field(
        default=None,
        gt=0,
        description="Original source video width in pixels"
    )
    source_height: Optional[int] = Field(
        default=None,
        gt=0,
        description="Original source video height in pixels"
    )

    @field_validator('end_time')
    @classmethod
    def end_time_must_be_after_start(cls, v: Optional[float], info) -> Optional[float]:
        """Validate that end_time is after start_time if both are set."""
        if v is not None and 'start_time' in info.data:
            start = info.data.get('start_time')
            if start is not None and v <= start:
                raise ValueError('end_time must be greater than start_time')
        return v

    @property
    def duration(self) -> Optional[float]:
        """Calculate duration if start and end times are set."""
        if self.start_time is not None and self.end_time is not None:
            return round(self.end_time - self.start_time, 3)
        return None

    def get_crop_filter(self) -> str:
        """Generate FFmpeg crop filter string."""
        if self.crop_width is None or self.crop_height is None:
            return ""
        return f"crop={self.crop_width}:{self.crop_height}:{self.crop_x}:{self.crop_y}"

    def get_trim_args(self) -> list[str]:
        """Generate FFmpeg trim arguments."""
        args = []
        if self.start_time is not None:
            args.extend(["-ss", str(self.start_time)])
        if self.end_time is not None:
            if self.start_time is not None:
                # Use duration instead of end time when start is set
                args.extend(["-t", str(self.end_time - self.start_time)])
            else:
                args.extend(["-to", str(self.end_time)])
        return args


class TemplateSlot(BaseModel):
    """
    Defines where a video goes in the output layout.

    A slot represents a rectangular region in the output canvas where
    a video source will be placed. Supports layering with z_order.

    Attributes:
        slot_id: Unique identifier for this slot
        name: Human-readable slot name
        x: X position in output canvas (pixels from left)
        y: Y position in output canvas (pixels from top)
        width: Width in output canvas (pixels)
        height: Height in output canvas (pixels)
        z_order: Layer order for overlapping (higher = on top)
        scale_mode: How to scale source to fit slot
        opacity: Slot opacity (0.0 = transparent, 1.0 = opaque)
        blend_mode: Blending mode for overlapping regions
        border_radius: Corner radius for rounded corners (pixels)
        border_width: Border stroke width (pixels)
        border_color: Border color in hex format
        enabled: Whether this slot is active
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "slot_id": "main_gameplay",
                "name": "Main Gameplay",
                "x": 0,
                "y": 0,
                "width": 1080,
                "height": 960,
                "z_order": 0,
                "scale_mode": "fill",
                "opacity": 1.0,
                "blend_mode": "normal",
                "border_radius": 0,
                "border_width": 0,
                "border_color": "#000000",
                "enabled": True
            }
        }
    )

    slot_id: str = Field(
        default_factory=lambda: f"slot-{uuid4().hex[:8]}",
        description="Unique identifier for this slot"
    )
    name: str = Field(
        default="",
        description="Human-readable slot name"
    )
    x: int = Field(
        default=0,
        ge=0,
        description="X position in output canvas (pixels from left)"
    )
    y: int = Field(
        default=0,
        ge=0,
        description="Y position in output canvas (pixels from top)"
    )
    width: int = Field(
        ...,
        gt=0,
        description="Width in output canvas (pixels)"
    )
    height: int = Field(
        ...,
        gt=0,
        description="Height in output canvas (pixels)"
    )
    z_order: int = Field(
        default=0,
        ge=0,
        description="Layer order for overlapping (higher values = on top)"
    )
    scale_mode: ScaleMode = Field(
        default=ScaleMode.FILL,
        description="How to scale source video to fit slot"
    )
    opacity: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Slot opacity (0.0 = transparent, 1.0 = opaque)"
    )
    blend_mode: BlendMode = Field(
        default=BlendMode.NORMAL,
        description="Blending mode for overlapping regions"
    )
    border_radius: int = Field(
        default=0,
        ge=0,
        description="Corner radius for rounded corners (pixels)"
    )
    border_width: int = Field(
        default=0,
        ge=0,
        description="Border stroke width (pixels)"
    )
    border_color: str = Field(
        default="#000000",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Border color in hex format (e.g., #FF0000)"
    )
    enabled: bool = Field(
        default=True,
        description="Whether this slot is active in the composite"
    )

    @property
    def aspect_ratio(self) -> float:
        """Calculate slot aspect ratio."""
        return self.width / self.height if self.height > 0 else 0.0

    def get_overlay_position(self) -> str:
        """Generate FFmpeg overlay position string."""
        return f"{self.x}:{self.y}"

    def get_scale_filter(self, source_width: int, source_height: int) -> str:
        """Generate FFmpeg scale filter based on scale mode."""
        if self.scale_mode == ScaleMode.NONE:
            return ""
        elif self.scale_mode == ScaleMode.STRETCH:
            return f"scale={self.width}:{self.height}"
        elif self.scale_mode == ScaleMode.FIT:
            return f"scale={self.width}:{self.height}:force_original_aspect_ratio=decrease,pad={self.width}:{self.height}:(ow-iw)/2:(oh-ih)/2"
        elif self.scale_mode == ScaleMode.FILL:
            source_ar = source_width / source_height if source_height > 0 else 1
            slot_ar = self.aspect_ratio
            if source_ar > slot_ar:
                # Source is wider, scale by height and crop width
                return f"scale=-1:{self.height},crop={self.width}:{self.height}"
            else:
                # Source is taller, scale by width and crop height
                return f"scale={self.width}:-1,crop={self.width}:{self.height}"
        return ""


class CompositeTemplate(BaseModel):
    """
    The full layout template for video compositing.

    Defines the output canvas dimensions, background, and all available
    slots where video sources can be placed.

    Attributes:
        template_id: Unique identifier for this template
        name: Template display name
        description: Template description
        output_width: Output canvas width in pixels
        output_height: Output canvas height in pixels
        output_fps: Output frame rate
        background_color: Background fill color in hex format
        slots: List of template slots for video placement
        created_at: Template creation timestamp
        updated_at: Template last update timestamp
        version: Template version string
        tags: Template classification tags
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "template_id": "tpl-vertical-split",
                "name": "Vertical Split 9:16",
                "description": "Two videos stacked vertically for TikTok/Reels",
                "output_width": 1080,
                "output_height": 1920,
                "output_fps": 30.0,
                "background_color": "#000000",
                "slots": [
                    {
                        "slot_id": "top",
                        "name": "Top Video",
                        "x": 0,
                        "y": 0,
                        "width": 1080,
                        "height": 960,
                        "z_order": 0
                    },
                    {
                        "slot_id": "bottom",
                        "name": "Bottom Video",
                        "x": 0,
                        "y": 960,
                        "width": 1080,
                        "height": 960,
                        "z_order": 0
                    }
                ],
                "version": "1.0.0",
                "tags": ["vertical", "split", "tiktok"]
            }
        }
    )

    template_id: str = Field(
        default_factory=lambda: f"tpl-{uuid4().hex[:8]}",
        description="Unique identifier for this template"
    )
    name: str = Field(
        ...,
        min_length=1,
        description="Template display name"
    )
    description: Optional[str] = Field(
        default=None,
        description="Template description"
    )
    output_width: int = Field(
        default=1080,
        gt=0,
        description="Output canvas width in pixels (1080 for 9:16 vertical)"
    )
    output_height: int = Field(
        default=1920,
        gt=0,
        description="Output canvas height in pixels (1920 for 9:16 vertical)"
    )
    output_fps: float = Field(
        default=30.0,
        gt=0.0,
        le=120.0,
        description="Output frame rate"
    )
    background_color: str = Field(
        default="#000000",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Background fill color in hex format"
    )
    slots: list[TemplateSlot] = Field(
        default_factory=list,
        description="List of template slots for video placement"
    )
    created_at: datetime = Field(
        default_factory=_utc_now,
        description="Template creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=_utc_now,
        description="Template last update timestamp"
    )
    version: str = Field(
        default="1.0.0",
        description="Template version string"
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Template classification tags"
    )

    @property
    def aspect_ratio(self) -> float:
        """Calculate output aspect ratio."""
        return self.output_width / self.output_height if self.output_height > 0 else 0.0

    @property
    def is_vertical(self) -> bool:
        """Check if template is vertical (portrait) orientation."""
        return self.output_height > self.output_width

    @property
    def resolution_label(self) -> str:
        """Get common resolution label (e.g., '9:16', '16:9', '1:1')."""
        from math import gcd
        g = gcd(self.output_width, self.output_height)
        w_ratio = self.output_width // g
        h_ratio = self.output_height // g
        return f"{w_ratio}:{h_ratio}"

    def get_slot_by_id(self, slot_id: str) -> Optional[TemplateSlot]:
        """Get a slot by its ID."""
        for slot in self.slots:
            if slot.slot_id == slot_id:
                return slot
        return None

    def get_enabled_slots(self) -> list[TemplateSlot]:
        """Get all enabled slots sorted by z_order."""
        return sorted(
            [s for s in self.slots if s.enabled],
            key=lambda s: s.z_order
        )

    def add_slot(self, slot: TemplateSlot) -> None:
        """Add a new slot to the template."""
        self.slots.append(slot)
        self.updated_at = _utc_now()

    def remove_slot(self, slot_id: str) -> bool:
        """Remove a slot by ID. Returns True if removed."""
        for i, slot in enumerate(self.slots):
            if slot.slot_id == slot_id:
                self.slots.pop(i)
                self.updated_at = _utc_now()
                return True
        return False

    def validate_slots_within_canvas(self) -> list[str]:
        """Validate that all slots fit within the canvas. Returns list of issues."""
        issues = []
        for slot in self.slots:
            if slot.x + slot.width > self.output_width:
                issues.append(
                    f"Slot '{slot.slot_id}' extends beyond canvas width "
                    f"(x={slot.x}, width={slot.width}, canvas_width={self.output_width})"
                )
            if slot.y + slot.height > self.output_height:
                issues.append(
                    f"Slot '{slot.slot_id}' extends beyond canvas height "
                    f"(y={slot.y}, height={slot.height}, canvas_height={self.output_height})"
                )
        return issues


class VideoSource(BaseModel):
    """
    Combines a source region with its slot assignment.

    Links a cropped/trimmed portion of a source video to a specific
    slot in the composite template.

    Attributes:
        source_id: Unique identifier for this source assignment
        source_region: The source video crop/trim definition
        slot_id: ID of the template slot to assign this source to
        audio_enabled: Whether to include audio from this source
        audio_volume: Volume level for this source's audio (0.0-2.0)
        video_filters: Additional FFmpeg video filters to apply
        audio_filters: Additional FFmpeg audio filters to apply
        label: User label for this source
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "source_id": "src-gameplay",
                "source_region": {
                    "source_path": "/videos/gameplay.mp4",
                    "crop_x": 0,
                    "crop_y": 0,
                    "crop_width": 1920,
                    "crop_height": 1080,
                    "start_time": 0.0,
                    "end_time": 60.0
                },
                "slot_id": "main_gameplay",
                "audio_enabled": True,
                "audio_volume": 1.0,
                "video_filters": [],
                "audio_filters": [],
                "label": "Main Gameplay Footage"
            }
        }
    )

    source_id: str = Field(
        default_factory=lambda: f"src-{uuid4().hex[:8]}",
        description="Unique identifier for this source assignment"
    )
    source_region: SourceRegion = Field(
        ...,
        description="The source video crop/trim definition"
    )
    slot_id: str = Field(
        ...,
        description="ID of the template slot to assign this source to"
    )
    audio_enabled: bool = Field(
        default=True,
        description="Whether to include audio from this source"
    )
    audio_volume: float = Field(
        default=1.0,
        ge=0.0,
        le=2.0,
        description="Volume level for this source's audio (0.0-2.0, 1.0 = normal)"
    )
    video_filters: list[str] = Field(
        default_factory=list,
        description="Additional FFmpeg video filters to apply"
    )
    audio_filters: list[str] = Field(
        default_factory=list,
        description="Additional FFmpeg audio filters to apply"
    )
    label: Optional[str] = Field(
        default=None,
        description="User label for this source"
    )


class CompositeRequest(BaseModel):
    """
    Full compositing request with template, sources, and output settings.

    This is the main model for requesting a video composite operation.
    It combines a template layout with assigned video sources and
    specifies the output configuration.

    Attributes:
        request_id: Unique identifier for this compositing request
        template: The composite template defining the layout
        sources: List of video sources with their slot assignments
        output_path: Path where the composite video will be saved
        audio_source: Source ID or 'mix' for audio handling
        audio_mix_mode: How to handle audio from multiple sources
        output_codec: Video codec for output (h264, hevc, etc.)
        output_bitrate: Video bitrate in kbps
        output_preset: Encoding preset (ultrafast, fast, medium, slow)
        audio_codec: Audio codec for output (aac, mp3, etc.)
        audio_bitrate: Audio bitrate in kbps
        duration_limit: Maximum output duration in seconds
        metadata: Additional metadata for the output file
        created_at: Request creation timestamp
        priority: Processing priority (higher = sooner)
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "request_id": "req-12345678",
                "template": {
                    "template_id": "tpl-vertical-split",
                    "name": "Vertical Split",
                    "output_width": 1080,
                    "output_height": 1920,
                    "slots": [
                        {"slot_id": "top", "x": 0, "y": 0, "width": 1080, "height": 960},
                        {"slot_id": "bottom", "x": 0, "y": 960, "width": 1080, "height": 960}
                    ]
                },
                "sources": [
                    {
                        "source_id": "gameplay",
                        "source_region": {"source_path": "/videos/game.mp4"},
                        "slot_id": "top"
                    },
                    {
                        "source_id": "facecam",
                        "source_region": {"source_path": "/videos/cam.mp4"},
                        "slot_id": "bottom"
                    }
                ],
                "output_path": "/output/composite.mp4",
                "audio_source": "gameplay",
                "audio_mix_mode": "single",
                "output_codec": "h264",
                "output_bitrate": 8000,
                "priority": 5
            }
        }
    )

    request_id: str = Field(
        default_factory=lambda: f"req-{uuid4().hex[:8]}",
        description="Unique identifier for this compositing request"
    )
    template: CompositeTemplate = Field(
        ...,
        description="The composite template defining the layout"
    )
    sources: list[VideoSource] = Field(
        ...,
        min_length=1,
        description="List of video sources with their slot assignments"
    )
    output_path: str = Field(
        ...,
        description="Path where the composite video will be saved"
    )
    audio_source: Optional[str] = Field(
        default=None,
        description="Source ID to use for audio, or None for auto-select first"
    )
    audio_mix_mode: AudioMixMode = Field(
        default=AudioMixMode.SINGLE,
        description="How to handle audio from multiple sources"
    )
    output_codec: str = Field(
        default="h264",
        description="Video codec for output (h264, hevc, vp9, etc.)"
    )
    output_bitrate: int = Field(
        default=8000,
        gt=0,
        description="Video bitrate in kbps"
    )
    output_preset: str = Field(
        default="medium",
        description="Encoding preset (ultrafast, fast, medium, slow, veryslow)"
    )
    audio_codec: str = Field(
        default="aac",
        description="Audio codec for output (aac, mp3, opus, etc.)"
    )
    audio_bitrate: int = Field(
        default=192,
        gt=0,
        description="Audio bitrate in kbps"
    )
    duration_limit: Optional[float] = Field(
        default=None,
        gt=0.0,
        description="Maximum output duration in seconds"
    )
    metadata: dict = Field(
        default_factory=dict,
        description="Additional metadata for the output file"
    )
    created_at: datetime = Field(
        default_factory=_utc_now,
        description="Request creation timestamp"
    )
    priority: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Processing priority (1=lowest, 10=highest)"
    )

    @model_validator(mode='after')
    def validate_sources_match_slots(self) -> 'CompositeRequest':
        """Validate that all source slot_ids exist in the template."""
        template_slot_ids = {slot.slot_id for slot in self.template.slots}
        for source in self.sources:
            if source.slot_id not in template_slot_ids:
                raise ValueError(
                    f"Source '{source.source_id}' references non-existent "
                    f"slot '{source.slot_id}'. Available slots: {template_slot_ids}"
                )
        return self

    @model_validator(mode='after')
    def validate_audio_source(self) -> 'CompositeRequest':
        """Validate that audio_source references a valid source."""
        if self.audio_source is not None and self.audio_mix_mode == AudioMixMode.SINGLE:
            source_ids = {src.source_id for src in self.sources}
            if self.audio_source not in source_ids:
                raise ValueError(
                    f"audio_source '{self.audio_source}' not found in sources. "
                    f"Available sources: {source_ids}"
                )
        return self

    def get_audio_source(self) -> Optional[VideoSource]:
        """Get the VideoSource that should provide audio."""
        if self.audio_mix_mode == AudioMixMode.MUTE:
            return None

        if self.audio_source:
            for source in self.sources:
                if source.source_id == self.audio_source:
                    return source

        # Default to first source with audio enabled
        for source in self.sources:
            if source.audio_enabled:
                return source
        return None

    def get_sources_by_z_order(self) -> list[tuple[VideoSource, TemplateSlot]]:
        """Get sources paired with their slots, sorted by z_order."""
        result = []
        for source in self.sources:
            slot = self.template.get_slot_by_id(source.slot_id)
            if slot and slot.enabled:
                result.append((source, slot))
        return sorted(result, key=lambda x: x[1].z_order)


# ============================================================================
# Pre-defined Template Configurations
# ============================================================================

def create_vertical_split_template() -> CompositeTemplate:
    """Create a vertical split template (two videos stacked)."""
    return CompositeTemplate(
        template_id="tpl-vertical-split-2x1",
        name="Vertical Split 2x1",
        description="Two videos stacked vertically for TikTok/Reels/Shorts (9:16)",
        output_width=1080,
        output_height=1920,
        output_fps=30.0,
        background_color="#000000",
        slots=[
            TemplateSlot(
                slot_id="top",
                name="Top Video",
                x=0,
                y=0,
                width=1080,
                height=960,
                z_order=0,
                scale_mode=ScaleMode.FILL
            ),
            TemplateSlot(
                slot_id="bottom",
                name="Bottom Video",
                x=0,
                y=960,
                width=1080,
                height=960,
                z_order=0,
                scale_mode=ScaleMode.FILL
            )
        ],
        tags=["vertical", "split", "tiktok", "reels", "shorts"]
    )


def create_pip_template(
    pip_position: str = "bottom-right",
    pip_size_percent: int = 30
) -> CompositeTemplate:
    """
    Create a picture-in-picture template.

    Args:
        pip_position: One of 'top-left', 'top-right', 'bottom-left', 'bottom-right'
        pip_size_percent: Size of PiP as percentage of canvas width (10-50)
    """
    pip_width = int(1080 * (pip_size_percent / 100))
    pip_height = int(pip_width * (9/16))  # Maintain 9:16 aspect
    margin = 40

    positions = {
        "top-left": (margin, margin),
        "top-right": (1080 - pip_width - margin, margin),
        "bottom-left": (margin, 1920 - pip_height - margin),
        "bottom-right": (1080 - pip_width - margin, 1920 - pip_height - margin),
    }
    pip_x, pip_y = positions.get(pip_position, positions["bottom-right"])

    return CompositeTemplate(
        template_id=f"tpl-pip-{pip_position}",
        name=f"Picture-in-Picture ({pip_position.replace('-', ' ').title()})",
        description=f"Main video with PiP overlay in {pip_position}",
        output_width=1080,
        output_height=1920,
        output_fps=30.0,
        background_color="#000000",
        slots=[
            TemplateSlot(
                slot_id="main",
                name="Main Video",
                x=0,
                y=0,
                width=1080,
                height=1920,
                z_order=0,
                scale_mode=ScaleMode.FILL
            ),
            TemplateSlot(
                slot_id="pip",
                name="Picture-in-Picture",
                x=pip_x,
                y=pip_y,
                width=pip_width,
                height=pip_height,
                z_order=1,
                scale_mode=ScaleMode.FILL,
                border_radius=12,
                border_width=2,
                border_color="#FFFFFF"
            )
        ],
        tags=["vertical", "pip", "overlay", "tiktok", "reels"]
    )


def create_side_by_side_template() -> CompositeTemplate:
    """Create a side-by-side template (reaction style) for 9:16."""
    return CompositeTemplate(
        template_id="tpl-side-by-side-9x16",
        name="Side by Side 9:16",
        description="Two videos side by side with bars (reaction style)",
        output_width=1080,
        output_height=1920,
        output_fps=30.0,
        background_color="#000000",
        slots=[
            TemplateSlot(
                slot_id="left",
                name="Left Video",
                x=0,
                y=480,  # Center vertically with some padding
                width=540,
                height=960,
                z_order=0,
                scale_mode=ScaleMode.FIT
            ),
            TemplateSlot(
                slot_id="right",
                name="Right Video",
                x=540,
                y=480,
                width=540,
                height=960,
                z_order=0,
                scale_mode=ScaleMode.FIT
            )
        ],
        tags=["vertical", "side-by-side", "reaction", "comparison"]
    )


def create_triple_stack_template() -> CompositeTemplate:
    """Create a triple vertical stack template for 9:16."""
    return CompositeTemplate(
        template_id="tpl-triple-stack",
        name="Triple Stack 9:16",
        description="Three videos stacked vertically",
        output_width=1080,
        output_height=1920,
        output_fps=30.0,
        background_color="#000000",
        slots=[
            TemplateSlot(
                slot_id="top",
                name="Top Video",
                x=0,
                y=0,
                width=1080,
                height=640,
                z_order=0,
                scale_mode=ScaleMode.FILL
            ),
            TemplateSlot(
                slot_id="middle",
                name="Middle Video",
                x=0,
                y=640,
                width=1080,
                height=640,
                z_order=0,
                scale_mode=ScaleMode.FILL
            ),
            TemplateSlot(
                slot_id="bottom",
                name="Bottom Video",
                x=0,
                y=1280,
                width=1080,
                height=640,
                z_order=0,
                scale_mode=ScaleMode.FILL
            )
        ],
        tags=["vertical", "triple", "stack", "tiktok"]
    )


# Dictionary of all pre-defined templates
PRESET_TEMPLATES = {
    "vertical-split": create_vertical_split_template,
    "pip-bottom-right": lambda: create_pip_template("bottom-right", 30),
    "pip-bottom-left": lambda: create_pip_template("bottom-left", 30),
    "pip-top-right": lambda: create_pip_template("top-right", 30),
    "pip-top-left": lambda: create_pip_template("top-left", 30),
    "side-by-side": create_side_by_side_template,
    "triple-stack": create_triple_stack_template,
}


def get_preset_template(template_name: str) -> Optional[CompositeTemplate]:
    """Get a pre-defined template by name."""
    factory = PRESET_TEMPLATES.get(template_name)
    if factory:
        return factory()
    return None


def list_preset_templates() -> list[dict]:
    """List all available preset templates with their descriptions."""
    return [
        {
            "name": name,
            "description": factory().description,
            "slot_count": len(factory().slots),
            "tags": factory().tags
        }
        for name, factory in PRESET_TEMPLATES.items()
    ]
