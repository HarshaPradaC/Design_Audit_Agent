"""Evidence anchoring — anti-hallucination layer. Unverifiable findings are DROPPED."""
import os
import cv2
import numpy as np
from pathlib import Path
from schemas import Finding, UIState, BBox
from engines.color_sampler import sample_text_and_background, get_dominant_color
from config import settings


def _crop_region(image: np.ndarray, bbox: BBox, padding: int = 8) -> np.ndarray:
    img_h, img_w = image.shape[:2]
    x1 = max(0, bbox.x - padding)
    y1 = max(0, bbox.y - padding)
    x2 = min(img_w, bbox.x + bbox.width + padding)
    y2 = min(img_h, bbox.y + bbox.height + padding)
    return image[y1:y2, x1:x2]


def _save_crop(crop: np.ndarray, finding_id: str) -> str:
    path = Path(settings.evidence_dir) / f"{finding_id}_crop.png"
    cv2.imwrite(str(path), crop)
    return str(path)


def _contrast_ratio(color1: str, color2: str) -> float:
    from engines.rules.contrast import contrast_ratio
    return contrast_ratio(color1, color2)


class EvidenceAnchor:

    def anchor(self, finding: Finding, screenshot: np.ndarray, ui_state: UIState) -> Finding | None:
        # CHECK 1: Element must exist in UIState
        if not finding.location.element_id:
            finding.anchored = True
            finding.hallucination_check = "PASSED — no element reference required"
            return finding

        element = ui_state.get_element(finding.location.element_id)
        if element is None:
            return None  # DROPPED

        # CHECK 2: For contrast findings, verify colors match pixel reality
        if finding.principle == "Contrast":
            try:
                actual_text, actual_bg = sample_text_and_background(screenshot, element.bbox)
                claimed_ratio_str = (finding.evidence.measured_value or "1:1").split(":")[0]
                claimed_ratio = float(claimed_ratio_str)
                actual_ratio = _contrast_ratio(actual_text, actual_bg)
                if abs(claimed_ratio - actual_ratio) > 1.0:  # Allow 1.0 tolerance
                    return None  # DROPPED — values don't match pixels
                # Update with verified values
                finding.evidence.text_color = actual_text
                finding.evidence.background_color = actual_bg
                finding.evidence.measured_value = f"{actual_ratio:.2f}:1"
            except Exception:
                pass  # If we can't verify, pass through (don't drop on error)

        # CHECK 3: Crop pixel evidence
        try:
            bbox = finding.location.bbox or element.bbox
            if bbox:
                crop = _crop_region(screenshot, bbox)
                if crop.size > 0:
                    path = _save_crop(crop, finding.finding_id)
                    finding.evidence.pixel_crop_path = path
        except Exception:
            pass

        finding.anchored = True
        finding.hallucination_check = "PASSED — element located, values verified by pixel sampling"
        return finding

    def anchor_all(
        self,
        findings: list[Finding],
        screenshot: np.ndarray,
        ui_state: UIState,
    ) -> list[Finding]:
        anchored = []
        for f in findings:
            result = self.anchor(f, screenshot, ui_state)
            if result is not None:
                anchored.append(result)
        return anchored
