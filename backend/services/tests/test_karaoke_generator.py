"""
Tests for the Karaoke ASS Subtitle Generator.

Run with: pytest backend/services/tests/test_karaoke_generator.py -v
"""

import pytest
from pathlib import Path
import tempfile

from backend.services.karaoke_generator import (
    generate_karaoke_ass,
    generate_karaoke_ass_multiline,
    KaraokeStyle,
    KaraokeConfig,
    ASSColor,
    ASSAlignment,
    KaraokeEffect,
    EmptyInputError,
    InvalidTimingError,
    _seconds_to_ass_time,
    _escape_ass_text,
)


# ============================================================================
# Test Fixtures / Mock Data
# ============================================================================

@pytest.fixture
def single_word():
    """Single word test case."""
    return [{"word": "Hello", "start": 0.0, "end": 1.0}]


@pytest.fixture
def sequential_words():
    """5 words with continuous timing (no gaps)."""
    return [
        {"word": "Hello ", "start": 0.0, "end": 0.5},
        {"word": "world ", "start": 0.5, "end": 1.0},
        {"word": "this ", "start": 1.0, "end": 1.3},
        {"word": "is ", "start": 1.3, "end": 1.5},
        {"word": "karaoke", "start": 1.5, "end": 2.5},
    ]


@pytest.fixture
def words_with_gaps():
    """Words with timing gaps between them."""
    return [
        {"word": "First", "start": 0.0, "end": 0.5},
        {"word": "second", "start": 1.0, "end": 1.5},  # 0.5s gap
        {"word": "third", "start": 3.0, "end": 3.5},   # 1.5s gap
    ]


@pytest.fixture
def special_chars_words():
    """Words with special characters."""
    return [
        {"word": 'He said "Hello"', "start": 0.0, "end": 1.0},
        {"word": "It's working", "start": 1.0, "end": 2.0},
        {"word": "Path\\to\\file", "start": 2.0, "end": 3.0},
    ]


@pytest.fixture
def unicode_words():
    """Words with Unicode characters."""
    return [
        {"word": "Caf\u00e9 ", "start": 0.0, "end": 0.5},
        {"word": "r\u00e9sum\u00e9 ", "start": 0.5, "end": 1.0},
        {"word": "\u4f60\u597d", "start": 1.0, "end": 1.5},  # Chinese
    ]


# ============================================================================
# Basic Functionality Tests
# ============================================================================

class TestBasicFunctionality:
    """Tests for core karaoke generation functionality."""

    def test_single_word_generation(self, single_word):
        """Test generating ASS for a single word."""
        result = generate_karaoke_ass(single_word)

        assert "[Script Info]" in result
        assert "[V4+ Styles]" in result
        assert "[Events]" in result
        assert "Dialogue:" in result
        assert "{\\kf100}Hello" in result  # 1.0s = 100cs

    def test_sequential_words(self, sequential_words):
        """Test generating ASS for sequential words."""
        result = generate_karaoke_ass(sequential_words)

        # Check all words are present with karaoke tags
        assert "{\\kf50}Hello " in result
        assert "{\\kf50}world " in result
        assert "{\\kf30}this " in result
        assert "{\\kf20}is " in result
        assert "{\\kf100}karaoke" in result

    def test_centisecond_calculation(self):
        """Test that duration is correctly calculated in centiseconds."""
        words = [{"word": "test", "start": 0.0, "end": 0.75}]
        result = generate_karaoke_ass(words)

        assert "{\\kf75}test" in result  # 0.75s = 75cs

    def test_timestamp_format(self):
        """Test ASS timestamp format is correct."""
        words = [{"word": "test", "start": 65.5, "end": 70.25}]
        result = generate_karaoke_ass(words)

        # Line should show 1:05.50 to 1:10.25
        assert "0:01:05.50" in result
        assert "0:01:10.25" in result

    def test_dialogue_line_structure(self, single_word):
        """Test that Dialogue line has correct format."""
        result = generate_karaoke_ass(single_word)

        # Check Format line
        assert "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text" in result

        # Check Dialogue has 10 fields
        lines = result.split("\n")
        dialogue_lines = [l for l in lines if l.startswith("Dialogue:")]
        assert len(dialogue_lines) == 1

        # Parse dialogue
        dialogue = dialogue_lines[0].replace("Dialogue: ", "")
        parts = dialogue.split(",", 9)  # Split into max 10 parts
        assert len(parts) == 10


# ============================================================================
# Style Parameter Tests
# ============================================================================

