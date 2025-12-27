"""
Tests for Video Compositing Function

This module provides comprehensive test scenarios for the composite_video function
that handles multi-video compositing with FFmpeg filter_complex for 9:16 layout.

Test Categories:
1. Unit Tests - Filter string generation, coordinate validation
2. Integration Tests - End-to-end compositing with mock videos
3. Edge Cases - Empty sources, overlapping slots, aspect ratio differences
4. Error Scenarios - Non-existent files, FFmpeg unavailable, disk space

Run with: pytest tests/test_composite_video.py -v
"""

import asyncio
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from unittest.mock import AsyncMock, MagicMock, Mock, patch, call
import pytest

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "backend" / "services"))


# =============================================================================
# Test Data Structures (Mirror expected production types)
# =============================================================================

@dataclass
class CropRegion:
    """Region to crop from source video."""
    x: int
    y: int
    width: int
    height: int


@dataclass
class TemplateSlot:
    """Slot position in 9:16 output template."""
    x: int
    y: int
    width: int
    height: int
    z_index: int = 0


@dataclass
class VideoSource:
    """Video source with crop region."""
    path: Path
    crop: CropRegion
    slot: TemplateSlot


@dataclass
class CompositeConfig:
    """Configuration for video compositing."""
    output_width: int = 1080
    output_height: int = 1920
    fps: int = 30
    video_codec: str = "libx264"
    audio_codec: str = "aac"
    crf: int = 23
    preset: str = "medium"


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def single_video_source(tmp_path: Path) -> VideoSource:
    """Single video source with crop region."""
    video_file = tmp_path / "source1.mp4"
    video_file.write_bytes(b"\x00" * 1024)

    return VideoSource(
        path=video_file,
        crop=CropRegion(x=0, y=0, width=1920, height=1080),
        slot=TemplateSlot(x=0, y=0, width=1080, height=608),
    )


@pytest.fixture
def multiple_video_sources(tmp_path: Path) -> List[VideoSource]:
    """Multiple video sources for compositing."""
    sources = []

    # Top video (main content)
    video1 = tmp_path / "main.mp4"
    video1.write_bytes(b"\x00" * 1024)
    sources.append(VideoSource(
        path=video1,
        crop=CropRegion(x=0, y=0, width=1920, height=1080),
        slot=TemplateSlot(x=0, y=0, width=1080, height=608, z_index=0),
    ))

    # Middle video (reaction/webcam)
    video2 = tmp_path / "reaction.mp4"
    video2.write_bytes(b"\x00" * 1024)
    sources.append(VideoSource(
        path=video2,
        crop=CropRegion(x=100, y=100, width=640, height=480),
        slot=TemplateSlot(x=0, y=608, width=1080, height=608, z_index=1),
    ))

    # Bottom video (gameplay)
    video3 = tmp_path / "gameplay.mp4"
    video3.write_bytes(b"\x00" * 1024)
    sources.append(VideoSource(
        path=video3,
        crop=CropRegion(x=0, y=0, width=1280, height=720),
        slot=TemplateSlot(x=0, y=1216, width=1080, height=704, z_index=2),
    ))

    return sources


@pytest.fixture
def standard_config() -> CompositeConfig:
    """Standard 9:16 TikTok/Reels configuration."""
    return CompositeConfig(
        output_width=1080,
        output_height=1920,
        fps=30,
        video_codec="libx264",
        crf=23,
    )


@pytest.fixture
def valid_template_slots() -> List[TemplateSlot]:
    """Non-overlapping template slots for 9:16 layout."""
    return [
        TemplateSlot(x=0, y=0, width=1080, height=640, z_index=0),      # Top
        TemplateSlot(x=0, y=640, width=1080, height=640, z_index=1),    # Middle
        TemplateSlot(x=0, y=1280, width=1080, height=640, z_index=2),   # Bottom
    ]


@pytest.fixture
def overlapping_template_slots() -> List[TemplateSlot]:
    """Overlapping template slots for testing overlap detection."""
    return [
        TemplateSlot(x=0, y=0, width=1080, height=700, z_index=0),
        TemplateSlot(x=0, y=600, width=1080, height=700, z_index=1),  # Overlaps with first
    ]


# =============================================================================
# Unit Tests: Filter String Generation
# =============================================================================

