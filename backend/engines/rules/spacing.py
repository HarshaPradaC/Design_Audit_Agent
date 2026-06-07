"""Spacing analysis — pixel gap measurement against 4px grid system."""
from schemas import Finding, Severity, UIElement, UIState, EvidenceDetail, FindingLocation, Recommendation

SPACING_SCALE = {4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}
MIN_TOUCH_GAP = 4
GRID_TOLERANCE = 3


def bbox_right(el: UIElement) -> int:
    return el.bbox.x + el.bbox.width


def bbox_bottom(el: UIElement) -> int:
    return el.bbox.y + el.bbox.height


def are_horizontally_adjacent(a: UIElement, b: UIElement) -> bool:
    a_bottom = bbox_bottom(a)
    b_bottom = bbox_bottom(b)
    overlap = min(a_bottom, b_bottom) - max(a.bbox.y, b.bbox.y)
    return overlap > min(a.bbox.height, b.bbox.height) * 0.3


def are_vertically_adjacent(a: UIElement, b: UIElement) -> bool:
    a_right = bbox_right(a)
    b_right = bbox_right(b)
    overlap = min(a_right, b_right) - max(a.bbox.x, b.bbox.x)
    return overlap > min(a.bbox.width, b.bbox.width) * 0.3


def horizontal_gap(a: UIElement, b: UIElement) -> float:
    """Gap between right edge of a and left edge of b (if b is to the right)."""
    left, right = (a, b) if a.bbox.x < b.bbox.x else (b, a)
    return max(0, right.bbox.x - bbox_right(left))


def vertical_gap(a: UIElement, b: UIElement) -> float:
    """Gap between bottom of a and top of b (if b is below)."""
    top, bottom = (a, b) if a.bbox.y < b.bbox.y else (b, a)
    return max(0, bottom.bbox.y - bbox_bottom(top))


def find_nearest_scale(gap: float) -> int:
    return min(SPACING_SCALE, key=lambda s: abs(s - gap))


def analyze_spacing(elements: list[UIElement], run_id: str = "") -> list[Finding]:
    findings = []
    seen_pairs = set()

    for i, el_a in enumerate(elements):
        for el_b in elements[i + 1:]:
            pair_key = tuple(sorted([el_a.id, el_b.id]))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            if are_horizontally_adjacent(el_a, el_b):
                gap = horizontal_gap(el_a, el_b)
                _check_gap(el_a, el_b, gap, "horizontal", findings, run_id)
            elif are_vertically_adjacent(el_a, el_b):
                gap = vertical_gap(el_a, el_b)
                _check_gap(el_a, el_b, gap, "vertical", findings, run_id)

    return findings[:10]  # Cap to avoid noise


def _check_gap(el_a, el_b, gap, direction, findings, run_id):
    if gap < MIN_TOUCH_GAP and gap > 0:
        findings.append(Finding(
            finding_id=f"SPACING_TIGHT_{el_a.id}_{el_b.id}",
            run_id=run_id,
            principle="Spacing",
            severity=Severity.high,
            location=FindingLocation(
                description=f"Gap between {el_a.semantic_role or el_a.type or 'element'} and {el_b.semantic_role or el_b.type or 'element'}",
                element_id=el_a.id,
                bbox=el_a.bbox,
            ),
            evidence=EvidenceDetail(
                measured_value=f"{gap:.0f}px {direction} gap",
                required_value=f"{MIN_TOUCH_GAP}px minimum",
                gap_px=gap,
                minimum_px=MIN_TOUCH_GAP,
                measurement_method="pixel_gap_measurement",
            ),
            recommendation=Recommendation(
                action="Increase spacing between adjacent elements",
                current_css=f"gap: {gap:.0f}px;",
                suggested_css=f"gap: {find_nearest_scale(max(gap, MIN_TOUCH_GAP))}px;",
                result="Elements meet minimum touch/read separation",
            ),
            confidence=93,
        ))
    elif gap > 0 and not any(abs(gap - s) <= GRID_TOLERANCE for s in SPACING_SCALE):
        nearest = find_nearest_scale(gap)
        findings.append(Finding(
            finding_id=f"SPACING_OFFGRID_{el_a.id}_{el_b.id}",
            run_id=run_id,
            principle="Spacing",
            severity=Severity.medium,
            location=FindingLocation(
                description=f"Off-grid spacing between elements",
                element_id=el_a.id,
                bbox=el_a.bbox,
            ),
            evidence=EvidenceDetail(
                measured_value=f"{gap:.0f}px",
                required_value=f"Nearest grid value: {nearest}px",
                gap_px=gap,
                nearest_grid=nearest,
                measurement_method="grid_alignment_check",
            ),
            recommendation=Recommendation(
                action="Align spacing to the 4px grid system",
                current_css=f"margin: {gap:.0f}px;",
                suggested_css=f"margin: {nearest}px;",
                result="Consistent spacing rhythm with design system",
            ),
            confidence=88,
        ))