class TestStyleParameters:
    """Tests for style configuration."""

    def test_custom_font_name(self, single_word):
        """Test custom font name in style."""
        result = generate_karaoke_ass(single_word, font_name="Comic Sans MS")

        assert "Comic Sans MS" in result

    def test_custom_font_size(self, single_word):
        """Test custom font size in style."""
        style = KaraokeStyle(font_size=72)
        result = generate_karaoke_ass(single_word, style=style)

        assert ",72," in result

    def test_hex_to_ass_color_conversion(self):
        """Test hex color conversion to ASS BGR format."""
        # Red in hex (#FF0000) should be &H0000FF in ASS (BGR)
        color = ASSColor.from_hex("#FF0000")
        assert color.to_ass() == "&H000000FF"

        # Green in hex (#00FF00) should be &H00FF00 in ASS
        color = ASSColor.from_hex("#00FF00")
        assert color.to_ass() == "&H0000FF00"

        # Blue in hex (#0000FF) should be &HFF0000 in ASS
        color = ASSColor.from_hex("#0000FF")
        assert color.to_ass() == "&H00FF0000"

    def test_hex_color_with_alpha(self):
        """Test hex color with alpha channel."""
        # 50% transparent red
        color = ASSColor.from_hex("#80FF0000")
        assert color.to_ass() == "&H800000FF"

    def test_primary_color(self, single_word):
        """Test primary (highlight) color in output."""
        result = generate_karaoke_ass(single_word, primary_color="#FFFF00")

        # Yellow in ASS BGR = &H0000FFFF
        assert "&H0000FFFF" in result

    def test_secondary_color(self, single_word):
        """Test secondary (pre-highlight) color."""
        style = KaraokeStyle(secondary_color="#00FF00")
        result = generate_karaoke_ass(single_word, style=style)

        # Green in ASS BGR = &H0000FF00
        assert "&H0000FF00" in result

    def test_all_alignments(self, single_word):
        """Test all 9 alignment values."""
        for alignment in ASSAlignment:
            style = KaraokeStyle(alignment=alignment)
            result = generate_karaoke_ass(single_word, style=style)
            # Alignment is field 19 (0-indexed 18)
            assert f",{alignment.value}," in result

    def test_position_override(self, single_word):
        """Test position override with \\pos tag."""
        result = generate_karaoke_ass(single_word, position=(960, 540))

        assert "\\pos(960,540)" in result

    def test_bold_style(self, single_word):
        """Test bold style flag."""
        style = KaraokeStyle(bold=True)
        result = generate_karaoke_ass(single_word, style=style)

        # Bold = -1 in style line
        assert ",-1," in result

    def test_outline_and_shadow(self, single_word):
        """Test outline and shadow values."""
        style = KaraokeStyle(outline_width=3.0, shadow_depth=2.0)
        result = generate_karaoke_ass(single_word, style=style)

        assert ",3.0," in result
        assert ",2.0," in result


# ============================================================================
# Karaoke Effect Tests
# ============================================================================

class TestKaraokeEffects:
    """Tests for different karaoke effects."""

    def test_sweep_effect(self, single_word):
        """Test sweep/fill effect (\\kf)."""
        style = KaraokeStyle(karaoke_effect=KaraokeEffect.SWEEP)
        result = generate_karaoke_ass(single_word, style=style)

        assert "{\\kf100}" in result

    def test_instant_effect(self, single_word):
        """Test instant effect (\\k)."""
        style = KaraokeStyle(karaoke_effect=KaraokeEffect.INSTANT)
        result = generate_karaoke_ass(single_word, style=style)

        assert "{\\k100}" in result

    def test_fill_effect(self, single_word):
        """Test fill effect (\\K)."""
        style = KaraokeStyle(karaoke_effect=KaraokeEffect.FILL)
        result = generate_karaoke_ass(single_word, style=style)

        assert "{\\K100}" in result

    def test_outline_effect(self, single_word):
        """Test outline effect (\\ko)."""
        style = KaraokeStyle(karaoke_effect=KaraokeEffect.OUTLINE)
        result = generate_karaoke_ass(single_word, style=style)

        assert "{\\ko100}" in result