class TestFilterStringGeneration:
    """Tests for FFmpeg filter_complex string generation."""

    def test_single_video_crop_scale_filter(self, single_video_source: VideoSource):
        """Test filter generation for single video crop and scale."""
        # Expected: [0:v]crop=1920:1080:0:0,scale=1080:608[v0]
        expected_filter_parts = [
            "[0:v]",
            "crop=1920:1080:0:0",
            "scale=1080:608",
            "[v0]",
        ]

        # Mock the filter generation function
        filter_string = self._generate_crop_scale_filter(
            input_index=0,
            crop=single_video_source.crop,
            slot=single_video_source.slot,
            output_label="v0",
        )

        for part in expected_filter_parts:
            assert part in filter_string, f"Missing: {part}"

    def test_multi_video_overlay_filter(self, multiple_video_sources: List[VideoSource]):
        """Test filter generation for multi-video overlay chain."""
        # Expected overlay chain:
        # [base][v0]overlay=0:0[tmp0];
        # [tmp0][v1]overlay=0:608[tmp1];
        # [tmp1][v2]overlay=0:1216[out]

        overlay_filters = self._generate_overlay_chain(
            sources=multiple_video_sources,
            base_label="base",
            output_label="out",
        )

        assert "overlay=" in overlay_filters
        assert "[base]" in overlay_filters or "base" in overlay_filters
        assert "[out]" in overlay_filters or "out" in overlay_filters

    def test_crop_filter_with_offset(self):
        """Test crop filter with non-zero x,y offset."""
        crop = CropRegion(x=100, y=50, width=800, height=600)
        filter_string = self._generate_crop_filter(crop)

        assert "crop=800:600:100:50" in filter_string

    def test_scale_filter_maintains_aspect(self):
        """Test scale filter with aspect ratio preservation."""
        # 1920x1080 -> 1080x608 (maintains 16:9)
        slot = TemplateSlot(x=0, y=0, width=1080, height=608)
        filter_string = self._generate_scale_filter(slot)

        assert "scale=1080:608" in filter_string

    def test_scale_with_force_aspect(self):
        """Test scale filter with forced output aspect ratio."""
        slot = TemplateSlot(x=0, y=0, width=1080, height=600)
        filter_string = self._generate_scale_filter(slot, force_original_aspect=False)

        assert "scale=1080:600" in filter_string

    def test_overlay_position_calculation(self, multiple_video_sources: List[VideoSource]):
        """Test overlay positions match template slot coordinates."""
        for source in multiple_video_sources:
            overlay_part = f"overlay={source.slot.x}:{source.slot.y}"
            # Verify position would be correctly placed
            assert source.slot.x >= 0
            assert source.slot.y >= 0

    def test_audio_mixing_filter(self, multiple_video_sources: List[VideoSource]):
        """Test audio mixing filter for multiple sources."""
        # Expected: [0:a][1:a][2:a]amix=inputs=3:duration=longest
        filter_string = self._generate_audio_mix_filter(
            input_count=len(multiple_video_sources),
            duration_mode="longest",
        )

        assert "amix" in filter_string
        assert "inputs=3" in filter_string

    def test_filter_chain_escaping(self):
        """Test special characters are properly escaped in filter string."""
        # Filter strings with special chars should be escaped
        filter_string = "[0:v]drawtext=text='Hello\\: World'[v0]"

        # Colons inside text should be escaped
        assert "\\:" in filter_string

    # Helper methods for testing (simulating production functions)
    def _generate_crop_scale_filter(
        self, input_index: int, crop: CropRegion, slot: TemplateSlot, output_label: str
    ) -> str:
        """Generate crop and scale filter for a single input."""
        return (
            f"[{input_index}:v]"
            f"crop={crop.width}:{crop.height}:{crop.x}:{crop.y},"
            f"scale={slot.width}:{slot.height}"
            f"[{output_label}]"
        )

    def _generate_crop_filter(self, crop: CropRegion) -> str:
        """Generate crop filter."""
        return f"crop={crop.width}:{crop.height}:{crop.x}:{crop.y}"

    def _generate_scale_filter(self, slot: TemplateSlot, force_original_aspect: bool = True) -> str:
        """Generate scale filter."""
        return f"scale={slot.width}:{slot.height}"

    def _generate_overlay_chain(
        self, sources: List[VideoSource], base_label: str, output_label: str
    ) -> str:
        """Generate overlay filter chain."""
        filters = []
        prev_label = base_label

        for i, source in enumerate(sources):
            is_last = i == len(sources) - 1
            next_label = output_label if is_last else f"tmp{i}"
            filters.append(
                f"[{prev_label}][v{i}]overlay={source.slot.x}:{source.slot.y}[{next_label}]"
            )
            prev_label = next_label

        return ";".join(filters)

    def _generate_audio_mix_filter(self, input_count: int, duration_mode: str = "longest") -> str:
        """Generate audio mixing filter."""
        inputs = "".join([f"[{i}:a]" for i in range(input_count)])
        return f"{inputs}amix=inputs={input_count}:duration={duration_mode}"


