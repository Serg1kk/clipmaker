"""
Karaoke ASS Subtitle Generator

Generates ASS (Advanced SubStation Alpha) subtitle files with karaoke timing tags
for word-by-word synchronized highlighting.

Usage:
    from backend.services.karaoke_generator import generate_karaoke_ass, KaraokeStyle

    words = [
        {"word": "Hello", "start": 0.0, "end": 0.5},
        {"word": "world", "start": 0.5, "end": 1.2},
    ]

    style = KaraokeStyle(
        font_name="Arial",
        font_size=64,
        primary_color="#FFFF00",  # Yellow highlight
        secondary_color="#FFFFFF",  # White before highlight
    )

    ass_content = generate_karaoke_ass(words, style=style, output_path="output.ass")
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Union, Optional, Sequence, List, Dict, Any
import io


class ASSAlignment(Enum):
    """ASS numpad-style alignment values."""
    BOTTOM_LEFT = 1
    BOTTOM_CENTER = 2
    BOTTOM_RIGHT = 3
    MIDDLE_LEFT = 4
    MIDDLE_CENTER = 5
    MIDDLE_RIGHT = 6
    TOP_LEFT = 7
    TOP_CENTER = 8
    TOP_RIGHT = 9


class KaraokeEffect(Enum):
    """Karaoke highlight effect types."""
    INSTANT = "k"       # Instant color change
    SWEEP = "kf"        # Left-to-right sweep fill
    FILL = "K"          # Alias for sweep (capital K)
    OUTLINE = "ko"      # Outline highlight


@dataclass
class ASSColor:
    """ASS-compatible color representation."""
    r: int  # 0-255 Red
    g: int  # 0-255 Green
    b: int  # 0-255 Blue
    a: int = 0  # 0-255 Alpha (0 = opaque, 255 = transparent)

    @classmethod
    def from_hex(cls, hex_color: str) -> "ASSColor":
        """
        Parse hex color like '#FFFFFF' or '#80FFFFFF' (with alpha).

        Args:
            hex_color: Color in format '#RRGGBB' or '#AARRGGBB'

        Returns:
            ASSColor instance

        Raises:
            ValueError: If hex format is invalid
        """
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            return cls(r=r, g=g, b=b, a=0)
        elif len(hex_color) == 8:
            a = int(hex_color[0:2], 16)
            r = int(hex_color[2:4], 16)
            g = int(hex_color[4:6], 16)
            b = int(hex_color[6:8], 16)
            return cls(r=r, g=g, b=b, a=a)
        raise ValueError(f"Invalid hex color format: #{hex_color}")

    @classmethod
    def from_rgb(cls, r: int, g: int, b: int, a: int = 0) -> "ASSColor":
        """Create color from RGB values."""
        return cls(r=r, g=g, b=b, a=a)

    def to_ass(self) -> str:
        """
        Convert to ASS color format: &HAABBGGRR

        Note: ASS uses BGR order (opposite of HTML/CSS RGB)
        """
        return f"&H{self.a:02X}{self.b:02X}{self.g:02X}{self.r:02X}"


def _parse_color(color: Union[str, ASSColor, tuple]) -> ASSColor:
    """Convert various color formats to ASSColor."""
    if isinstance(color, ASSColor):
        return color
    elif isinstance(color, str):
        return ASSColor.from_hex(color)
    elif isinstance(color, tuple):
        if len(color) == 3:
            return ASSColor.from_rgb(*color)
        elif len(color) == 4:
            return ASSColor.from_rgb(*color)
    raise ValueError(f"Invalid color format: {color}")


@dataclass
class KaraokeStyle:
    """
    Complete style configuration for karaoke subtitles.

    Attributes:
        font_name: Font family name (default: "Arial")
        font_size: Font size in pixels (default: 48)
        bold: Bold text (default: False)
        italic: Italic text (default: False)
        underline: Underlined text (default: False)
        strikeout: Strikethrough text (default: False)

        primary_color: Text fill color - shown AFTER karaoke highlight
        secondary_color: Karaoke color - shown BEFORE highlight
        outline_color: Text border/outline color
        back_color: Shadow color

        outline_width: Outline thickness in pixels (default: 2.0)
        shadow_depth: Shadow distance in pixels (default: 1.0)

        alignment: Numpad-style position (default: BOTTOM_CENTER)
        margin_left: Left margin in pixels (default: 10)
        margin_right: Right margin in pixels (default: 10)
        margin_vertical: Vertical margin in pixels (default: 30)

        karaoke_effect: Type of karaoke effect (default: SWEEP)

        scale_x: Horizontal scale percentage (default: 100.0)
        scale_y: Vertical scale percentage (default: 100.0)
        spacing: Extra letter spacing (default: 0.0)
        angle: Rotation angle in degrees (default: 0.0)
        border_style: 1 = outline+shadow, 3 = opaque box (default: 1)
        encoding: Character encoding (default: 1)
    """
    # Font settings
    font_name: str = "Arial"
    font_size: int = 48
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikeout: bool = False

    # Colors - NOTE: primary = highlighted (sung), secondary = unhighlighted (not yet sung)
    primary_color: Union[str, ASSColor, tuple] = "#FFFF00"      # Yellow - highlighted text
    secondary_color: Union[str, ASSColor, tuple] = "#FFFFFF"    # White - before highlight
    outline_color: Union[str, ASSColor, tuple] = "#000000"      # Black outline
    back_color: Union[str, ASSColor, tuple] = "#000000"         # Black shadow

    # Border and shadow
    outline_width: float = 2.0
    shadow_depth: float = 1.0

    # Positioning
    alignment: ASSAlignment = ASSAlignment.BOTTOM_CENTER
    margin_left: int = 10
    margin_right: int = 10
    margin_vertical: int = 30

    # Position override (x, y) - if set, uses \pos tag
    position: Optional[tuple] = None

    # Karaoke-specific
    karaoke_effect: KaraokeEffect = KaraokeEffect.SWEEP

    # Scale (percentage)
    scale_x: float = 100.0
    scale_y: float = 100.0

    # Spacing
    spacing: float = 0.0
    angle: float = 0.0

    # Border style: 1 = outline + shadow, 3 = opaque box
    border_style: int = 1

    # Character encoding (1 = default)
    encoding: int = 1


@dataclass
class KaraokeConfig:
    """Configuration for the karaoke generator."""
    # Video dimensions (PlayResX/PlayResY)
    video_width: int = 1920
    video_height: int = 1080

    # Metadata
    title: str = "Karaoke Subtitles"

    # Style name used in Events
    style_name: str = "Karaoke"

    # Event layer (higher = on top)
    layer: int = 0

    # Minimum duration for karaoke tag (centiseconds)
    min_duration_cs: int = 1

    # Whether to include UTF-8 BOM
    include_bom: bool = True

    # Line ending style
    line_ending: str = "\n"  # Use "\r\n" for strict Windows compatibility


# Type alias for word timestamp input
WordTimestamp = Union[Dict[str, Any], Any]


class KaraokeGenerationError(Exception):
    """Base exception for karaoke generation errors."""
    pass


class InvalidTimingError(KaraokeGenerationError):
    """Raised when word timing data is invalid."""
    pass


class EmptyInputError(KaraokeGenerationError):
    """Raised when no words are provided."""
    pass


def _seconds_to_ass_time(total_seconds: float) -> str:
    """
    Convert seconds to ASS timestamp format: H:MM:SS.cc

    Args:
        total_seconds: Time in seconds (float)

    Returns:
        ASS timestamp string (e.g., "0:01:23.45")
    """
    if total_seconds < 0:
        raise InvalidTimingError(f"Negative timestamp: {total_seconds}")

    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    centiseconds = int(round((total_seconds % 1) * 100))

    # Handle edge case where rounding gives 100 centiseconds
    if centiseconds >= 100:
        centiseconds = 0
        seconds += 1
        if seconds >= 60:
            seconds = 0
            minutes += 1
            if minutes >= 60:
                minutes = 0
                hours += 1

    return f"{hours}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"


def _get_word_text(word: WordTimestamp) -> str:
    """Extract word text from various input formats."""
    if isinstance(word, dict):
        return word.get("word", word.get("text", ""))
    elif hasattr(word, "word"):
        return word.word
    elif hasattr(word, "text"):
        return word.text
    return str(word)


def _get_word_start(word: WordTimestamp) -> float:
    """Extract start time from various input formats."""
    if isinstance(word, dict):
        return float(word.get("start", word.get("start_time", 0)))
    elif hasattr(word, "start"):
        return float(word.start)
    elif hasattr(word, "start_time"):
        return float(word.start_time)
    return 0.0


def _get_word_end(word: WordTimestamp) -> float:
    """Extract end time from various input formats."""
    if isinstance(word, dict):
        return float(word.get("end", word.get("end_time", 0)))
    elif hasattr(word, "end"):
        return float(word.end)
    elif hasattr(word, "end_time"):
        return float(word.end_time)
    return 0.0


def _escape_ass_text(text: str) -> str:
    """
    Escape special characters for ASS format.

    Args:
        text: Raw text to escape

    Returns:
        Escaped text safe for ASS
    """
    # Escape backslashes first
    text = text.replace("\\", "\\\\")
    # Convert newlines to ASS hard line break
    text = text.replace("\n", "\\N")
    return text


def _generate_script_info(config: KaraokeConfig) -> str:
    """Generate the [Script Info] section."""
    lines = [
        "[Script Info]",
        f"Title: {config.title}",
        "ScriptType: v4.00+",
        f"PlayResX: {config.video_width}",
        f"PlayResY: {config.video_height}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
    ]
    return config.line_ending.join(lines)


def _generate_style_line(style: KaraokeStyle, style_name: str) -> str:
    """
    Generate a single Style line for the [V4+ Styles] section.

    Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,
            BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing,
            Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    """
    # Parse colors
    primary = _parse_color(style.primary_color).to_ass()
    secondary = _parse_color(style.secondary_color).to_ass()
    outline = _parse_color(style.outline_color).to_ass()
    back = _parse_color(style.back_color).to_ass()

    # Boolean to ASS format (-1 = true, 0 = false)
    bold = -1 if style.bold else 0
    italic = -1 if style.italic else 0
    underline = -1 if style.underline else 0
    strikeout = -1 if style.strikeout else 0

    # Alignment value
    alignment = style.alignment.value if isinstance(style.alignment, ASSAlignment) else style.alignment

    style_parts = [
        style_name,
        style.font_name,
        str(style.font_size),
        primary,
        secondary,
        outline,
        back,
        str(bold),
        str(italic),
        str(underline),
        str(strikeout),
        str(style.scale_x),
        str(style.scale_y),
        str(style.spacing),
        str(style.angle),
        str(style.border_style),
        str(style.outline_width),
        str(style.shadow_depth),
        str(alignment),
        str(style.margin_left),
        str(style.margin_right),
        str(style.margin_vertical),
        str(style.encoding),
    ]

    return "Style: " + ",".join(style_parts)


def _generate_styles_section(style: KaraokeStyle, style_name: str, line_ending: str) -> str:
    """Generate the [V4+ Styles] section."""
    format_line = "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"

    lines = [
        "[V4+ Styles]",
        format_line,
        _generate_style_line(style, style_name),
    ]
    return line_ending.join(lines)


def _generate_dialogue_line(
    start_time: float,
    end_time: float,
    text: str,
    style_name: str,
    layer: int = 0,
) -> str:
    """
    Generate a single Dialogue line for the [Events] section.

    Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    """
    start_str = _seconds_to_ass_time(start_time)
    end_str = _seconds_to_ass_time(end_time)

    parts = [
        str(layer),
        start_str,
        end_str,
        style_name,
        "",  # Name (speaker)
        "0",  # MarginL override
        "0",  # MarginR override
        "0",  # MarginV override
        "",  # Effect
        text,
    ]

    return "Dialogue: " + ",".join(parts)


def _generate_karaoke_text(
    words: Sequence[WordTimestamp],
    style: KaraokeStyle,
    config: KaraokeConfig,
) -> str:
    """
    Generate karaoke text with timing tags for a sequence of words.

    Args:
        words: Sequence of word timestamp objects
        style: Karaoke style configuration
        config: Generator configuration

    Returns:
        Text with karaoke tags (e.g., "{\\kf50}Hello {\\kf30}world")
    """
    karaoke_tag = style.karaoke_effect.value
    parts = []

    # Add position override if specified
    position_tag = ""
    if style.position:
        x, y = style.position
        position_tag = f"\\pos({x},{y})"

    for i, word in enumerate(words):
        word_text = _get_word_text(word)
        start = _get_word_start(word)
        end = _get_word_end(word)

        # Validate timing
        if start < 0:
            raise InvalidTimingError(f"Word '{word_text}' has negative start time: {start}")
        if end < 0:
            raise InvalidTimingError(f"Word '{word_text}' has negative end time: {end}")
        if end < start:
            raise InvalidTimingError(f"Word '{word_text}' has end time ({end}) before start time ({start})")

        # Calculate duration in centiseconds
        duration_cs = max(config.min_duration_cs, int(round((end - start) * 100)))

        # Escape special characters
        escaped_text = _escape_ass_text(word_text)

        # Build karaoke tag - include position tag only for first word
        if i == 0 and position_tag:
            parts.append(f"{{\\{karaoke_tag}{duration_cs}{position_tag}}}{escaped_text}")
        else:
            parts.append(f"{{\\{karaoke_tag}{duration_cs}}}{escaped_text}")

    return "".join(parts)


def generate_karaoke_ass(
    words: Sequence[WordTimestamp],
    *,
    style: Optional[KaraokeStyle] = None,
    config: Optional[KaraokeConfig] = None,
    output_path: Optional[Union[str, Path]] = None,
    # Convenience parameters that override config
    font_name: Optional[str] = None,
    font_size: Optional[int] = None,
    primary_color: Optional[Union[str, tuple]] = None,
    secondary_color: Optional[Union[str, tuple]] = None,
    outline_color: Optional[Union[str, tuple]] = None,
    position: Optional[tuple] = None,
    alignment: Optional[Union[ASSAlignment, int]] = None,
    video_width: Optional[int] = None,
    video_height: Optional[int] = None,
) -> str:
    """
    Generate karaoke-style ASS subtitles from word-level timestamps.

    Creates an ASS file with karaoke timing tags that highlight words
    one at a time as they are spoken, synchronized with audio.

    Args:
        words: Sequence of word timing objects. Each must have:
            - word/text (str): The word text
            - start/start_time (float): Start time in seconds
            - end/end_time (float): End time in seconds

        style: Complete style configuration. If None, uses defaults.

        config: Generator configuration. If None, uses defaults.

        output_path: Optional path to write the ASS file.

        font_name: Override font name (convenience parameter)
        font_size: Override font size (convenience parameter)
        primary_color: Override highlight color (convenience parameter)
        secondary_color: Override pre-highlight color (convenience parameter)
        outline_color: Override outline color (convenience parameter)
        position: Override position as (x, y) tuple (convenience parameter)
        alignment: Override alignment (convenience parameter)
        video_width: Override video width (convenience parameter)
        video_height: Override video height (convenience parameter)

    Returns:
        str: Complete ASS file content

    Raises:
        EmptyInputError: If words sequence is empty
        InvalidTimingError: If word timing is invalid
        IOError: If output_path cannot be written

    Example:
        >>> words = [
        ...     {"word": "Hello ", "start": 0.0, "end": 0.5},
        ...     {"word": "world", "start": 0.5, "end": 1.2},
        ... ]
        >>> ass = generate_karaoke_ass(
        ...     words,
        ...     font_size=64,
        ...     primary_color="#FFFF00",
        ...     output_path="karaoke.ass"
        ... )
    """
    # Initialize defaults
    if style is None:
        style = KaraokeStyle()
    if config is None:
        config = KaraokeConfig()

    # Apply convenience parameter overrides to style
    if font_name is not None:
        style.font_name = font_name
    if font_size is not None:
        style.font_size = font_size
    if primary_color is not None:
        style.primary_color = primary_color
    if secondary_color is not None:
        style.secondary_color = secondary_color
    if outline_color is not None:
        style.outline_color = outline_color
    if position is not None:
        style.position = position
    if alignment is not None:
        if isinstance(alignment, int):
            style.alignment = ASSAlignment(alignment)
        else:
            style.alignment = alignment

    # Apply convenience parameter overrides to config
    if video_width is not None:
        config.video_width = video_width
    if video_height is not None:
        config.video_height = video_height

    # Convert words to list for multiple passes
    words_list = list(words)

    # Validate input
    if not words_list:
        raise EmptyInputError("No words provided for karaoke generation")

    # Build ASS file content
    output = io.StringIO()
    line_ending = config.line_ending

    # UTF-8 BOM if requested
    if config.include_bom:
        output.write("\ufeff")

    # Script Info section
    output.write(_generate_script_info(config))
    output.write(line_ending)
    output.write(line_ending)

    # Styles section
    output.write(_generate_styles_section(style, config.style_name, line_ending))
    output.write(line_ending)
    output.write(line_ending)

    # Events section
    output.write("[Events]")
    output.write(line_ending)
    output.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")
    output.write(line_ending)

    # Calculate line timing (start of first word to end of last word)
    line_start = _get_word_start(words_list[0])
    line_end = _get_word_end(words_list[-1])

    # Generate karaoke text with timing tags
    karaoke_text = _generate_karaoke_text(words_list, style, config)

    # Generate dialogue line
    dialogue = _generate_dialogue_line(
        start_time=line_start,
        end_time=line_end,
        text=karaoke_text,
        style_name=config.style_name,
        layer=config.layer,
    )
    output.write(dialogue)
    output.write(line_ending)

    # Get final content
    ass_content = output.getvalue()

    # Write to file if path provided
    if output_path is not None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(ass_content)

    return ass_content


def generate_karaoke_ass_multiline(
    segments: Sequence[Sequence[WordTimestamp]],
    *,
    style: Optional[KaraokeStyle] = None,
    config: Optional[KaraokeConfig] = None,
    output_path: Optional[Union[str, Path]] = None,
    **kwargs,
) -> str:
    """
    Generate karaoke ASS with multiple dialogue lines (one per segment).

    Use this when you want each segment/sentence as a separate subtitle line.

    Args:
        segments: Sequence of word sequences, each becomes one dialogue line
        style: Style configuration
        config: Generator configuration
        output_path: Optional output file path
        **kwargs: Additional style/config overrides

    Returns:
        str: Complete ASS file content
    """
    # Initialize defaults
    if style is None:
        style = KaraokeStyle()
    if config is None:
        config = KaraokeConfig()

    # Apply kwargs overrides
    for key, value in kwargs.items():
        if hasattr(style, key):
            setattr(style, key, value)
        elif hasattr(config, key):
            setattr(config, key, value)

    # Build ASS file
    output = io.StringIO()
    line_ending = config.line_ending

    if config.include_bom:
        output.write("\ufeff")

    output.write(_generate_script_info(config))
    output.write(line_ending)
    output.write(line_ending)

    output.write(_generate_styles_section(style, config.style_name, line_ending))
    output.write(line_ending)
    output.write(line_ending)

    output.write("[Events]")
    output.write(line_ending)
    output.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")
    output.write(line_ending)

    # Generate dialogue for each segment
    for segment_words in segments:
        words_list = list(segment_words)
        if not words_list:
            continue

        line_start = _get_word_start(words_list[0])
        line_end = _get_word_end(words_list[-1])
        karaoke_text = _generate_karaoke_text(words_list, style, config)

        dialogue = _generate_dialogue_line(
            start_time=line_start,
            end_time=line_end,
            text=karaoke_text,
            style_name=config.style_name,
            layer=config.layer,
        )
        output.write(dialogue)
        output.write(line_ending)

    ass_content = output.getvalue()

    if output_path is not None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(ass_content)

    return ass_content


def generate_word_by_word_ass(
    words: Sequence[WordTimestamp],
    *,
    style: Optional[KaraokeStyle] = None,
    config: Optional[KaraokeConfig] = None,
    output_path: Optional[Union[str, Path]] = None,
    **kwargs,
) -> str:
    """
    Generate ASS subtitles with one word at a time (word-by-word display).

    Unlike karaoke mode which shows all words with highlight animation,
    this mode shows each word individually during its time range,
    similar to TikTok/Instagram Reels style.

    Args:
        words: Sequence of word timing objects
        style: Style configuration
        config: Generator configuration
        output_path: Optional output file path
        **kwargs: Additional style/config overrides

    Returns:
        str: Complete ASS file content
    """
    # Initialize defaults
    if style is None:
        style = KaraokeStyle()
    if config is None:
        config = KaraokeConfig()

    # Apply kwargs overrides
    for key, value in kwargs.items():
        if hasattr(style, key):
            setattr(style, key, value)
        elif hasattr(config, key):
            setattr(config, key, value)

    # Convert to list
    words_list = list(words)

    if not words_list:
        raise EmptyInputError("No words provided for subtitle generation")

    # Build ASS file
    output = io.StringIO()
    line_ending = config.line_ending

    if config.include_bom:
        output.write("\ufeff")

    # Script Info section
    output.write(_generate_script_info(config))
    output.write(line_ending)
    output.write(line_ending)

    # Styles section - use primary_color as the main text color (no karaoke animation)
    output.write(_generate_styles_section(style, config.style_name, line_ending))
    output.write(line_ending)
    output.write(line_ending)

    # Events section - one Dialogue per word
    output.write("[Events]")
    output.write(line_ending)
    output.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")
    output.write(line_ending)

    # Generate one dialogue line per word
    for word in words_list:
        word_text = _get_word_text(word)
        start = _get_word_start(word)
        end = _get_word_end(word)

        # Skip empty words
        if not word_text.strip():
            continue

        # Escape text
        escaped_text = _escape_ass_text(word_text.strip())

        # Generate dialogue for this word
        dialogue = _generate_dialogue_line(
            start_time=start,
            end_time=end,
            text=escaped_text,
            style_name=config.style_name,
            layer=config.layer,
        )
        output.write(dialogue)
        output.write(line_ending)

    # Get final content
    ass_content = output.getvalue()

    # Write to file if path provided
    if output_path is not None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(ass_content)

    return ass_content


# Convenience aliases
Alignment = ASSAlignment
Effect = KaraokeEffect
Color = ASSColor
Style = KaraokeStyle
Config = KaraokeConfig
