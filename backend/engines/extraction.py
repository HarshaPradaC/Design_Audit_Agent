"""Hybrid extraction: OpenCV measures, Gemini understands. Merge into UIState."""
import json
import uuid
import re
from pathlib import Path
from schemas import UIElement, UIState, BBox, Colors, Font, Spacing, PageMetadata
from engines.opencv_extractor import extract_elements_opencv
from engines.color_sampler import sample_text_and_background, image_to_numpy
import gemini_client
from prompts.extraction import EXTRACTION_PROMPT


def extract_elements_gemini(image_bytes: bytes) -> list[dict]:
    """Call Gemini Vision to get semantic element info."""
    try:
        raw = gemini_client.ask_vision(image_bytes, EXTRACTION_PROMPT)
        # Strip markdown fences if present
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        raw = raw.strip()
        data = json.loads(raw)
        return data.get("elements", [])
    except Exception as e:
        print(f"[extraction] Gemini extraction failed: {e}")
        return []


def _iou(bbox1: BBox, bbox2_dict: dict) -> float:
    """Intersection over Union between a BBox and a dict with approximate_bbox."""
    b2 = bbox2_dict.get("approximate_bbox", {})
    if not b2:
        return 0.0

    ax1, ay1 = bbox1.x, bbox1.y
    ax2, ay2 = bbox1.x + bbox1.width, bbox1.y + bbox1.height
    bx1, by1 = b2.get("x", 0), b2.get("y", 0)
    bx2, by2 = bx1 + b2.get("width", 0), by1 + b2.get("height", 0)

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
        return 0.0

    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
    a_area = (ax2 - ax1) * (ay2 - ay1)
    b_area = (bx2 - bx1) * (by2 - by1)
    union_area = a_area + b_area - inter_area

    return inter_area / union_area if union_area > 0 else 0.0


def merge_extraction(
    opencv_elements: list[UIElement],
    gemini_elements: list[dict],
) -> list[UIElement]:
    """
    Merge OpenCV (precise bbox + colors) with Gemini (semantic type + role).
    OpenCV takes precedence for measurements. Gemini provides meaning.
    """
    merged = []
    used_gemini = set()

    for oc_el in opencv_elements:
        best_match = None
        best_iou = 0.4  # Minimum threshold

        for j, gem_el in enumerate(gemini_elements):
            if j in used_gemini:
                continue
            score = _iou(oc_el.bbox, gem_el)
            if score > best_iou:
                best_iou = score
                best_match = (j, gem_el)

        if best_match:
            j, gem = best_match
            used_gemini.add(j)

            # Parse font size from Gemini if available
            font_size = None
            if isinstance(gem.get("font_size"), (int, float)):
                font_size = float(gem["font_size"])

            merged_el = UIElement(
                id=oc_el.id,
                type=gem.get("type") or oc_el.type,
                semantic_role=gem.get("semantic_role"),
                text=gem.get("text_content") or "",
                bbox=oc_el.bbox,  # Trust OpenCV for bbox
                colors=oc_el.colors,  # Trust OpenCV for colors
                font=Font(
                    size_px=font_size,
                    weight=gem.get("font_weight"),
                    family=gem.get("font_family"),
                ),
                border_radius_px=oc_el.border_radius_px,
                hierarchy_level=gem.get("hierarchy_level"),
                visual_weight=gem.get("visual_weight"),
                source="opencv+gemini-vision",
                extraction_confidence=min(
                    (oc_el.extraction_confidence or 85),
                    int(best_iou * 100),
                ) + 5,
            )
            merged.append(merged_el)
        else:
            # No Gemini match — keep OpenCV-only element
            merged.append(oc_el)

    # Add Gemini-only elements (things OpenCV missed)
    for j, gem_el in enumerate(gemini_elements):
        if j in used_gemini:
            continue
        bbox_dict = gem_el.get("approximate_bbox", {})
        if not bbox_dict:
            continue
        merged.append(UIElement(
            id=f"gem_{j:04d}",
            type=gem_el.get("type"),
            semantic_role=gem_el.get("semantic_role"),
            text=gem_el.get("text_content") or "",
            bbox=BBox(
                x=bbox_dict.get("x", 0),
                y=bbox_dict.get("y", 0),
                width=bbox_dict.get("width", 10),
                height=bbox_dict.get("height", 10),
            ),
            colors=Colors(),
            source="gemini-vision",
            extraction_confidence=70,
        ))

    return merged


def build_ui_state(
    image_path: str,
    image_bytes: bytes,
    run_id: str,
    page_id: str = "page",
    url: str | None = None,
    level: int = 1,
) -> UIState:
    """Full extraction pipeline: OpenCV + Gemini → merged UIState."""
    opencv_els = extract_elements_opencv(image_path)
    gemini_els = extract_elements_gemini(image_bytes)
    elements = merge_extraction(opencv_els, gemini_els)

    # Enrich colors where missing
    img_np = image_to_numpy(image_path)
    for el in elements:
        if not el.colors.text or not el.colors.background:
            try:
                t, bg = sample_text_and_background(img_np, el.bbox)
                if not el.colors.text:
                    el.colors.text = t
                if not el.colors.background:
                    el.colors.background = bg
            except Exception:
                pass

    # Determine page primary color from most common background
    primary_color = None
    bg_colors = [el.colors.background for el in elements if el.colors.background]
    if bg_colors:
        from collections import Counter
        primary_color = Counter(bg_colors).most_common(1)[0][0]

    return UIState(
        page_id=page_id,
        url=url,
        run_id=run_id,
        level=level,
        screenshot_path=image_path,
        elements=elements,
        page_metadata=PageMetadata(
            primary_color=primary_color,
            total_elements_detected=len(elements),
            extraction_model="gemini-2.0-flash+opencv",
        ),
    )