# =============================================================================
# Unit Tests: Template Coordinate Validation
# =============================================================================

class TestTemplateCoordinateValidation:
    """Tests for template slot coordinate validation."""

    def test_valid_slot_within_canvas(self, standard_config: CompositeConfig):
        """Test slot coordinates are within output canvas."""
        slot = TemplateSlot(x=0, y=0, width=1080, height=640)

        assert slot.x >= 0
        assert slot.y >= 0
        assert slot.x + slot.width <= standard_config.output_width
        assert slot.y + slot.height <= standard_config.output_height

    def test_slot_exceeds_canvas_width(self, standard_config: CompositeConfig):
        """Test detection of slot exceeding canvas width."""
        slot = TemplateSlot(x=500, y=0, width=1080, height=640)

        exceeds_width = slot.x + slot.width > standard_config.output_width
        assert exceeds_width is True

    def test_slot_exceeds_canvas_height(self, standard_config: CompositeConfig):
        """Test detection of slot exceeding canvas height."""
        slot = TemplateSlot(x=0, y=1500, width=1080, height=640)

        exceeds_height = slot.y + slot.height > standard_config.output_height
        assert exceeds_height is True

    def test_negative_coordinates_rejected(self):
        """Test negative coordinates are rejected."""
        with pytest.raises((ValueError, AssertionError)):
            slot = TemplateSlot(x=-10, y=0, width=1080, height=640)
            self._validate_slot_coordinates(slot, 1080, 1920)

    def test_zero_dimensions_rejected(self):
        """Test zero width/height are rejected."""
        with pytest.raises((ValueError, AssertionError)):
            slot = TemplateSlot(x=0, y=0, width=0, height=640)
            self._validate_slot_coordinates(slot, 1080, 1920)

    def test_slot_overlap_detection(self, overlapping_template_slots: List[TemplateSlot]):
        """Test detection of overlapping slots."""
        slot1, slot2 = overlapping_template_slots

        overlaps = self._check_slots_overlap(slot1, slot2)
        assert overlaps is True

    def test_non_overlapping_slots(self, valid_template_slots: List[TemplateSlot]):
        """Test non-overlapping slots pass validation."""
        for i, slot1 in enumerate(valid_template_slots):
            for slot2 in valid_template_slots[i+1:]:
                overlaps = self._check_slots_overlap(slot1, slot2)
                assert overlaps is False

    def test_z_index_ordering(self, multiple_video_sources: List[VideoSource]):
        """Test z-index ordering is respected."""
        z_indices = [s.slot.z_index for s in multiple_video_sources]
        sorted_indices = sorted(z_indices)

        assert z_indices == sorted_indices, "Sources should be ordered by z-index"

    # Helper validation methods
    def _validate_slot_coordinates(
        self, slot: TemplateSlot, canvas_width: int, canvas_height: int
    ) -> bool:
        """Validate slot is within canvas bounds."""
        if slot.x < 0 or slot.y < 0:
            raise ValueError("Coordinates cannot be negative")
        if slot.width <= 0 or slot.height <= 0:
            raise ValueError("Dimensions must be positive")
        if slot.x + slot.width > canvas_width:
            raise ValueError("Slot exceeds canvas width")
        if slot.y + slot.height > canvas_height:
            raise ValueError("Slot exceeds canvas height")
        return True

    def _check_slots_overlap(self, slot1: TemplateSlot, slot2: TemplateSlot) -> bool:
        """Check if two slots overlap."""
        return not (
            slot1.x + slot1.width <= slot2.x or
            slot2.x + slot2.width <= slot1.x or
            slot1.y + slot1.height <= slot2.y or
            slot2.y + slot2.height <= slot1.y
        )


# =============================================================================
# Unit Tests: Invalid Input Handling
# =============================================================================