# ============================================================================
# Edge Case Tests
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_empty_word_list_raises_error(self):
        """Test that empty word list raises EmptyInputError."""
        with pytest.raises(EmptyInputError):
            generate_karaoke_ass([])

    def test_negative_start_time_raises_error(self):
        """Test that negative start time raises error."""
        words = [{"word": "test", "start": -1.0, "end": 1.0}]

        with pytest.raises(InvalidTimingError):
            generate_karaoke_ass(words)

    def test_negative_end_time_raises_error(self):
        """Test that negative end time raises error."""
        words = [{"word": "test", "start": 0.0, "end": -1.0}]

        with pytest.raises(InvalidTimingError):
            generate_karaoke_ass(words)

    def test_end_before_start_raises_error(self):
        """Test that end < start raises error."""
        words = [{"word": "test", "start": 5.0, "end": 3.0}]

        with pytest.raises(InvalidTimingError):
            generate_karaoke_ass(words)

    def test_zero_duration_word(self):
        """Test word with zero duration."""
        words = [{"word": "test", "start": 1.0, "end": 1.0}]
        config = KaraokeConfig(min_duration_cs=1)
        result = generate_karaoke_ass(words, config=config)

        # Should use minimum duration
        assert "{\\kf1}" in result

    def test_special_characters_escaping(self, special_chars_words):
        """Test special character escaping."""
        result = generate_karaoke_ass(special_chars_words)

        # Quotes should be preserved
        assert '"Hello"' in result
        # Apostrophe preserved
        assert "It's" in result
        # Backslashes should be escaped
        assert "Path\\\\to\\\\file" in result

    def test_newline_escaping(self):
        """Test newline conversion to \\N."""
        words = [{"word": "Line1\nLine2", "start": 0.0, "end": 1.0}]
        result = generate_karaoke_ass(words)

        assert "\\N" in result

    def test_unicode_support(self, unicode_words):
        """Test Unicode character support."""
        result = generate_karaoke_ass(unicode_words)

        assert "Caf\u00e9" in result
        assert "r\u00e9sum\u00e9" in result
        assert "\u4f60\u597d" in result  # Chinese characters

    def test_long_timestamp(self):
        """Test timestamps over 1 hour."""
        words = [{"word": "test", "start": 7200.0, "end": 7201.0}]
        result = generate_karaoke_ass(words)

        assert "2:00:00.00" in result
        assert "2:00:01.00" in result

    def test_fractional_centiseconds_rounding(self):
        """Test proper rounding of fractional centiseconds."""
        # 0.155s should round to 16cs (not 15)
        words = [{"word": "test", "start": 0.0, "end": 0.155}]
        result = generate_karaoke_ass(words)

        assert "{\\kf16}" in result


# ============================================================================
# Output Validation Tests
# ============================================================================

class TestOutputValidation:
    """Tests for validating ASS output structure."""

    def test_script_info_section(self, single_word):
        """Test [Script Info] section content."""
        result = generate_karaoke_ass(single_word)

        assert "[Script Info]" in result
        assert "ScriptType: v4.00+" in result
        assert "PlayResX:" in result
        assert "PlayResY:" in result

    def test_styles_section(self, single_word):
        """Test [V4+ Styles] section content."""
        result = generate_karaoke_ass(single_word)

        assert "[V4+ Styles]" in result
        assert "Format: Name, Fontname" in result
        assert "Style: Karaoke" in result

    def test_events_section(self, single_word):
        """Test [Events] section content."""
        result = generate_karaoke_ass(single_word)

        assert "[Events]" in result
        assert "Format: Layer, Start, End" in result
        assert "Dialogue:" in result

    def test_section_order(self, single_word):
        """Test sections are in correct order."""
        result = generate_karaoke_ass(single_word)

        info_pos = result.find("[Script Info]")
        styles_pos = result.find("[V4+ Styles]")
        events_pos = result.find("[Events]")

        assert info_pos < styles_pos < events_pos

    def test_utf8_bom(self, single_word):
        """Test UTF-8 BOM is included when requested."""
        config = KaraokeConfig(include_bom=True)
        result = generate_karaoke_ass(single_word, config=config)

        assert result.startswith("\ufeff")

    def test_no_utf8_bom(self, single_word):
        """Test UTF-8 BOM is excluded when not requested."""
        config = KaraokeConfig(include_bom=False)
        result = generate_karaoke_ass(single_word, config=config)

        assert not result.startswith("\ufeff")


# ============================================================================
# File Output Tests
# ============================================================================

class TestFileOutput:
    """Tests for file writing functionality."""

    def test_write_to_file(self, single_word):
        """Test writing ASS content to file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "test.ass"
            result = generate_karaoke_ass(single_word, output_path=output_path)

            assert output_path.exists()

            with open(output_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert content == result

    def test_create_parent_directories(self, single_word):
        """Test that parent directories are created."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "subdir" / "deep" / "test.ass"
            generate_karaoke_ass(single_word, output_path=output_path)

            assert output_path.exists()


# ============================================================================
# Multiline Tests
# ============================================================================

