"""Dynamic content filter — mask timestamps, counters, spinners before pixel comparison."""
import re
import numpy as np
import cv2
from schemas import BBox

DYNAMIC_PATTERNS = [
    r'\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?',
    r'\d{4}-\d{2}-\d{2}',
    r'\d{1,2}/\d{1,2}/\d{2,4}',
    r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
    r'\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago',
    r'Session\s+ID:\s+\w+',
    r'\(\d+\)',  # notification counts like (12)
]

MASK_COLOR = 128  # neutral gray


class DynamicContentFilter:

    def __init__(self, extra_selectors: list[str] | None = None):
        self.extra_selectors = extra_selectors or []

    def auto_detect_dynamic_regions(
        self, img1: np.ndarray, img2: np.ndarray, threshold: int = 15
    ) -> list[BBox]:
        """Compare two rapid captures; regions that changed are dynamic."""
        if img1.shape != img2.shape:
            return []
        diff = np.abs(img1.astype(int) - img2.astype(int)).max(axis=2).astype(np.uint8)
        _, binary = cv2.threshold(diff, threshold, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dilated = cv2.dilate(binary, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        regions = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if w > 8 and h > 8:
                regions.append(BBox(x=x, y=y, width=w, height=h))
        return regions

    def apply_masks(self, screenshot: np.ndarray, masks: list[BBox]) -> np.ndarray:
        """Paint dynamic regions with neutral gray."""
        masked = screenshot.copy()
        for bbox in masks:
            x1 = max(0, bbox.x)
            y1 = max(0, bbox.y)
            x2 = min(screenshot.shape[1], bbox.x + bbox.width)
            y2 = min(screenshot.shape[0], bbox.y + bbox.height)
            masked[y1:y2, x1:x2] = MASK_COLOR
        return masked

    def filter_for_comparison(
        self,
        baseline: np.ndarray,
        current: np.ndarray,
        dynamic_regions: list[BBox] | None = None,
    ) -> tuple[np.ndarray, np.ndarray]:
        """Apply same masks to both images so dynamic areas don't skew diff."""
        regions = dynamic_regions or []
        b_masked = self.apply_masks(baseline, regions)
        c_masked = self.apply_masks(current, regions)
        return b_masked, c_masked

    def pixel_diff_score(self, img1: np.ndarray, img2: np.ndarray) -> float:
        """Return fraction of pixels that differ significantly (0.0 to 1.0)."""
        if img1.shape != img2.shape:
            return 1.0
        diff = np.abs(img1.astype(int) - img2.astype(int)).max(axis=2)
        changed = np.sum(diff > 20)
        total = diff.size
        return changed / total if total > 0 else 0.0
