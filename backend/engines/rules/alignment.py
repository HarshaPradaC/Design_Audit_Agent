"""Alignment analysis — detect elements that break the visual grid."""
import statistics
from schemas import Finding, Severity, UIElement, EvidenceDetail, FindingLocation, Recommendation

ALIGNMENT_TOLERANCE = 6  # px — elements within 6px of a column are "aligned"
MIN_CLUSTER_SIZE = 2     # need at least 2 elements to define a column


def cluster_values(values: list[int], tolerance: int = ALIGNMENT_TOLERANCE) -> list[list[int]]:
    if not values:
        return []
    sorted_vals = sorted(set(values))
    clusters = [[sorted_vals[0]]]
    for v in sorted_vals[1:]:
        if v - clusters[-1][-1] <= tolerance:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return clusters


def find_dominant_columns(elements: list[UIElement]) -> list[float]:
    left_edges = [el.bbox.x for el in elements]
    clusters = cluster_values(left_edges)
    dominant = [statistics.mean(c) for c in clusters if len(c) >= MIN_CLUSTER_SIZE]
    return dominant


def find_nearest_column(x: int, columns: list[float]) -> float:
    if not columns:
        return x
    return min(columns, key=lambda c: abs(c - x))


def analyze_alignment(elements: list[UIElement], run_id: str = "") -> list[Finding]:
    if len(elements) < 3:
        return []

    dominant_cols = find_dominant_columns(elements)
    if not dominant_cols:
        return []

    findings = []
    for el in elements:
        nearest = find_nearest_column(el.bbox.x, dominant_cols)
        deviation = abs(el.bbox.x - nearest)
        if deviation > ALIGNMENT_TOLERANCE:
            findings.append(Finding(
                finding_id=f"ALIGN_{el.id}",
                run_id=run_id,
                principle="Alignment",
                severity=Severity.medium,
                location=FindingLocation(
                    description=f"{el.type or 'element'} misaligned from visual grid",
                    element_id=el.id,
                    bbox=el.bbox,
                ),
                evidence=EvidenceDetail(
                    measured_value=f"x={el.bbox.x}px",
                    required_value=f"nearest column at x={nearest:.0f}px",
                    element_x=el.bbox.x,
                    nearest_column=nearest,
                    measurement_method="left_edge_cluster_analysis",
                ),
                recommendation=Recommendation(
                    action="Align element to the dominant layout column",
                    current_css=f"/* element left edge: {el.bbox.x}px */",
                    suggested_css=f"margin-left: {nearest:.0f}px; /* or adjust container */",
                    result=f"Aligns to column at {nearest:.0f}px — {deviation:.0f}px deviation corrected",
                ),
                confidence=90,
            ))

    return findings[:8]
