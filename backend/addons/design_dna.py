"""Design DNA fingerprinter — extract the implicit design system from any screenshot."""
import statistics
from collections import Counter
from sklearn.cluster import KMeans
import numpy as np
from schemas import UIState, DesignDNA


def _hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _cluster_colors(hex_colors: list[str], n_clusters: int = 4) -> list[str]:
    if len(hex_colors) < n_clusters:
        return list(set(hex_colors))
    try:
        rgb = np.array([_hex_to_rgb(c) for c in hex_colors], dtype=float)
        k = min(n_clusters, len(hex_colors))
        km = KMeans(n_clusters=k, n_init=5, random_state=42)
        km.fit(rgb)
        centers = km.cluster_centers_
        result = []
        for center in centers:
            r, g, b = int(center[0]), int(center[1]), int(center[2])
            result.append(f"#{r:02x}{g:02x}{b:02x}")
        return result
    except Exception:
        return list(set(hex_colors))[:n_clusters]


def _find_spacing_scale(gaps: list[float]) -> list[int]:
    if not gaps:
        return [4, 8, 16, 24, 32]
    # Round to nearest 4 and count
    rounded = [round(g / 4) * 4 for g in gaps if 2 < g < 200]
    if not rounded:
        return [4, 8, 16, 24, 32]
    counter = Counter(rounded)
    scale = sorted([v for v, c in counter.items() if c >= 1])
    return scale[:8] or [4, 8, 16, 24, 32]


def _find_type_scale(font_sizes: list[float]) -> list[float]:
    if not font_sizes:
        return [12, 14, 16, 20, 24, 32]
    rounded = [round(s) for s in font_sizes if 8 < s < 96]
    counter = Counter(rounded)
    return sorted(set([v for v, _ in counter.most_common(8)]))


def _find_radius_scale(radii: list[int]) -> list[int]:
    if not radii:
        return []
    counter = Counter(radii)
    return sorted([v for v, c in counter.most_common(5) if v > 0])


def extract_design_dna(ui_state: UIState) -> DesignDNA:
    elements = ui_state.elements

    # Collect colors
    bg_colors = [e.colors.background for e in elements if e.colors.background]
    text_colors = [e.colors.text for e in elements if e.colors.text]
    all_colors = bg_colors + text_colors

    primary_colors = []
    neutral_colors = []

    if all_colors:
        clustered = _cluster_colors(all_colors, n_clusters=6)
        for c in clustered:
            r, g, b = _hex_to_rgb(c)
            # Colorful = primary, gray-ish = neutral
            saturation = max(r, g, b) - min(r, g, b)
            if saturation > 40:
                primary_colors.append(c)
            else:
                neutral_colors.append(c)

    # Spacing scale from inter-element gaps
    gaps = []
    for i, a in enumerate(elements):
        for b in elements[i + 1:]:
            h_gap = max(0, b.bbox.x - (a.bbox.x + a.bbox.width))
            v_gap = max(0, b.bbox.y - (a.bbox.y + a.bbox.height))
            if 0 < h_gap < 200:
                gaps.append(h_gap)
            if 0 < v_gap < 200:
                gaps.append(v_gap)

    spacing_scale = _find_spacing_scale(gaps[:200])

    # Type scale
    font_sizes = [e.font.size_px for e in elements if e.font.size_px]
    type_scale = _find_type_scale(font_sizes)

    # Border radius scale
    radii = [e.border_radius_px for e in elements if e.border_radius_px is not None]
    radius_scale = _find_radius_scale(radii)

    return DesignDNA(
        primary_colors=primary_colors[:4],
        neutral_colors=neutral_colors[:4],
        spacing_scale=spacing_scale,
        type_scale_px=type_scale,
        border_radius_px=radius_scale,
        shadow_style="unknown",
    )