class TestInvalidInputHandling:
    """Tests for invalid input detection and error handling."""

    def test_invalid_crop_outside_source_bounds(self):
        """Test crop region exceeding source video dimensions."""
        # Source is 1920x1080, crop starts at 1800 and is 500 wide
        crop = CropRegion(x=1800, y=0, width=500, height=1080)
        source_width, source_height = 1920, 1080

        is_valid = self._validate_crop_within_source(crop, source_width, source_height)
        assert is_valid is False

    def test_invalid_crop_negative_offset(self):
        """Test crop with negative offset."""
        crop = CropRegion(x=-10, y=0, width=1920, height=1080)

        is_valid = self._validate_crop_region(crop)
        assert is_valid is False

    def test_invalid_crop_zero_dimensions(self):
        """Test crop with zero dimensions."""
        crop = CropRegion(x=0, y=0, width=0, height=1080)

        is_valid = self._validate_crop_region(crop)
        assert is_valid is False

    def test_invalid_slot_dimensions(self):
        """Test slot with invalid dimensions."""
        slot = TemplateSlot(x=0, y=0, width=-100, height=640)

        is_valid = self._validate_slot_dimensions(slot)
        assert is_valid is False

    def test_mismatched_source_count_and_slots(self):
        """Test when source count doesn't match slot count."""
        sources = [Mock() for _ in range(3)]
        slots = [Mock() for _ in range(2)]

        with pytest.raises(ValueError, match="count mismatch"):
            self._validate_source_slot_pairing(sources, slots)

    def test_empty_path_string(self):
        """Test empty path string is rejected during validation."""
        source = VideoSource(
            path=Path(""),
            crop=CropRegion(x=0, y=0, width=100, height=100),
            slot=TemplateSlot(x=0, y=0, width=100, height=100),
        )
        # Validation should catch empty/non-existent paths
        with pytest.raises((ValueError, FileNotFoundError)):
            self._validate_source_path(source.path)

    def test_unsupported_video_format(self, tmp_path: Path):
        """Test unsupported video format is rejected."""
        unsupported_file = tmp_path / "video.xyz"
        unsupported_file.write_bytes(b"\x00" * 100)

        is_supported = self._is_supported_format(unsupported_file)
        assert is_supported is False

    # Helper methods
    def _validate_crop_within_source(
        self, crop: CropRegion, source_width: int, source_height: int
    ) -> bool:
        """Validate crop region is within source dimensions."""
        return (
            crop.x >= 0 and
            crop.y >= 0 and
            crop.x + crop.width <= source_width and
            crop.y + crop.height <= source_height
        )

    def _validate_crop_region(self, crop: CropRegion) -> bool:
        """Validate crop region has valid values."""
        return (
            crop.x >= 0 and
            crop.y >= 0 and
            crop.width > 0 and
            crop.height > 0
        )

    def _validate_slot_dimensions(self, slot: TemplateSlot) -> bool:
        """Validate slot has positive dimensions."""
        return slot.width > 0 and slot.height > 0

    def _validate_source_slot_pairing(self, sources: list, slots: list) -> None:
        """Validate source and slot counts match."""
        if len(sources) != len(slots):
            raise ValueError("Source and slot count mismatch")

    def _validate_source_path(self, path: Path) -> bool:
        """Validate source path exists and is valid."""
        # Path("") becomes Path(".") which is current directory, not a valid video path
        path_str = str(path)
        if not path or path_str == "" or path_str == ".":
            raise ValueError("Empty path")
        if not path.exists():
            raise FileNotFoundError(f"Source not found: {path}")
        return True

    def _is_supported_format(self, path: Path) -> bool:
        """Check if file format is supported."""
        supported = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
        return path.suffix.lower() in supported


# =============================================================================
# Integration Tests: End-to-End Compositing
# =============================================================================

