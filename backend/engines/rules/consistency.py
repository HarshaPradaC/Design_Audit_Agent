"""Consistency analysis — detect design system violations via color/radius clustering."""
import statistics
from collections import Counter
from schemas import Finding, Severity, UIElement, EvidenceDetail, FindingLocation, Recommendation

COLOR_SIMILARITY_THRESHOLD = 30  # RGB distance — colors within this are "same family"
RADIUS_TOLERANCE = 2             # px — border radii within 2px are same system


def rgb_distance(hex1: str, hex2: str) -> float:
    def to_rgb(h):
        h = h.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    try:
        r1, g1, b1 = to_rgb(hex1)
        r2, g2, b2 = to_rgb(hex2)
        return ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) ** 0.5
    except Exception:
        return 999.0


def find_color_clusters(colors: list[str]) -> list[list[str]]:
    if not colors:
        return []
    clusters: list[list[str]] = []
    for color in colors:
        placed = False
        for cluster in clusters:
            if rgb_distance(color, cluster[0]) <= COLOR_SIMILARITY_THRESHOLD:
                cluster.append(color)
                placed = True
                break
        if not placed:
            clusters.append([color])
    return sorted(clusters, key=len, reverse=True)


def dominant_color_family(clusters: list[list[str]]) -> list[str]:
    if not clusters:
        return []
    return clusters[0]


def analyze_consistency(elements: list[UIElement], run_id: str = "") -> list[Finding]:
    findings = []

    # Collect background colors from interactive elements
    bg_colors = [
        el.colors.background for el in elements
        if el.colors.background and el.type in ("button", "card", "badge", "input")
    ]

    if len(bg_colors) >= 3:
        clusters = find_color_clusters(bg_colors)
        dominant = dominant_color_family(clusters)

        # Elements that don't fit any cluster
        for el in elements:
            if not el.colors.background or el.type not in ("button", "card", "badge", "input"):
                continue
            in_any_cluster = any(
                rgb_distance(el.colors.background, c) <= COLOR_SIMILARITY_THRESHOLD
                for c in (dominant if dominant else [])
            )
            is_isolated = all(
                len(cluster) == 1
                for cluster in clusters
                if el.colors.background in cluster
            )
            if is_isolated and len(clusters) > 1:
                nearest_system_color = dominant[0] if dominant else el.colors.background
                findings.append(Finding(
                    finding_id=f"CONSISTENCY_COLOR_{el.id}",
                    run_id=run_id,
                    principle="Consistency",
                    severity=Severity.low,
                    location=FindingLocation(
                        description=f"{el.type} uses a color outside the design system palette",
                        element_id=el.id,
                        bbox=el.bbox,
                    ),
                    evidence=EvidenceDetail(
                        measured_value=f"Color: {el.colors.background}",
                        required_value=f"System palette color (e.g. {nearest_system_color})",
                        background_color=el.colors.background,
                        measurement_method="color_cluster_analysis",
                    ),
                    recommendation=Recommendation(
                        action="Use a color from the established design system palette",
                        current_css=f"background-color: {el.colors.background};",
                        suggested_css=f"background-color: {nearest_system_color};",
                        result="Consistent color usage across UI components",
                    ),
                    confidence=79,
                ))

    # Check border radius consistency
    radii = [
        el.border_radius_px for el in elements
        if el.border_radius_px is not None and el.type in ("button", "card", "input", "badge")
    ]

    if len(radii) >= 3:
        counter = Counter(radii)
        dominant_radius = counter.most_common(1)[0][0]
        for el in elements:
            if el.border_radius_px is None or el.type not in ("button", "card", "input", "badge"):
                continue
            if abs(el.border_radius_px - dominant_radius) > RADIUS_TOLERANCE:
                findings.append(Finding(
                    finding_id=f"CONSISTENCY_RADIUS_{el.id}",
                    run_id=run_id,
                    principle="Consistency",
                    severity=Severity.low,
                    location=FindingLocation(
                        description=f"{el.type} border radius deviates from system",
                        element_id=el.id,
                        bbox=el.bbox,
                    ),
                    evidence=EvidenceDetail(
                        measured_value=f"border-radius: {el.border_radius_px}px",
                        required_value=f"System radius: {dominant_radius}px",
                        measurement_method="border_radius_mode_detection",
                        extra={"element_radius": el.border_radius_px, "system_radius": dominant_radius},
                    ),
                    recommendation=Recommendation(
                        action="Standardize border radius to design system value",
                        current_css=f"border-radius: {el.border_radius_px}px;",
                        suggested_css=f"border-radius: {dominant_radius}px;",
                        result="Consistent corner radius across all components",
                    ),
                    confidence=82,
                ))

    return findings[:6]
