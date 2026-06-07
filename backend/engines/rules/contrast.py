"""WCAG contrast analysis — pure math, no AI, no hallucinations."""
import math
from schemas import Finding, Severity, UIElement, EvidenceDetail, FindingLocation, Recommendation


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)


def wcag_relative_luminance(hex_color: str) -> float:
    """Pure WCAG 2.1 formula."""
    r, g, b = hex_to_rgb(hex_color)
    channels = []
    for c in [r, g, b]:
        c = c / 255.0
        if c <= 0.03928:
            channels.append(c / 12.92)
        else:
            channels.append(((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(color1: str, color2: str) -> float:
    try:
        l1 = wcag_relative_luminance(color1)
        l2 = wcag_relative_luminance(color2)
        lighter = max(l1, l2)
        darker = min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    except Exception:
        return 1.0


def find_minimum_passing_color(text_color: str, bg_color: str, target_ratio: float = 4.5) -> str:
    """Binary search: find darkest version of text_color that passes target_ratio."""
    r, g, b = hex_to_rgb(text_color)
    bg_lum = wcag_relative_luminance(bg_color)

    # Try darkening the color
    for step in range(0, 256, 4):
        dark_r = max(0, r - step)
        dark_g = max(0, g - step)
        dark_b = max(0, b - step)
        candidate = f"#{dark_r:02x}{dark_g:02x}{dark_b:02x}"
        if contrast_ratio(candidate, bg_color) >= target_ratio:
            return candidate

    return "#000000"


def analyze_contrast(element: UIElement, run_id: str = "") -> Finding | None:
    if not element.colors.text or not element.colors.background:
        return None

    try:
        ratio = contrast_ratio(element.colors.text, element.colors.background)
    except Exception:
        return None

    font_size = element.font.size_px or 16
    is_large_text = font_size >= 18 or (font_size >= 14 and (element.font.weight or 400) >= 700)
    threshold = 3.0 if is_large_text else 4.5

    if ratio >= threshold:
        return None

    severity = Severity.critical if ratio < 2.5 else Severity.high
    suggested = find_minimum_passing_color(element.colors.text, element.colors.background, threshold)

    return Finding(
        finding_id=f"CONTRAST_{element.id}",
        run_id=run_id,
        principle="Contrast",
        severity=severity,
        location=FindingLocation(
            description=f"{element.type or 'element'} ({element.semantic_role or 'unknown role'})",
            element_id=element.id,
            bbox=element.bbox,
        ),
        evidence=EvidenceDetail(
            measured_value=f"{ratio:.2f}:1",
            required_value=f"{threshold}:1 (WCAG AA)",
            text_color=element.colors.text,
            background_color=element.colors.background,
            measurement_method="wcag_relative_luminance_formula",
        ),
        recommendation=Recommendation(
            action="Increase text-background contrast to meet WCAG AA",
            current_css=f"color: {element.colors.text};",
            suggested_css=f"color: {suggested};",
            result=f"Achieves {contrast_ratio(suggested, element.colors.background):.2f}:1 — WCAG AA {'PASS' if contrast_ratio(suggested, element.colors.background) >= threshold else 'still failing'}",
        ),
        confidence=97,
    )
