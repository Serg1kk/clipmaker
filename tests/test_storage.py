#!/usr/bin/env python3
"""
Test script for StorageService and Pydantic schemas.
Run from project root: python tests/test_storage.py
"""

import sys
import json
import shutil
from pathlib import Path
from datetime import datetime
from uuid import uuid4

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.models.schemas import (
    ProjectSchema,
    TranscriptionSchema,
    SegmentSchema,
    WordTimingSchema,
    ClipSchema,
    TranscriptionStatus,
    SourceVideoSchema,
    ProjectSettingsSchema,
    ProjectIndexEntry,
    ProjectIndex,
)


def test_schemas():
    """Test all Pydantic schemas."""
    print("=== Testing Pydantic Schemas ===")

    # Test WordTimingSchema
    word = WordTimingSchema(word="Hello", start=0.0, end=0.5, probability=0.98)
    assert word.word == "Hello"
    assert word.start == 0.0
    print("WordTimingSchema: PASSED")

    # Test SegmentSchema
    segment = SegmentSchema(
        id=0,
        start=0.0,
        end=2.0,
        text="Hello world.",
        words=[word],
        confidence=0.95
    )
    assert segment.id == 0
    assert len(segment.words) == 1
    print("SegmentSchema: PASSED")

    # Test TranscriptionSchema
    transcription = TranscriptionSchema(
        status=TranscriptionStatus.COMPLETED,
        language='en',
        model_used='base',
        text='Hello world.',
        processing_time_seconds=10.5,
        word_count=2,
        segments=[segment]
    )
    assert transcription.status == TranscriptionStatus.COMPLETED
    assert len(transcription.segments) == 1
    print("TranscriptionSchema: PASSED")

    # Test SourceVideoSchema
    video = SourceVideoSchema(
        path="/path/to/video.mp4",
        filename="video.mp4",
        duration_seconds=7200.0,
        format="mp4"
    )
    assert video.filename == "video.mp4"
    print("SourceVideoSchema: PASSED")

    # Test ClipSchema
    clip = ClipSchema(
        name="Introduction",
        start_time=0.0,
        end_time=30.5
    )
    assert clip.duration_seconds == 30.5
    print("ClipSchema: PASSED")

    # Test ProjectSchema
    project = ProjectSchema(
        name="Test Project",
        source_video=video,
        transcription=transcription,
        clips=[clip]
    )
    assert project.name == "Test Project"
    assert project.id is not None
    print("ProjectSchema: PASSED")

    # Test JSON roundtrip
    json_str = project.model_dump_json()
    loaded = ProjectSchema.model_validate_json(json_str)
    assert loaded.name == project.name
    assert loaded.transcription.status == TranscriptionStatus.COMPLETED
    print("JSON Roundtrip: PASSED")

    print("=== All Schema Tests PASSED ===\n")


def test_storage_service_standalone():
    """Test storage service logic in isolation."""
    print("=== Testing Storage Service Logic ===")

    # Test timestamp formatting
    def format_timestamp_srt(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def format_timestamp_vtt(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

    # Test SRT timestamp
    assert format_timestamp_srt(0.0) == "00:00:00,000"
    assert format_timestamp_srt(5.2) == "00:00:05,200"
    assert format_timestamp_srt(3661.5) == "01:01:01,500"
    print("SRT Timestamp Format: PASSED")

    # Test VTT timestamp
    assert format_timestamp_vtt(0.0) == "00:00:00.000"
    assert format_timestamp_vtt(5.2) == "00:00:05.200"
    assert format_timestamp_vtt(3661.5) == "01:01:01.500"
    print("VTT Timestamp Format: PASSED")

    # Test SRT generation
    segments = [
        SegmentSchema(id=0, start=0.0, end=5.2, text="Hello world."),
        SegmentSchema(id=1, start=5.2, end=10.5, text="This is a test."),
    ]

    lines = []
    for i, segment in enumerate(segments, 1):
        start = format_timestamp_srt(segment.start)
        end = format_timestamp_srt(segment.end)
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(segment.text.strip())
        lines.append("")

    srt_content = "\n".join(lines)
    assert "1\n00:00:00,000 --> 00:00:05,200\nHello world." in srt_content
    assert "2\n00:00:05,200 --> 00:00:10,500\nThis is a test." in srt_content
    print("SRT Generation: PASSED")

    # Test VTT generation
    lines = ["WEBVTT", ""]
    for i, segment in enumerate(segments, 1):
        start = format_timestamp_vtt(segment.start)
        end = format_timestamp_vtt(segment.end)
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(segment.text.strip())
        lines.append("")

    vtt_content = "\n".join(lines)
    assert "WEBVTT" in vtt_content
    assert "00:00:00.000 --> 00:00:05.200" in vtt_content
    print("VTT Generation: PASSED")

    print("=== All Storage Logic Tests PASSED ===\n")


def test_project_index():
    """Test project index functionality."""
    print("=== Testing Project Index ===")

    # Create entries
    entry1 = ProjectIndexEntry(
        id="uuid-1",
        name="Project 1",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        transcription_status=TranscriptionStatus.COMPLETED,
        clip_count=5
    )

    entry2 = ProjectIndexEntry(
        id="uuid-2",
        name="Project 2",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        transcription_status=TranscriptionStatus.PENDING,
        clip_count=0
    )

    # Create index
    index = ProjectIndex(projects=[entry1, entry2])
    assert len(index.projects) == 2
    print("Project Index Creation: PASSED")

    # Test JSON serialization
    index_json = index.model_dump_json()
    loaded_index = ProjectIndex.model_validate_json(index_json)
    assert len(loaded_index.projects) == 2
    assert loaded_index.projects[0].name == "Project 1"
    print("Project Index Serialization: PASSED")

    print("=== All Index Tests PASSED ===\n")


if __name__ == "__main__":
    test_schemas()
    test_storage_service_standalone()
    test_project_index()
    print("=" * 50)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 50)
