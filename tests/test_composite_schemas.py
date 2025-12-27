"""
Tests for video compositing data models.

Tests cover:
- SourceRegion crop and trim functionality
- TemplateSlot positioning and scaling
- CompositeTemplate layout validation
- VideoSource slot assignments
- CompositeRequest validation and audio handling
- Pre-defined template factories
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from backend.models.composite_schemas import (
    ScaleMode,
    AudioMixMode,
    BlendMode,
    SourceRegion,
    TemplateSlot,
    CompositeTemplate,
    VideoSource,
    CompositeRequest,
    create_vertical_split_template,
    create_pip_template,
    create_side_by_side_template,
    create_triple_stack_template,
    get_preset_template,
    list_preset_templates,
    PRESET_TEMPLATES,
)


class TestSourceRegion:
    """Tests for SourceRegion model."""

    def test_minimal_source_region(self):
        """Test creating source region with only required fields."""
        region = SourceRegion(source_path="/path/to/video.mp4")
        assert region.source_path == "/path/to/video.mp4"
        assert region.crop_x == 0
        assert region.crop_y == 0
        assert region.crop_width is None
        assert region.crop_height is None
        assert region.start_time is None
        assert region.end_time is None

    def test_full_source_region(self):
        """Test creating source region with all fields."""
        region = SourceRegion(
            source_path="/videos/gameplay.mp4",
            crop_x=100,
            crop_y=50,
            crop_width=1280,
            crop_height=720,
            start_time=10.0,
            end_time=70.0,
            source_fps=60.0,
            source_width=1920,
            source_height=1080
        )
        assert region.crop_x == 100
        assert region.crop_y == 50
        assert region.crop_width == 1280
        assert region.crop_height == 720
        assert region.start_time == 10.0
        assert region.end_time == 70.0
        assert region.duration == 60.0

    def test_duration_property(self):
        """Test duration calculation."""
        region = SourceRegion(
            source_path="/video.mp4",
            start_time=5.5,
            end_time=15.75
        )
        assert region.duration == 10.25

    def test_duration_none_when_times_not_set(self):
        """Test duration is None when start/end not set."""
        region = SourceRegion(source_path="/video.mp4")
        assert region.duration is None

    def test_end_time_validation(self):
        """Test that end_time must be after start_time."""
        with pytest.raises(ValidationError) as exc_info:
            SourceRegion(
                source_path="/video.mp4",
                start_time=20.0,
                end_time=10.0
            )
        assert "end_time must be greater than start_time" in str(exc_info.value)

    def test_negative_crop_values_rejected(self):
        """Test that negative crop coordinates are rejected."""
        with pytest.raises(ValidationError):
            SourceRegion(
                source_path="/video.mp4",
                crop_x=-10
            )

    def test_get_crop_filter(self):
        """Test FFmpeg crop filter generation."""
        region = SourceRegion(
            source_path="/video.mp4",
            crop_x=100,
            crop_y=50,
            crop_width=800,
            crop_height=600
        )
        assert region.get_crop_filter() == "crop=800:600:100:50"

    def test_get_crop_filter_no_crop(self):
        """Test crop filter is empty when no crop set."""
        region = SourceRegion(source_path="/video.mp4")
        assert region.get_crop_filter() == ""

    def test_get_trim_args(self):
        """Test FFmpeg trim arguments generation."""
        region = SourceRegion(
            source_path="/video.mp4",
            start_time=5.0,
            end_time=15.0
        )
        args = region.get_trim_args()
        assert "-ss" in args
        assert "5.0" in args
        assert "-t" in args
        assert "10.0" in args  # Duration, not end time


class TestTemplateSlot:
    """Tests for TemplateSlot model."""

    def test_minimal_slot(self):
        """Test creating slot with only required fields."""
        slot = TemplateSlot(width=1080, height=960)
        assert slot.width == 1080
        assert slot.height == 960
        assert slot.x == 0
        assert slot.y == 0
        assert slot.z_order == 0
        assert slot.scale_mode == ScaleMode.FILL
        assert slot.opacity == 1.0
        assert slot.enabled is True

    def test_full_slot(self):
        """Test creating slot with all fields."""
        slot = TemplateSlot(
            slot_id="main_video",
            name="Main Video Area",
            x=100,
            y=200,
            width=800,
            height=600,
            z_order=5,
            scale_mode=ScaleMode.FIT,
            opacity=0.9,
            blend_mode=BlendMode.OVERLAY,
            border_radius=10,
            border_width=2,
            border_color="#FF0000",
            enabled=True
        )
        assert slot.slot_id == "main_video"
        assert slot.name == "Main Video Area"
        assert slot.z_order == 5
        assert slot.opacity == 0.9
        assert slot.border_color == "#FF0000"

    def test_aspect_ratio_property(self):
        """Test aspect ratio calculation."""
        slot = TemplateSlot(width=1920, height=1080)
        assert abs(slot.aspect_ratio - 16/9) < 0.01

    def test_get_overlay_position(self):
        """Test overlay position string generation."""
        slot = TemplateSlot(x=100, y=200, width=400, height=300)
        assert slot.get_overlay_position() == "100:200"

    def test_auto_generated_slot_id(self):
        """Test that slot_id is auto-generated if not provided."""
        slot = TemplateSlot(width=1080, height=960)
        assert slot.slot_id.startswith("slot-")
        assert len(slot.slot_id) == 13  # "slot-" + 8 hex chars

    def test_invalid_border_color_rejected(self):
        """Test that invalid hex colors are rejected."""
        with pytest.raises(ValidationError):
            TemplateSlot(
                width=100,
                height=100,
                border_color="red"
            )

    def test_opacity_bounds(self):
        """Test opacity value bounds."""
        with pytest.raises(ValidationError):
            TemplateSlot(width=100, height=100, opacity=1.5)

        with pytest.raises(ValidationError):
            TemplateSlot(width=100, height=100, opacity=-0.1)


class TestCompositeTemplate:
    """Tests for CompositeTemplate model."""

    def test_minimal_template(self):
        """Test creating template with only required fields."""
        template = CompositeTemplate(name="Test Template")
        assert template.name == "Test Template"
        assert template.output_width == 1080
        assert template.output_height == 1920
        assert template.output_fps == 30.0
        assert template.background_color == "#000000"
        assert template.slots == []

    def test_full_template(self):
        """Test creating template with all fields."""
        slots = [
            TemplateSlot(slot_id="top", width=1080, height=960, x=0, y=0),
            TemplateSlot(slot_id="bottom", width=1080, height=960, x=0, y=960)
        ]
        template = CompositeTemplate(
            template_id="my-template",
            name="My Custom Template",
            description="A custom layout",
            output_width=1080,
            output_height=1920,
            output_fps=60.0,
            background_color="#1A1A1A",
            slots=slots,
            version="2.0.0",
            tags=["custom", "vertical"]
        )
        assert len(template.slots) == 2
        assert template.version == "2.0.0"
        assert "custom" in template.tags

    def test_aspect_ratio_and_orientation(self):
        """Test aspect ratio and orientation detection."""
        vertical = CompositeTemplate(name="Vertical", output_width=1080, output_height=1920)
        horizontal = CompositeTemplate(name="Horizontal", output_width=1920, output_height=1080)

        assert vertical.is_vertical is True
        assert horizontal.is_vertical is False
        assert vertical.resolution_label == "9:16"
        assert horizontal.resolution_label == "16:9"

    def test_get_slot_by_id(self):
        """Test finding slot by ID."""
        slots = [
            TemplateSlot(slot_id="main", width=1080, height=1920),
            TemplateSlot(slot_id="overlay", width=200, height=200)
        ]
        template = CompositeTemplate(name="Test", slots=slots)

        found = template.get_slot_by_id("main")
        assert found is not None
        assert found.slot_id == "main"

        not_found = template.get_slot_by_id("nonexistent")
        assert not_found is None

    def test_get_enabled_slots(self):
        """Test filtering enabled slots sorted by z_order."""
        slots = [
            TemplateSlot(slot_id="a", width=100, height=100, z_order=2, enabled=True),
            TemplateSlot(slot_id="b", width=100, height=100, z_order=0, enabled=False),
            TemplateSlot(slot_id="c", width=100, height=100, z_order=1, enabled=True)
        ]
        template = CompositeTemplate(name="Test", slots=slots)

        enabled = template.get_enabled_slots()
        assert len(enabled) == 2
        assert enabled[0].slot_id == "c"  # z_order=1
        assert enabled[1].slot_id == "a"  # z_order=2

    def test_add_and_remove_slot(self):
        """Test adding and removing slots."""
        template = CompositeTemplate(name="Test")
        assert len(template.slots) == 0

        template.add_slot(TemplateSlot(slot_id="new", width=100, height=100))
        assert len(template.slots) == 1

        removed = template.remove_slot("new")
        assert removed is True
        assert len(template.slots) == 0

        not_removed = template.remove_slot("nonexistent")
        assert not_removed is False

    def test_validate_slots_within_canvas(self):
        """Test canvas boundary validation."""
        slots = [
            TemplateSlot(slot_id="ok", x=0, y=0, width=1080, height=960),
            TemplateSlot(slot_id="overflow_x", x=500, y=0, width=700, height=100),
            TemplateSlot(slot_id="overflow_y", x=0, y=1800, width=100, height=200)
        ]
        template = CompositeTemplate(name="Test", slots=slots)

        issues = template.validate_slots_within_canvas()
        assert len(issues) == 2
        assert any("overflow_x" in issue for issue in issues)
        assert any("overflow_y" in issue for issue in issues)


class TestVideoSource:
    """Tests for VideoSource model."""

    def test_minimal_video_source(self):
        """Test creating video source with only required fields."""
        source = VideoSource(
            source_region=SourceRegion(source_path="/video.mp4"),
            slot_id="main"
        )
        assert source.slot_id == "main"
        assert source.audio_enabled is True
        assert source.audio_volume == 1.0
        assert source.video_filters == []

    def test_full_video_source(self):
        """Test creating video source with all fields."""
        source = VideoSource(
            source_id="gameplay-1",
            source_region=SourceRegion(
                source_path="/videos/game.mp4",
                crop_width=1920,
                crop_height=1080,
                start_time=0,
                end_time=60
            ),
            slot_id="top",
            audio_enabled=True,
            audio_volume=0.8,
            video_filters=["eq=contrast=1.2"],
            audio_filters=["volume=1.5"],
            label="Main Gameplay"
        )
        assert source.source_id == "gameplay-1"
        assert source.audio_volume == 0.8
        assert len(source.video_filters) == 1
        assert source.label == "Main Gameplay"


class TestCompositeRequest:
    """Tests for CompositeRequest model."""

    @pytest.fixture
    def valid_template(self):
        """Create a valid template for testing."""
        return CompositeTemplate(
            name="Test Template",
            slots=[
                TemplateSlot(slot_id="top", width=1080, height=960, x=0, y=0),
                TemplateSlot(slot_id="bottom", width=1080, height=960, x=0, y=960)
            ]
        )

    @pytest.fixture
    def valid_sources(self):
        """Create valid sources for testing."""
        return [
            VideoSource(
                source_id="src1",
                source_region=SourceRegion(source_path="/video1.mp4"),
                slot_id="top",
                audio_enabled=True
            ),
            VideoSource(
                source_id="src2",
                source_region=SourceRegion(source_path="/video2.mp4"),
                slot_id="bottom",
                audio_enabled=False
            )
        ]

    def test_minimal_request(self, valid_template, valid_sources):
        """Test creating request with only required fields."""
        request = CompositeRequest(
            template=valid_template,
            sources=valid_sources,
            output_path="/output/result.mp4"
        )
        assert request.output_path == "/output/result.mp4"
        assert request.audio_mix_mode == AudioMixMode.SINGLE
        assert request.output_codec == "h264"
        assert request.priority == 5

    def test_full_request(self, valid_template, valid_sources):
        """Test creating request with all fields."""
        request = CompositeRequest(
            request_id="req-custom",
            template=valid_template,
            sources=valid_sources,
            output_path="/output/result.mp4",
            audio_source="src1",
            audio_mix_mode=AudioMixMode.SINGLE,
            output_codec="hevc",
            output_bitrate=12000,
            output_preset="slow",
            audio_codec="aac",
            audio_bitrate=256,
            duration_limit=120.0,
            metadata={"title": "Test Video"},
            priority=10
        )
        assert request.request_id == "req-custom"
        assert request.output_bitrate == 12000
        assert request.metadata["title"] == "Test Video"

    def test_source_slot_validation(self, valid_template):
        """Test that sources must reference existing slots."""
        invalid_sources = [
            VideoSource(
                source_region=SourceRegion(source_path="/video.mp4"),
                slot_id="nonexistent_slot"
            )
        ]
        with pytest.raises(ValidationError) as exc_info:
            CompositeRequest(
                template=valid_template,
                sources=invalid_sources,
                output_path="/output.mp4"
            )
        assert "non-existent slot" in str(exc_info.value)

    def test_audio_source_validation(self, valid_template, valid_sources):
        """Test that audio_source must reference existing source."""
        with pytest.raises(ValidationError) as exc_info:
            CompositeRequest(
                template=valid_template,
                sources=valid_sources,
                output_path="/output.mp4",
                audio_source="nonexistent_source"
            )
        assert "not found in sources" in str(exc_info.value)

    def test_get_audio_source(self, valid_template, valid_sources):
        """Test audio source retrieval."""
        request = CompositeRequest(
            template=valid_template,
            sources=valid_sources,
            output_path="/output.mp4",
            audio_source="src1"
        )
        audio = request.get_audio_source()
        assert audio is not None
        assert audio.source_id == "src1"

    def test_get_audio_source_mute(self, valid_template, valid_sources):
        """Test audio source returns None when muted."""
        request = CompositeRequest(
            template=valid_template,
            sources=valid_sources,
            output_path="/output.mp4",
            audio_mix_mode=AudioMixMode.MUTE
        )
        assert request.get_audio_source() is None

    def test_get_audio_source_auto_select(self, valid_template, valid_sources):
        """Test audio source auto-selects first enabled source."""
        request = CompositeRequest(
            template=valid_template,
            sources=valid_sources,
            output_path="/output.mp4"
        )
        audio = request.get_audio_source()
        assert audio is not None
        assert audio.source_id == "src1"

    def test_get_sources_by_z_order(self, valid_template, valid_sources):
        """Test sources are returned sorted by slot z_order."""
        valid_template.slots[0].z_order = 5
        valid_template.slots[1].z_order = 1

        request = CompositeRequest(
            template=valid_template,
            sources=valid_sources,
            output_path="/output.mp4"
        )
        ordered = request.get_sources_by_z_order()
        assert len(ordered) == 2
        assert ordered[0][0].slot_id == "bottom"  # z_order=1
        assert ordered[1][0].slot_id == "top"     # z_order=5

    def test_empty_sources_rejected(self, valid_template):
        """Test that empty sources list is rejected."""
        with pytest.raises(ValidationError):
            CompositeRequest(
                template=valid_template,
                sources=[],
                output_path="/output.mp4"
            )


class TestPresetTemplates:
    """Tests for pre-defined template factories."""

    def test_create_vertical_split_template(self):
        """Test vertical split template creation."""
        template = create_vertical_split_template()
        assert template.output_width == 1080
        assert template.output_height == 1920
        assert len(template.slots) == 2
        assert template.get_slot_by_id("top") is not None
        assert template.get_slot_by_id("bottom") is not None

        # Verify slots cover the canvas
        top = template.get_slot_by_id("top")
        bottom = template.get_slot_by_id("bottom")
        assert top.height + bottom.height == 1920

    def test_create_pip_template_positions(self):
        """Test PiP template with different positions."""
        positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

        for position in positions:
            template = create_pip_template(pip_position=position)
            assert len(template.slots) == 2

            main = template.get_slot_by_id("main")
            pip = template.get_slot_by_id("pip")

            assert main is not None
            assert pip is not None
            assert main.width == 1080
            assert main.height == 1920
            assert pip.z_order > main.z_order

    def test_create_pip_template_size(self):
        """Test PiP template with different sizes."""
        template_small = create_pip_template(pip_size_percent=20)
        template_large = create_pip_template(pip_size_percent=40)

        pip_small = template_small.get_slot_by_id("pip")
        pip_large = template_large.get_slot_by_id("pip")

        assert pip_large.width > pip_small.width
        assert pip_large.height > pip_small.height

    def test_create_side_by_side_template(self):
        """Test side by side template creation."""
        template = create_side_by_side_template()
        assert len(template.slots) == 2

        left = template.get_slot_by_id("left")
        right = template.get_slot_by_id("right")

        assert left is not None
        assert right is not None
        assert left.x + left.width == right.x  # Adjacent
        assert left.y == right.y  # Same vertical position

    def test_create_triple_stack_template(self):
        """Test triple stack template creation."""
        template = create_triple_stack_template()
        assert len(template.slots) == 3

        top = template.get_slot_by_id("top")
        middle = template.get_slot_by_id("middle")
        bottom = template.get_slot_by_id("bottom")

        assert top is not None
        assert middle is not None
        assert bottom is not None

        # Verify vertical stacking
        assert top.y < middle.y < bottom.y
        assert top.height + middle.height + bottom.height == 1920

    def test_get_preset_template(self):
        """Test retrieving preset by name."""
        template = get_preset_template("vertical-split")
        assert template is not None
        assert template.name == "Vertical Split 2x1"

        not_found = get_preset_template("nonexistent")
        assert not_found is None

    def test_list_preset_templates(self):
        """Test listing all preset templates."""
        presets = list_preset_templates()
        assert len(presets) == len(PRESET_TEMPLATES)

        for preset in presets:
            assert "name" in preset
            assert "description" in preset
            assert "slot_count" in preset
            assert "tags" in preset

    def test_all_presets_are_valid(self):
        """Test that all preset templates are valid."""
        for name, factory in PRESET_TEMPLATES.items():
            template = factory()

            # Validate basic structure
            assert template.output_width > 0
            assert template.output_height > 0
            assert len(template.slots) > 0

            # Validate slots don't overflow canvas
            issues = template.validate_slots_within_canvas()
            assert len(issues) == 0, f"Template '{name}' has issues: {issues}"
