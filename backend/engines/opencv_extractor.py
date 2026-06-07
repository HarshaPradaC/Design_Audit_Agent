"""OpenCV-based UI element extraction — deterministic bounding box detection."""
import cv2
import numpy as np
from schemas import BBox, UIElement, Colors
from engines.color_sampler import sample_text_and_background


MIN_ELEMENT_WIDTH = 20
MIN_ELEMENT_HEIGHT = 8
MAX_ELEMENTS = 60


def extract_elements_opencv(image_path: str) -> list[UIElement]:
    """
    Detect potential UI elements via edge detection + contour finding.
    Returns elements with bbox + sampled colors. No AI, no hallucinations.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    img_h, img_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Multi-scale edge detection to catch both sharp and soft boundaries
    edges_tight = cv2.Canny(gray, 50, 150)
    edges_loose = cv2.Canny(gray, 20, 80)
    edges = cv2.bitwise_or(edges_tight, edges_loose)

    # Dilate to close small gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, hierarchy = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    elements = []
    seen_rects = set()

    for i, cnt in enumerate(contours):
        x, y, w, h = cv2.boundingRect(cnt)

        # Filter tiny noise
        if w < MIN_ELEMENT_WIDTH or h < MIN_ELEMENT_HEIGHT:
            continue

        # Skip near-full-page rectangles (background)
        if w > img_w * 0.95 and h > img_h * 0.95:
            continue

        # Deduplicate near-identical rects
        rect_key = (x // 4, y // 4, w // 4, h // 4)
        if rect_key in seen_rects:
            continue
        seen_rects.add(rect_key)

        bbox = BBox(x=int(x), y=int(y), width=int(w), height=int(h))

        # Sample colors
        try:
            text_color, bg_color = sample_text_and_background(img, bbox)
        except Exception:
            text_color, bg_color = None, None

        # Estimate border radius from contour shape
        border_radius = _estimate_border_radius(cnt, w, h)

        element = UIElement(
            id=f"el_{i:04d}",
            bbox=bbox,
            colors=Colors(
                background=bg_color,
                text=text_color,
            ),
            border_radius_px=border_radius,
            source="opencv",
            extraction_confidence=85,
        )
        elements.append(element)

    # Sort by area descending, take top N
    elements.sort(key=lambda e: e.bbox.width * e.bbox.height, reverse=True)
    return elements[:MAX_ELEMENTS]


def _estimate_border_radius(contour, w: int, h: int) -> int:
    """Estimate if element has rounded corners (rough heuristic)."""
    perimeter = cv2.arcLength(contour, True)
    area = cv2.contourArea(contour)
    if area <= 0 or perimeter <= 0:
        return 0
    # Circularity: 1.0 = perfect circle, ~0.78 = rounded rect
    circularity = 4 * 3.14159 * area / (perimeter ** 2)
    if circularity > 0.85:
        return min(w, h) // 2  # Pill / circle
    elif circularity > 0.7:
        return 8
    elif circularity > 0.6:
        return 4
    return 0


def load_image_numpy(image_path: str) -> np.ndarray:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read: {image_path}")
    return img