class TestMultiline:
    """Tests for multiline karaoke generation."""

    def test_multiline_generation(self):
        """Test generating multiple dialogue lines."""
        segments = [
            [
                {"word": "First ", "start": 0.0, "end": 0.5},
                {"word": "line", "start": 0.5, "end": 1.0},
            ],
            [
                {"word": "Second ", "start": 2.0, "end": 2.5},
                {"word": "line", "start": 2.5, "end": 3.0},
            ],
        ]

        result = generate_karaoke_ass_multiline(segments)

        # Should have two Dialogue lines
        dialogue_count = result.count("Dialogue:")
        assert dialogue_count == 2

    def test_multiline_empty_segment(self):
        """Test that empty segments are skipped."""
        segments = [
            [{"word": "test", "start": 0.0, "end": 1.0}],
            [],  # Empty segment
            [{"word": "test2", "start": 2.0, "end": 3.0}],
        ]

        result = generate_karaoke_ass_multiline(segments)

        dialogue_count = result.count("Dialogue:")
        assert dialogue_count == 2  # Only 2, not 3


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
    """Tests for utility functions."""

    def test_seconds_to_ass_time(self):
        """Test time conversion."""
        assert _seconds_to_ass_time(0) == "0:00:00.00"
        assert _seconds_to_ass_time(65.5) == "0:01:05.50"
        assert _seconds_to_ass_time(3723.25) == "1:02:03.25"
        assert _seconds_to_ass_time(0.99) == "0:00:00.99"

    def test_seconds_to_ass_time_edge_cases(self):
        """Test time conversion edge cases."""
        # Very small time
        assert _seconds_to_ass_time(0.01) == "0:00:00.01"
        # Rounding to 100cs should increment seconds
        assert _seconds_to_ass_time(0.999) == "0:00:01.00"

    def test_escape_ass_text(self):
        """Test text escaping."""
        assert _escape_ass_text("hello") == "hello"
        assert _escape_ass_text("line1\nline2") == "line1\\N"
        assert _escape_ass_text("path\\file") == "path\\\\file"


# ============================================================================
# Input Format Compatibility Tests
# ============================================================================

class TestInputFormatCompatibility:
    """Tests for different input formats."""

    def test_dict_with_word_key(self):
        """Test dict input with 'word' key."""
        words = [{"word": "test", "start": 0.0, "end": 1.0}]
        result = generate_karaoke_ass(words)
        assert "test" in result

    def test_dict_with_text_key(self):
        """Test dict input with 'text' key."""
        words = [{"text": "test", "start": 0.0, "end": 1.0}]
        result = generate_karaoke_ass(words)
        assert "test" in result

    def test_dict_with_start_time_key(self):
        """Test dict input with 'start_time' key."""
        words = [{"word": "test", "start_time": 0.0, "end_time": 1.0}]
        result = generate_karaoke_ass(words)
        assert "{\\kf100}" in result


# ============================================================================
# ASSColor Tests
# ============================================================================

class TestASSColor:
    """Tests for ASSColor class."""

    def test_from_hex_6_digit(self):
        """Test parsing 6-digit hex color."""
        color = ASSColor.from_hex("#FFFFFF")
        assert color.r == 255
        assert color.g == 255
        assert color.b == 255
        assert color.a == 0

    def test_from_hex_8_digit(self):
        """Test parsing 8-digit hex color with alpha."""
        color = ASSColor.from_hex("#80FF0000")
        assert color.a == 128
        assert color.r == 255
        assert color.g == 0
        assert color.b == 0

    def test_from_hex_without_hash(self):
        """Test parsing hex without # prefix."""
        color = ASSColor.from_hex("FF0000")
        assert color.r == 255

    def test_from_hex_lowercase(self):
        """Test parsing lowercase hex."""
        color = ASSColor.from_hex("#ff00ff")
        assert color.r == 255
        assert color.g == 0
        assert color.b == 255

    def test_from_rgb(self):
        """Test creating from RGB values."""
        color = ASSColor.from_rgb(255, 128, 64)
        assert color.r == 255
        assert color.g == 128
        assert color.b == 64

    def test_to_ass_format(self):
        """Test conversion to ASS color format."""
        color = ASSColor(r=255, g=128, b=64, a=0)
        assert color.to_ass() == "&H004080FF"

    def test_invalid_hex_raises_error(self):
        """Test invalid hex format raises error."""
        with pytest.raises(ValueError):
            ASSColor.from_hex("#GGG")

        with pytest.raises(ValueError):
            ASSColor.from_hex("#12345")  # 5 digits


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