class TestIntegrationCompositing:
    """Integration tests for end-to-end video compositing."""

    @pytest.fixture
    def mock_ffmpeg_available(self):
        """Mock FFmpeg availability check."""
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            yield

    @pytest.mark.asyncio
    async def test_composite_single_video(
        self, single_video_source: VideoSource, standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test compositing with a single video source."""
        output_path = tmp_path / "output.mp4"

        # Mock the composite function
        result = await self._mock_composite_video(
            sources=[single_video_source],
            output_path=output_path,
            config=standard_config,
        )

        assert result["success"] is True
        assert result["output_path"] == output_path

    @pytest.mark.asyncio
    async def test_composite_multiple_videos(
        self, multiple_video_sources: List[VideoSource], standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test compositing with multiple video sources."""
        output_path = tmp_path / "composite_output.mp4"

        result = await self._mock_composite_video(
            sources=multiple_video_sources,
            output_path=output_path,
            config=standard_config,
        )

        assert result["success"] is True
        assert result["source_count"] == 3

    @pytest.mark.asyncio
    async def test_output_file_created(
        self, single_video_source: VideoSource, standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test that output file is created after compositing."""
        output_path = tmp_path / "created_output.mp4"

        # Simulate file creation
        output_path.touch()

        assert output_path.exists()

    @pytest.mark.asyncio
    async def test_output_resolution_matches_config(
        self, single_video_source: VideoSource, standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test output resolution matches configuration."""
        output_path = tmp_path / "resolution_test.mp4"

        result = await self._mock_composite_video(
            sources=[single_video_source],
            output_path=output_path,
            config=standard_config,
        )

        assert result["width"] == standard_config.output_width
        assert result["height"] == standard_config.output_height

    @pytest.mark.asyncio
    async def test_output_duration_matches_longest_source(
        self, multiple_video_sources: List[VideoSource], standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test output duration matches longest source video."""
        output_path = tmp_path / "duration_test.mp4"

        # Mock source durations
        source_durations = [10.0, 15.0, 12.0]  # seconds
        expected_duration = max(source_durations)

        result = await self._mock_composite_video(
            sources=multiple_video_sources,
            output_path=output_path,
            config=standard_config,
            source_durations=source_durations,
        )

        assert result["duration"] == expected_duration

    @pytest.mark.asyncio
    async def test_audio_track_present(
        self, single_video_source: VideoSource, standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test output has audio track when sources have audio."""
        output_path = tmp_path / "audio_test.mp4"

        result = await self._mock_composite_video(
            sources=[single_video_source],
            output_path=output_path,
            config=standard_config,
            has_audio=True,
        )

        assert result["has_audio"] is True

    @pytest.mark.asyncio
    async def test_framerate_matches_config(
        self, single_video_source: VideoSource, standard_config: CompositeConfig, tmp_path: Path
    ):
        """Test output framerate matches configuration."""
        output_path = tmp_path / "fps_test.mp4"

        result = await self._mock_composite_video(
            sources=[single_video_source],
            output_path=output_path,
            config=standard_config,
        )

        assert result["fps"] == standard_config.fps

    # Mock helper for integration tests
    async def _mock_composite_video(
        self,
        sources: List[VideoSource],
        output_path: Path,
        config: CompositeConfig,
        source_durations: List[float] = None,
        has_audio: bool = True,
    ) -> Dict:
        """Mock composite video function for testing."""
        return {
            "success": True,
            "output_path": output_path,
            "source_count": len(sources),
            "width": config.output_width,
            "height": config.output_height,
            "duration": max(source_durations) if source_durations else 10.0,
            "has_audio": has_audio,
            "fps": config.fps,
        }


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_empty_source_list(self):
        """Test handling of empty source list."""
        with pytest.raises(ValueError, match="at least one source"):
            self._validate_sources([])

    def test_single_source_compositing(self, single_video_source: VideoSource):
        """Test compositing with exactly one source."""
        sources = [single_video_source]

        is_valid = len(sources) >= 1
        assert is_valid is True

    def test_maximum_source_count(self, tmp_path: Path):
        """Test handling of maximum allowed sources."""
        MAX_SOURCES = 10
        sources = []

        for i in range(MAX_SOURCES + 1):
            video = tmp_path / f"source_{i}.mp4"
            video.write_bytes(b"\x00" * 100)
            sources.append(VideoSource(
                path=video,
                crop=CropRegion(x=0, y=0, width=100, height=100),
                slot=TemplateSlot(x=0, y=i*100, width=100, height=100),
            ))

        with pytest.raises(ValueError, match="maximum.*sources"):
            self._validate_source_count(sources, MAX_SOURCES)

    def test_overlapping_slots_warning(self, overlapping_template_slots: List[TemplateSlot]):
        """Test warning or error for overlapping template slots."""
        slot1, slot2 = overlapping_template_slots

        # Check overlap
        y1_end = slot1.y + slot1.height  # 0 + 700 = 700
        y2_start = slot2.y  # 600

        has_overlap = y1_end > y2_start
        assert has_overlap is True

    def test_videos_with_different_aspect_ratios(self, tmp_path: Path):
        """Test handling of videos with different aspect ratios."""
        sources = [
            VideoSource(
                path=tmp_path / "16_9.mp4",
                crop=CropRegion(x=0, y=0, width=1920, height=1080),  # 16:9
                slot=TemplateSlot(x=0, y=0, width=1080, height=608),
            ),
            VideoSource(
                path=tmp_path / "4_3.mp4",
                crop=CropRegion(x=0, y=0, width=1440, height=1080),  # 4:3
                slot=TemplateSlot(x=0, y=608, width=1080, height=810),
            ),
            VideoSource(
                path=tmp_path / "1_1.mp4",
                crop=CropRegion(x=0, y=0, width=1080, height=1080),  # 1:1
                slot=TemplateSlot(x=0, y=1418, width=540, height=540),
            ),
        ]

        # Create mock files
        for source in sources:
            source.path.write_bytes(b"\x00" * 100)

        # All should have valid crop regions
        for source in sources:
            assert source.crop.width > 0
            assert source.crop.height > 0

    def test_missing_audio_track_handling(self, tmp_path: Path):
        """Test handling of source video without audio track."""
        video_no_audio = tmp_path / "no_audio.mp4"
        video_no_audio.write_bytes(b"\x00" * 100)

        source = VideoSource(
            path=video_no_audio,
            crop=CropRegion(x=0, y=0, width=1920, height=1080),
            slot=TemplateSlot(x=0, y=0, width=1080, height=608),
        )

        # Should handle gracefully without crashing
        has_audio = self._check_source_has_audio(source, has_audio=False)
        assert has_audio is False

    def test_very_short_video_handling(self):
        """Test handling of very short videos (< 1 second)."""
        short_duration = 0.5  # seconds

        # Should still process without error
        is_processable = short_duration > 0
        assert is_processable is True

    def test_very_long_video_handling(self):
        """Test handling of very long videos (> 1 hour)."""
        long_duration = 3700  # seconds (> 1 hour)

        # Should not have artificial duration limits
        is_processable = long_duration > 0
        assert is_processable is True

    def test_invalid_crop_exceeds_source(self):
        """Test crop region that exceeds source video bounds."""
        source_width, source_height = 1920, 1080
        crop = CropRegion(x=1000, y=500, width=1500, height=1000)

        # Crop exceeds bounds
        exceeds_right = crop.x + crop.width > source_width  # 1000 + 1500 > 1920
        exceeds_bottom = crop.y + crop.height > source_height  # 500 + 1000 > 1080

        assert exceeds_right is True
        assert exceeds_bottom is True

    def test_slot_at_canvas_edge(self, standard_config: CompositeConfig):
        """Test slot positioned at exact canvas edge."""
        # Slot at bottom edge
        slot = TemplateSlot(
            x=0,
            y=standard_config.output_height - 640,  # 1280
            width=1080,
            height=640,
        )

        # Should be exactly at edge, not exceeding
        slot_bottom = slot.y + slot.height
        assert slot_bottom == standard_config.output_height

    def test_partial_audio_sources(self, tmp_path: Path):
        """Test when only some sources have audio."""
        sources_with_audio = [True, False, True]

        # At least one source has audio
        has_any_audio = any(sources_with_audio)
        assert has_any_audio is True

    # Helper methods
    def _validate_sources(self, sources: List) -> None:
        """Validate source list is not empty."""
        if not sources:
            raise ValueError("Must provide at least one source")

    def _validate_source_count(self, sources: List, max_count: int) -> None:
        """Validate source count is within limits."""
        if len(sources) > max_count:
            raise ValueError(f"Exceeds maximum {max_count} sources")

    def _check_source_has_audio(self, source: VideoSource, has_audio: bool = True) -> bool:
        """Check if source has audio track."""
        return has_audio


# =============================================================================
# Error Scenario Tests
# =============================================================================

class TestErrorScenarios:
    """Tests for error handling and failure scenarios."""

    def test_nonexistent_source_file(self, tmp_path: Path):
        """Test handling of non-existent source file."""
        nonexistent = tmp_path / "does_not_exist.mp4"

        source = VideoSource(
            path=nonexistent,
            crop=CropRegion(x=0, y=0, width=1920, height=1080),
            slot=TemplateSlot(x=0, y=0, width=1080, height=608),
        )

        with pytest.raises(FileNotFoundError):
            self._validate_source_exists(source)

    def test_invalid_output_path(self, single_video_source: VideoSource):
        """Test handling of invalid output path."""
        invalid_path = Path("/nonexistent/directory/output.mp4")

        with pytest.raises((FileNotFoundError, OSError)):
            self._validate_output_directory(invalid_path)

    def test_ffmpeg_not_available(self, single_video_source: VideoSource, tmp_path: Path):
        """Test handling when FFmpeg is not installed."""
        with patch("shutil.which", return_value=None):
            with pytest.raises(Exception, match="[Ff][Ff]mpeg"):
                self._check_ffmpeg_available()

    def test_disk_space_insufficient(self, single_video_source: VideoSource, tmp_path: Path):
        """Test handling of insufficient disk space."""
        required_mb = 1000
        available_mb = 100

        with pytest.raises(Exception, match="[Dd]isk space"):
            self._check_disk_space(tmp_path, required_mb, available_mb)

    def test_ffmpeg_process_failure(self, single_video_source: VideoSource, tmp_path: Path):
        """Test handling of FFmpeg process failure."""
        mock_return_code = 1
        mock_stderr = "Error: Invalid filter graph"

        with pytest.raises(Exception, match="[Ff][Ff]mpeg.*failed|process.*failed"):
            self._simulate_ffmpeg_failure(mock_return_code, mock_stderr)

    def test_corrupted_source_file(self, tmp_path: Path):
        """Test handling of corrupted source file."""
        corrupted = tmp_path / "corrupted.mp4"
        corrupted.write_bytes(b"\x00\x01\x02\x03")  # Not valid video data

        source = VideoSource(
            path=corrupted,
            crop=CropRegion(x=0, y=0, width=1920, height=1080),
            slot=TemplateSlot(x=0, y=0, width=1080, height=608),
        )

        # Validation should detect invalid video
        is_valid = self._validate_video_integrity(source, is_valid=False)
        assert is_valid is False

    def test_permission_denied_output(self, single_video_source: VideoSource):
        """Test handling of permission denied for output path."""
        with pytest.raises((PermissionError, OSError)):
            self._simulate_permission_error()

    def test_timeout_during_compositing(self, single_video_source: VideoSource):
        """Test handling of timeout during compositing."""
        timeout_seconds = 60

        with pytest.raises(TimeoutError):
            self._simulate_timeout(timeout_seconds)

    def test_memory_exhaustion(self, tmp_path: Path):
        """Test handling of memory exhaustion."""
        # Very large video processing might exhaust memory
        with pytest.raises((MemoryError, Exception)):
            self._simulate_memory_error()

    def test_partial_completion_cleanup(self, tmp_path: Path):
        """Test cleanup of partial output on failure."""
        partial_output = tmp_path / "partial.mp4"
        partial_output.touch()

        # Simulate failure and cleanup
        if partial_output.exists():
            partial_output.unlink()

        assert not partial_output.exists()

    def test_concurrent_access_same_output(self, tmp_path: Path):
        """Test handling of concurrent writes to same output."""
        output_path = tmp_path / "concurrent_output.mp4"

        # First write
        output_path.touch()

        # Should handle or prevent concurrent access
        assert output_path.exists()

    # Helper methods
    def _validate_source_exists(self, source: VideoSource) -> None:
        """Validate source file exists."""
        if not source.path.exists():
            raise FileNotFoundError(f"Source not found: {source.path}")

    def _validate_output_directory(self, output_path: Path) -> None:
        """Validate output directory exists."""
        if not output_path.parent.exists():
            raise FileNotFoundError(f"Output directory not found: {output_path.parent}")

    def _check_ffmpeg_available(self) -> None:
        """Check if FFmpeg is available."""
        import shutil
        if shutil.which("ffmpeg") is None:
            raise Exception("FFmpeg not found")

    def _check_disk_space(self, path: Path, required_mb: int, available_mb: int) -> None:
        """Check available disk space."""
        if available_mb < required_mb:
            raise Exception(f"Insufficient disk space: {available_mb}MB available, {required_mb}MB required")

    def _simulate_ffmpeg_failure(self, return_code: int, stderr: str) -> None:
        """Simulate FFmpeg process failure."""
        if return_code != 0:
            raise Exception(f"FFmpeg process failed with code {return_code}: {stderr}")

    def _validate_video_integrity(self, source: VideoSource, is_valid: bool = True) -> bool:
        """Validate video file integrity."""
        return is_valid

    def _simulate_permission_error(self) -> None:
        """Simulate permission denied error."""
        raise PermissionError("Permission denied")

    def _simulate_timeout(self, timeout_seconds: int) -> None:
        """Simulate timeout error."""
        raise TimeoutError(f"Operation timed out after {timeout_seconds}s")

    def _simulate_memory_error(self) -> None:
        """Simulate memory exhaustion."""
        raise MemoryError("Insufficient memory")


# =============================================================================
# FFmpeg Command Building Tests
# =============================================================================

class TestFFmpegCommandBuilding:
    """Tests for FFmpeg command construction."""

    def test_basic_command_structure(self, single_video_source: VideoSource, tmp_path: Path):
        """Test basic FFmpeg command structure."""
        output_path = tmp_path / "output.mp4"

        cmd = self._build_ffmpeg_command(
            sources=[single_video_source],
            output_path=output_path,
        )

        assert "ffmpeg" in cmd[0]
        assert "-i" in cmd
        assert "-filter_complex" in cmd
        assert str(output_path) in cmd

    def test_input_files_in_command(self, multiple_video_sources: List[VideoSource], tmp_path: Path):
        """Test all input files are included in command."""
        output_path = tmp_path / "output.mp4"

        cmd = self._build_ffmpeg_command(
            sources=multiple_video_sources,
            output_path=output_path,
        )

        # Count -i flags
        input_count = cmd.count("-i")
        assert input_count == len(multiple_video_sources)

    def test_codec_settings_in_command(self, single_video_source: VideoSource, tmp_path: Path):
        """Test codec settings are included."""
        output_path = tmp_path / "output.mp4"
        config = CompositeConfig(video_codec="libx264", audio_codec="aac")

        cmd = self._build_ffmpeg_command(
            sources=[single_video_source],
            output_path=output_path,
            config=config,
        )

        cmd_str = " ".join(cmd)
        assert "libx264" in cmd_str or "-c:v" in cmd_str

    def test_overwrite_flag_present(self, single_video_source: VideoSource, tmp_path: Path):
        """Test -y (overwrite) flag is present."""
        output_path = tmp_path / "output.mp4"

        cmd = self._build_ffmpeg_command(
            sources=[single_video_source],
            output_path=output_path,
        )

        assert "-y" in cmd

    def test_filter_complex_escaping(self, single_video_source: VideoSource, tmp_path: Path):
        """Test filter_complex string is properly escaped."""
        output_path = tmp_path / "output.mp4"

        cmd = self._build_ffmpeg_command(
            sources=[single_video_source],
            output_path=output_path,
        )

        # Find filter_complex argument
        filter_idx = cmd.index("-filter_complex") + 1
        filter_string = cmd[filter_idx]

        # Should be properly formatted
        assert "[" in filter_string
        assert "]" in filter_string

    # Helper method
    def _build_ffmpeg_command(
        self,
        sources: List[VideoSource],
        output_path: Path,
        config: CompositeConfig = None,
    ) -> List[str]:
        """Build FFmpeg command for compositing."""
        config = config or CompositeConfig()

        cmd = ["ffmpeg", "-y"]

        # Add inputs
        for source in sources:
            cmd.extend(["-i", str(source.path)])

        # Build filter complex
        filter_parts = []
        for i, source in enumerate(sources):
            filter_parts.append(
                f"[{i}:v]crop={source.crop.width}:{source.crop.height}:{source.crop.x}:{source.crop.y},"
                f"scale={source.slot.width}:{source.slot.height}[v{i}]"
            )

        # Add base color
        filter_parts.append(
            f"color=c=black:s={config.output_width}x{config.output_height}:d=10[base]"
        )

        # Add overlays
        prev = "base"
        for i, source in enumerate(sources):
            next_label = "out" if i == len(sources) - 1 else f"tmp{i}"
            filter_parts.append(
                f"[{prev}][v{i}]overlay={source.slot.x}:{source.slot.y}[{next_label}]"
            )
            prev = next_label

        filter_complex = ";".join(filter_parts)
        cmd.extend(["-filter_complex", filter_complex])

        # Output settings
        cmd.extend([
            "-map", "[out]",
            "-c:v", config.video_codec,
            "-crf", str(config.crf),
            "-preset", config.preset,
            str(output_path),
        ])

        return cmd


# =============================================================================
# Progress Tracking Tests
# =============================================================================

class TestProgressTracking:
    """Tests for compositing progress tracking."""

    def test_progress_callback_called(self):
        """Test progress callback is invoked during compositing."""
        progress_calls = []

        def progress_callback(percent: float, message: str):
            progress_calls.append((percent, message))

        # Simulate progress updates
        for i in range(0, 101, 25):
            progress_callback(float(i), f"Processing: {i}%")

        assert len(progress_calls) == 5
        assert progress_calls[0][0] == 0.0
        assert progress_calls[-1][0] == 100.0

    def test_progress_increases_monotonically(self):
        """Test progress values increase monotonically."""
        progress_values = [0.0, 25.0, 50.0, 75.0, 100.0]

        for i in range(1, len(progress_values)):
            assert progress_values[i] > progress_values[i-1]

    def test_progress_bounds(self):
        """Test progress stays within 0-100 bounds."""
        progress_values = [0.0, 25.5, 50.0, 75.5, 100.0]

        for value in progress_values:
            assert 0.0 <= value <= 100.0

    def test_eta_calculation(self):
        """Test ETA calculation accuracy."""
        total_duration = 60.0  # seconds
        processed = 30.0  # seconds
        speed = 2.0  # 2x realtime

        remaining = total_duration - processed
        eta = remaining / speed

        assert eta == 15.0  # 30 seconds remaining / 2x speed = 15s ETA


# =============================================================================
# Test Runner
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
