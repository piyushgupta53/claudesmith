#!/usr/bin/env python3
"""
Extract structured text content from PowerPoint presentations.

This module provides functionality to:
- Extract all text content from PowerPoint shapes
- Preserve paragraph formatting (alignment, bullets, fonts, spacing)
- Handle nested GroupShapes recursively with correct absolute positions
- Sort shapes by visual position on slides

Usage:
    python inventory.py input.pptx output.json
"""

import argparse
import json
import platform
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.enum.text import PP_ALIGN
from pptx.shapes.base import BaseShape

# Type aliases
JsonValue = Union[str, int, float, bool, None]
ParagraphDict = Dict[str, JsonValue]
ShapeDict = Dict[str, Union[str, float, bool, List[ParagraphDict], List[str], Dict[str, Any], None]]
InventoryData = Dict[str, Dict[str, "ShapeData"]]
InventoryDict = Dict[str, Dict[str, ShapeDict]]


def main():
    """Main entry point for command-line usage."""
    parser = argparse.ArgumentParser(
        description="Extract text inventory from PowerPoint."
    )
    parser.add_argument("input", help="Input PowerPoint file (.pptx)")
    parser.add_argument("output", help="Output JSON file for inventory")
    parser.add_argument(
        "--issues-only",
        action="store_true",
        help="Include only shapes with overflow or overlap issues",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)

    try:
        print(f"Extracting text inventory from: {args.input}")
        inventory = extract_text_inventory(input_path, issues_only=args.issues_only)

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        save_inventory(inventory, output_path)

        print(f"Output saved to: {args.output}")

        total_slides = len(inventory)
        total_shapes = sum(len(shapes) for shapes in inventory.values())
        print(f"Found text in {total_slides} slides with {total_shapes} text elements")

    except Exception as e:
        print(f"Error processing presentation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@dataclass
class ShapeWithPosition:
    """A shape with its absolute position on the slide."""
    shape: BaseShape
    absolute_left: int
    absolute_top: int


class ParagraphData:
    """Data structure for paragraph properties."""

    def __init__(self, paragraph: Any):
        self.text: str = paragraph.text.strip()
        self.bullet: bool = False
        self.level: Optional[int] = None
        self.alignment: Optional[str] = None
        self.space_before: Optional[float] = None
        self.space_after: Optional[float] = None
        self.font_name: Optional[str] = None
        self.font_size: Optional[float] = None
        self.bold: Optional[bool] = None
        self.italic: Optional[bool] = None
        self.underline: Optional[bool] = None
        self.color: Optional[str] = None
        self.theme_color: Optional[str] = None
        self.line_spacing: Optional[float] = None

        # Check for bullet formatting
        if hasattr(paragraph, "_p") and paragraph._p is not None and paragraph._p.pPr is not None:
            pPr = paragraph._p.pPr
            ns = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
            if pPr.find(f"{ns}buChar") is not None or pPr.find(f"{ns}buAutoNum") is not None:
                self.bullet = True
                if hasattr(paragraph, "level"):
                    self.level = paragraph.level

        # Add alignment if not LEFT
        if hasattr(paragraph, "alignment") and paragraph.alignment is not None:
            alignment_map = {
                PP_ALIGN.CENTER: "CENTER",
                PP_ALIGN.RIGHT: "RIGHT",
                PP_ALIGN.JUSTIFY: "JUSTIFY",
            }
            if paragraph.alignment in alignment_map:
                self.alignment = alignment_map[paragraph.alignment]

        # Add spacing properties
        if hasattr(paragraph, "space_before") and paragraph.space_before:
            self.space_before = paragraph.space_before.pt
        if hasattr(paragraph, "space_after") and paragraph.space_after:
            self.space_after = paragraph.space_after.pt

        # Extract font properties from first run
        if paragraph.runs:
            first_run = paragraph.runs[0]
            if hasattr(first_run, "font"):
                font = first_run.font
                if font.name:
                    self.font_name = font.name
                if font.size:
                    self.font_size = font.size.pt
                if font.bold is not None:
                    self.bold = font.bold
                if font.italic is not None:
                    self.italic = font.italic
                if font.underline is not None:
                    self.underline = font.underline

                try:
                    if font.color.rgb:
                        self.color = str(font.color.rgb)
                except (AttributeError, TypeError):
                    try:
                        if font.color.theme_color:
                            self.theme_color = font.color.theme_color.name
                    except (AttributeError, TypeError):
                        pass

        if hasattr(paragraph, "line_spacing") and paragraph.line_spacing is not None:
            if hasattr(paragraph.line_spacing, "pt"):
                self.line_spacing = round(paragraph.line_spacing.pt, 2)
            else:
                font_size = self.font_size if self.font_size else 12.0
                self.line_spacing = round(paragraph.line_spacing * font_size, 2)

    def to_dict(self) -> ParagraphDict:
        """Convert to dictionary for JSON serialization."""
        result: ParagraphDict = {"text": self.text}

        if self.bullet:
            result["bullet"] = self.bullet
        if self.level is not None:
            result["level"] = self.level
        if self.alignment:
            result["alignment"] = self.alignment
        if self.space_before is not None:
            result["space_before"] = self.space_before
        if self.space_after is not None:
            result["space_after"] = self.space_after
        if self.font_name:
            result["font_name"] = self.font_name
        if self.font_size is not None:
            result["font_size"] = self.font_size
        if self.bold is not None:
            result["bold"] = self.bold
        if self.italic is not None:
            result["italic"] = self.italic
        if self.underline is not None:
            result["underline"] = self.underline
        if self.color:
            result["color"] = self.color
        if self.theme_color:
            result["theme_color"] = self.theme_color
        if self.line_spacing is not None:
            result["line_spacing"] = self.line_spacing

        return result


class ShapeData:
    """Data structure for shape properties."""

    @staticmethod
    def emu_to_inches(emu: int) -> float:
        return emu / 914400.0

    def __init__(
        self,
        shape: BaseShape,
        absolute_left: Optional[int] = None,
        absolute_top: Optional[int] = None,
        slide: Optional[Any] = None,
    ):
        self.shape = shape
        self.shape_id: str = ""

        # Get placeholder type if applicable
        self.placeholder_type: Optional[str] = None
        self.default_font_size: Optional[float] = None
        if hasattr(shape, "is_placeholder") and shape.is_placeholder:
            if shape.placeholder_format and shape.placeholder_format.type:
                self.placeholder_type = str(shape.placeholder_format.type).split(".")[-1].split(" ")[0]

        # Get position information
        left_emu = absolute_left if absolute_left is not None else (shape.left if hasattr(shape, "left") else 0)
        top_emu = absolute_top if absolute_top is not None else (shape.top if hasattr(shape, "top") else 0)

        self.left: float = round(self.emu_to_inches(left_emu), 2)
        self.top: float = round(self.emu_to_inches(top_emu), 2)
        self.width: float = round(self.emu_to_inches(shape.width if hasattr(shape, "width") else 0), 2)
        self.height: float = round(self.emu_to_inches(shape.height if hasattr(shape, "height") else 0), 2)

        self.frame_overflow_bottom: Optional[float] = None
        self.overlapping_shapes: Dict[str, float] = {}
        self.warnings: List[str] = []

    @property
    def paragraphs(self) -> List[ParagraphData]:
        if not self.shape or not hasattr(self.shape, "text_frame"):
            return []

        paragraphs = []
        for paragraph in self.shape.text_frame.paragraphs:
            if paragraph.text.strip():
                paragraphs.append(ParagraphData(paragraph))
        return paragraphs

    @property
    def has_any_issues(self) -> bool:
        return (
            self.frame_overflow_bottom is not None
            or len(self.overlapping_shapes) > 0
            or len(self.warnings) > 0
        )

    def to_dict(self) -> ShapeDict:
        result: ShapeDict = {
            "left": self.left,
            "top": self.top,
            "width": self.width,
            "height": self.height,
        }

        if self.placeholder_type:
            result["placeholder_type"] = self.placeholder_type

        if self.default_font_size:
            result["default_font_size"] = self.default_font_size

        if self.warnings:
            result["warnings"] = self.warnings

        result["paragraphs"] = [para.to_dict() for para in self.paragraphs]

        return result


def is_valid_shape(shape: BaseShape) -> bool:
    """Check if a shape contains meaningful text content."""
    if not hasattr(shape, "text_frame") or not shape.text_frame:
        return False

    text = shape.text_frame.text.strip()
    if not text:
        return False

    if hasattr(shape, "is_placeholder") and shape.is_placeholder:
        if shape.placeholder_format and shape.placeholder_format.type:
            placeholder_type = str(shape.placeholder_format.type).split(".")[-1].split(" ")[0]
            if placeholder_type == "SLIDE_NUMBER":
                return False
            if placeholder_type == "FOOTER" and text.isdigit():
                return False

    return True


def collect_shapes_with_absolute_positions(
    shape: BaseShape, parent_left: int = 0, parent_top: int = 0
) -> List[ShapeWithPosition]:
    """Recursively collect all shapes with valid text."""
    if hasattr(shape, "shapes"):
        result = []
        group_left = shape.left if hasattr(shape, "left") else 0
        group_top = shape.top if hasattr(shape, "top") else 0
        abs_group_left = parent_left + group_left
        abs_group_top = parent_top + group_top

        for child in shape.shapes:
            result.extend(collect_shapes_with_absolute_positions(child, abs_group_left, abs_group_top))
        return result

    if is_valid_shape(shape):
        shape_left = shape.left if hasattr(shape, "left") else 0
        shape_top = shape.top if hasattr(shape, "top") else 0

        return [ShapeWithPosition(
            shape=shape,
            absolute_left=parent_left + shape_left,
            absolute_top=parent_top + shape_top,
        )]

    return []


def sort_shapes_by_position(shapes: List[ShapeData]) -> List[ShapeData]:
    """Sort shapes by visual position (top-to-bottom, left-to-right)."""
    if not shapes:
        return shapes

    shapes = sorted(shapes, key=lambda s: (s.top, s.left))

    result = []
    row = [shapes[0]]
    row_top = shapes[0].top

    for shape in shapes[1:]:
        if abs(shape.top - row_top) <= 0.5:
            row.append(shape)
        else:
            result.extend(sorted(row, key=lambda s: s.left))
            row = [shape]
            row_top = shape.top

    result.extend(sorted(row, key=lambda s: s.left))
    return result


def extract_text_inventory(
    pptx_path: Path, prs: Optional[Any] = None, issues_only: bool = False
) -> InventoryData:
    """Extract text content from all slides."""
    if prs is None:
        prs = Presentation(str(pptx_path))
    inventory: InventoryData = {}

    for slide_idx, slide in enumerate(prs.slides):
        shapes_with_positions = []
        for shape in slide.shapes:
            shapes_with_positions.extend(collect_shapes_with_absolute_positions(shape))

        if not shapes_with_positions:
            continue

        shape_data_list = [
            ShapeData(swp.shape, swp.absolute_left, swp.absolute_top, slide)
            for swp in shapes_with_positions
        ]

        sorted_shapes = sort_shapes_by_position(shape_data_list)
        for idx, shape_data in enumerate(sorted_shapes):
            shape_data.shape_id = f"shape-{idx}"

        if issues_only:
            sorted_shapes = [sd for sd in sorted_shapes if sd.has_any_issues]

        if not sorted_shapes:
            continue

        inventory[f"slide-{slide_idx}"] = {
            shape_data.shape_id: shape_data for shape_data in sorted_shapes
        }

    return inventory


def save_inventory(inventory: InventoryData, output_path: Path) -> None:
    """Save inventory to JSON file."""
    json_inventory: InventoryDict = {}
    for slide_key, shapes in inventory.items():
        json_inventory[slide_key] = {
            shape_key: shape_data.to_dict() for shape_key, shape_data in shapes.items()
        }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(json_inventory, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
