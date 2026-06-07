"""Confidence scoring engine — modifiers applied on top of principle base scores."""
from schemas import Finding

CONFIDENCE_BASE = {
    "Contrast": 97,
    "Spacing": 93,
    "Alignment": 90,
    "Visual Hierarchy": 74,
    "Consistency": 79,
    "Regression": 85,
}

MODIFIERS = {
    "element_partially_occluded": -8,
    "color_gradient_background": -12,
    "font_size_small": -5,
    "multiple_instances_corroborate": +10,
    "pixel_measurement_precise": +5,
    "gemini_agrees": +8,
    "before_after_hex_diff": +12,
    "dynamic_region_detected": -20,
    "opencv_detected": +5,
    "gemini_only": -10,
}


def calculate_confidence(finding: Finding, context: dict | None = None) -> int:
    base = CONFIDENCE_BASE.get(finding.principle, 70)
    if context:
        for modifier, delta in MODIFIERS.items():
            if context.get(modifier):
                base += delta
    # Penalize if not anchored
    if not finding.anchored:
        base -= 15
    # Reward gemini+opencv source
    if finding.location.element_id and "opencv" in (finding.evidence.measurement_method or ""):
        base += MODIFIERS["pixel_measurement_precise"]
    return max(0, min(100, base))


def apply_confidence(findings: list[Finding], context: dict | None = None) -> list[Finding]:
    for f in findings:
        f.confidence = calculate_confidence(f, context)
    return findings
